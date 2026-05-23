"""
vc/sd_jwt.py — SD-JWT VC issuance and verification wrapper.

Built on top of the official `sd-jwt` IETF library
(https://github.com/openwallet-foundation-labs/sd-jwt-python).

This module is the bridge between our raw issuer keypair (from crypto/keys.py)
and the SD-JWT VC protocol used in EUDI Wallet.

Selective Disclosure flow:
  1. Issuer signs a credential with ALL attributes marked as disclosable.
  2. Holder (wallet) stores the full SD-JWT (JWT + all disclosures).
  3. At presentation, holder filters disclosures — only chosen ones leave the wallet.
  4. Verifier hashes received disclosures and checks against `_sd` array in JWT.
     Verifier proves nothing about non-disclosed attributes.
"""
from __future__ import annotations

import time
from typing import Any

from cryptography.hazmat.primitives import serialization
from jwcrypto.jwk import JWK
from sd_jwt.common import SDObj
from sd_jwt.holder import SDJWTHolder
from sd_jwt.issuer import SDJWTIssuer
from sd_jwt.verifier import SDJWTVerifier

from ..crypto.keys import (
    ISSUER_ALG,
    get_issuer_kid,
    get_issuer_private_key,
    get_issuer_public_key,
)

# Issuer identity (also appears as `iss` claim in JWT)
ISSUER_URL = "https://actid.gov.ro"

# Claims that are always visible (NEVER selectively disclosed)
_FRAMING_CLAIMS = {"iss", "sub", "iat", "exp", "vct", "_sd_alg", "_sd", "cnf"}


# ─── JWK conversion (internal) ─────────────────────────────────────────────
def _to_jwk_private() -> JWK:
    pem = get_issuer_private_key().private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    jwk = JWK.from_pem(pem)
    jwk["kid"] = get_issuer_kid()
    return jwk


def _to_jwk_public() -> JWK:
    pem = get_issuer_public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    jwk = JWK.from_pem(pem)
    jwk["kid"] = get_issuer_kid()
    return jwk


# ─── Public API ────────────────────────────────────────────────────────────
def sign_credential(
    vct: str,
    subject_id: str,
    attributes: dict[str, Any],
    lifetime_days: int = 365,
) -> str:
    """
    Issuer signs a VC as SD-JWT. All `attributes` become selectively disclosable.

    Args:
        vct: Verifiable Credential Type (e.g. "RomanianID")
        subject_id: User identifier (becomes `sub` claim)
        attributes: dict of attribute_name → value; ALL marked as disclosable
        lifetime_days: validity period in days

    Returns:
        SD-JWT issuance string: <jwt>~<disclosure1>~<disclosure2>~...
    """
    now = int(time.time())
    claims: dict[Any, Any] = {
        "iss": ISSUER_URL,
        "sub": subject_id,
        "iat": now,
        "exp": now + (lifetime_days * 86400),
        "vct": vct,
    }
    for key, value in attributes.items():
        claims[SDObj(key)] = value

    issuer = SDJWTIssuer(
        user_claims=claims,
        issuer_key=_to_jwk_private(),
        sign_alg=ISSUER_ALG,
        extra_header_parameters={"kid": get_issuer_kid()},
    )
    return issuer.sd_jwt_issuance


def create_presentation(
    sd_jwt_issuance: str,
    disclosed_attributes: list[str],
) -> str:
    """
    Holder filters the SD-JWT, releasing only chosen attributes.

    Args:
        sd_jwt_issuance: Full SD-JWT from `sign_credential()`
        disclosed_attributes: attribute names to reveal, e.g. ["given_name", "birth_date"]

    Returns:
        SD-JWT presentation string (JWT + only the chosen disclosures)
    """
    holder = SDJWTHolder(sd_jwt_issuance)
    claims_to_disclose = {attr: True for attr in disclosed_attributes}
    holder.create_presentation(
        claims_to_disclose=claims_to_disclose,
        nonce=None,
        aud=None,
        holder_key=None,  # No key-binding in MVP
    )
    return holder.sd_jwt_presentation


def verify_presentation(
    presentation: str,
    trusted_jwks: list[dict] | None = None,
) -> dict:
    """
    Verifier validates SD-JWT presentation and returns disclosed attributes.

    Args:
        presentation: SD-JWT presentation string
        trusted_jwks: List of trusted issuer JWK dicts. If None, defaults to
                      our own issuer key (single-issuer demo mode).

    Returns:
        {
            "valid": bool,
            "issuer_id": str | None,      # value of `iss` claim
            "vct": str | None,
            "subject_id": str | None,     # value of `sub` claim
            "disclosed_attributes": dict[str, Any],
            "errors": list[str],
        }
    """
    if trusted_jwks is None:
        lookup_by_iss = {ISSUER_URL: _to_jwk_public()}
        lookup_by_kid = {get_issuer_kid(): _to_jwk_public()}
    else:
        lookup_by_iss = {}
        lookup_by_kid = {}
        for jwk_dict in trusted_jwks:
            jwk = JWK(**jwk_dict)
            if "kid" in jwk_dict:
                lookup_by_kid[jwk_dict["kid"]] = jwk

    def get_key(issuer_iss: str, header: dict) -> JWK:
        if issuer_iss in lookup_by_iss:
            return lookup_by_iss[issuer_iss]
        kid = header.get("kid")
        if kid in lookup_by_kid:
            return lookup_by_kid[kid]
        raise ValueError(f"Unknown issuer (iss={issuer_iss}, kid={kid})")

    try:
        verifier = SDJWTVerifier(presentation, cb_get_issuer_key=get_key)
        payload = verifier.get_verified_payload()
    except Exception as exc:
        return {
            "valid": False,
            "issuer_id": None,
            "vct": None,
            "subject_id": None,
            "disclosed_attributes": {},
            "errors": [str(exc)],
        }

    disclosed = {k: v for k, v in payload.items() if k not in _FRAMING_CLAIMS}
    return {
        "valid": True,
        "issuer_id": payload.get("iss"),
        "vct": payload.get("vct"),
        "subject_id": payload.get("sub"),
        "disclosed_attributes": disclosed,
        "errors": [],
    }
