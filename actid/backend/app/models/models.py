from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    cnp = Column(String(13), unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="cetățean")  # cetățean / funcționar / sistem
    city = Column(String, default="Cluj-Napoca")
    country = Column(String, default="România")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="owner", foreign_keys="Document.owner_id")
    share_tokens = relationship("ShareToken", back_populates="creator")
    delegations_as_delegator = relationship(
        "DelegationGrant", back_populates="delegator", foreign_keys="DelegationGrant.delegator_id"
    )
    delegations_as_delegate = relationship(
        "DelegationGrant", back_populates="delegate", foreign_keys="DelegationGrant.delegate_id"
    )
    pending_auths = relationship("PendingAuth", back_populates="user")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    doc_type = Column(String, nullable=False)
    doc_number = Column(String)
    issued_by = Column(String)
    issued_date = Column(Date)
    expires_date = Column(Date)
    is_verified = Column(Boolean, default=True)
    metadata_json = Column(Text)
    description = Column(String)
    photo_base64 = Column(Text, nullable=True)
    cnp = Column(String(13), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="documents", foreign_keys=[owner_id])


class ShareToken(Base):
    __tablename__ = "share_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    creator_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    document_ids = Column(Text, nullable=False)  # JSON array
    permissions = Column(Text)  # JSON array
    context = Column(String)
    recipient_role = Column(String, default="funcționar")
    expires_at = Column(DateTime, nullable=False)
    max_uses = Column(Integer, default=1)
    use_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", back_populates="share_tokens")
    scan_logs = relationship("ShareScanLog", back_populates="share_token")


class ShareScanLog(Base):
    __tablename__ = "share_scan_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    token_id = Column(String, ForeignKey("share_tokens.id"), nullable=False)
    scanned_by = Column(String)
    scanned_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String)

    share_token = relationship("ShareToken", back_populates="scan_logs")


class DelegationGrant(Base):
    __tablename__ = "delegation_grants"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    delegator_id = Column(String, ForeignKey("users.id"), nullable=False)
    delegate_id = Column(String, ForeignKey("users.id"), nullable=False)
    document_categories = Column(Text, nullable=False)  # JSON array
    permissions = Column(Text, nullable=False)  # JSON array
    valid_until = Column(DateTime)
    consent_timestamp = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    notes = Column(String)

    delegator = relationship(
        "User", back_populates="delegations_as_delegator", foreign_keys=[delegator_id]
    )
    delegate = relationship(
        "User", back_populates="delegations_as_delegate", foreign_keys=[delegate_id]
    )


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    action = Column(String, nullable=False)
    actor_id = Column(String)
    actor_name = Column(String)
    actor_role = Column(String, default="sistem")
    target_document_id = Column(String)
    target_user_id = Column(String)
    metadata_json = Column(Text)
    prev_hash = Column(String, nullable=False)
    hash = Column(String, nullable=False, unique=True)
    block_number = Column(Integer, default=0)


class PendingAuth(Base):
    __tablename__ = "pending_auths"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    session_token = Column(String, unique=True, nullable=False, index=True)
    otp_code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="pending_auths")


# ─── Children / Guardian ─────────────────────────────────────────────────────

class ChildProfile(Base):
    __tablename__ = "child_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    full_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    cnp = Column(String(13), nullable=True)   # optional for children < 14
    # Set when the child turns 14 and creates their own account
    user_id = Column(String, ForeignKey("users.id"), nullable=True, unique=True)
    is_student = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    guardians = relationship("ChildGuardian", back_populates="child", cascade="all, delete-orphan")
    documents = relationship("ChildDocument", back_populates="child", cascade="all, delete-orphan")
    user = relationship("User", foreign_keys=[user_id])


class ChildGuardian(Base):
    """
    Links a User (guardian) to a ChildProfile.
    Two guardians of the same child have no direct link — privacy isolation by design.
    """
    __tablename__ = "child_guardians"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    child_id = Column(String, ForeignKey("child_profiles.id"), nullable=False)
    guardian_id = Column(String, ForeignKey("users.id"), nullable=False)
    relationship_type = Column(String, default="parent")  # parent / legal_guardian / adoptive_parent
    proof_type = Column(String, default="birth_certificate")  # birth_certificate / adoption_decree / court_order / ci
    proof_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    child = relationship("ChildProfile", back_populates="guardians")
    guardian = relationship("User")


class ChildDocument(Base):
    __tablename__ = "child_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    child_id = Column(String, ForeignKey("child_profiles.id"), nullable=False)
    doc_type = Column(String, nullable=False)
    doc_number = Column(String)
    issued_by = Column(String)
    issued_date = Column(Date)
    expires_date = Column(Date)
    description = Column(String)
    photo_base64 = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    child = relationship("ChildProfile", back_populates="documents")


class GovernmentDocRegistry(Base):
    """Mock government-issued document database — searched when a parent adds a child document."""
    __tablename__ = "gov_doc_registry"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    holder_cnp = Column(String(13), nullable=False, index=True)
    doc_type = Column(String, nullable=False)
    doc_number = Column(String)
    issued_by = Column(String)
    issued_date = Column(Date)
    expires_date = Column(Date)
    description = Column(String)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CivilRegistry(Base):
    """State civil registry — birth certificates, adoptions, court orders."""
    __tablename__ = "civil_registry"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    record_type = Column(String, nullable=False)  # birth_certificate / adoption_decree / court_order
    child_full_name = Column(String, nullable=False)
    child_date_of_birth = Column(Date, nullable=False)
    child_cnp = Column(String(13), nullable=True)
    parent1_cnp = Column(String(13), nullable=True)   # typically mother
    parent1_name = Column(String, nullable=True)
    parent2_cnp = Column(String(13), nullable=True)   # typically father
    parent2_name = Column(String, nullable=True)
    guardian_cnp = Column(String(13), nullable=True)  # adoptive parent / court guardian
    guardian_name = Column(String, nullable=True)
    document_number = Column(String, nullable=True)
    issued_date = Column(Date, nullable=True)
    issued_by = Column(String, nullable=True)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# TEMPORARY — table belongs to Andrei per API_CONTRACT.md §2.2. Kept here so
# Radu's presentations endpoints can be tested end-to-end before Andrei merges.
class PresentationLog(Base):
    __tablename__ = "presentation_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    creator_id = Column(String, ForeignKey("users.id"), nullable=False)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    sd_jwt = Column(Text, nullable=False)
    disclosed_attrs = Column(Text, nullable=False)  # JSON array
    purpose = Column(String)
    verifier_role = Column(String, default="funcționar")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    scanned_by = Column(String, ForeignKey("users.id"), nullable=True)
