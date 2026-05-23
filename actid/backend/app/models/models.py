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
