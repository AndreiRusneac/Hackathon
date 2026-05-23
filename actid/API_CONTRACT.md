# API Contract — ActID EUDI Wallet MVP

> **Scop:** punct unic de adevăr între cele 4 echipe pentru ca toți să poată lucra **în paralel**, fără să se blocheze unul pe altul. Tot ce e aici trebuie respectat as-is; dacă cineva are nevoie de o modificare, **întâi** discutăm în grup și actualizăm acest document.

**Owner:** Andrei · **Versiune:** 1.0 (MVP) · **Data:** 2026-05-23

---

## 0. Distribuția task-urilor

| Persoană | Rolul | Branch | Output |
|---|---|---|---|
| **Andrei** | Backend Crypto + SD-JWT | `eudi/mvp-andrei` | Endpoint `GET /api/credentials/{doc_id}` → SD-JWT semnat + DB encryption pentru CNP/poză |
| **Radu** | Backend Verifier + Trust Registry | `eudi/mvp-radu` | Endpoint scan care **verifică semnătura** + trust check + întoarce doar atributele dezvăluite |
| **Alissia** | Frontend Presentation UX | `eudi/mvp-alissia` | UI cu **checkbox per atribut**, generare prezentare, vizualizare verifier |
| **Teo** | Frontend Wallet Security | `eudi/mvp-teo` | Pagină nouă `/securitate` cu status encryption, issueri trusted, istoric prezentări |

**Branch de integrare:** `eudi/mvp` (creat din `main`). Toți merge-uiesc aici la fiecare 3-4 ore.

---

## 1. Modelul de date EUDI

### 1.1 SD-JWT Verifiable Credential — format

Un credențial este un string cu această structură:

```
<JWT_HEADER>.<JWT_PAYLOAD>.<SIGNATURE>~<disclosure_1>~<disclosure_2>~...~<disclosure_N>
```

**Header JWT:**
```json
{
  "alg": "ES256",
  "typ": "vc+sd-jwt",
  "kid": "actid-issuer-001"
}
```

**Payload JWT (claims):**
```json
{
  "iss": "https://actid.gov.ro",
  "sub": "user_id_uuid",
  "iat": 1748000000,
  "exp": 1779536000,
  "vct": "RomanianID",
  "_sd_alg": "sha-256",
  "_sd": [
    "hash_disclosure_1",
    "hash_disclosure_2",
    "..."
  ]
}
```

**Disclosure** (un atribut dezvăluibil) — base64url al unui JSON array:
```
base64url([salt, claim_name, claim_value])
```
Exemplu decodat: `["abc123", "given_name", "Ion"]`

**Cum funcționează Selective Disclosure:**
- Wallet-ul stochează **JWT + TOATE disclosurile** (issuer-side).
- La prezentare, user-ul alege ce atribute dezvăluie → trimite doar disclosurile alese.
- Verifier-ul: hash-uiește fiecare disclosure primit, verifică că hash-ul e în `_sd`, validează semnătura JWT.

### 1.2 Tipuri de credențiale (`vct`)

| Document `doc_type` din DB | `vct` în SD-JWT | Atribute dezvăluibile |
|---|---|---|
| `CI` | `RomanianID` | `given_name`, `family_name`, `birth_date`, `cnp`, `document_number`, `issue_date`, `expiry_date`, `over_18` (derivat), `over_65` (derivat) |
| `PASAPORT` | `Passport` | `given_name`, `family_name`, `birth_date`, `nationality`, `document_number`, `issue_date`, `expiry_date` |
| `PERMIS` | `DriverLicense` | `given_name`, `family_name`, `birth_date`, `document_number`, `categories`, `issue_date`, `expiry_date` |
| **orice altul** | `GenericAttestation` | `doc_type`, `doc_number`, `issued_by`, `issued_date`, `expires_date` |

### 1.3 Trusted Issuers (JSON intern)

Fișier: `backend/app/trust/issuers.json` (creat de Radu)

