"""
Encryption-at-rest pentru câmpuri sensibile (CNP, poze documente).

Folosește AES-256-GCM cu o cheie de 32 bytes derivată cu HKDF-SHA256 din
settings.SECRET_KEY. Fiecare encrypt() generează un nonce random nou.

⚠️  PRODUCTION NOTE
   1. SECRET_KEY trebuie să vină din vault (HashiCorp Vault, AWS Secrets Manager),
      NU din fișier .env în clar.
   2. Rotație: la schimbarea cheii, re-criptează toate rândurile (logică separată).
   3. Pentru date la-rest mai sensibile (PID complet), considerăm field-level
      encryption pe HSM (cheia de DEK derivată per-user).
   În acest MVP: AES-256-GCM cu cheie statică derivată din SECRET_KEY.

Format ciphertext stocat în DB:
    'enc_v1:' + base64url(nonce || ciphertext_with_gcm_tag)

Backward compatibility:
    decrypt() acceptă orice string. Dacă NU începe cu 'enc_v1:', îl returnează
    as-is — datele vechi (înainte de encryption) continuă să meargă.
"""
from __future__ import annotations

import base64
import os
from functools import lru_cache

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from ..config import settings

_PREFIX = "enc_v1:"
_HKDF_SALT = b"actid-eudi-vault-v1"
_HKDF_INFO = b"actid-field-encryption"
_KEY_LEN = 32   # 256 bits — AES-256
_NONCE_LEN = 12  # 96 bits — GCM standard


@lru_cache(maxsize=1)
def _vault_key() -> bytes:
    """Derivă cheia AES-256 din SECRET_KEY. Cached — derivă o singură dată."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=_KEY_LEN,
        salt=_HKDF_SALT,
        info=_HKDF_INFO,
    )
    return hkdf.derive(settings.SECRET_KEY.encode("utf-8"))


def encrypt(plaintext: str | None) -> str | None:
    """Encrypt a string with AES-256-GCM. Returns 'enc_v1:<b64url>'. None → None."""
    if plaintext is None:
        return None
    if not isinstance(plaintext, str):
        raise TypeError(f"encrypt expects str or None, got {type(plaintext).__name__}")

    aesgcm = AESGCM(_vault_key())
    nonce = os.urandom(_NONCE_LEN)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)
    payload = base64.urlsafe_b64encode(nonce + ct).rstrip(b"=").decode("ascii")
    return _PREFIX + payload


def decrypt(ciphertext: str | None) -> str | None:
    """
    Decrypt a value produced by encrypt().

    Backward-compatible: if `ciphertext` does NOT start with 'enc_v1:', returns it
    unchanged (handles legacy plain values from DB created before encryption).
    """
    if ciphertext is None:
        return None
    if not isinstance(ciphertext, str):
        raise TypeError(f"decrypt expects str or None, got {type(ciphertext).__name__}")
    if not ciphertext.startswith(_PREFIX):
        return ciphertext  # legacy plain value

    payload_b64 = ciphertext[len(_PREFIX):]
    pad = "=" * (-len(payload_b64) % 4)
    raw = base64.urlsafe_b64decode(payload_b64 + pad)
    if len(raw) < _NONCE_LEN + 16:  # 16 = GCM tag size minimum
        raise ValueError("Ciphertext too short — corrupt or tampered")

    nonce, ct = raw[:_NONCE_LEN], raw[_NONCE_LEN:]
    aesgcm = AESGCM(_vault_key())
    plaintext_bytes = aesgcm.decrypt(nonce, ct, associated_data=None)  # raises InvalidTag if tampered
    return plaintext_bytes.decode("utf-8")


def is_encrypted(value: str | None) -> bool:
    """Helper: True if the value appears to be vault-encrypted."""
    return isinstance(value, str) and value.startswith(_PREFIX)
