"""
vc/issuer.py — maps a Document model instance to a signed SD-JWT VC.

Per EUDI ARF 1.4 §6.3: each document type maps to a standardized vct
(Verifiable Credential Type) with attributes following the relevant
attestation schema.

Selective-disclosure design: ALL attributes are wrapped with SDObj()
inside sign_credential(), so the holder can choose exactly which fields
to reveal at presentation time — enabling eIDAS minimum-disclosure
(e.g. over_18 without birth_date).
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

from ..crypto.vault import decrypt as vault_decrypt
from ..models.models import Document, User
from .sd_jwt import sign_credential

# ─── VCT constants (align with EUDI ARF attestation types) ─────────────────
_VCT_MAP = {
    "CI": "RomanianID",
    "PASAPORT": "Passport",
    "PERMIS": "DriverLicense",
    "CAZIER": "CriminalRecord",
}
_VCT_DEFAULT = "GenericAttestation"


# ─── Public API ─────────────────────────────────────────────────────────────

def issue_credential(document: Document, owner: User) -> str:
    """
    Convert a Document row + its owner into a signed SD-JWT VC.

    All credential attributes are selectively disclosable — the holder
    (wallet) chooses which to reveal at presentation time.

    Returns:
        SD-JWT issuance string: <jwt>~<disclosure1>~<disclosure2>~...
    """
    vct = _VCT_MAP.get(document.doc_type, _VCT_DEFAULT)
    attributes = build_attributes(document, owner)
    return sign_credential(vct=vct, subject_id=owner.id, attributes=attributes)


def build_attributes(document: Document, owner: User) -> dict[str, Any]:
    """
    Public single source of truth for a document's signable attributes.

    Both the credential-issuance path and the presentation-creation path call
    this, so the attributes OFFERED to the wallet UI are exactly the ones that
    get SIGNED into the SD-JWT. Drops None values so only real, disclosable
    attributes are returned.
    """
    vct = _VCT_MAP.get(document.doc_type, _VCT_DEFAULT)
    attrs = _build_attributes(document, owner, vct)
    return {k: v for k, v in attrs.items() if v is not None}


def get_available_attributes(document: Document, owner: User) -> list[str]:
    """
    Return list of attribute names that would be included in the VC.
    Used by GET /api/credentials/{id} to inform the wallet UI.
    """
    return list(build_attributes(document, owner).keys())


def get_vct(document: Document) -> str:
    """Return the vct string for a given document type."""
    return _VCT_MAP.get(document.doc_type, _VCT_DEFAULT)


# ─── Internals ──────────────────────────────────────────────────────────────

def _build_attributes(document: Document, owner: User, vct: str) -> dict[str, Any]:
    if vct == "RomanianID":
        return _ci_attributes(document, owner)
    if vct == "Passport":
        return _pasaport_attributes(document, owner)
    if vct == "DriverLicense":
        return _permis_attributes(document, owner)
    if vct == "CriminalRecord":
        return _cazier_attributes(document, owner)
    return _generic_attributes(document, owner)


def _meta(document: Document) -> dict[str, Any]:
    """Parse the document's metadata_json blob into a dict (empty on failure)."""
    if not document.metadata_json:
        return {}
    try:
        data = json.loads(document.metadata_json)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _home_address(document: Document, owner: User) -> str | None:
    """
    Resolve the holder's domicile address. Prefer an explicit address stored in
    the document metadata; otherwise compose from the owner's city + country,
    which is the real domicile data we have on the account.
    """
    explicit = _meta(document).get("address")
    if explicit:
        return str(explicit)
    parts = [p for p in (owner.city, owner.country) if p]
    return ", ".join(parts) or None


def _over_65(birth_date_iso: str | None) -> bool | None:
    """Derive age-over-65 boolean from birth date (eIDAS minimum-disclosure)."""
    if birth_date_iso is None:
        return None
    try:
        bd = date.fromisoformat(birth_date_iso)
        today = datetime.now(timezone.utc).date()
        return (today - bd).days >= 65 * 365
    except ValueError:
        return None


