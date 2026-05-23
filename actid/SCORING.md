# ActID — Checklist punctare hackathon

Maparea fiecărui criteriu de jurizare la implementarea concretă din cod.
Total: **100 puncte**.

| Criteriu | Punctaj | Implementare | Fișiere principale |
|---|---|---|---|
| **Impact social** | 25 pts | Flux diaspora (delegare, reînnoire la distanță), notificări proactive, selective disclosure pentru protecția datelor personale | `frontend/src/pages/FamilyPage.tsx`, `backend/app/api/family.py`, `backend/app/api/notifications.py` |
| **UX / Usability** | 25 pts | Mobile-first, navigare de jos, contrast WCAG AA, etichete ARIA, skeleton states, toast feedback, UI integral în română | `frontend/src/components/`, `frontend/src/index.css`, toate paginile |
| **Fezabilitate tehnică** | 20 pts | Arhitectură curată FastAPI + React, SD-JWT VC (IETF standard), AES-256-GCM encryption at rest, Docker production-ready | `backend/app/vc/`, `backend/app/crypto/`, `docker-compose.yml` |
| **Demo funcțional** | 20 pts | 5 fluxuri complete: login+2FA, expirare + notificări, selective disclosure EUDI, diaspora/delegare, audit blockchain | `DEMO_SCRIPT.md`, `backend/app/api/`, `frontend/src/pages/` |
| **Coerență Digital Romania** | 10 pts | ROeID simulat, acte specific românești (CI, cazier, rovinietă), issuer „Statul Român — MAI", tot UI-ul în română | `backend/app/api/auth.py`, `backend/app/trust/issuers.json`, `backend/app/seed.py` |

---

## Detaliere pe criterii

### Impact social — 25 pts

- **Diaspora**: Maria (Cluj) a delegat actele către Alex (Londra); Alex le vede, primește alerte de expirare și poate solicita reînnoire de la distanță.
- **Vârstnici**: notificările proactive elimină nevoia de a urmări manual zeci de termene; delegarea permite unui copil să se ocupe de acte.
- **Protecția datelor**: selective disclosure — cetățeanul alege exact ce atribute dezvăluie (ex: dovedește vârsta fără să expună CNP-ul).
- Consimțământ explicit la delegare, cu categorii de documente limitate și termen de valabilitate.

### UX / Usability — 25 pts

- Layout mobile-first (breakpoint primar 375px), navigare de jos (`BottomNav`).
- Componente accesibile: focus vizibil, `aria-label`, `aria-pressed`, navigare la tastatură.
- Stări de încărcare (skeleton), feedback prin toast-uri, empty states clare.
- Pagina de securitate wallet cu fingerprint cheie publică, status criptare vizual.
- UI selective disclosure: chip-uri toggle cu marcaj vizual pentru atribute sensibile (CNP, adresă).

### Fezabilitate tehnică — 20 pts

- Backend FastAPI cu module separate pe domenii (auth, documents, sharing, family, audit, credentials, presentations).
- **SD-JWT VC** (standard IETF / EUDI ARF 1.4): emitere ES256, selective disclosure cu salt random per atribut, verificare criptografică.
- **Encryption at rest**: AES-256-GCM + HKDF-SHA256 pentru CNP și poze în SQLite.
- **Keypair management**: P-256 generat la startup, stocat în PEM 0600, fingerprint expus în UI.
- **Trust Registry**: `issuers.json` cu JWK public, lookup by kid/iss URL.
- **Ledger SHA-256**: registru append-only verificabil — `backend/app/ledger.py`.
- Docker: `docker-compose up --build` pornește totul, Nginx servește SPA-ul și proxiază `/api`.

### Demo funcțional — 20 pts

Cinci fluxuri demonstrabile end-to-end (vezi `DEMO_SCRIPT.md`):
1. Login → ROeID → 2FA → Dashboard cu alerte de expirare.
2. Selective disclosure EUDI: cetățean bifează atribute → QR → funcționar verifică → vede doar ce a fost dezvăluit.
3. Delegare familie / scenariul diaspora + solicită reînnoire de la distanță.
4. Partajare QR clasică cu scop temporar + scanare de către funcționar.
5. Jurnal de audit blockchain + verificarea integrității lanțului.

### Coerență Digital Romania — 10 pts

- Flux de autentificare ROeID simulat cu 2FA.
- Issuer: „Statul Român — Ministerul Afacerilor Interne" în trust registry.
- Documente specific românești în datele seed: CI, pașaport, permis, cazier, certificat naștere, rovinietă.
- Întregul UI și toate mesajele sunt în limba română.
- `vct` mapate: `RomanianID`, `Passport`, `DriverLicense`, `GenericAttestation`.

---

## Componente cheie de evidențiat la jurizare

| Funcționalitate | Unde se vede | Endpoint / fișier |
|---|---|---|
| Selective Disclosure SD-JWT | Pagina Prezentare EUDI | `backend/app/vc/sd_jwt.py`, `POST /api/presentations` |
| Verificare criptografică | Portal Funcționar → tab EUDI | `GET /api/presentations/{id}/scan` |
| Encryption at rest AES-256-GCM | Pagina Securitate Wallet | `backend/app/crypto/vault.py`, `GET /api/wallet/security` |
| Keypair P-256 + fingerprint | Pagina Securitate Wallet | `backend/app/crypto/keys.py` |
| Ledger SHA-256 înlănțuit | Pagina Jurnal de Audit | `backend/app/ledger.py`, `GET /api/audit/entries` |
| Verificare integritate lanț | Buton „Verifică" | `GET /api/audit/verify` |
| Delegare familie | Pagina Family | `backend/app/api/family.py` |
| Partajare QR clasică | Pagina Sharing | `backend/app/api/sharing.py` |
| Control acces pe roluri | Vizibilitate diferită cetățean/funcționar | `backend/app/api/auth.py` (`require_role`) |