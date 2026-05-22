# ActID — Checklist punctare hackathon

Maparea fiecărui criteriu de jurizare la implementarea concretă din cod.
Total: **100 puncte**.

| Criteriu | Punctaj | Implementare | Fișiere principale |
|---|---|---|---|
| **Impact social** | 25 pts | Flux diaspora (delegare către familie, administrare de la distanță), notificări proactive pentru vârstnici | `frontend/src/pages/FamilyPage.tsx`, `frontend/src/pages/DashboardPage.tsx`, `backend/app/api/family.py` |
| **UX / Usability** | 25 pts | Mobile-first, navigare de jos, contrast WCAG AA, etichete ARIA, interfață integral în română | `frontend/src/components/`, `frontend/src/index.css`, toate paginile din `frontend/src/pages/` |
| **Fezabilitate tehnică** | 20 pts | Arhitectură curată FastAPI + React, separare API/UI, Docker production-ready cu un singur `docker-compose up` | `backend/app/`, `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` |
| **Demo funcțional** | 20 pts | 4 fluxuri complete: login+2FA, expirare documente, diaspora/delegare, partajare QR + scanare funcționar | `DEMO_SCRIPT.md`, `backend/app/api/`, `frontend/src/pages/` |
| **Coerență Digital Romania** | 10 pts | ROeID simulat, acte specific românești (CI, cazier, rovinietă, ANAF/ONRC), tot UI-ul în română | `backend/app/api/auth.py`, `backend/app/seed.py`, `frontend/src/lib/utils.ts` |

---

## Detaliere pe criterii

### Impact social — 25 pts
- **Diaspora**: Maria (Cluj) a delegat actele către fiul Alex (Londra); Alex
  le vede și poate solicita reînnoiri de la distanță.
- **Vârstnici**: notificările proactive de expirare elimină nevoia de a
  urmări manual zeci de termene.
- Consimțământ explicit la delegare, cu categorii de documente limitate.

### UX / Usability — 25 pts
- Layout mobile-first, navigare de jos (`BottomNav`).
- Componente accesibile: focus vizibil, `aria-label`, navigare la tastatură,
  contrast conform WCAG AA.
- Stări de încărcare (skeleton), feedback prin toast-uri.

### Fezabilitate tehnică — 20 pts
- Backend FastAPI cu rutere separate pe domenii (auth, documents, sharing,
  family, audit) și documentație automată la `/docs`.
- Frontend React 18 + TypeScript + Zustand, build static.
- Docker: `docker-compose up --build` pornește totul, fără pași manuali;
  Nginx servește SPA-ul și direcționează `/api` către backend.
- **Ledger SHA-256**: registru append-only verificabil — `backend/app/ledger.py`.

### Demo funcțional — 20 pts
Patru fluxuri demonstrabile end-to-end (vezi `DEMO_SCRIPT.md`):
1. Login → ROeID → 2FA → Dashboard cu alerte de expirare.
2. Delegare familie / scenariul diaspora.
3. Partajare QR cu scop temporar + scanare de către funcționar.
4. Jurnal de audit blockchain + verificarea integrității lanțului.

### Coerență Digital Romania — 10 pts
- Flux de autentificare ROeID simulat cu 2FA.
- Documente specific românești în datele seed: CI, pașaport, permis, cazier,
  certificat de naștere, rovinietă, ANAF, ONRC.
- Întregul UI și toate mesajele sunt în limba română.

---

## Componente cheie de evidențiat la jurizare

| Funcționalitate | Unde se vede | Endpoint / fișier |
|---|---|---|
| Ledger SHA-256 înlănțuit | Pagina Jurnal de Audit | `backend/app/ledger.py`, `GET /api/audit/entries` |
| Verificare integritate lanț | Buton „Verifică" | `GET /api/audit/verify` |
| Statistici audit | Carduri sus pe pagina de audit | `GET /api/audit/stats` |
| Delegare familie | Pagina Family | `backend/app/api/family.py` |
| Partajare QR cu scop | Pagina Sharing | `backend/app/api/sharing.py` |
| Control acces pe roluri | Vizibilitate diferită cetățean/funcționar | `backend/app/api/auth.py` (`require_role`) |