```json
[
  {
    "id": "actid-issuer-001",
    "name": "Statul Român — Ministerul Afacerilor Interne",
    "country": "RO",
    "public_key_jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
    "trust_framework": "EUDI ARF 1.4 (simulated)",
    "valid_from": "2026-01-01"
  }
]
```

---

## 2. Endpoints — Backend

### 2.1 Issuance (Andrei)

#### `GET /api/credentials/{document_id}`

**Auth:** Bearer JWT (owner only).

**Răspuns 200:**
```json
{
  "credential_sd_jwt": "eyJhbGc...~WyJzYWx0...~WyJzYWx0...",
  "vct": "RomanianID",
  "issuer_id": "actid-issuer-001",
  "disclosed_attributes_available": [
    "given_name", "family_name", "birth_date", "cnp",
    "document_number", "issue_date", "expiry_date", "over_18"
  ]
}
```

**Erori:**
- `404` — document inexistent
- `403` — nu ești owner-ul

**Side-effect:** intrare în `audit_log` cu `action="CREDENTIAL_ISSUED"`.

#### Funcții utilitare Python expuse pentru Radu (modulul `vc.sd_jwt`):

```python
def sign_sd_jwt(vct: str, subject_id: str, attributes: dict[str, Any]) -> str:
    """Întoarce SD-JWT complet (header.payload.sig~disclosures)."""

def verify_sd_jwt(sd_jwt: str, trusted_issuer_jwks: list[dict]) -> dict:
    """
    Returns: {
        "valid": bool,
        "issuer_id": str,
        "vct": str,
        "subject_id": str,
        "disclosed_attributes": dict[str, Any],
        "errors": list[str]
    }
    """
```

### 2.2 Presentation Creation (Backend pentru Alissia)

#### `POST /api/presentations`

**Auth:** Bearer JWT (cetățean).

**Body:**
```json
{
  "document_id": "uuid",
  "disclosed_attributes": ["given_name", "birth_date"],
  "purpose": "Verificare vârstă bar",
  "verifier_role": "funcționar"
}
```

**Răspuns 201:**
```json
{
  "presentation_id": "pres_abc123",
  "qr_url": "https://actid.example/verify/pres_abc123",
  "expires_at": "2026-05-24T18:00:00Z",
  "disclosed_attributes": ["given_name", "birth_date"]
}
```

**Backend stochează în `presentation_logs` table:**
- `id`, `creator_id`, `document_id`, `disclosed_attrs` (JSON), `purpose`, `created_at`, `expires_at`, `used_at` (nullable), `scanned_by` (nullable)

**Acest endpoint îl scrie Radu** (în `api/presentations.py`), dar tabela o adaugă **Andrei** în `models.py`.

### 2.3 Presentation Verification (Radu)

#### `GET /api/presentations/{presentation_id}/scan`

**Auth:** Bearer JWT (funcționar — `require_role("funcționar")`).

**Răspuns 200:**
```json
{
  "valid": true,
  "issuer": {
    "id": "actid-issuer-001",
    "name": "Statul Român — Ministerul Afacerilor Interne",
    "trusted": true,
    "country": "RO"
  },
  "credential_type": "RomanianID",
  "disclosed_attributes": {
    "given_name": "Ion",
    "birth_date": "1985-03-15"
  },
  "purpose": "Verificare vârstă bar",
  "verified_at": "2026-05-23T18:00:00Z"
}
```

**Erori:**
- `404` — presentation_id necunoscut
- `410` — expirată sau deja folosită
- `403` — rol greșit
- `422` — semnătura SD-JWT invalidă (cu `{"valid": false, "errors": [...]}`)

**Side-effect:**
- `presentation.used_at = now`, `presentation.scanned_by = funcționar.id`
- Audit log: `action="PRESENTATION_VERIFIED"`

### 2.4 Wallet Security (Andrei + Teo)

#### `GET /api/wallet/security`

