from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List, Any


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    identifier: str  # email or CNP
    password: str


class TwoFARequest(BaseModel):
    session_token: str
    otp_code: str


class LoginResponse(BaseModel):
    session_token: str
    message: str
    demo_otp: str
    user_name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class RegisterRequest(BaseModel):
    full_name: str
    phone: str
    password: str
    # Optional — provided after ID scan + face verification
    cnp: Optional[str] = None
    email: Optional[str] = None
    id_verified: bool = False
    face_verified: bool = False
    face_match_score: Optional[float] = None


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ─── Users ───────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    city: Optional[str] = None
    country: Optional[str] = None
    cnp: str

    model_config = {"from_attributes": True}


# ─── Documents ───────────────────────────────────────────────────────────────

class DocumentCreate(BaseModel):
    doc_type: str
    doc_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expires_date: Optional[date] = None
    description: Optional[str] = None
    photo_base64: Optional[str] = None
    cnp: Optional[str] = None


class DocumentResponse(BaseModel):
    id: str
    owner_id: str
    doc_type: str
    doc_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expires_date: Optional[date] = None
    is_verified: bool
    description: Optional[str] = None
    photo_base64: Optional[str] = None
    cnp: Optional[str] = None
    created_at: datetime
    days_remaining: Optional[int] = None
    status: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Sharing ─────────────────────────────────────────────────────────────────

class ShareTokenCreate(BaseModel):
    document_ids: List[str]
    permissions: List[str] = ["read"]
    context: Optional[str] = None
    recipient_role: str = "funcționar"
    expires_hours: int = 24


class ShareTokenResponse(BaseModel):
    id: str
    token: str
    document_ids: List[str]
    permissions: List[str]
    context: Optional[str] = None
    expires_at: datetime
    use_count: int
    max_uses: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Family Delegation ────────────────────────────────────────────────────────

class DelegationCreate(BaseModel):
    delegate_email: str
    document_categories: List[str]
    permissions: List[str] = ["read"]
    valid_days: Optional[int] = 365
    notes: Optional[str] = None


class DelegationResponse(BaseModel):
    id: str
    delegator_id: str
    delegate_id: str
    delegator_name: Optional[str] = None
    delegate_name: Optional[str] = None
    delegate_email: Optional[str] = None
    document_categories: List[str]
    permissions: List[str]
    valid_until: Optional[datetime] = None
    is_active: bool
    consent_timestamp: datetime
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Renewal Request ─────────────────────────────────────────────────────────

class RenewalRequestCreate(BaseModel):
    document_id: str
    note: Optional[str] = None


# ─── Audit ───────────────────────────────────────────────────────────────────

class AuditEntryResponse(BaseModel):
    id: str
    timestamp: datetime
    action: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_role: str
    target_document_id: Optional[str] = None
    target_user_id: Optional[str] = None
    metadata: Optional[Any] = None
    prev_hash: str
    hash: str
    block_number: int

    model_config = {"from_attributes": True}


class ChainVerifyResponse(BaseModel):
    valid: bool
    entries_checked: int
    errors: List[str]
    message: str


# ─── Renewal ─────────────────────────────────────────────────────────────────

class RenewalRequestCreate(BaseModel):
    document_id: str
    note: Optional[str] = None


class RenewalRequestResponse(BaseModel):
    success: bool
    message: str


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationItem(BaseModel):
    doc_id: str
    doc_type: str
    doc_title: Optional[str] = None
    days_until_expiry: Optional[int] = None
    severity: str  # urgent / warning / expired
    is_delegated: bool = False
    delegated_from_name: Optional[str] = None


# ─── Presentations (EUDI SD-JWT) ─────────────────────────────────────────────

class PresentationCreatePayload(BaseModel):
    document_id: str
    disclosed_attributes: List[str]
    purpose: Optional[str] = None
    verifier_role: Optional[str] = "funcționar"


class PresentationCreateResult(BaseModel):
    presentation_id: str
    qr_url: str
    expires_at: datetime
    disclosed_attributes: List[str]


class VerifiedIssuer(BaseModel):
    id: str
    name: str
    trusted: bool
    country: str


class PresentationVerifyResult(BaseModel):
    valid: bool
    issuer: VerifiedIssuer
    credential_type: str
    disclosed_attributes: dict
    purpose: Optional[str] = None
    verified_at: datetime


# ─── Children / Guardians ────────────────────────────────────────────────────

class ScanBirthCertRequest(BaseModel):
    image_base64: str


class ScanBirthCertResponse(BaseModel):
    success: bool
    child_name: Optional[str] = None
    date_of_birth: Optional[str] = None  # ISO YYYY-MM-DD
    cnp: Optional[str] = None
    parent_names: List[str] = []
    requester_found: bool = False  # True if current user's name found in parents
    raw_text: Optional[str] = None
    message: str


class ChildDocumentCreate(BaseModel):
    doc_type: str
    doc_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expires_date: Optional[date] = None
    description: Optional[str] = None
    photo_base64: Optional[str] = None


class ChildDocumentResponse(BaseModel):
    id: str
    child_id: str
    doc_type: str
    doc_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expires_date: Optional[date] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GuardianSummary(BaseModel):
    relationship_type: str
    guardian_name: str
    proof_verified: bool


class ChildCreate(BaseModel):
    full_name: str
    date_of_birth: date
    cnp: Optional[str] = None
    relationship_type: str = "parent"
    proof_type: str = "birth_certificate"
    proof_image_base64: Optional[str] = None  # used for verification
    proof_verified: bool = False


class AddGuardianRequest(BaseModel):
    guardian_email: str
    relationship_type: str = "legal_guardian"  # parent / legal_guardian / adoptive_parent
    proof_type: str = "court_order"
    proof_image_base64: Optional[str] = None


class ChildResponse(BaseModel):
    id: str
    full_name: str
    date_of_birth: date
    cnp: Optional[str] = None
    created_at: datetime
    relationship_type: str
    proof_type: str
    proof_verified: bool
    is_student: bool = False
    documents: List[ChildDocumentResponse] = []
    guardians: List[GuardianSummary] = []

    model_config = {"from_attributes": True}


class GovDocResult(BaseModel):
    gov_doc_id: str
    doc_type: str
    doc_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[date] = None
    expires_date: Optional[date] = None
    description: Optional[str] = None
    already_linked: bool = False


class StudentStatusUpdate(BaseModel):
    is_student: bool


class MyChildProfileResponse(BaseModel):
    id: str
    full_name: str
    date_of_birth: date
    cnp: Optional[str] = None
    is_student: bool = False
    documents: List[ChildDocumentResponse] = []
    guardians: List[GuardianSummary] = []

    model_config = {"from_attributes": True}


# ─── Civil Registry ──────────────────────────────────────────────────────────

class RegistryChildResult(BaseModel):
    registry_id: str
    child_full_name: str
    child_date_of_birth: date
    child_cnp: Optional[str] = None
    record_type: str
    document_number: Optional[str] = None
    issued_by: Optional[str] = None
    relationship_type: str  # parent / legal_guardian / adoptive_parent
    already_linked: bool = False


# ─── Funcționar ──────────────────────────────────────────────────────────────

class RecentScanResponse(BaseModel):
    scan_id: str
    token: str
    scanned_at: datetime
    owner_name: str
    doc_types: List[str]
    context: Optional[str] = None


class FunctionarStatsResponse(BaseModel):
    total_scans_today: int
    total_scans_week: int
    unique_citizens: int
