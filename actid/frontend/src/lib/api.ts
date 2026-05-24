import axios from "axios";

declare module "axios" {
  interface AxiosError {
    userMessage?: string;
  }
}

export function getErrMsg(err: unknown, fallback = "A apărut o eroare"): string {
  if (err && typeof err === "object" && "userMessage" in err) {
    return (err as { userMessage?: string }).userMessage || fallback;
  }
  return fallback;
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("actid_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("actid_token");
      localStorage.removeItem("actid_user");
      window.dispatchEvent(new CustomEvent("actid:logout"));
    }
    // Attach a human-readable message so catch blocks can use err.userMessage
    if (!err.response) {
      err.userMessage = "Verifică conexiunea la internet";
    } else if (err.response.status === 500) {
      err.userMessage = "Eroare server, încearcă din nou";
    } else {
      err.userMessage = err.response?.data?.detail || "A apărut o eroare";
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  full_name: string;
  phone: string;
  password: string;
  cnp?: string;
  email?: string;
  id_verified?: boolean;
  face_verified?: boolean;
  face_match_score?: number;
}

export const authApi = {
  login: (identifier: string, password: string) =>
    api.post("/auth/login", { identifier, password }),

  verify2fa: (session_token: string, otp_code: string) =>
    api.post("/auth/verify-2fa", { session_token, otp_code }),

  register: (payload: RegisterPayload) => api.post("/auth/register", payload),

  me: () => api.get("/auth/me"),

  logout: () => api.post("/auth/logout"),
  deleteAccount: () => api.delete("/auth/me"),
};

// ─── Identity verification (registration flow) ───────────────────────────────

export interface ScanIdResult {
  success: boolean;
  full_name?: string;
  surname?: string;
  given_names?: string;
  /** "Seria" — 2 uppercase letters on a Romanian CI (e.g. "SX"). */
  series?: string;
  /** "Numărul" — the digits portion only (e.g. "590152"). */
  document_number?: string;
  nationality?: string;
  date_of_birth?: string;
  /** "Data eliberării" — from the printed front of the card. */
  date_of_issue?: string;
  expiration_date?: string;
  sex?: string;
  cnp?: string;
  /** True when the extracted CNP passes the official Romanian checksum. */
  cnp_valid?: boolean;
  id_face_base64?: string;
  message: string;
}

export interface VerifyFaceResult {
  match: boolean;
  score: number;
  distance: number;
  message: string;
  /** True when the backend couldn't actually compare faces (e.g. face_recognition unavailable). */
  fallback?: boolean;
}

export const identityApi = {
  scanId: (image_base64: string) =>
    api.post<ScanIdResult>("/identity/scan-id", { image_base64 }),

  verifyFace: (id_face_base64: string, selfie_base64: string) =>
    api.post<VerifyFaceResult>("/identity/verify-face", {
      id_face_base64,
      selfie_base64,
    }),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export interface DocumentCatalogItem {
  doc_type: string;
  label: string;
  category: string;
  issuing_authority: string;
  validity_days: number | null;
  state: "missing" | "owned" | "expired";
  existing_document_id: string | null;
}

export const documentsApi = {
  list: () => api.get("/documents/"),
  listDelegated: () => api.get("/documents/delegated"),
  get: (id: string) => api.get(`/documents/${id}`),
  create: (data: object) => api.post("/documents/", data),
  delete: (id: string) => api.delete(`/documents/${id}`),
  renewalRequest: (document_id: string, note?: string) =>
    api.post("/documents/renewal-request", { document_id, note }),
  catalog: () => api.get<DocumentCatalogItem[]>("/documents/catalog"),
  request: (doc_type: string) => api.post("/documents/request", { doc_type }),
};

// ─── Sharing ─────────────────────────────────────────────────────────────────

export const sharingApi = {
  createToken: (data: object) => api.post("/sharing/tokens", data),
  listTokens: () => api.get("/sharing/tokens"),
  scanToken: (tokenValue: string) => api.get(`/sharing/scan/${tokenValue}`),
  revokeToken: (id: string) => api.delete(`/sharing/tokens/${id}`),
};

// ─── Family ──────────────────────────────────────────────────────────────────

export const familyApi = {
  listDelegations: () => api.get("/family/delegations"),
  listDelegatedToMe: () => api.get("/family/delegated-to-me"),
  createDelegation: (data: object) => api.post("/family/delegations", data),
  revokeDelegation: (id: string) => api.delete(`/family/delegations/${id}`),
};

// ─── Audit ───────────────────────────────────────────────────────────────────

export const auditApi = {
  listEntries: (limit = 50, offset = 0) =>
    api.get(`/audit/entries?limit=${limit}&offset=${offset}`),
  verifyChain: () => api.get("/audit/verify"),
  stats: () => api.get("/audit/stats"),
};

// ─── Credentials (Andrei) ────────────────────────────────────────────────────

export interface CredentialResult {
  credential_sd_jwt: string;
  vct: string;
  issuer_id: string;
  disclosed_attributes_available: string[];
}

export const credentialsApi = {
  get: (docId: string) => api.get<CredentialResult>(`/credentials/${docId}`),
};

// ─── Presentations (Radu) ────────────────────────────────────────────────────

export interface PresentationCreatePayload {
  document_id: string;
  disclosed_attributes: string[];
  purpose?: string;
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
  purpose: string | null;
  verified_at: string;
}

export const presentationsApi = {
  create: (payload: PresentationCreatePayload) =>
    api.post<PresentationCreateResult>("/presentations", payload),
  scan: (presentationId: string) =>
    api.get<PresentationVerifyResult>(`/presentations/${presentationId}/scan`),
};

// ─── Wallet Security (Teo) ───────────────────────────────────────────────────

export interface WalletSecurity {
  wallet_instance_id: string;
  encryption: {
    algorithm: string;
    at_rest_enabled: boolean;
    encrypted_fields: string[];
  };
  trusted_issuers: Array<{
    id: string;
    name: string;
    country: string;
    valid_from: string;
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

// ─── Debug / Encryption Proof (hidden route — for demo) ──────────────────────

export type EncryptionStatus = "v1" | "v2" | "plain" | null;

export interface RawDocumentView {
  doc_id: string;
  plaintext_fields: {
    doc_type: string;
    owner_id: string;
    issued_date: string | null;
    expires_date: string | null;
    is_verified: boolean;
    status: string;
    days_remaining: number | null;
    created_at: string | null;
  };
  server_view: {
    doc_number: string | null;
    issued_by: string | null;
    description: string | null;
    cnp: string | null;
    photo_base64: string | null;
  };
  user_view: {
    doc_number: string | null;
    issued_by: string | null;
    description: string | null;
    cnp: string | null;
    photo_base64: string | null;
  };
  encryption: {
    algorithm: string;
    key_derivation: string;
    per_field_status: Record<string, EncryptionStatus>;
    user_id: string;
    key_fingerprint: string;
  };
}

export interface DebugDocListItem {
  id: string;
  doc_type: string;
  is_verified: boolean;
  doc_number_status: EncryptionStatus;
  cnp_status: EncryptionStatus;
}

export const debugApi = {
  rawDocument: (docId: string) => api.get<RawDocumentView>(`/debug/raw-document/${docId}`),
  myDocsList: () => api.get<{ user_id: string; user_name: string; documents: DebugDocListItem[] }>("/debug/my-documents-list"),
};
