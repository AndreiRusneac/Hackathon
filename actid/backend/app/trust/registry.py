"""Trust Registry — load + query trusted EUDI issuers."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

_REGISTRY_PATH = Path(__file__).parent / "issuers.json"


@lru_cache(maxsize=1)
def load_issuers() -> list[dict]:
    with _REGISTRY_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def get_issuer(issuer_id: str) -> Optional[dict]:
    """Lookup by kid ('actid-issuer-001') or iss URL ('https://actid.gov.ro')."""
    for iss in load_issuers():
        if iss["id"] == issuer_id or iss.get("iss_url") == issuer_id:
            return iss
    return None


def is_trusted(issuer_id: str) -> bool:
    return get_issuer(issuer_id) is not None


def trusted_jwks() -> list[dict]:
    """Public JWKs of all trusted issuers — passed to verify_sd_jwt."""
    return [
        {**iss["public_key_jwk"], "kid": iss["id"]}
        for iss in load_issuers()
    ]
