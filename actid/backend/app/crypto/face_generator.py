"""
AI-generated face fetcher pentru documentele de identitate.

Sursă: thispersondoesnotexist.com (StyleGAN2 NVIDIA)
  - Fețele NU EXISTĂ în realitate — generate cu AI
  - 1024×1024 pixeli, ~800KB JPEG (claritate fotografică)

Strategie gen-correct:
  - thispersondoesnotexist.com NU acceptă filtru de gen → genul e random
  - Soluție: fetch + clasifică cu OpenCV (Levi-Hassner) + retry până matches
  - Max 5 încercări → P(succes) ≈ 99.97% la ~85% per-attempt accuracy

Helpers:
  - fetch_ai_face(gender) → poză AI cu genul cerut (best-effort)
  - gender_from_cnp(cnp)  → "M" / "F" / None (cifra 1 din CNP)
"""
from __future__ import annotations

import base64
import logging
import ssl
import urllib.request
from urllib.error import URLError

from .gender_classifier import classify_gender

logger = logging.getLogger(__name__)

_THIS_PERSON_URL = "https://thispersondoesnotexist.com/"
_TIMEOUT_SECONDS = 12
_MAX_GENDER_ATTEMPTS = 5


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _http_get(url: str, accept: str = "*/*") -> bytes | None:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (ActID Demo)",
                "Accept": accept,
            },
        )
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SECONDS, context=_ssl_context()) as resp:
            return resp.read()
    except (URLError, TimeoutError, OSError) as exc:
        logger.warning("HTTP GET failed for %s: %s", url, exc)
        return None


def _fetch_one_face() -> bytes | None:
    """Întoarce bytes-ii unei fețe AI (gen random) sau None."""
    return _http_get(_THIS_PERSON_URL, accept="image/*")


def fetch_ai_face(gender: str | None = None) -> str | None:
    """
    Întoarce o poză AI ca data URL base64. Dacă gender specificat,
    încearcă până la 5 ori până găsește o față cu genul corect.

    Args:
        gender: "M", "F" sau None (random)
    """
    last_bytes: bytes | None = None

    for attempt in range(1, _MAX_GENDER_ATTEMPTS + 1):
        img_bytes = _fetch_one_face()
        if not img_bytes:
            continue
        last_bytes = img_bytes

        if gender is None:
            break  # nu ne pasă de gen, prima e ok

        detected = classify_gender(img_bytes)
        if detected is None:
            # Clasificatorul a eșuat — accept prima poză
            logger.info("Gender classifier unavailable, accepting first face")
            break

        if detected == gender:
            logger.info("Got %s face on attempt %d", gender, attempt)
            break

        logger.info("Attempt %d/%d: wanted %s, got %s — retrying",
                    attempt, _MAX_GENDER_ATTEMPTS, gender, detected)

    if not last_bytes:
        return None
    b64 = base64.b64encode(last_bytes).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def gender_from_cnp(cnp: str | None) -> str | None:
    """Cifra 1 din CNP: 1/3/5/7 → M,  2/4/6/8 → F."""
    if not cnp or len(cnp) < 1 or not cnp[0].isdigit():
        return None
    d = int(cnp[0])
    if d in (1, 3, 5, 7):
        return "M"
    if d in (2, 4, 6, 8):
        return "F"
    return None
