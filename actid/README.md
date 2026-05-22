# ActID 🪪

**Portofelul Digital al Cetățeanului Român**  
Cluj Hackathon 2026 · Tema: Digital Romania · 48h

---

## Ce este ActID?

ActID este o aplicație mobilă-first care permite cetățenilor români să stocheze, gestioneze și partajeze temporar documente de identitate digitale — cu notificări proactive de expirare, delegare familială și jurnal de audit imutabil pe blockchain simulat.

### De ce ActID în loc de EU Digital Identity Wallet?

| Funcționalitate | EUDIW | ActID |
|---|---|---|
| Notificări proactive de expirare | ❌ pasiv | ✅ 30/7/1 zile înainte |
| Documente românești specifice (Rovinietă, ONRC, ANAF) | ❌ | ✅ |
| Delegare familială (diaspora → părinți) | ❌ | ✅ |
| Partajare QR temporară și contextuală | ❌ | ✅ |
| Disponibil acum în România | ❌ | ✅ |

---

## Demo rapid

```bash
cd actid
./start.sh
```

Deschide **http://localhost:5173**

### Conturi demo

| Utilizator | Email | Parolă | Poveste |
|---|---|---|---|
| Ion Popescu | ion.popescu@gmail.com | Parola@123 | CI expiră în 30 zile, cazier în 7 zile |
| Maria Ionescu | maria.ionescu@gmail.com | Parola@123 | Toate actele la zi, a delegat accesul fiului |
| Alexandru Ionescu | alex.ionescu@gmail.com | Parola@123 | Diaspora Londra — gestionează actele mamei |
| Funcționar | functionar@spclep.ro | Parola@123 | Scanează QR-uri de la cetățeni |

**Cod 2FA (demo): `123456`**

---

## Fluxuri demo

### 1. Ion — Buletin care expiră
1. Login ca Ion → dashboard arată alertă: *"CI expiră în 30 zile"*
2. Tab Documente → badge amber pe CI, badge roșu pe cazier (7 zile)
3. Sharing → selectezi CI → generezi QR cu context "Angajator"
4. Audit Log → verifici lanțul SHA-256 → "Lanț valid ✓"

### 2. Alex — Diaspora (Londra)
1. Login ca Alex → banner diaspora pe dashboard
2. Tab Familie → "Primit" → vede delegarea de la Maria
3. Documente delegate → Rovinieta Mariei expiră în 10 zile
4. Solicită reînnoire din Londra fără să fie fizic în România

### 3. Funcționar SPCLEP
1. Login ca funcționar → portal dedicat
2. Scanează token QR → vede documentele cetățeanului verificate
3. Istoricul scanărilor în Jurnalul de Audit

---

## Arhitectură

```
actid/
├── backend/                  # FastAPI + SQLAlchemy + SQLite
│   └── app/
│       ├── api/
│       │   ├── auth.py       # ROeID simulat + 2FA mock + JWT
│       │   ├── documents.py  # CRUD documente + status expirare
│       │   ├── sharing.py    # Token QR temporar (24h)
│       │   ├── family.py     # Delegări familie
│       │   └── audit.py     # Jurnal blockchain
│       ├── ledger.py         # SHA-256 chained append-only log
│       ├── models/models.py  # SQLAlchemy: User, Document, ShareToken,
│       │                     #             DelegationGrant, AuditEntry
│       └── seed.py           # Date demo: Ion, Maria, Alex, Funcționar
│
├── frontend/                 # React 18 + Vite + TypeScript
│   └── src/
│       ├── pages/            # Login, Dashboard, Documents,
│       │                     # Sharing, Family, AuditLog
│       ├── components/
│       │   ├── layout/       # AppLayout, SideNav, BottomNav
│       │   ├── documents/    # DocumentCard cu status badges
│       │   ├── sharing/      # QRGenerator cu qrcode.react
│       │   ├── notifications/# NotificationBanner proactiv
│       │   └── ui/           # Button, Badge, Card, Input, Alert
│       ├── store/            # Zustand: auth, documents, notifications
│       └── lib/              # API client (axios), utils, tipuri
│
├── start.sh                  # One-command local dev (fără Docker)
└── docker-compose.yml        # Backend + Frontend containerizat
```

---

## Stack tehnic

| Layer | Tehnologie |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| State | Zustand |
| Routing | React Router v6 |
| Backend | FastAPI, SQLAlchemy, SQLite |
| Auth | JWT + ROeID simulat + 2FA mock (TOTP) |
| Blockchain sim | SHA-256 chained audit log, append-only |
| QR | qrcode.react (generare), scanare manuală |
| Containere | Docker Compose |

---

## Cerințe tehnice obligatorii ✅

- [x] **ROeID simulat** cu 2FA (cod OTP mock `123456`)
- [x] **JWT** cu expirare (8h pentru demo)
- [x] **Jurnal de audit imutabil** — SHA-256 chaining, append-only, fără DELETE
- [x] **RBAC** — cetățean / funcționar / sistem enforce-uit pe fiecare endpoint
- [x] **Mobile-first** — breakpoint 375px primar, bottom nav pe mobil
- [x] **WCAG AA** — contrast, aria-labels, keyboard navigation, focus rings

---

## Instalare locală

### Fără Docker (recomandat)

```bash
git clone https://github.com/AndreiRusneac/Hackathon.git
cd Hackathon/actid
./start.sh
```

Scriptul instalează automat dependențele Python și npm dacă lipsesc.

### Manual

```bash
# Backend
cd actid/backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --port 8000 --reload

# Frontend (terminal separat)
cd actid/frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

### Cu Docker

```bash
cd actid
docker-compose up --build
```

---

## API Reference

Documentație interactivă: **http://localhost:8000/docs**

| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/auth/login` | POST | Autentificare ROeID (returnează session_token) |
| `/api/auth/verify-2fa` | POST | Verificare OTP → JWT access token |
| `/api/auth/me` | GET | Profil utilizator curent |
| `/api/documents/` | GET | Lista documentelor proprii |
| `/api/documents/delegated` | GET | Documente delegate de familie |
| `/api/sharing/tokens` | POST | Creare token QR (24h) |
| `/api/sharing/scan/{token}` | GET | Scanare token de funcționar |
| `/api/family/delegations` | GET/POST | Gestionare delegări |
| `/api/audit/entries` | GET | Jurnal de audit |
| `/api/audit/verify` | GET | Verificare integritate lanț SHA-256 |

---

## Contribuitori

| Membru | Branch | Feature |
|---|---|---|
| Andrei Rusneac | `main` | Scaffold + arhitectură |
| — | `feat/ux-polish` | UI/UX & accesibilitate |
| — | `feat/notifications` | Notificări proactive |
| — | `feat/functionar-portal` | Portal funcționar & QR scan |
| — | `feat/diaspora-story` | Diaspora, familie & vârstnici |

---

## Criterii de evaluare

| Criteriu | Punctaj | Status |
|---|---|---|
| UX / Usabilitate | 25 pts | 🔄 în progres |
| Impact Social | 25 pts | 🔄 în progres |
| Demo funcțional | 20 pts | ✅ toate fluxurile verificate |
| Fezabilitate tehnică | 20 pts | ✅ arhitectură curată |
| Coerență Digital Romania | 10 pts | ✅ context românesc complet |

---

*Built in 48h for Cluj Hackathon 2026 · Digital Romania*
