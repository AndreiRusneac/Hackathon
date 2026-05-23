"""
Identity verification endpoints — used during registration BEFORE the user has an account.
All routes are public (no auth dependency).

  POST /api/identity/scan-id     — OCR the MRZ of a Romanian CI / passport, return parsed fields + cropped face
  POST /api/identity/verify-face — compare a selfie against the cropped ID face, return similarity score
"""
from __future__ import annotations

import base64
import io
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/identity", tags=["identity"])

# Face-match decision threshold. face_recognition returns a "distance" in [0, 1];
# lower = more similar. Industry rule of thumb: < 0.6 = same person.
FACE_MATCH_THRESHOLD = 0.60


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ScanIdRequest(BaseModel):
    image_base64: str  # data URL or raw base64 of the ID photo


class ScanIdResponse(BaseModel):
    success: bool
    full_name: Optional[str] = None
    surname: Optional[str] = None
    given_names: Optional[str] = None
    document_number: Optional[str] = None
    nationality: Optional[str] = None
    date_of_birth: Optional[str] = None     # ISO YYYY-MM-DD
    expiration_date: Optional[str] = None   # ISO YYYY-MM-DD
    sex: Optional[str] = None
    cnp: Optional[str] = None               # for Romanian docs the MRZ personal_number is the CNP
    id_face_base64: Optional[str] = None    # cropped face from the ID, base64 PNG
    message: str = ""


class VerifyFaceRequest(BaseModel):
    id_face_base64: str
    selfie_base64: str


class VerifyFaceResponse(BaseModel):
    match: bool
    score: float                # similarity score in [0, 1] — 1 = identical
    distance: float             # raw face_recognition distance — 0 = identical
    message: str = ""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _decode_image(b64: str):
    """Decode a base64 string (with or without data:image/ prefix) into a numpy RGB array."""
    import numpy as np
    from PIL import Image

    if "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Imaginea nu a putut fi decodată")
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Formatul imaginii este invalid")
    return np.array(img)


def _encode_face_png(arr) -> str:
    """Encode a numpy RGB array back to a base64 PNG data URL."""
    from PIL import Image

    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _parse_mrz_date(yymmdd: Optional[str]) -> Optional[str]:
    """Convert MRZ YYMMDD into ISO YYYY-MM-DD. MRZ uses 2-digit years."""
    if not yymmdd or len(yymmdd) != 6 or not yymmdd.isdigit():
        return None
    yy, mm, dd = int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6])
    # Pivot on current 2-digit year + 20: anything <= today+20 is 20xx, else 19xx
    current_yy = datetime.utcnow().year % 100
    year = 2000 + yy if yy <= current_yy + 20 else 1900 + yy
    try:
        return datetime(year, mm, dd).date().isoformat()
    except ValueError:
        return None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/scan-id", response_model=ScanIdResponse)
def scan_id(req: ScanIdRequest):
    """Extract MRZ data from a CI / passport image and crop the face for later comparison."""
    img = _decode_image(req.image_base64)

    # ── 1. Read the MRZ ───────────────────────────────────────────────────
    try:
        from passporteye import read_mrz
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Modulul de scanare nu este disponibil pe acest server",
        )

    # passporteye accepts raw bytes; re-encode the PIL image to PNG bytes
    from PIL import Image
    buf = io.BytesIO()
    Image.fromarray(img).save(buf, format="PNG")
    buf.seek(0)

    try:
        mrz = read_mrz(buf, save_roi=False)
    except Exception as exc:
        logger.exception("MRZ read failed")
        raise HTTPException(status_code=422, detail=f"Scanare MRZ eșuată: {exc}")

    if mrz is None:
        return ScanIdResponse(
            success=False,
            message="Nu am găsit zona MRZ. Reașează documentul și încearcă din nou.",
        )

    data = mrz.to_dict()

    surname = (data.get("surname") or "").strip()
    given = (data.get("names") or "").strip()
    full_name = f"{given} {surname}".strip() or None

    # ── 2. Crop the face from the ID ──────────────────────────────────────
    id_face_b64: Optional[str] = None
    try:
        import face_recognition
        locations = face_recognition.face_locations(img, model="hog")
        if locations:
            # Use the largest detected face
            top, right, bottom, left = max(
                locations, key=lambda b: (b[2] - b[0]) * (b[1] - b[3])
            )
            # Add a small margin
            h, w = img.shape[:2]
            pad = int(0.15 * max(bottom - top, right - left))
            top, left = max(0, top - pad), max(0, left - pad)
            bottom, right = min(h, bottom + pad), min(w, right + pad)
            face_crop = img[top:bottom, left:right]
            id_face_b64 = _encode_face_png(face_crop)
    except ImportError:
        logger.warning("face_recognition not installed — skipping ID face crop")
    except Exception:
        logger.exception("Face crop from ID failed (non-fatal)")

    return ScanIdResponse(
        success=True,
        full_name=full_name,
        surname=surname or None,
        given_names=given or None,
        document_number=(data.get("number") or "").strip() or None,
        nationality=(data.get("nationality") or "").strip() or None,
        date_of_birth=_parse_mrz_date(data.get("date_of_birth")),
        expiration_date=_parse_mrz_date(data.get("expiration_date")),
        sex=(data.get("sex") or "").strip() or None,
        cnp=(data.get("personal_number") or "").strip() or None,
        id_face_base64=id_face_b64,
        message="Document scanat cu succes" if full_name else "MRZ citit parțial",
    )


@router.post("/verify-face", response_model=VerifyFaceResponse)
def verify_face(req: VerifyFaceRequest):
    """Compare a live selfie against the ID face. Returns match=True if similar enough."""
    try:
        import face_recognition
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Modulul de recunoaștere facială nu este disponibil pe acest server",
        )

    id_img = _decode_image(req.id_face_base64)
    selfie_img = _decode_image(req.selfie_base64)

    id_encodings = face_recognition.face_encodings(id_img)
    if not id_encodings:
        raise HTTPException(status_code=422, detail="Nu am găsit fața pe documentul scanat")

    selfie_encodings = face_recognition.face_encodings(selfie_img)
    if not selfie_encodings:
        raise HTTPException(status_code=422, detail="Nu am găsit fața în selfie")

    distance = float(face_recognition.face_distance([id_encodings[0]], selfie_encodings[0])[0])
    match = distance < FACE_MATCH_THRESHOLD
    score = max(0.0, 1.0 - distance)

    return VerifyFaceResponse(
        match=match,
        score=round(score, 3),
        distance=round(distance, 3),
        message=(
            "Identitate confirmată"
            if match
            else "Fețele nu se potrivesc suficient — încearcă din nou"
        ),
    )
