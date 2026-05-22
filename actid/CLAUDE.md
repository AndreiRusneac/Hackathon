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

## Demo Accounts

| User | Email | Password | Role |
|------|-------|----------|------|
| Ion Popescu | ion.popescu@gmail.com | Parola@123 | cetățean |
| Maria Ionescu | maria.ionescu@gmail.com | Parola@123 | cetățean |
| Alex Ionescu | alex.ionescu@gmail.com | Parola@123 | cetățean |
| Funcționar | functionar@spclep.ro | Parola@123 | funcționar |

**2FA code (demo): 123456**

## Architecture

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Auth**: JWT + simulated ROeID OAuth + mock 2FA
- **Ledger**: SHA-256 chained append-only audit log in SQLite

## Key Flows

1. Login → ROeID branding → 2FA (code: 123456) → Dashboard
2. Ion's buletin expires in 30 days → alert on dashboard
3. Alex (London) → sees Maria's delegated documents
4. Create QR share → funcționar scans → audit log updated
5. Audit log → blockchain chain visualization
6. Alex (delegate) → Family → expand delegated doc → "Solicită reînnoire" → audit log gets RENEWAL_REQUEST entry

## Scoring

- UX/Usability: 25pts — mobile-first, WCAG AA
- Impact Social: 25pts — diaspora story, elderly
- Demo funcțional: 20pts — all flows working
- Fezabilitate tehnică: 20pts — clean architecture
- Coerență Digital Romania: 10pts — Romanian context