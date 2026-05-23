"""
SD-JWT VC — Sign + verify helpers.

MOCK IMPLEMENTATION — owned by Andrei (eudi/mvp-andrei). Replaces a real
P-256 / ES256 + sd-jwt library implementation once that lands. The shape of
the public API (sign_sd_jwt / verify_sd_jwt) is fixed by API_CONTRACT.md §2.1
and must not change.

Until Andrei merges the real crypto:
  * sign_sd_jwt() emits a deterministic, well-formed string with base64url
    disclosures so the verifier path can be tested end-to-end.
  * verify_sd_jwt() decodes the same format and returns the disclosed
    attributes. Signature check is stubbed (always considered valid for
    issuers present in the trust registry).
"""
import base64
import hashlib
import json
import secrets
import time
from typing import Any

ISSUER_ID = "actid-issuer-001"
ISSUER_URL = "https://actid.gov.ro"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _hash_disclosure(disclosure_b64: str) -> str:
    return _b64url(hashlib.sha256(disclosure_b64.encode("ascii")).digest())


def _make_disclosure(claim_name: str, claim_value: Any) -> str:
    salt = _b64url(secrets.token_bytes(16))
    arr = [salt, claim_name, claim_value]
    return _b64url(json.dumps(arr, separators=(",", ":")).encode("utf-8"))


def sign_sd_jwt(vct: str, subject_id: str, attributes: dict[str, Any]) -> str:
    """
    Build a SD-JWT in compact form:
        <header>.<payload>.<sig>~<disclosure1>~<disclosure2>~...

    Returns the full string. All attributes become disclosures (selective
    disclosure happens at presentation time by dropping disclosures).
    """
    header = {"alg": "ES256", "typ": "vc+sd-jwt", "kid": ISSUER_ID}

    disclosures = [_make_disclosure(name, value) for name, value in attributes.items()]
    sd_hashes = [_hash_disclosure(d) for d in disclosures]

    now = int(time.time())
    payload = {
        "iss": ISSUER_URL,
        "sub": subject_id,
        "iat": now,
        "exp": now + 365 * 24 * 3600,
        "vct": vct,
        "_sd_alg": "sha-256",
        "_sd": sd_hashes,
    }

    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature_b64 = _b64url(b"MOCK_SIGNATURE_REPLACE_WITH_ES256")

    jwt_part = f"{header_b64}.{payload_b64}.{signature_b64}"
    return "~".join([jwt_part, *disclosures]) + ("~" if disclosures else "")


def filter_disclosures(sd_jwt: str, keep_claims: list[str]) -> str:
    """
    Drop disclosures whose claim_name is not in keep_claims. Used at
    presentation time so only requested attributes are revealed.
    """
    parts = sd_jwt.rstrip("~").split("~")
    jwt_part, raw_disclosures = parts[0], parts[1:]

    kept: list[str] = []
    for d in raw_disclosures:
        try:
            arr = json.loads(_b64url_decode(d))
            _, claim_name, _ = arr
            if claim_name in keep_claims:
                kept.append(d)
        except Exception:
            continue

    return "~".join([jwt_part, *kept]) + ("~" if kept else "")


def verify_sd_jwt(sd_jwt: str, trusted_issuer_jwks: list[dict]) -> dict:
    """
    Verify a SD-JWT. MOCK: signature check is stubbed — issuer trust is
    delegated to the registry passed in (kid must appear in jwks list).

    Returns:
      {
        "valid": bool,
        "issuer_id": str,
        "vct": str,
        "subject_id": str,
        "disclosed_attributes": dict[str, Any],
        "errors": list[str],
      }
    """
    errors: list[str] = []
    result = {
        "valid": False,
        "issuer_id": "",
        "vct": "",
        "subject_id": "",
        "disclosed_attributes": {},
        "errors": errors,
    }

    try:
        parts = sd_jwt.rstrip("~").split("~")
        jwt_part, disclosures = parts[0], parts[1:]

        header_b64, payload_b64, _signature_b64 = jwt_part.split(".")
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception as e:
        errors.append(f"SD-JWT malformat: {e}")
        return result

    kid = header.get("kid", "")
    result["issuer_id"] = kid
    result["vct"] = payload.get("vct", "")
    result["subject_id"] = payload.get("sub", "")

    trusted_kids = {jwk.get("kid") for jwk in trusted_issuer_jwks}
    if kid not in trusted_kids:
        errors.append(f"Issuer '{kid}' nu este în registry-ul de încredere")
        return result

    # Stubbed signature check — real impl uses ES256 + JWK
    # if not _verify_es256(jwt_part, jwk): errors.append("Semnătură invalidă"); return result

    if int(payload.get("exp", 0)) < int(time.time()):
        errors.append("Credențial expirat")
        return result

    expected_hashes = set(payload.get("_sd", []))
    disclosed_attrs: dict[str, Any] = {}
    for d in disclosures:
        if _hash_disclosure(d) not in expected_hashes:
            errors.append("Disclosure cu hash necunoscut — posibilă manipulare")
            return result
        try:
            arr = json.loads(_b64url_decode(d))
            _salt, claim_name, claim_value = arr
            disclosed_attrs[claim_name] = claim_value
        except Exception as e:
            errors.append(f"Disclosure invalid: {e}")
            return result

    result["disclosed_attributes"] = disclosed_attrs
    result["valid"] = True
    return result
