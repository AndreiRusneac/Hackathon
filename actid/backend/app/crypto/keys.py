"""
Issuer keypair management — generează și expune cheia care semnează SD-JWT VCs.

⚠️  PRODUCTION NOTE
   În producție, cheia privată trebuie:
   1. Stocată într-un HSM/KMS (AWS KMS, GCP KMS, Azure Key Vault, hardware HSM)
   2. SAU criptată la rest cu o passphrase din vault
   3. Cu rotație periodică (90 zile recomandare)
   În acest MVP de hackathon: cheia stă în PEM cu permisiuni 0600.
   E ACCEPTABIL pentru demo, NU pentru producție reală.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ec import (
    EllipticCurvePrivateKey,
    EllipticCurvePublicKey,
)

# ─── Constants ─────────────────────────────────────────────────────────────
_KEYS_DIR = Path(__file__).resolve().parent.parent / "keys"
_PRIVATE_KEY_PATH = _KEYS_DIR / "issuer_private.pem"
_PUBLIC_KEY_PATH = _KEYS_DIR / "issuer_public.pem"
_METADATA_PATH = _KEYS_DIR / "issuer_metadata.json"

ISSUER_KID = "actid-issuer-001"
ISSUER_ALG = "ES256"
ISSUER_CURVE = ec.SECP256R1()


# ─── Public API ────────────────────────────────────────────────────────────
def ensure_issuer_keys() -> None:
    """Idempotent. Generates issuer keypair on first call, no-op afterwards."""
    if _PRIVATE_KEY_PATH.exists() and _PUBLIC_KEY_PATH.exists():
        return
    _KEYS_DIR.mkdir(parents=True, exist_ok=True)
    private_key = ec.generate_private_key(ISSUER_CURVE)
    public_key = private_key.public_key()
    _save_private_key(private_key)
    _save_public_key(public_key)
    _save_metadata(public_key)


def get_issuer_private_key() -> EllipticCurvePrivateKey:
    """Load and return the issuer's private signing key."""
    with open(_PRIVATE_KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)  # type: ignore[return-value]


def get_issuer_public_key() -> EllipticCurvePublicKey:
    """Load and return the issuer's public verification key."""
    with open(_PUBLIC_KEY_PATH, "rb") as f:
        return serialization.load_pem_public_key(f.read())  # type: ignore[return-value]


def get_issuer_public_jwk() -> dict:
    """Return public key as a JWK dict (for trust registry, security page)."""
    public_key = get_issuer_public_key()
    return _public_key_to_jwk(public_key)


def get_issuer_kid() -> str:
    return ISSUER_KID


def get_issuer_fingerprint() -> str:
    """SHA-256 fingerprint of the public key DER bytes. For human display."""
    public_key = get_issuer_public_key()
    der = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    digest = hashlib.sha256(der).hexdigest()
    return f"SHA256:{digest}"


# ─── Internals ─────────────────────────────────────────────────────────────
def _save_private_key(key: EllipticCurvePrivateKey) -> None:
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    _PRIVATE_KEY_PATH.write_bytes(pem)
    os.chmod(_PRIVATE_KEY_PATH, 0o600)


def _save_public_key(key: EllipticCurvePublicKey) -> None:
    pem = key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    _PUBLIC_KEY_PATH.write_bytes(pem)


def _save_metadata(public_key: EllipticCurvePublicKey) -> None:
    meta = {
        "kid": ISSUER_KID,
        "alg": ISSUER_ALG,
        "curve": "P-256",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "jwk": _public_key_to_jwk(public_key),
    }
    _METADATA_PATH.write_text(json.dumps(meta, indent=2))


def _public_key_to_jwk(public_key: EllipticCurvePublicKey) -> dict:
    numbers = public_key.public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": _b64url(numbers.x.to_bytes(32, "big")),
        "y": _b64url(numbers.y.to_bytes(32, "big")),
        "kid": ISSUER_KID,
        "alg": ISSUER_ALG,
        "use": "sig",
    }


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")