**Auth:** Bearer JWT.

**Răspuns 200:**
```json
{
  "wallet_instance_id": "wia_user_uuid_first8",
  "encryption": {
    "algorithm": "AES-256-GCM",
    "at_rest_enabled": true,
    "encrypted_fields": ["users.cnp", "documents.cnp", "documents.photo_base64"]
  },
  "trusted_issuers": [
    {
      "id": "actid-issuer-001",
      "name": "Statul Român — Ministerul Afacerilor Interne",
      "country": "RO",
      "valid_from": "2026-01-01"
    }
  ],
  "issuer_public_key_fingerprint": "SHA256:abc123def456..."
}
```

#### `GET /api/wallet/presentations-history`

**Auth:** Bearer JWT.

**Răspuns 200:**
```json
{
  "presentations": [
    {
      "id": "pres_abc",
      "document_id": "doc_uuid",
      "document_type": "CI",
      "disclosed_attributes": ["given_name", "birth_date"],
      "purpose": "Verificare vârstă bar",
      "created_at": "2026-05-23T17:00:00Z",
      "scanned_at": "2026-05-23T17:05:00Z",
      "scanned_by_name": "Funcționar SPCLEP"
    }
  ]
}
```

---

## 3. Endpoints — Frontend (TypeScript types)

În `frontend/src/lib/api.ts` se adaugă:

```typescript
// ─── Credentials (Andrei) ──────────────────────────────────────────────────
export interface CredentialResult {
  credential_sd_jwt: string;
  vct: string;
  issuer_id: string;
  disclosed_attributes_available: string[];
}

export const credentialsApi = {
  get: (docId: string) => api.get<CredentialResult>(`/credentials/${docId}`),
};

// ─── Presentations (Radu) ──────────────────────────────────────────────────
export interface PresentationCreatePayload {
  document_id: string;
  disclosed_attributes: string[];
  purpose: string;
  verifier_role?: "funcționar" | "any";
}

export interface PresentationCreateResult {
  presentation_id: string;
  qr_url: string;
  expires_at: string;
  disclosed_attributes: string[];
}

export interface PresentationVerifyResult {
  valid: boolean;
  issuer: {
    id: string;
    name: string;
    trusted: boolean;
    country: string;
  };
  credential_type: string;
  disclosed_attributes: Record<string, string | number | boolean>;
  purpose: string;
  verified_at: string;
}

export const presentationsApi = {
  create: (payload: PresentationCreatePayload) =>
    api.post<PresentationCreateResult>("/presentations", payload),
  scan: (presentationId: string) =>
    api.get<PresentationVerifyResult>(`/presentations/${presentationId}/scan`),
};

// ─── Wallet Security (Teo) ─────────────────────────────────────────────────
export interface WalletSecurity {
  wallet_instance_id: string;
  encryption: {
    algorithm: string;
    at_rest_enabled: boolean;
    encrypted_fields: string[];
  };
  trusted_issuers: Array<{
    id: string; name: string; country: string; valid_from: string;
  }>;
  issuer_public_key_fingerprint: string;
}

export interface PresentationHistoryEntry {
  id: string;
  document_id: string;
  document_type: string;
  disclosed_attributes: string[];
  purpose: string;
  created_at: string;
  scanned_at: string | null;
  scanned_by_name: string | null;
}

export const walletApi = {
  security: () => api.get<WalletSecurity>("/wallet/security"),
  history: () => api.get<{ presentations: PresentationHistoryEntry[] }>("/wallet/presentations-history"),
};
```

---

## 4. Spec criptografice (Andrei)

