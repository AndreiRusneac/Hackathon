# ActID — Romanian Digital Identity Wallet

Hackathon Cluj 2026 · Theme: Digital Romania · 48h build

## Quick Start

```bash
# One command (recommended — no Docker needed)
cd actid
./start.sh

# Manual (backend)
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000

# Manual (frontend) — separate terminal
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

API docs (Swagger): http://localhost:8000/docs

## Demo Accounts

| User | Email | Password | Role |
|------|-------|----------|------|
| Ion Popescu | ion.popescu@gmail.com | Parola@123 | cetățean |
| Maria Ionescu | maria.ionescu@gmail.com | Parola@123 | cetățean |
| Alex Ionescu | alex.ionescu@gmail.com | Parola@123 | cetățean — diaspora Londra |
| Funcționar | functionar@spclep.ro | Parola@123 | funcționar |

**2FA code (demo): 123456**

## Architecture

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Auth**: JWT + simulated ROeID OAuth + mock 2FA
- **Ledger**: SHA-256 chained append-only audit log in SQLite
- **bcrypt** directly — NOT passlib (broken on Python 3.14)

## Backend File Structure

```
backend/app/
  main.py            — app init, CORS, router registration, startup seed
  config.py          — Settings (SECRET_KEY, DATABASE_URL, CORS_ORIGINS)
  database.py        — SQLAlchemy engine + get_db()
  ledger.py          — SHA-256 audit chain (do not modify)
  seed.py            — idempotent demo data (runs on startup)
  models/models.py   — all SQLAlchemy models
  schemas/schemas.py — all Pydantic schemas
  api/
    auth.py          — /api/auth/* + get_current_user_dep + require_role()
    documents.py     — /api/documents/*
    sharing.py       — /api/sharing/*
    family.py        — /api/family/*
    audit.py         — /api/audit/*
    functionar.py    — /api/functionar/* (role-gated: funcționar only)
    notifications.py — /api/notifications/*
```

## Key Flows

1. Login → ROeID branding → 2FA (code: 123456) → Dashboard
2. Ion's buletin expires in 30 days → alert on dashboard
3. Alex (London) → sees Maria's delegated documents
4. Create QR share → funcționar scans → audit log updated
5. Audit log → blockchain chain visualization
6. Alex (delegate) → Family → expand delegated doc → "Solicită reînnoire" → audit log gets RENEWAL_REQUEST entry

## API Endpoints

### Auth
- `POST /api/auth/login` → `{session_token, demo_otp}`
- `POST /api/auth/verify-2fa` → `{access_token, user}`
- `GET  /api/auth/me`
- `POST /api/auth/logout`

### Documents (cetățean only — funcționar gets 403)
- `GET    /api/documents/` — own documents with computed status + days_remaining
- `GET    /api/documents/{id}`
- `POST   /api/documents/` — create document
- `DELETE /api/documents/{id}` — owner only
- `GET    /api/documents/delegated` — docs delegated to current user
- `POST   /api/documents/renewal-request` — body: `{document_id, note}`; owner or delegate with `request_renewal` permission

### Sharing
- `POST   /api/sharing/tokens` — create QR token
- `GET    /api/sharing/tokens` — list own tokens
- `GET    /api/sharing/scan/{token}` — funcționar scans QR; records ShareScanLog
- `DELETE /api/sharing/tokens/{id}` — revoke

### Family / Delegation
- `GET    /api/family/delegations` — delegations I created
- `POST   /api/family/delegations` — create delegation
- `DELETE /api/family/delegations/{id}` — revoke
- `GET    /api/family/delegated-to-me` — delegations I received

### Audit
- `GET /api/audit/entries` — paginated; cetățean sees own, funcționar sees all
- `GET /api/audit/verify` — SHA-256 chain check
- `GET /api/audit/stats`

### Funcționar Portal (role=funcționar required)
- `GET /api/functionar/recent-scans` — last 20 scans with owner name, doc types, context
- `GET /api/functionar/stats` — `{total_scans_today, total_scans_week, unique_citizens}`

### Notifications
- `GET /api/notifications/` — expiring/expired docs (own + delegated); severity: urgent/warning/expired

## RBAC Rules
- **cetățean**: own documents only; can delegate, share, request renewal
- **funcționar**: scan QR tokens only; 403 on all `/api/documents/*` endpoints
- Delegation validity: checked via `is_active.is_(True)` AND `valid_until > now`

## Audit Pattern
```python
from app.ledger import add_audit_entry
add_audit_entry(db, action="ACTION_NAME", actor_id=..., actor_name=...,
                actor_role=..., target_document_id=..., metadata={...})
db.commit()  # always after add_audit_entry
```

## Document Status Logic (`_doc_status` in documents.py)
- `expires_date is None` → `"valid"`, days=None
- `delta < 0` → `"expirat"`, days=delta
- `0 <= delta <= 30` → `"expiră_curând"`, days=delta  (includes TODAY)
- `delta > 30` → `"valid"`, days=delta

## Demo Scenarios (seeded)
- **Ion**: CI expires in 30d (warning), cazier expires in 7d (urgent)
- **Maria**: all docs valid; active delegation to Alex for CI/PASAPORT/ROVINIETA/PERMIS
- **Alex**: location=Londra; sees Maria's rovinieta expiring in 10d via delegation
- **Funcționar**: 3 seeded scan logs (Ion/Maria/Alex); stats show 2 today, 3 this week

## Scoring

- UX/Usability: 25pts — mobile-first, WCAG AA
- Impact Social: 25pts — diaspora story, elderly
- Demo funcțional: 20pts — all flows working
- Fezabilitate tehnică: 20pts — clean architecture
- Coerență Digital Romania: 10pts — Romanian context