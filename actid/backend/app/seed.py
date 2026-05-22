"""Seed demo data for ActID hackathon."""
import json
from datetime import date, datetime, timedelta

import bcrypt
from sqlalchemy.orm import Session

from .ledger import add_audit_entry
from .models.models import AuditEntry, DelegationGrant, Document, User

# Fixed IDs for reproducibility
ION_ID = "user-ion-popescu-0001"
MARIA_ID = "user-maria-ionescu-0002"
ALEX_ID = "user-alex-ionescu-0003"
FUNC_ID = "user-functionar-0004"

TODAY = date.today()


def seed_database(db: Session) -> None:
    if db.query(User).filter(User.id == ION_ID).first():
        return  # Already seeded

    pw = bcrypt.hashpw(b"Parola@123", bcrypt.gensalt()).decode()

    # ── Users ────────────────────────────────────────────────────────────────
    ion = User(
        id=ION_ID,
        cnp="1820315123456",
        email="ion.popescu@gmail.com",
        full_name="Ion Popescu",
        phone="0740123456",
        hashed_password=pw,
        role="cetățean",
        city="Cluj-Napoca",
        country="România",
    )
    maria = User(
        id=MARIA_ID,
        cnp="2650820123457",
        email="maria.ionescu@gmail.com",
        full_name="Maria Ionescu",
        phone="0752987654",
        hashed_password=pw,
        role="cetățean",
        city="Cluj-Napoca",
        country="România",
    )
    alex = User(
        id=ALEX_ID,
        cnp="1941205123458",
        email="alex.ionescu@gmail.com",
        full_name="Alexandru Ionescu",
        phone="+447700900123",
        hashed_password=pw,
        role="cetățean",
        city="Londra",
        country="Marea Britanie",
    )
    func = User(
        id=FUNC_ID,
        cnp="1890510123459",
        email="functionar@spclep.ro",
        full_name="Gheorghe Munteanu",
        phone="0264123456",
        hashed_password=pw,
        role="funcționar",
        city="Cluj-Napoca",
        country="România",
    )
    db.add_all([ion, maria, alex, func])
    db.flush()

    # ── Ion's documents (has expiry issues) ──────────────────────────────────
    ion_ci = Document(
        id="doc-ion-ci-0001",
        owner_id=ION_ID,
        doc_type="CI",
        doc_number="CJ123456",
        issued_by="SPCLEP Cluj-Napoca",
        issued_date=date(2016, 6, 21),
        expires_date=TODAY + timedelta(days=30),  # expiring soon!
        is_verified=True,
        description="Carte de identitate",
    )
    ion_pasaport = Document(
        id="doc-ion-pasaport-0002",
        owner_id=ION_ID,
        doc_type="PASAPORT",
        doc_number="RO1234567",
        issued_by="MAI Cluj",
        issued_date=date(2020, 3, 15),
        expires_date=date(2030, 3, 15),
        is_verified=True,
        description="Pașaport biometric",
    )
    ion_permis = Document(
        id="doc-ion-permis-0003",
        owner_id=ION_ID,
        doc_type="PERMIS",
        doc_number="CJ456789",
        issued_by="RAR Cluj",
        issued_date=date(2017, 8, 20),
        expires_date=date(2027, 8, 20),
        is_verified=True,
        description="Permis de conducere cat. B",
    )
    ion_cazier = Document(
        id="doc-ion-cazier-0004",
        owner_id=ION_ID,
        doc_type="CAZIER",
        doc_number="CZ2024-001",
        issued_by="IPJ Cluj",
        issued_date=date(2024, 5, 29),
        expires_date=TODAY + timedelta(days=7),  # 7 days!
        is_verified=True,
        description="Cazier judiciar",
    )

    # ── Maria's documents (all in order, has rovinietă) ──────────────────────
    maria_ci = Document(
        id="doc-maria-ci-0005",
        owner_id=MARIA_ID,
        doc_type="CI",
        doc_number="CJ987654",
        issued_by="SPCLEP Cluj-Napoca",
        issued_date=date(2019, 11, 10),
        expires_date=date(2029, 11, 10),
        is_verified=True,
        description="Carte de identitate",
    )
    maria_pasaport = Document(
        id="doc-maria-pasaport-0006",
        owner_id=MARIA_ID,
        doc_type="PASAPORT",
        doc_number="RO9876543",
        issued_by="MAI Cluj",
        issued_date=date(2020, 6, 25),
        expires_date=date(2030, 6, 25),
        is_verified=True,
        description="Pașaport biometric",
    )
    maria_cert_nastere = Document(
        id="doc-maria-cert-0007",
        owner_id=MARIA_ID,
        doc_type="CERT_NASTERE",
        doc_number="CN-1965-5678",
        issued_by="Primăria Cluj-Napoca",
        issued_date=date(1965, 8, 20),
        expires_date=None,
        is_verified=True,
        description="Certificat de naștere",
    )
    maria_rovinieta = Document(
        id="doc-maria-rovinieta-0008",
        owner_id=MARIA_ID,
        doc_type="ROVINIETA",
        doc_number="RO-2026-XY1234",
        issued_by="CNAIR",
        issued_date=TODAY - timedelta(days=355),
        expires_date=TODAY + timedelta(days=10),  # 10 days — Alex needs to renew!
        is_verified=True,
        description="Rovinietă anuală — CJ-12-XYZ",
    )

    # ── Alex's documents (UK resident) ───────────────────────────────────────
    alex_ci = Document(
        id="doc-alex-ci-0009",
        owner_id=ALEX_ID,
        doc_type="CI",
        doc_number="CJ555111",
        issued_by="SPCLEP Cluj-Napoca",
        issued_date=date(2020, 2, 14),
        expires_date=date(2030, 2, 14),
        is_verified=True,
        description="Carte de identitate (adresă: Londra)",
    )
    alex_pasaport = Document(
        id="doc-alex-pasaport-0010",
        owner_id=ALEX_ID,
        doc_type="PASAPORT",
        doc_number="RO5551234",
        issued_by="Ambasada României Londra",
        issued_date=date(2021, 8, 30),
        expires_date=date(2031, 8, 30),
        is_verified=True,
        description="Pașaport biometric",
    )

    db.add_all([
        ion_ci, ion_pasaport, ion_permis, ion_cazier,
        maria_ci, maria_pasaport, maria_cert_nastere, maria_rovinieta,
        alex_ci, alex_pasaport,
    ])
    db.flush()

    # ── Delegation: Maria → Alex ──────────────────────────────────────────────
    delegation = DelegationGrant(
        id="delegation-maria-alex-0001",
        delegator_id=MARIA_ID,
        delegate_id=ALEX_ID,
        document_categories=json.dumps(["CI", "PASAPORT", "ROVINIETA", "PERMIS"]),
        permissions=json.dumps(["read", "request_renewal"]),
        valid_until=datetime.utcnow() + timedelta(days=365),
        notes="Fiu în diaspora (Londra) — administrează actele mamei de la distanță",
    )
    db.add(delegation)
    db.flush()

    # ── Seed audit entries ────────────────────────────────────────────────────
    add_audit_entry(
        db,
        action="SYSTEM_INIT",
        actor_id="sistem",
        actor_name="ActID System",
        actor_role="sistem",
        metadata={"version": "1.0.0", "event": "Inițializare sistem ActID"},
    )
    add_audit_entry(
        db,
        action="DOCUMENT_UPLOAD",
        actor_id=ION_ID,
        actor_name="Ion Popescu",
        actor_role="cetățean",
        target_document_id="doc-ion-ci-0001",
        metadata={"doc_type": "CI", "event": "Adăugat CI în portofel digital"},
    )
    add_audit_entry(
        db,
        action="DELEGATION_CREATE",
        actor_id=MARIA_ID,
        actor_name="Maria Ionescu",
        actor_role="cetățean",
        target_user_id=ALEX_ID,
        metadata={
            "delegate_name": "Alexandru Ionescu",
            "event": "Delegare acordată fiului din Londra",
            "categories": ["CI", "PASAPORT", "ROVINIETA", "PERMIS"],
        },
    )
    add_audit_entry(
        db,
        action="DOCUMENT_VIEW",
        actor_id=ALEX_ID,
        actor_name="Alexandru Ionescu",
        actor_role="cetățean",
        target_document_id="doc-maria-rovinieta-0008",
        metadata={"event": "Alex a verificat rovinieta mamei din Londra", "location": "Londra, UK"},
    )

    db.commit()
    print("✅ Seed data loaded successfully")