| Cheie / algoritm | Valoare |
|---|---|
| Issuer signing | **P-256 / ES256** (recomandare ARF + suport WebCrypto) |
| Issuer keypair location | `backend/app/keys/issuer_private.pem` + `issuer_public.pem` (generat la primul startup, **NU** commit-uit — în `.gitignore`) |
| Encryption at rest | **AES-256-GCM** |
| Cheia AES | Derivată din `SECRET_KEY` cu **HKDF-SHA256**, salt fix `b"actid-eudi-v1"` |
| Câmpuri criptate | `User.cnp`, `Document.cnp`, `Document.photo_base64` |
| Hash pentru SD-JWT disclosures | **SHA-256** (declarat în `_sd_alg`) |
| Salt per disclosure | 16 bytes random (URL-safe base64) |
| Library SD-JWT | **`sd-jwt`** Python (oficial IETF) — `pip install sd-jwt` |
| Library JWT | `python-jose` (deja folosit) |

**`.gitignore` adăugări:**
```
backend/app/keys/*.pem
backend/app/keys/*.jwk
```

---

## 5. Flow complet — exemplu end-to-end

**Scenariu:** Ion vrea să dovedească la intrarea într-un bar că are peste 18 ani, fără să-și dezvăluie CNP-ul sau numărul de CI.

```
┌─────────┐                ┌─────────┐                ┌─────────┐
│  ION    │                │ BACKEND │                │FUNCȚIONAR│
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     │ 1. Deschide app → Pres.  │                          │
     │    Selectează CI         │                          │
     │    Bifează doar:         │                          │
     │    [✓] given_name        │                          │
     │    [✓] birth_date        │                          │
     │    Purpose: "Vârstă bar" │                          │
     │                          │                          │
     │ 2. POST /presentations   │                          │
     ├─────────────────────────>│                          │
     │                          │ 3. Backend:              │
     │                          │  - load Document (decrypt│
     │                          │    CNP at rest)          │
     │                          │  - sign_sd_jwt(...)      │
     │                          │  - keep only requested   │
     │                          │    disclosures           │
     │                          │  - save Presentation     │
     │                          │                          │
     │ 4. {presentation_id, qr_url, ...}                   │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ 5. Generează QR cu       │                          │
     │    qr_url                │                          │
     │                          │                          │
     │      ╔═══════════════════════════════╗             │
     │      ║  ION arată QR-ul              ║─────────────>│
     │      ╚═══════════════════════════════╝             │
     │                          │                          │
     │                          │ 6. GET /presentations/   │
     │                          │      pres_abc/scan       │
     │                          │<─────────────────────────┤
     │                          │                          │
     │                          │ 7. Backend:              │
     │                          │  - verify SD-JWT sig     │
     │                          │  - check issuer trusted  │
     │                          │  - mark presentation used│
     │                          │                          │
     │                          │ 8. {valid, issuer, attrs}│
     │                          ├─────────────────────────>│
     │                          │                          │
     │                          │           Funcționar vede│
     │                          │           ┌──────────────│
     │                          │           │ ✓ Verificat  │
     │                          │           │ Emis de:     │
     │                          │           │ Statul Român │
     │                          │           │              │
     │                          │           │ given_name:  │
     │                          │           │   Ion        │
     │                          │           │ birth_date:  │
     │                          │           │   1985-03-15 │
     │                          │           └──────────────│
     │                          │                          │
```

**Detaliu important**: CNP-ul lui Ion **niciodată** nu pleacă în QR — pentru că disclosurile lui (CNP, document_number) **nu sunt incluse** în prezentare. Verifier-ul nu poate să "ghicească" CNP-ul din JWT pentru că vede doar hash-urile (`_sd` array), iar hash-urile sunt salt-uite.

---

## 6. Mock data — ca să nu vă blocați

Până când fiecare termină modulul lui, folosiți aceste mock-uri:

### Mock SD-JWT (pentru Alissia, Teo, Radu — primele 3 ore)

