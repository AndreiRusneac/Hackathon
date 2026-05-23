from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, SessionLocal
from .api import auth, documents, sharing, family, audit, functionar, notifications, identity
from .models import models  # noqa: F401 — registers models with Base

app = FastAPI(
    title="ActID API",
    description="Romanian Digital Identity Wallet — Cluj Hackathon 2026",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(sharing.router, prefix="/api")
app.include_router(family.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(functionar.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(identity.router, prefix="/api")


# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    # Add new columns to existing DBs (SQLite doesn't auto-migrate)
    from sqlalchemy import text
    with engine.connect() as conn:
        for col, definition in [("photo_base64", "TEXT"), ("cnp", "VARCHAR(13)")]:
            try:
                conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col} {definition}"))
                conn.commit()
            except Exception:
                pass  # column already exists
    db = SessionLocal()
    try:
        from .seed import seed_database
        seed_database(db)
    finally:
        db.close()


# ── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "ActID API", "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "service": "ActID — Portofelul Digital al Cetățeanului Român",
        "docs": "/docs",
        "health": "/health",
    }
