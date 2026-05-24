# CLAUDE_Teo.md — Teo's Frontend Scope

Branch: `eudi/mvp-Teo` | Role: Frontend Logic, Auth Flows, Stores, Error Handling

---

## Post-merge state (after integrating origin/main)

- **FamilyPage** no longer manages diaspora delegations — it's now parent/child
  management (ChildProfile, ChildGuardian, ChildDocument), auto-expiring guardian
  links at child's 18th birthday. Delegation flow was dropped in favor of the
  EUDI presentation flow on PresentationsPage.
- **DocumentsPage** no longer uses manual add / camera-scan to create documents.
  It now opens a **catalog modal** (`documentsApi.catalog()` + `request()`) that
  emits documents from mock issuing authorities. Existing docs render via the
  visual templates in `components/documents/templates/` (CI, Pașaport, Permis)
  with an `OfficialStamp` overlay. Children's documents are listed at the bottom
  with `?child=<id>` deep linking from FamilyPage.
- **Encryption-at-rest** lives in `backend/app/crypto/vault.py` (AES-256-GCM,
  per-user keys via `enc_v2:` prefix). The earlier local `encryption.py` /
  `blockchain.py` / `contracts/` / `deploy_contract.py` were dead code and have
  been removed.

---

## What Teo Owns

| Area | Files |
|------|-------|
| API client & interceptor | `frontend/src/lib/api.ts` |
| Error helper | `frontend/src/lib/api.ts` → `getErrMsg` |
| Notification store | `frontend/src/store/notificationStore.ts` |
| UI primitives | `frontend/src/components/ui/index.tsx` → `ConfirmDialog` |
| Layout auth listener | `frontend/src/components/layout/AppLayout.tsx` |
| Document card (renewal) | `frontend/src/components/documents/DocumentCard.tsx` |
| Pages (all logic rewrites) | `DashboardPage`, `DocumentsPage`, `FamilyPage`, `AuditLogPage`, `SharingPage`, `LoginPage` |
| Types | `frontend/src/types/index.ts` → `AuditStats` |
| Utils | `frontend/src/lib/utils.ts` → `ACTION_LABELS.RENEWAL_REQUEST` |
| Backend renewal endpoint | `backend/app/api/documents.py` → `POST /documents/renewal-request` |
| Backend SQLAlchemy fixes | `backend/app/api/documents.py`, `family.py` |
| Schemas | `backend/app/schemas/schemas.py` → `RenewalRequestCreate`, `RenewalRequestResponse` |

---

## Patterns — Follow These Everywhere

### 1. Error handling — `getErrMsg`

```ts
// lib/api.ts — already exported
export function getErrMsg(err: unknown, fallback = "A apărut o eroare"): string

// In every catch block:
catch (err) {
  addToast(getErrMsg(err, "Eroare la încărcarea datelor"), "error");
}
// NEVER: catch (e: any) { ... e.message ... }
```

### 2. Stable load functions — `useCallback` + `useEffect`

```tsx
const load = useCallback(async () => {
  // fetch + setState
}, [storeAction, addToast]);   // only stable Zustand actions as deps

useEffect(() => { load(); }, [load]);
```

### 3. Confirm dialogs — `ConfirmDialog` (not `window.confirm`)

```tsx
// State
const [confirmDoc, setConfirmDoc] = useState<Document | null>(null);

// Trigger
<Button onClick={() => setConfirmDoc(doc)}>Șterge</Button>

// Dialog (at bottom of JSX)
<ConfirmDialog
  open={!!confirmDoc}
  title="Șterge document"
  description={`Ești sigur că vrei să ștergi "${confirmDoc?.doc_type}"?`}
  confirmLabel="Șterge"
  destructive
  onConfirm={handleConfirmDelete}
  onCancel={() => setConfirmDoc(null)}
/>
```

### 4. Force-logout on 401 — custom event

```ts
// lib/api.ts interceptor dispatches:
window.dispatchEvent(new CustomEvent("actid:logout"));

// AppLayout.tsx catches:
useEffect(() => {
  const handleForceLogout = () => { logout(); navigate("/login", { replace: true }); };
  window.addEventListener("actid:logout", handleForceLogout);
  return () => window.removeEventListener("actid:logout", handleForceLogout);
}, [logout, navigate]);
```

### 5. Backend SQLAlchemy boolean filter

```python
# CORRECT — works with SQLAlchemy
DelegationGrant.is_active.is_(True)
# WRONG — causes warnings / wrong results
DelegationGrant.is_active == True
```

### 6. Backend UTC date

```python
from datetime import datetime, timezone
datetime.now(timezone.utc).date()   # correct — timezone-aware
# NOT date.today()                  — broken for UTC-offset environments
```

---

## API Methods Available (`lib/api.ts`)

