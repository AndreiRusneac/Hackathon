"""
Gender classifier — OpenCV DNN + Caffe model (Levi-Hassner 2015).

Download lazy la prima utilizare:
  - gender_deploy.prototxt  (~2KB)
  - gender_net.caffemodel   (~43MB)

Acuratețe: ~85-90% pe fețe AI bine aliniate (vs ~78% pe fețe naturale).

Folosire:
  from .gender_classifier import classify_gender
  result = classify_gender(image_bytes)  # → "M" / "F" / None
"""
from __future__ import annotations

import logging
import ssl
import urllib.request
from pathlib import Path
from urllib.error import URLError

logger = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parent.parent / "assets" / "models"
_PROTO_PATH = _MODELS_DIR / "gender_deploy.prototxt"
_MODEL_PATH = _MODELS_DIR / "gender_net.caffemodel"

_PROTO_URLS = [
    "https://raw.githubusercontent.com/smahesh29/Gender-and-Age-Detection/master/gender_deploy.prototxt",
    "https://raw.githubusercontent.com/spmallick/learnopencv/master/AgeGender/gender_deploy.prototxt",
    "https://raw.githubusercontent.com/eveningglow/age-and-gender-classification/master/age-and-gender-classification/model/gender/deploy_gender.prototxt",
]
_MODEL_URLS = [
    "https://github.com/smahesh29/Gender-and-Age-Detection/raw/master/gender_net.caffemodel",
    "https://github.com/GilLevi/AgeGenderDeepLearning/raw/master/models/gender_net.caffemodel",
    "https://github.com/eveningglow/age-and-gender-classification/raw/master/age-and-gender-classification/model/gender/gender_net.caffemodel",
]

_MEAN_VALUES = (78.4263377603, 87.7689143744, 114.895847746)

_net = None  # cv2.dnn.Net — lazy initialized


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _download(url: str, dest: Path) -> bool:
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(
            url, headers={"User-Agent": "ActID-Demo/1.0"}
        )
        with urllib.request.urlopen(req, timeout=120, context=_ssl_context()) as resp:
            data = resp.read()
        dest.write_bytes(data)
        size_mb = len(data) / 1024 / 1024
        logger.info("Downloaded %s (%.1f MB)", dest.name, size_mb)
        return True
    except (URLError, TimeoutError, OSError) as exc:
        logger.warning("Could not download %s: %s", url, exc)
        return False


def _try_download_from(urls: list[str], dest: Path, min_size: int = 1000) -> bool:
    """Try each URL in order until one succeeds. min_size sanity-checks the result."""
    for url in urls:
        logger.info("Trying %s ...", url)
        if _download(url, dest) and dest.stat().st_size >= min_size:
            return True
        # Bad download — clean up
        if dest.exists() and dest.stat().st_size < min_size:
            dest.unlink(missing_ok=True)
    return False


def _ensure_models() -> bool:
    """Ensures both model files exist locally. Returns True if ready."""
    if not _PROTO_PATH.exists():
        logger.info("Downloading gender_deploy.prototxt...")
        if not _try_download_from(_PROTO_URLS, _PROTO_PATH, min_size=500):
            return False
    if not _MODEL_PATH.exists():
        logger.info("Downloading gender_net.caffemodel (~43MB, one-time)...")
        if not _try_download_from(_MODEL_URLS, _MODEL_PATH, min_size=1_000_000):
            return False
    return True


def _load_net():
    """Lazy-load Caffe net. Returns net or None on failure."""
    global _net
    if _net is not None:
        return _net
    try:
        import cv2  # noqa: F401  — confirm cv2 is importable
    except ImportError:
        logger.warning("cv2 (opencv-python) not available — gender classification disabled")
        return None
    if not _ensure_models():
        return None
    try:
        import cv2
        _net = cv2.dnn.readNetFromCaffe(str(_PROTO_PATH), str(_MODEL_PATH))
        return _net
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not load gender model: %s", exc)
        return None


def classify_gender(jpeg_bytes: bytes) -> str | None:
    """
    Classify gender from JPEG bytes.

    Returns:
        "M" / "F" / None (if classifier unavailable or image cannot be decoded)
    """
    net = _load_net()
    if net is None:
        return None
    try:
        import cv2
        import numpy as np

        arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        # AI faces from thispersondoesnotexist are 1024×1024 with face centered.
        # Center-crop 80% to focus on the face.
        h, w = img.shape[:2]
        size = int(min(h, w) * 0.8)
        y0 = (h - size) // 2
        x0 = (w - size) // 2
        face = img[y0:y0 + size, x0:x0 + size]

        blob = cv2.dnn.blobFromImage(face, 1.0, (227, 227), _MEAN_VALUES, swapRB=False)
        net.setInput(blob)
        preds = net.forward()
        gender_idx = int(preds[0].argmax())
        # Caffe model output: [Male=0, Female=1]
        return "M" if gender_idx == 0 else "F"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gender classification failed: %s", exc)
        return None