```python
# Hardcodat pentru testare, înlocuit de Andrei real implementation
MOCK_SD_JWT = (
    "eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6ImFjdGlkLWlzc3Vlci0wMDEifQ"
    ".eyJpc3MiOiJodHRwczovL2FjdGlkLmdvdi5ybyIsInZjdCI6IlJvbWFuaWFuSUQifQ"
    ".MOCK_SIGNATURE"
    "~WyJhYmMxMjMiLCAiZ2l2ZW5fbmFtZSIsICJJb24iXQ"   # given_name: "Ion"
    "~WyJkZWY0NTYiLCAiZmFtaWx5X25hbWUiLCAiUG9wZXNjdSJd"  # family_name: "Popescu"
    "~WyJnaGk3ODkiLCAiYmlydGhfZGF0ZSIsICIxOTg1LTAzLTE1Il0"  # birth_date
)
```

### Mock presentation response (pentru Alissia frontend până când Radu termină)

```json
{
  "valid": true,
  "issuer": {
    "id": "actid-issuer-001",
    "name": "Statul Român — Ministerul Afacerilor Interne",
    "trusted": true,
    "country": "RO"
  },
  "credential_type": "RomanianID",
  "disclosed_attributes": {
    "given_name": "Ion",
    "birth_date": "1985-03-15"
  },
  "purpose": "Verificare vârstă bar",
  "verified_at": "2026-05-23T18:00:00Z"
}
```

### Mock wallet security (pentru Teo)

```json
{
  "wallet_instance_id": "wia_demo_user_12345678",
  "encryption": {
    "algorithm": "AES-256-GCM",
    "at_rest_enabled": true,
    "encrypted_fields": ["users.cnp", "documents.cnp", "documents.photo_base64"]
  },
  "trusted_issuers": [
    {
      "id": "actid-issuer-001",
      "name": "Statul Român — Ministerul Afacerilor Interne",
      "country": "RO",
      "valid_from": "2026-01-01"
    }
  ],
  "issuer_public_key_fingerprint": "SHA256:demo123abc456def789..."
}
```

---

## 7. Reguli de colaborare

1. **Nu modificați acest document fără discuție în grup.**
2. **Nu modificați endpoint-uri ale altora.** Dacă aveți nevoie de un câmp suplimentar, întrebați.
3. **Branch strategy:**
   - Fiecare merge-uiește **din** `eudi/mvp` în branch-ul lui zilnic.
   - Fiecare push-ează **în** `eudi/mvp` când are ceva stabil.
   - Merge în `main` doar după ce funcționează end-to-end pe `eudi/mvp`.
4. **Commit mesaj:**
   - `feat(crypto): ...` — Andrei
   - `feat(verifier): ...` — Radu
   - `feat(presentation-ui): ...` — Alissia
   - `feat(wallet-security): ...` — Teo
5. **La fiecare 3-4 ore: status update scurt pe grup** — ce ați făcut, ce blocaje aveți.
6. **Nu modificați `ledger.py`** — e tamper-evident chain, nu se atinge.

---

## 8. Definition of Done — MVP

✅ User poate vedea un document → tap "Distribuie selectiv" → bifează atribute → generează QR
✅ Funcționar scanează QR → vede doar atributele alese + badge "Verificat de Statul Român ✓"
✅ În DB, CNP-urile și pozele sunt criptate (vizibil dacă deschizi `actid.db` cu DB browser → vezi blob, nu text)
✅ Pagina `/securitate` afișează status encryption + lista issueri trusted + istoric prezentări
✅ Audit log conține `CREDENTIAL_ISSUED` și `PRESENTATION_VERIFIED` cu hash chain intact
✅ Toate testele existente trec (smoke test la `http://localhost:8000/docs`)

---

## 9. Resurse de referință

- **SD-JWT VC IETF draft:** https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/
- **EUDI Wallet ARF 1.4:** https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework
- **`sd-jwt` Python lib:** https://github.com/openwallet-foundation-labs/sd-jwt-python
- **OpenID4VP / OpenID4VCI:** https://openid.net/sg/openid4vc/

---

**Întrebări? Modificări?** Discutați mai întâi în grup, apoi actualizați documentul cu PR mic și ping pe canal.