# ActID

**Portofelul Digital al Cetățeanului Român — cu strat EUDI Wallet**
Cluj Hackathon 2026 · Tema: Digital Romania · 48h

---

## Ce este ActID?

ActID este o aplicație mobile-first care permite cetățenilor români să stocheze, gestioneze și partajeze selectiv documente de identitate digitale. Construit pe standardele **EUDI Wallet ARF 1.4** și **SD-JWT VC (IETF draft)**, oferă:

- **Notificări proactive** de expirare (30 / 7 / 1 zile înainte)
- **Delegare familială** — diaspora gestionează actele părinților din orice țară
- **Selective Disclosure** — cetățeanul alege exact ce atribute dezvăluie (ex: dovedești că ai >18 ani fără să expui CNP-ul)
- **Verificare criptografică SD-JWT** — funcționarul vede doar atributele autorizate, semnat de „Statul Român"
- **Audit imutabil SHA-256** — fiecare acțiune este înlănțuită criptografic, vizualizată ca blockchain

---

## Demo rapid

```bash
cd actid
./start.sh
```

Deschide `http://localhost:5173`

### Conturi demo

| Utilizator | Email | Parolă | Rol | Poveste |
|---|---|---|---|---|
| Ion Popescu | ion.popescu@gmail.com | Parola@123 | cetățean | CI expiră în 30 zile, cazier în 7 zile |
| Maria Ionescu | maria.ionescu@gmail.com | Parola@123 | cetățean | Toate actele valide, a delegat accesul fiului |
| Alexandru Ionescu | alex.ionescu@gmail.com | Parola@123 | cetățean | Diaspora Londra — gestionează actele mamei |
| Funcționar | functionar@spclep.ro | Parola@123 | funcționar | Scanează QR-uri și verifică prezentări EUDI |

**Cod 2FA (demo): `123456`**

---

## Fluxuri demo

### 1. Ion — Buletin care expiră
1. Login ca Ion → Dashboard arată alerta: *„CI expiră în 30 zile, cazier în 7 zile"*
2. Tab **Prezentare EUDI** → selectează CI → bifează doar `Prenume` + `Data nașterii` → generează QR
3. Funcționar scanează QR → vede **doar** cele 2 atribute + badge *„Verificat de Statul Român ✓"*
4. **Audit Log** → verifici lanțul SHA-256 → *„Lanț valid ✓"* + `CREDENTIAL_ISSUED`, `PRESENTATION_VERIFIED`

### 2. Alex — Diaspora (Londra)
1. Login ca Alex → banner diaspora pe Dashboard
2. Tab **Familie** → secțiunea *„Delegat mie"* → vede actele Mariei
3. **Rovinieta Mariei expiră în 10 zile** → click *„Solicită reînnoire"* din Londra
4. Tab **Securitate Wallet** → status criptare AES-256-GCM + fingerprint cheie publică issuer

### 3. Funcționar SPCLEP
1. Login ca funcționar → Portal dedicat, tab *„Prezentare EUDI"*
2. Introduce ID-ul sau URL-ul QR de la cetățean → verificare SD-JWT
3. Vede doar atributele dezvăluite + badge *„Emitent de încredere"*
4. Tab *„Token QR"* → scanează token-ul vechi de partajare

---

## Arhitectură

```
actid/
├── backend/                        # FastAPI + SQLAlchemy + SQLite
│   └── app/
│       ├── api/
│       │   ├── auth.py             # ROeID simulat + 2FA mock + JWT
│       │   ├── documents.py        # CRUD documente + status expirare
│       │   ├── sharing.py          # Token QR temporar (24h)
│       │   ├── family.py           # Delegări familie
│       │   ├── audit.py            # Jurnal blockchain
│       │   ├── functionar.py       # Portal funcționar (role-gated)
│       │   ├── notifications.py    # Alerte expirare (proprii + delegate)
│       │   ├── credentials.py      # Emitere SD-JWT VC + wallet security
│       │   ├── presentations.py    # Creare + verificare prezentări EUDI
│       │   └── identity.py         # OCR MRZ + verificare facială
│       ├── vc/
│       │   ├── sd_jwt.py           # Sign/verify SD-JWT (ES256, IETF draft)
│       │   └── issuer.py           # Mapare doc_type → vct + atribute
│       ├── crypto/
│       │   ├── keys.py             # Keypair P-256 (generat la startup)
│       │   └── vault.py            # AES-256-GCM encryption at rest
│       ├── trust/
│       │   ├── registry.py         # Trust registry EUDI
│       │   └── issuers.json        # Emitenți de încredere
│       ├── ledger.py               # SHA-256 chained append-only log
│       ├── models/models.py        # User, Document, ShareToken,
│       │                           # DelegationGrant, AuditEntry, PresentationLog
│       └── seed.py                 # Date demo idempotente
│
├── frontend/                       # React 18 + Vite + TypeScript
│   └── src/
│       ├── pages/
│       │   ├── PresentationsPage   # Selective disclosure + QR generator
│       │   ├── SecurityPage        # Status wallet, issuers, istoric prezentări
│       │   ├── FunctionarPage      # Verificare EUDI + token QR (2 tab-uri)
│       │   ├── DashboardPage       # Alerte expirare, acțiuni rapide
│       │   ├── DocumentsPage       # CRUD documente
│       │   ├── FamilyPage          # Delegări date/primite
│       │   ├── SharingPage         # Token QR vechi
│       │   ├── AuditLogPage        # Vizualizare blockchain
│       │   └── NotificationsPage   # Centru notificări
│       ├── components/
│       │   ├── layout/             # AppLayout, SideNav, BottomNav
│       │   ├── documents/          # DocumentCard cu status badges
│       │   ├── sharing/            # QRGenerator
│       │   └── ui/                 # Button, Badge, Card, StatusBadge
│       ├── store/                  # Zustand: auth, documents, notifications
│       └── lib/api.ts              # Axios client + toate TypeScript types
│
├── start.sh                        # One-command local dev (fără Docker)
└── docker-compose.yml              # Backend + Frontend containerizat
```

