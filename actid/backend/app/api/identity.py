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
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/identity", tags=["identity"])

# Face-match decision threshold. face_recognition returns a "distance" in [0, 1];
# lower = more similar. Industry rule of thumb: < 0.6 = same person.
FACE_MATCH_THRESHOLD = 0.60

# Max width we resize input photos down to before MRZ OCR. passporteye degrades
# on very large images (slow + worse glyph segmentation).
MRZ_MAX_WIDTH = 1400

# A Romanian CNP is exactly 13 digits, with the first digit (S) encoding the
# century + sex, so it's always in 1..8. Match a 13-digit run anchored on that
# constraint so we don't accidentally pick up a document number or date pair.
_CNP_RE = re.compile(r"(?<!\d)([1-8]\d{12})(?!\d)")

# Romanian CNP checksum coefficients (apply to digits 0..11; the 13th is the check).
_CNP_CHECKSUM_COEFFS = (2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ScanIdRequest(BaseModel):
    image_base64: str  # data URL or raw base64 of the ID photo


class ScanIdResponse(BaseModel):
    success: bool
    full_name: Optional[str] = None
    surname: Optional[str] = None
    given_names: Optional[str] = None
    series: Optional[str] = None            # Romanian CI "Seria" — 2 letters (e.g. SX)
    document_number: Optional[str] = None   # the 6-digit "Numărul" portion only
    nationality: Optional[str] = None
    date_of_birth: Optional[str] = None     # ISO YYYY-MM-DD
    date_of_issue: Optional[str] = None     # ISO YYYY-MM-DD — from the printed front
    expiration_date: Optional[str] = None   # ISO YYYY-MM-DD
    sex: Optional[str] = None
    cnp: Optional[str] = None               # 13-digit Romanian CNP
    cnp_valid: bool = False                 # true if cnp passes the official checksum
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
    fallback: bool = False      # true when face_recognition is unavailable


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


# Common OCR glyph confusions in MRZ digit positions. Apply this before
# trying to parse a date so a single misread doesn't blank the whole field.
_DIGIT_FIXUP = str.maketrans({
    "O": "0", "Q": "0", "D": "0",
    "I": "1", "L": "1", "|": "1",
    "Z": "2",
    "S": "5",
    "G": "6",
    "T": "7",
    "B": "8",
})


def _parse_mrz_date(yymmdd: Optional[str]) -> Optional[str]:
    """Convert MRZ YYMMDD into ISO YYYY-MM-DD. MRZ uses 2-digit years."""
    if not yymmdd or len(yymmdd) != 6:
        return None
    fixed = yymmdd.translate(_DIGIT_FIXUP)
    if not fixed.isdigit():
        return None
    yy, mm, dd = int(fixed[:2]), int(fixed[2:4]), int(fixed[4:6])
    # Pivot on current 2-digit year + 20: anything <= today+20 is 20xx, else 19xx
    current_yy = datetime.utcnow().year % 100
    year = 2000 + yy if yy <= current_yy + 20 else 1900 + yy
    try:
        return datetime(year, mm, dd).date().isoformat()
    except ValueError:
        return None


def _split_series_and_number(combined: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Romanian CIs print 'SERIA SX NR 590152' but the MRZ jams these together
    into one 8–9 char document-number field like 'SX590152'. Split them so
    we can show them as separate fields on the review screen.

    Returns (series, number_only). If the input doesn't match the AA-letters
    + digits pattern (e.g. it's a passport number), returns (None, original).
    """
    if not combined:
        return None, None
    cleaned = combined.replace("<", "").replace(" ", "").upper()
    if not cleaned:
        return None, None
    match = re.match(r"^([A-Z]{2})(\d{4,9})$", cleaned)
    if match:
        return match.group(1), match.group(2)
    return None, cleaned


# Label root-word matches — we just need to find these keywords anywhere on
# the card, then look for the nearest date in a window of text after them.
# This is far more forgiving than tight regexes because Romanian CIs print
# the authority name between the issue-date label and the actual date.
_ISSUE_LABEL_RE = re.compile(r"(eliber|emiter|issued|date\s*of\s*issue)", re.IGNORECASE)
_EXPIRY_LABEL_RE = re.compile(
    r"(expir|valab|valid|date\s*of\s*expir)", re.IGNORECASE
)
_BIRTH_LABEL_RE = re.compile(
    r"(n[aă]scut|na[șs]terii|date\s*of\s*birth)", re.IGNORECASE
)

# Generic date regex — also accepts the common OCR misreads in the digit
# positions (`O`/`Q`/`D` instead of `0`, `I`/`L`/`|` instead of `1`, etc.).
# The matched groups are normalized via _DIGIT_FIXUP before being parsed.
_DATE_CHAR_CLASS = r"[\dOQDILZSGTB|]"
_FUZZY_DATE_RE = re.compile(
    rf"({_DATE_CHAR_CLASS}{{1,2}})[./\-\s]({_DATE_CHAR_CLASS}{{1,2}})[./\-\s]({_DATE_CHAR_CLASS}{{2,4}})"
)


def _to_iso(d: str, m: str, y: str) -> Optional[str]:
    """Take three digit-ish strings (day, month, year) and return ISO YYYY-MM-DD."""
    # Apply the OCR fixup table first so 'O' → '0', 'I' → '1' etc.
    df = d.translate(_DIGIT_FIXUP)
    mf = m.translate(_DIGIT_FIXUP)
    yf = y.translate(_DIGIT_FIXUP)
    if not (df.isdigit() and mf.isdigit() and yf.isdigit()):
        return None
    try:
        di, mi, yi = int(df), int(mf), int(yf)
    except ValueError:
        return None
    if yi < 100:
        current_yy = datetime.utcnow().year % 100
        yi = 2000 + yi if yi <= current_yy + 20 else 1900 + yi
    try:
        return datetime(yi, mi, di).date().isoformat()
    except ValueError:
        return None


def _find_date_near(text: str, label_re: re.Pattern, window: int = 120) -> Optional[str]:
    """
    Find the first plausible date within *window* chars after any occurrence
    of *label_re* in *text*. Returns ISO YYYY-MM-DD or None.

    This is the proximity-based replacement for tight label-then-date regex.
    On real Romanian CIs there's often an issuing-authority line between the
    "Data eliberării" label and the actual date — proximity matching just
    grabs the next date that appears within the next 120 characters.
    """
    if not text:
        return None
    for label_match in label_re.finditer(text):
        chunk = text[label_match.end(): label_match.end() + window]
        date_match = _FUZZY_DATE_RE.search(chunk)
        if date_match:
            iso = _to_iso(*date_match.groups())
            if iso:
                return iso
    return None


def _all_dates(text: str) -> List[str]:
    """Return every ISO date found in *text*, with OCR fixup applied."""
    if not text:
        return []
    out = []
    for m in _FUZZY_DATE_RE.finditer(text):
        iso = _to_iso(*m.groups())
        if iso:
            out.append(iso)
    return out


def _extract_dates_from_text(text: str) -> dict[str, Optional[str]]:
    """
    Find issue / expiry / birth dates on the printed front of a Romanian CI.

    Strategy:
      1. Proximity match: find label root-words, take the first date that
         appears within 120 chars after the label.
      2. Chronological fallback: from all dates on the card, the earliest
         past date = birth, the latest past date = issue, the latest future
         date = expiry.
    """
    out: dict[str, Optional[str]] = {
        "issue": _find_date_near(text, _ISSUE_LABEL_RE),
        "expiry": _find_date_near(text, _EXPIRY_LABEL_RE),
        "birth": _find_date_near(text, _BIRTH_LABEL_RE),
    }

    all_dates = _all_dates(text)
    if all_dates:
        all_dates = sorted(set(all_dates))
        today_iso = datetime.utcnow().date().isoformat()
        past = [d for d in all_dates if d < today_iso]
        future = [d for d in all_dates if d >= today_iso]
        if out["birth"] is None and past:
            out["birth"] = past[0]
        if out["issue"] is None and len(past) >= 2:
            out["issue"] = past[-1]
        if out["expiry"] is None and future:
            out["expiry"] = future[-1]

    return out


def _normalize_nationality(value: Optional[str], full_text: Optional[str]) -> Optional[str]:
    """
    Force the nationality to ROU when the card text clearly says so.

    MRZ OCR sometimes returns garbled 3-letter codes; the printed front of
    a Romanian CI always says ROU / ROMANIA / ROMÂNĂ / CETĂȚEAN ROMÂN, so
    we trust that signal over a noisy MRZ read.
    """
    haystack = (full_text or "").upper()
    if "ROU" in haystack or "ROMAN" in haystack:
        return "ROU"
    if value:
        clean = value.replace("<", "").strip().upper()
        # Accept any clean 3-letter code; otherwise drop garbage
        if re.fullmatch(r"[A-Z]{3}", clean):
            return clean
    return None


def _clean_mrz_field(value: Optional[str]) -> Optional[str]:
    """Strip MRZ filler '<' chars and whitespace. Empty/'None' string → None."""
    if not value:
        return None
    cleaned = value.replace("<", " ").strip()
    cleaned = " ".join(cleaned.split())
    if not cleaned or cleaned.upper() == "NONE":
        return None
    return cleaned


# MRZ filler chars (`<`) are sometimes OCR'd as the visually-similar letters
# X, K or Y. When that happens, the misread letter gets glued to the start
# of the next name token: "RADU<GABRIEL" becomes "RADU XGABRIEL" or even
# "RADUXGABRIEL". Strip standalone X/K/Y when they appear immediately before
# a longer all-caps word — that pattern is virtually always a filler misread
# in Romanian names. (Edge case: real names like "Xenia" are extremely rare;
# user can correct on the review screen anyway.)
_NAME_FILLER_RE = re.compile(r"\b([XKY])(?=[A-Z]{2,}\b)")


def _clean_mrz_name(value: Optional[str]) -> Optional[str]:
    """Like _clean_mrz_field, but also strips X/K/Y MRZ-filler misreads."""
    cleaned = _clean_mrz_field(value)
    if not cleaned:
        return None
    fixed = _NAME_FILLER_RE.sub("", cleaned)
    fixed = " ".join(fixed.split())
    return fixed or None


def _validate_cnp(cnp: str) -> bool:
    """
    Romanian CNP checksum validation.

    Format: S YY MM DD JJ NNN C (13 digits) where the last digit C is a check.
    Algorithm: multiply digits 0..11 by coefficients (2,7,9,1,4,6,3,5,8,2,7,9),
    sum, take mod 11; if result is 10, the check digit is 1, else it's the result.

    We also sanity-check the embedded birth-date so OCR garbage like 9999999999998
    doesn't pass purely by coincidence.
    """
    if not cnp or len(cnp) != 13 or not cnp.isdigit():
        return False
    if cnp[0] not in "12345678":
        return False
    # Sanity check the embedded birth date
    mm, dd = int(cnp[3:5]), int(cnp[5:7])
    if not (1 <= mm <= 12 and 1 <= dd <= 31):
        return False
    total = sum(int(cnp[i]) * _CNP_CHECKSUM_COEFFS[i] for i in range(12))
    check = total % 11
    if check == 10:
        check = 1
    return check == int(cnp[12])


# Fuzzy 13-character "CNP-shape" pattern that accepts OCR-confused glyphs in
# any position (O/Q/D → 0, I/L/| → 1, etc.). Each candidate is run through
# _DIGIT_FIXUP and checksum-validated before being returned.
_CNP_FUZZY_RE = re.compile(
    r"(?<![\dA-Z])([1-8OQDIL|ZSGTB][\dOQDIL|ZSGTB]{12})(?![\dA-Z])"
)


def _find_cnp_candidates(text: str) -> List[str]:
    """
    Return all 13-digit substrings of *text* that could be a Romanian CNP.

    Accepts OCR misreads (e.g. 'O' instead of '0') by running each candidate
    through the _DIGIT_FIXUP table before adding it to the pool. Anything
    that doesn't normalize to 13 actual digits is dropped.
    """
    if not text:
        return []
    out = []
    # First, strict matches — these are unambiguous wins.
    out.extend(_CNP_RE.findall(text))
    # Then, fuzzy matches with OCR fixup applied.
    for m in _CNP_FUZZY_RE.finditer(text):
        fixed = m.group(1).translate(_DIGIT_FIXUP)
        if fixed.isdigit() and len(fixed) == 13 and fixed[0] in "12345678":
            out.append(fixed)
    # Also: take the text with all whitespace stripped and run the strict
    # regex on it — handles cases where OCR introduced spaces inside the CNP.
    no_space = re.sub(r"\s+", "", text)
    out.extend(_CNP_RE.findall(no_space))
    return out


def _pick_best_cnp(candidates: List[str]) -> tuple[Optional[str], bool]:
    """
    From a list of CNP candidates, prefer one with a valid checksum.
    Returns (cnp, valid). If nothing passes checksum, return the first
    candidate so the user can manually correct it on the review screen.
    """
    if not candidates:
        return None, False
    # De-duplicate while preserving order
    seen = []
    for c in candidates:
        if c not in seen:
            seen.append(c)
    for c in seen:
        if _validate_cnp(c):
            return c, True
    return seen[0], False


def _extract_cnp_from_mrz(data: dict, raw_mrz_code: Optional[str]) -> List[str]:
    """Collect all CNP candidates from passporteye's parsed fields + raw text."""
    pool = []
    for key in ("personal_number", "optional1", "optional2", "optional"):
        value = data.get(key)
        if value:
            pool.extend(_find_cnp_candidates(value))
    if raw_mrz_code:
        pool.extend(_find_cnp_candidates(raw_mrz_code))
    return pool


def _full_card_ocr(img_rgb) -> str:
    """
    Run Tesseract over the full ID card photo with several preprocessing /
    PSM combinations and return the concatenated text. Multi-pass coverage is
    important because Romanian CIs are dense layouts — no single Tesseract
    pass gets every field. Each pass costs ~0.3–0.6 s on a 2000-px crop, so
    the total budget stays under ~2 s on the backend.
    """
    try:
        import cv2
        import numpy as np
        import pytesseract
    except ImportError:
        logger.warning("pytesseract / cv2 unavailable — skipping full-card OCR")
        return ""

    try:
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)

        # Cap the longest edge to 2000 px so OCR stays fast even on 4k phone shots
        h, w = gray.shape
        max_edge = 2000
        if max(h, w) > max_edge:
            scale = max_edge / float(max(h, w))
            gray = cv2.resize(
                gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
            )

        # Variant 1: bilateral filter + CLAHE — best for text on noisy backgrounds
        v1 = cv2.bilateralFilter(gray, d=5, sigmaColor=50, sigmaSpace=50)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        v1 = clahe.apply(v1)

        # Variant 2: Otsu binarization — crispest output for printed labels
        _, v2 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Variant 3: adaptive threshold — handles uneven lighting across the card
        v3 = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
            blockSize=31, C=10,
        )

        # PSM 6 = uniform block of text, PSM 11 = sparse text. Together they
        # catch both the dense column on the right and the scattered labels.
        configs = (
            "--psm 6 -c tessedit_char_whitelist="
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzĂÎÂȘȚăîâșț./-: ",
            "--psm 11 -c tessedit_char_whitelist="
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzĂÎÂȘȚăîâșț./-: ",
        )

        chunks: List[str] = []
        for image in (v1, v2, v3):
            for cfg in configs:
                try:
                    text = pytesseract.image_to_string(image, config=cfg, lang="ron+eng")
                    if text:
                        chunks.append(text)
                except Exception:
                    logger.warning("OCR pass failed (continuing)", exc_info=False)

        combined = "\n---\n".join(chunks)
        # Truncate when logging so we don't flood the journal; full text stays in memory.
        logger.info(
            "Full-card OCR — %d passes, %d chars total. First 400: %r",
            len(chunks), len(combined), combined[:400],
        )
        return combined
    except Exception:
        logger.exception("Full-card OCR failed (non-fatal)")
        return ""


def _preprocess_for_mrz(img_rgb, variant: str = "clahe"):
    """
    Prepare a camera frame for MRZ reading. Multiple variants are supported so
    the caller can retry with progressively more aggressive preprocessing.
    Returns PNG bytes ready to hand to passporteye.read_mrz.
    """
    import numpy as np
    from PIL import Image

    h, w = img_rgb.shape[:2]
    if w > MRZ_MAX_WIDTH:
        scale = MRZ_MAX_WIDTH / float(w)
        new_size = (MRZ_MAX_WIDTH, int(round(h * scale)))
        img_rgb = np.array(Image.fromarray(img_rgb).resize(new_size, Image.LANCZOS))

    try:
        import cv2
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        if variant == "clahe":
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            processed = clahe.apply(gray)
        elif variant == "otsu":
            # Otsu binarization — turns the MRZ band into crisp black-on-white
            _, processed = cv2.threshold(
                gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
        elif variant == "adaptive":
            processed = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
                blockSize=31, C=10,
            )
        else:
            processed = gray
    except Exception:
        from PIL import ImageOps
        processed = np.array(ImageOps.autocontrast(Image.fromarray(img_rgb).convert("L")))

    buf = io.BytesIO()
    Image.fromarray(processed).save(buf, format="PNG")
    buf.seek(0)
    return buf


def _try_read_mrz(img_rgb):
    """
    Try several preprocessing variants in order and return the first successful
    MRZ object. Each variant trades off different failure modes (uneven lighting,
    glare, low contrast), so cycling through them dramatically improves the
    real-world hit rate on phone-captured photos.
    """
    from passporteye import read_mrz
    from PIL import Image

    variants = ("clahe", "otsu", "adaptive", "gray", "raw")
    for variant in variants:
        try:
            if variant == "raw":
                buf = io.BytesIO()
                Image.fromarray(img_rgb).save(buf, format="PNG")
                buf.seek(0)
            else:
                buf = _preprocess_for_mrz(img_rgb, variant=variant)
            mrz = read_mrz(buf, save_roi=False)
            if mrz is not None:
                logger.info("MRZ extracted on variant=%s", variant)
                return mrz
        except Exception:
            logger.warning("MRZ variant=%s failed (will try next)", variant, exc_info=False)
    return None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/scan-id", response_model=ScanIdResponse)
def scan_id(req: ScanIdRequest):
    """Extract MRZ data from a CI / passport image and crop the face for later comparison."""
    img = _decode_image(req.image_base64)

    # ── 1. Read the MRZ ───────────────────────────────────────────────────
    try:
        import passporteye  # noqa: F401
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Modulul de scanare nu este disponibil pe acest server",
        )

    mrz = _try_read_mrz(img)

    # ── 2. Collect CNP candidates from MRZ + full-card OCR ────────────────
    cnp_candidates: List[str] = []
    surname: Optional[str] = None
    given: Optional[str] = None
    combined_number: Optional[str] = None
    nationality_mrz: Optional[str] = None
    date_of_birth: Optional[str] = None
    expiration_date: Optional[str] = None
    sex: Optional[str] = None
    mrz_data: dict = {}

    if mrz is not None:
        mrz_data = mrz.to_dict()
        raw_code = getattr(mrz, "mrz_code", None)
        surname = _clean_mrz_name(mrz_data.get("surname"))
        given = _clean_mrz_name(mrz_data.get("names"))
        combined_number = _clean_mrz_field(mrz_data.get("number"))
        nationality_mrz = _clean_mrz_field(mrz_data.get("nationality"))
        date_of_birth = _parse_mrz_date(mrz_data.get("date_of_birth"))
        expiration_date = _parse_mrz_date(mrz_data.get("expiration_date"))
        sex = _clean_mrz_field(mrz_data.get("sex"))
        cnp_candidates.extend(_extract_cnp_from_mrz(mrz_data, raw_code))

    # Always run the full-card OCR pass; even if MRZ extracted a CNP, the
    # printed front-of-card text often confirms it (or provides one when MRZ
    # missed). Both sources feeding _pick_best_cnp lets the checksum filter
    # pick the right one.
    full_text = _full_card_ocr(img)
    cnp_candidates.extend(_find_cnp_candidates(full_text))

    cnp, cnp_valid = _pick_best_cnp(cnp_candidates)
    logger.info(
        "scan-id extraction: mrz=%s cnp=%s (valid=%s, %d candidates: %r)",
        "yes" if mrz is not None else "no",
        cnp, cnp_valid, len(cnp_candidates), cnp_candidates[:8],
    )

    # ── 2a. Split Seria from Numărul ─────────────────────────────────────
    series, document_number = _split_series_and_number(combined_number)

    # If MRZ didn't yield series/number, try the printed front. Romanian CIs
    # show "SERIA SX NR 590152" in big letters near the document number.
    if not series or not document_number:
        m = re.search(
            r"SERI[AEI]\s*[:.]?\s*([A-Z]{2})\s*N[RUO][.:]?\s*(\d{4,9})",
            (full_text or "").upper(),
        )
        if m:
            series = series or m.group(1)
            document_number = document_number or m.group(2)

    # ── 2b. Normalize nationality (trust the printed ROU over noisy MRZ) ─
    nationality = _normalize_nationality(nationality_mrz, full_text)

    # ── 2c. Fill in any missing dates from the printed front ─────────────
    front_dates = _extract_dates_from_text(full_text)
    logger.info("scan-id dates from front OCR: %r", front_dates)
    if not date_of_birth:
        date_of_birth = front_dates.get("birth")
    if not expiration_date:
        expiration_date = front_dates.get("expiry")
    date_of_issue = front_dates.get("issue")

    # Romanian convention: surname first, then given names
    if surname and given:
        full_name = f"{surname} {given}"
    else:
        full_name = surname or given

    # ── 3. Crop the face from the ID ──────────────────────────────────────
    id_face_b64: Optional[str] = None
    try:
        import face_recognition
        locations = face_recognition.face_locations(img, model="hog")
        if locations:
            top, right, bottom, left = max(
                locations, key=lambda b: (b[2] - b[0]) * (b[1] - b[3])
            )
            h, w = img.shape[:2]
            pad = int(0.15 * max(bottom - top, right - left))
            top, left = max(0, top - pad), max(0, left - pad)
            bottom, right = min(h, bottom + pad), min(w, right + pad)
            face_crop = img[top:bottom, left:right]
            id_face_b64 = _encode_face_png(face_crop)
    except ImportError:
        logger.warning("face_recognition not installed — using heuristic ID face crop")
        try:
            h, w = img.shape[:2]
            left, right = int(0.05 * w), int(0.35 * w)
            top, bottom = int(0.25 * h), int(0.80 * h)
            id_face_b64 = _encode_face_png(img[top:bottom, left:right])
        except Exception:
            logger.exception("Heuristic face crop failed (non-fatal)")
    except Exception:
        logger.exception("Face crop from ID failed (non-fatal)")

    # ── 4. Decide overall success ─────────────────────────────────────────
    if mrz is None and not cnp:
        return ScanIdResponse(
            success=False,
            id_face_base64=id_face_b64,
            message="Nu am putut citi documentul. Asigură-te că este bine luminat și că zona cu codul de jos (MRZ) e vizibilă.",
        )

    has_any = bool(full_name or cnp or document_number)
    if cnp_valid:
        msg = "Document scanat cu succes — CNP validat."
    elif cnp:
        msg = "Document scanat — verifică CNP-ul în pasul următor."
    elif has_any:
        msg = "Document scanat parțial — verifică datele înainte de a continua."
    else:
        msg = "MRZ detectat dar nu am putut extrage datele. Încearcă din nou."

    return ScanIdResponse(
        success=has_any,
        full_name=full_name,
        surname=surname,
        given_names=given,
        series=series,
        document_number=document_number,
        nationality=nationality,
        date_of_birth=date_of_birth,
        date_of_issue=date_of_issue,
        expiration_date=expiration_date,
        sex=sex,
        cnp=cnp,
        cnp_valid=cnp_valid,
        id_face_base64=id_face_b64,
        message=msg,
    )