def _split_name(full_name: str) -> tuple[str, str]:
    """'Prenume Nume' → (given_name, family_name). Best-effort split on first space."""
    parts = full_name.strip().split(maxsplit=1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def _birth_date_from_cnp(cnp: str | None) -> str | None:
    """
    Extract ISO birth date from Romanian CNP (13 digits).
    Format: S YY MM DD JJJCC where S encodes gender+century:
      1/2 → 1900s, 3/4 → 1800s, 5/6 → 2000s
    """
    if not cnp or len(cnp) < 7:
        return None
    try:
        century_map = {1: 1900, 2: 1900, 3: 1800, 4: 1800, 5: 2000, 6: 2000}
        century = century_map.get(int(cnp[0]))
        if century is None:
            return None
        year = century + int(cnp[1:3])
        month = int(cnp[3:5])
        day = int(cnp[5:7])
        return f"{year:04d}-{month:02d}-{day:02d}"
    except (ValueError, IndexError):
        return None


def _over_18(birth_date_iso: str | None) -> bool | None:
    """
    Derive age-over-18 boolean from birth date.
    eIDAS minimum-disclosure: holder can prove age without revealing birth_date.
    """
    if birth_date_iso is None:
        return None
    try:
        bd = date.fromisoformat(birth_date_iso)
        today = datetime.now(timezone.utc).date()
        return (today - bd).days >= 18 * 365
    except ValueError:
        return None


def _ci_attributes(doc: Document, owner: User) -> dict[str, Any]:
    given_name, family_name = _split_name(owner.full_name)
    cnp = vault_decrypt(doc.cnp, owner.id) or owner.cnp
    bd = _birth_date_from_cnp(cnp)
    return {
        "given_name": given_name,
        "family_name": family_name,
        "birth_date": bd,
        "cnp": cnp,
        "address": _home_address(doc, owner),
        "document_number": vault_decrypt(doc.doc_number, owner.id),
        "issue_date": doc.issued_date.isoformat() if doc.issued_date else None,
        "expiry_date": doc.expires_date.isoformat() if doc.expires_date else None,
        "over_18": _over_18(bd),
        "over_65": _over_65(bd),
    }


def _pasaport_attributes(doc: Document, owner: User) -> dict[str, Any]:
    given_name, family_name = _split_name(owner.full_name)
    cnp = vault_decrypt(doc.cnp, owner.id) or owner.cnp
    bd = _birth_date_from_cnp(cnp)
    return {
        "given_name": given_name,
        "family_name": family_name,
        "birth_date": bd,
        "cnp": cnp,
        "document_number": vault_decrypt(doc.doc_number, owner.id),
        "issue_date": doc.issued_date.isoformat() if doc.issued_date else None,
        "expiry_date": doc.expires_date.isoformat() if doc.expires_date else None,
        "nationality": "RO",
        "over_18": _over_18(bd),
        "over_65": _over_65(bd),
    }


def _cazier_attributes(doc: Document, owner: User) -> dict[str, Any]:
    """
    Criminal-record attestation. The defining attribute is has_criminal_record;
    a cazier judiciar is issued "clean" by default (no record), overridable via
    metadata_json {"has_criminal_record": true}.
    """
    given_name, family_name = _split_name(owner.full_name)
    has_record = bool(_meta(doc).get("has_criminal_record", False))
    return {
        "given_name": given_name,
        "family_name": family_name,
        "has_criminal_record": has_record,
        "document_number": vault_decrypt(doc.doc_number, owner.id),
        "issue_date": doc.issued_date.isoformat() if doc.issued_date else None,
        "expiry_date": doc.expires_date.isoformat() if doc.expires_date else None,
    }


def _permis_attributes(doc: Document, owner: User) -> dict[str, Any]:
    given_name, family_name = _split_name(owner.full_name)
    categories: list[str] = []
    if doc.metadata_json:
        try:
            meta = json.loads(doc.metadata_json)
            categories = meta.get("categories", [])
        except (json.JSONDecodeError, AttributeError):
            pass
    return {
        "given_name": given_name,
        "family_name": family_name,
        "document_number": vault_decrypt(doc.doc_number, owner.id),
        "issue_date": doc.issued_date.isoformat() if doc.issued_date else None,
        "expiry_date": doc.expires_date.isoformat() if doc.expires_date else None,
        "categories": categories or ["B"],
    }


def _generic_attributes(doc: Document, owner: User) -> dict[str, Any]:
    given_name, family_name = _split_name(owner.full_name)
    return {
        "given_name": given_name,
        "family_name": family_name,
        "document_type": doc.doc_type,
        "document_number": vault_decrypt(doc.doc_number, owner.id),
        "issue_date": doc.issued_date.isoformat() if doc.issued_date else None,
        "expiry_date": doc.expires_date.isoformat() if doc.expires_date else None,
        "issued_by": doc.issued_by,
    }
