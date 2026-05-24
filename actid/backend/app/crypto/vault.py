"""
Encryption-at-rest pentru câmpuri sensibile din documente.

Folosește AES-256-GCM cu HKDF-SHA256.

DOUĂ moduri de criptare:
─────────────────────────────────────────────────────────────────────────
  enc_v1:<b64>   — Cheie GLOBALĂ derivată din SECRET_KEY (legacy)
                   Folosită înainte. Toți userii au aceeași cheie.

  enc_v2:<b64>   — Cheie PER-USER derivată din SECRET_KEY + user_id
                   Folosită ACUM pentru toate emisiunile noi.
                   Fiecare user are propria cheie unică în memorie.
                   Dacă cineva fură DB-ul, ciphertext-urile a doi useri
                   diferiți NU se pot deschide cu aceeași cheie.

Backward-compat:
  decrypt() detectează automat prefixul. enc_v1 nu necesită user_id.
  enc_v2 necesită user_id (raises ValueError dacă lipsește).
  String fără prefix → returnat as-is (legacy plain).

⚠️  PRODUCTION NOTE
   1. SECRET_KEY trebuie din HSM/KMS, nu din .env în clar.
   2. Per-user keys derivate la runtime — server-ul are acces la toate.
      Pentru E2E pură, ar trebui keypair generat client-side (WebCrypto).
   3. Rotația cheilor implică re-criptare bulk — afară din scope MVP.
"""
from __future__ import annotations

import base64
import os
from functools import lru_cache

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from ..config import settings

# ─── Prefixes for format detection ──────────────────────────────────────────
_V1_PREFIX = "enc_v1:"  # global key (legacy)
_V2_PREFIX = "enc_v2:"  # per-user key (current)

# ─── HKDF parameters ────────────────────────────────────────────────────────
_V1_SALT = b"actid-eudi-vault-v1"
_V1_INFO = b"actid-field-encryption"

_V2_SALT = b"actid-eudi-vault-v2"
_V2_INFO_PREFIX = b"actid-user-"  # appended with user_id

_KEY_LEN = 32   # 256 bits — AES-256
_NONCE_LEN = 12  # 96 bits — GCM standard
_TAG_LEN = 16   # GCM auth tag


# ─── Key derivation ─────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def _global_vault_key() -> bytes:
    """Cheia globală v1 — derivată o singură dată din SECRET_KEY."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=_KEY_LEN,
        salt=_V1_SALT,
        info=_V1_INFO,
    )
    return hkdf.derive(settings.SECRET_KEY.encode("utf-8"))


@lru_cache(maxsize=512)
def _user_vault_key(user_id: str) -> bytes:
    """
    Cheia per-user v2 — derivată din SECRET_KEY + user_id cu HKDF.
    Cache la 512 useri (LRU eviction). Securitate: două ID-uri diferite
    produc două chei DIFERITE și unliklike to collide (HKDF-SHA256).
    """
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("user_id must be a non-empty string")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=_KEY_LEN,
        salt=_V2_SALT,
        info=_V2_INFO_PREFIX + user_id.encode("utf-8"),
    )
    return hkdf.derive(settings.SECRET_KEY.encode("utf-8"))


# ─── Public API ─────────────────────────────────────────────────────────────
def encrypt(plaintext: str | None, user_id: str | None = None) -> str | None:
    """
    Encrypt string with AES-256-GCM.

    - user_id provided   → enc_v2 (per-user key, RECOMMENDED)
    - user_id is None    → enc_v1 (global key, legacy, doar pentru migrare)
    - plaintext is None  → None
    """
    if plaintext is None:
        return None
    if not isinstance(plaintext, str):
        raise TypeError(f"encrypt expects str or None, got {type(plaintext).__name__}")

    if user_id is not None:
        key = _user_vault_key(user_id)
        prefix = _V2_PREFIX
    else:
        key = _global_vault_key()
        prefix = _V1_PREFIX

    aesgcm = AESGCM(key)
    nonce = os.urandom(_NONCE_LEN)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)
    payload = base64.urlsafe_b64encode(nonce + ct).rstrip(b"=").decode("ascii")
    return prefix + payload


def decrypt(ciphertext: str | None, user_id: str | None = None) -> str | None:
    """
    Decrypt value produced by encrypt().

    Auto-detects format:
      - enc_v2:... → necesită user_id (raises ValueError dacă lipsește)
      - enc_v1:... → ignoră user_id, folosește cheia globală
      - alt format → returnat as-is (legacy plain pre-encryption)
      - None       → None
    """
    if ciphertext is None:
        return None
    if not isinstance(ciphertext, str):
        raise TypeError(f"decrypt expects str or None, got {type(ciphertext).__name__}")

    if ciphertext.startswith(_V2_PREFIX):
        if user_id is None:
            raise ValueError("enc_v2 ciphertext requires user_id for decryption")
        key = _user_vault_key(user_id)
        payload_b64 = ciphertext[len(_V2_PREFIX):]
    elif ciphertext.startswith(_V1_PREFIX):
        key = _global_vault_key()
        payload_b64 = ciphertext[len(_V1_PREFIX):]
    else:
        return ciphertext  # legacy plain (or unknown format — pass through)

    pad = "=" * (-len(payload_b64) % 4)
    raw = base64.urlsafe_b64decode(payload_b64 + pad)
    if len(raw) < _NONCE_LEN + _TAG_LEN:
        raise ValueError("Ciphertext too short — corrupt or tampered")

    nonce, ct = raw[:_NONCE_LEN], raw[_NONCE_LEN:]
    aesgcm = AESGCM(key)
    plaintext_bytes = aesgcm.decrypt(nonce, ct, associated_data=None)  # raises InvalidTag if tampered
    return plaintext_bytes.decode("utf-8")


def encryption_version(value: str | None) -> str | None:
    """Returnează 'v1' / 'v2' / 'plain' / None pentru o valoare dată."""
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    if value.startswith(_V2_PREFIX):
        return "v2"
    if value.startswith(_V1_PREFIX):
        return "v1"
    return "plain"


def is_encrypted(value: str | None) -> bool:
    """True dacă valoarea este criptată vault (v1 sau v2)."""
    return isinstance(value, str) and (
        value.startswith(_V1_PREFIX) or value.startswith(_V2_PREFIX)
    )
