// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "cetățean" | "funcționar" | "sistem";
  city?: string;
  country?: string;
  cnp: string;
}

export interface LoginResponse {
  session_token: string;
  message: string;
  demo_otp: string;
  user_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocStatus = "valid" | "expiră_curând" | "expirat";

export type DocType =
  // Identitate
  | "CI"
  | "PASAPORT"
  | "CERT_CETATENIE"
  | "CAZIER"
  // Familie & Stare Civilă
  | "CERT_NASTERE"
  | "CERT_CASATORIE"
  | "CERT_DECES"
  | "LIVRET_FAMILIE"
  // Domiciliu & Acte Juridice
  | "ADEVERINTA_DOMICILIU"
  | "PROCURA"
  // Muncă & Venituri
  | "ADEVERINTA_VENIT"
  | "CONTRACT_MUNCA"
  // Educație
  | "DIPLOMA_BAC"
  | "DIPLOMA_LICENTA"
  | "CERT_COMPETENTE"
  // Sănătate
  | "CARD_SANATATE"
  | "CERT_HANDICAP"
  | "ECUSON_PARCARE"
  // Vehicul & Transport
  | "PERMIS"
  | "TALON"
  | "INMATRICULARE_TEMP"
  | "ITP"
  | "ASIGURARE"
  | "ROVINIETA"
  // Copii
  | "DECRET_ADOPTIE"
  | "CARNET_ELEV"
  | "CARD_TRANSPORT_ELEV"
  // Legacy (kept for backward compatibility, not in add form)
  | "ADEVERINTA"
  | "ANAF"
  | "ONRC";

export interface Document {
  id: string;
  owner_id: string;
  doc_type: DocType;
  doc_number?: string;
  issued_by?: string;
  issued_date?: string;
  expires_date?: string;
  is_verified: boolean;
  description?: string;
  photo_base64?: string;
  cnp?: string;
  created_at: string;
  days_remaining?: number;
  status?: DocStatus;
}

export interface DelegatedDocument extends Document {
  delegated_from: {
    id: string;
    full_name: string;
    city?: string;
    country?: string;
  };
  delegation_permissions: string[];
  delegation_id: string;
}

// ─── Sharing ──────────────────────────────────────────────────────────────────

export interface ShareToken {
  id: string;
  token: string;
  document_ids: string[];
  permissions: string[];
  context?: string;
  expires_at: string;
  use_count: number;
  max_uses: number;
  is_active: boolean;
  created_at: string;
}

export interface ShareTokenCreate {
  document_ids: string[];
  permissions: string[];
  context?: string;
  recipient_role: string;
  expires_hours: number;
}

// ─── Family Delegation ────────────────────────────────────────────────────────

export interface DelegationGrant {
  id: string;
  delegator_id: string;
  delegate_id: string;
  delegator_name?: string;
  delegate_name?: string;
  delegate_email?: string;
  document_categories: string[];
  permissions: string[];
  valid_until?: string;
  is_active: boolean;
  consent_timestamp: string;
  notes?: string;
}

// ─── Children / Guardians ────────────────────────────────────────────────────

export interface GuardianSummary {
  relationship_type: string;
  guardian_name: string;
  proof_verified: boolean;
}

export interface ChildDocument {
  id: string;
  child_id: string;
  doc_type: string;
  doc_number?: string;
  issued_by?: string;
  issued_date?: string;
  expires_date?: string;
  description?: string;
  created_at: string;
}

export interface GovDocResult {
  gov_doc_id: string;
  doc_type: string;
  doc_number?: string;
  issued_by?: string;
  issued_date?: string;
  expires_date?: string;
  description?: string;
  already_linked: boolean;
}

export interface ChildProfile {
  id: string;
  full_name: string;
  date_of_birth: string;
  cnp?: string;
  created_at: string;
  relationship_type: string;
  proof_type: string;
  proof_verified: boolean;
  is_student: boolean;
  documents: ChildDocument[];
  guardians: GuardianSummary[];
}

export interface MyChildProfile {
  id: string;
  full_name: string;
  date_of_birth: string;
  cnp?: string;
  documents: ChildDocument[];
  guardians: GuardianSummary[];
}

export interface RegistryChild {
  registry_id: string;
  child_full_name: string;
  child_date_of_birth: string;
  child_cnp?: string;
  record_type: string;
  document_number?: string;
  issued_by?: string;
  relationship_type: string;
  already_linked: boolean;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor_id?: string;
  actor_name?: string;
  actor_role: string;
  target_document_id?: string;
  target_user_id?: string;
  metadata?: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  block_number: number;
}

// ─── Audit stats ─────────────────────────────────────────────────────────────

export interface AuditStats {
  total_entries: number;
  user_entries: number;
  chain_valid: boolean;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  doc_id?: string;
  dismissed: boolean;
}