@router.post("/verify-face", response_model=VerifyFaceResponse)
def verify_face(req: VerifyFaceRequest):
    """Compare a live selfie against the ID face. Returns match=True if similar enough."""
    try:
        import face_recognition
    except ImportError:
        logger.warning("face_recognition not available — accepting selfie without match check")
        return VerifyFaceResponse(
            match=True,
            score=0.0,
            distance=1.0,
            fallback=True,
            message="Verificare facială indisponibilă pe acest server — am acceptat selfie-ul fără comparație.",
        )

    id_img = _decode_image(req.id_face_base64)
    selfie_img = _decode_image(req.selfie_base64)

    try:
        id_encodings = face_recognition.face_encodings(id_img)
    except Exception:
        logger.exception("Encoding the ID face failed")
        id_encodings = []
    if not id_encodings:
        return VerifyFaceResponse(
            match=True,
            score=0.0,
            distance=1.0,
            fallback=True,
            message="Nu am găsit fața pe document — am acceptat selfie-ul fără comparație.",
        )

    try:
        selfie_encodings = face_recognition.face_encodings(selfie_img)
    except Exception:
        logger.exception("Encoding the selfie failed")
        selfie_encodings = []
    if not selfie_encodings:
        raise HTTPException(
            status_code=422,
            detail="Nu am găsit fața în selfie. Asigură-te că ești bine luminat și încearcă din nou.",
        )

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
