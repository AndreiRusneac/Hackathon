FROM python:3.11-slim

WORKDIR /app

# System dependencies:
#   tesseract-ocr        — OCR engine used by passporteye (MRZ scanning)
#   libgl1 / libglib2.0  — OpenCV runtime (used internally by passporteye)
#   cmake + build-essential — needed to compile dlib (face_recognition backend)
#   libboost-all-dev     — dlib link-time dependency
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        tesseract-ocr \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libgomp1 \
        cmake \
        build-essential \
        libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
