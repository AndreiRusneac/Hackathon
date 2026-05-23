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
};

// ─── Identity verification (registration flow) ───────────────────────────────

export interface ScanIdResult {
  success: boolean;
  full_name?: string;
  surname?: string;
  given_names?: string;
  document_number?: string;
  nationality?: string;
  date_of_birth?: string;
  expiration_date?: string;
  sex?: string;
  cnp?: string;
  id_face_base64?: string;
  message: string;
}

export interface VerifyFaceResult {
  match: boolean;
  score: number;
  distance: number;
  message: string;
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

export const documentsApi = {
  list: () => api.get("/documents/"),
  listDelegated: () => api.get("/documents/delegated"),
  get: (id: string) => api.get(`/documents/${id}`),
  create: (data: object) => api.post("/documents/", data),
  delete: (id: string) => api.delete(`/documents/${id}`),
  renewalRequest: (document_id: string, note?: string) =>
    api.post("/documents/renewal-request", { document_id, note }),
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