```ts
authApi.login(identifier, password)
authApi.verify2FA(session_token, otp_code)
authApi.me()
authApi.logout()

documentsApi.list()
documentsApi.get(id)
documentsApi.create(data)
documentsApi.delete(id)
documentsApi.delegated()
documentsApi.renewalRequest(document_id, note?)   // ← added by Teo

sharingApi.createToken(data)
sharingApi.listTokens()
sharingApi.scan(token)
sharingApi.revokeToken(id)

familyApi.listDelegations()
familyApi.listDelegatedToMe()
familyApi.createDelegation(data)
familyApi.revokeDelegation(id)

auditApi.entries(params)
auditApi.verify()
auditApi.stats()
```

---

## Notification Store (`store/notificationStore.ts`)

```ts
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;                      // ← added by Teo
  generateFromDocuments: (docs) => void;    // client-side from own docs
  dismiss: (id: string) => void;
  addToast: (message, type) => void;
  // ...
}
```

`generateFromDocuments` preserves already-dismissed IDs across re-fetches.
`unreadCount` stays in sync on every mutation.

---

## Types (`types/index.ts`)

```ts
export interface AuditStats {   // ← added by Teo
  total_entries: number;
  user_entries: number;
  chain_valid: boolean;
}
```

---

## Utils (`lib/utils.ts`)

```ts
ACTION_LABELS.RENEWAL_REQUEST = {
  label: "Cerere reînnoire",
  icon: "🔄",
  color: "text-blue-600",
}
```

---

## DocumentCard Props

```tsx
<DocumentCard
  doc={doc}
  canRenewal={true}                          // show renewal button
  onRenewalRequest={async () => { ... }}     // () => Promise<void> — doc captured in closure
/>
```

When `canRenewal && !renewalSent`: shows "🔄 Solicită reînnoire" button.
After success: shows "🔄 Reînnoire solicitată" badge (no second click possible).

---

## Backend Renewal Endpoint

```
POST /api/documents/renewal-request
Body: { document_id: string, note?: string }
Auth: JWT bearer

Rules:
- Owner: always allowed
- Delegate: allowed only if grant has "request_renewal" in permissions
- Audit action: RENEWAL_REQUEST
```

Response: `{ success: true, message: "Cerere înregistrată" }`

---

## Endpoints NOT Yet Wired to Frontend (from teammates' main merge)

These backend endpoints exist and are tested via Swagger, but have no frontend pages yet:

### `GET /api/notifications/`
Returns `List[NotificationItem]`:
```ts
{
  doc_id: string;
  doc_type: string;
  doc_title?: string;
  days_until_expiry?: number;
  severity: "urgent" | "warning" | "expired";
  is_delegated: boolean;
  delegated_from_name?: string;
}
```
Sorted: expired → urgent → warning.
**Suggested work**: replace client-side `generateFromDocuments` with a live fetch from this endpoint, or supplement with delegated-doc notifications.

### `GET /api/functionar/recent-scans`
Returns last 20 scans with `{ scan_id, token, scanned_at, owner_name, doc_types, context }`.

### `GET /api/functionar/stats`
Returns `{ total_scans_today, total_scans_week, unique_citizens }`.

**Suggested work**: new `FunctionarDashboardPage` — gated to `role === "funcționar"`, shows stats cards + recent scans table.

---

## Key Flows Teo Implemented

| Flow | Where |
|------|-------|
| 2FA typed error messages | `LoginPage.tsx` |
| Force-logout on 401 | `AppLayout.tsx` + `lib/api.ts` interceptor |
| Delete document with confirmation | `DocumentsPage.tsx` → `ConfirmDialog` |
| Revoke delegation with confirmation | `FamilyPage.tsx` → `ConfirmDialog` |
| Renewal request from delegated doc | `FamilyPage.tsx` + `DocumentCard.tsx` + `POST /documents/renewal-request` |
| Expiry countdown on delegated docs | `FamilyPage.tsx` |
| Unread notification count | `notificationStore.ts` |
| Typed audit stats | `AuditLogPage.tsx` + `types/index.ts` |

---

## Demo Accounts

| User | Email | Password | Role |
|------|-------|----------|------|
| Ion Popescu | ion.popescu@gmail.com | Parola@123 | cetățean |
| Maria Ionescu | maria.ionescu@gmail.com | Parola@123 | cetățean |
| Alex Ionescu | alex.ionescu@gmail.com | Parola@123 | cetățean (diaspora Londra) |
| Funcționar | functionar@spclep.ro | Parola@123 | funcționar |

**2FA code: 123456**

Key demo scenario for Teo's work:
1. Log in as **Alex** → Family → expand Maria's delegated doc → "Solicită reînnoire"
2. Log in as **Ion** → Documents → delete a doc (ConfirmDialog appears)
3. Expire JWT manually → refresh → redirected to /login (actid:logout event flow)

---

## Push Safety Rules

Before every push:
1. No `.env` files, no personal keys, no `config.py` with real secrets
2. `git diff origin/Teo` — check every changed line
3. `git status` — no untracked sensitive files
4. No force push to `main`
5. Pull from `main` first if teammates have pushed → resolve conflicts before pushing

```bash
git pull origin main        # merge teammates' work
git push origin Teo         # push your branch
```