---

## Stack tehnic

| Layer | Tehnologie |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| State | Zustand |
| Routing | React Router v6 |
| Backend | FastAPI, SQLAlchemy, SQLite |
| Auth | JWT + ROeID simulat + 2FA mock |
| SD-JWT VC | `sd-jwt` (IETF OWEF), `jwcrypto`, ES256 / P-256 |
| Encryption at rest | AES-256-GCM + HKDF-SHA256 (câmpuri sensibile în DB) |
| Audit chain | SHA-256 append-only ledger, verificabil |
| QR | `qrcode.react` (generare), scanare manuală + auto via URL |
| Containere | Docker Compose |

---

## API Reference

Documentație interactivă: `http://localhost:8000/docs`

### Auth
| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/auth/login` | POST | Autentificare ROeID → `session_token` |
| `/api/auth/verify-2fa` | POST | OTP → `access_token` JWT |
| `/api/auth/me` | GET | Profil utilizator curent |

### Documente & Partajare
| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/documents/` | GET | Documente proprii cu status + zile rămase |
| `/api/documents/delegated` | GET | Documente delegate de familie |
| `/api/documents/renewal-request` | POST | Solicită reînnoire (owner sau delegat) |
| `/api/sharing/tokens` | POST/GET | Creare / listare token QR (24h) |
| `/api/sharing/scan/{token}` | GET | Scanare token de funcționar |

### EUDI Wallet
| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/credentials/{doc_id}` | GET | Emite SD-JWT VC semnat ES256 pentru document |
| `/api/presentations` | POST | Crează prezentare cu atribute selectate + QR |
| `/api/presentations/{id}/scan` | GET | Verifică SD-JWT, întoarce atributele dezvăluite (funcționar) |
| `/api/wallet/security` | GET | Status criptare, issueri trusted, fingerprint cheie |
| `/api/wallet/presentations-history` | GET | Istoricul prezentărilor generate |

### Familie & Notificări
| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/family/delegations` | GET/POST | Delegări create |
| `/api/family/delegated-to-me` | GET | Delegări primite |
| `/api/notifications/` | GET | Alerte expirare (proprii + delegate) |

### Audit & Funcționar
| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/audit/entries` | GET | Jurnal paginat (cetățean: propriu; funcționar: tot) |
| `/api/audit/verify` | GET | Verificare integritate lanț SHA-256 |
| `/api/functionar/recent-scans` | GET | Ultimele 20 scanări cu context |
| `/api/functionar/stats` | GET | Statistici azi / săptămână / cetățeni unici |

---

## Instalare locală

### Fără Docker (recomandat pentru dev)

```bash
git clone https://github.com/AndreiRusneac/Hackathon.git
cd Hackathon/actid
./start.sh
```

> **Dependențe opționale** (pentru scanarea documentelor de identitate):
> ```bash
> brew install tesseract
> pip install face_recognition
> ```
> Fără acestea, restul aplicației funcționează normal — endpoint-urile de identitate returnează `503`.

### Manual

```bash
# Backend
cd actid/backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --port 8000 --reload

# Frontend (terminal separat)
cd actid/frontend
npm install
npm run dev
```

### Cu Docker

```bash
cd actid
docker-compose up --build
# Frontend: http://localhost (Nginx, port 80)
# API:      http://localhost:8000
```

---

## Securitate & Criptografie

| Mecanism | Detalii |
|---|---|
| **SD-JWT signing** | ES256 / P-256, cheie generată la startup în `backend/app/keys/` (`.gitignore`) |
| **Encryption at rest** | AES-256-GCM, cheie derivată din `SECRET_KEY` cu HKDF-SHA256 |
| **Câmpuri criptate** | `documents.cnp`, `documents.photo_base64` |
| **Selective Disclosure** | Salt 16 bytes random per atribut, hash SHA-256, standard IETF SD-JWT VC |
| **Audit chain** | SHA-256 înlănțuit, append-only, fără DELETE posibil |
| **RBAC** | `cetățean` / `funcționar` enforce-uit pe fiecare endpoint |

---

## Criterii de evaluare

| Criteriu | Punctaj | Status |
|---|---|---|
| UX / Usabilitate | 25 pts | Mobile-first, WCAG AA, română, skeleton states |
| Impact Social | 25 pts | Diaspora, vârstnici, delegare familie, selective disclosure |
| Demo funcțional | 20 pts | 5 fluxuri complete end-to-end |
| Fezabilitate tehnică | 20 pts | Arhitectură curată, EUDI ARF 1.4, Docker prod |
| Coerență Digital Romania | 10 pts | ROeID, acte românești, UI integral în română |

---

## Echipa

| Membru | Branch | Contribuție |
|---|---|---|
| Andrei Rusneac | `eudi/mvp-andrei` | Scaffold + backend crypto (SD-JWT, AES vault, keypair, issuance) |
| Radu | `eudi/mvp-radu` | Backend verifier + trust registry + `POST /api/presentations` |
| Alissia | `eudi/mvp-alissia` | Frontend Presentations UX (checkbox atribute, QR generator) |
| Teo | `eudi/mvp-teo` | Frontend Wallet Security page (`/securitate`) |

---

*Built in 48h for Cluj Hackathon 2026 · Digital Romania*