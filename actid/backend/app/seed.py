"""Seed demo data for ActID hackathon."""
import json
from datetime import date, datetime, timedelta

import bcrypt
from sqlalchemy.orm import Session

from .ledger import add_audit_entry
from .models.models import AuditEntry, CivilRegistry, ChildDocument, ChildGuardian, ChildProfile, DelegationGrant, Document, GovernmentDocRegistry, ShareScanLog, ShareToken, User

# Fixed IDs for reproducibility
ION_ID = "user-ion-popescu-0001"
MARIA_ID = "user-maria-ionescu-0002"
ALEX_ID = "user-alex-ionescu-0003"
FUNC_ID = "user-functionar-0004"
SOFIA_ID = "user-sofia-constantin-0005"

TODAY = date.today()


def _seed_extensions(db: Session) -> None:
    """Seed data added after initial release — each item checked independently."""
    pw = bcrypt.hashpw(b"Parola@123", bcrypt.gensalt()).decode()

    # Sofia user
    if not db.query(User).filter(User.id == SOFIA_ID).first():
        sofia = User(
            id=SOFIA_ID,
            cnp="6110315120033",
            email="sofia.constantin@gmail.com",
            full_name="Sofia Constantin-Popescu",
            phone="0745234567",
            hashed_password=pw,
            role="cetățean",
            city="Cluj-Napoca",
            country="România",
        )
        db.add(sofia)
        db.flush()

    # Civil registry records
    if not db.query(CivilRegistry).filter(CivilRegistry.id == "registry-elena-0001").first():
        db.add(CivilRegistry(
            id="registry-elena-0001",
            record_type="birth_certificate",
            child_full_name="Elena Ionescu-Popescu",
            child_date_of_birth=date(2015, 5, 10),
            child_cnp="6150510120011",
            parent1_cnp="2650820123457",
            parent1_name="Maria Ionescu",
            parent2_cnp="1820315123456",
            parent2_name="Ion Popescu",
            document_number="CN-2015-8821",
            issued_date=date(2015, 5, 18),
            issued_by="Primăria Cluj-Napoca — Stare Civilă",
        ))

    if not db.query(CivilRegistry).filter(CivilRegistry.id == "registry-sofia-0002").first():
        db.add(CivilRegistry(
            id="registry-sofia-0002",
            record_type="adoption_decree",
            child_full_name="Sofia Constantin-Popescu",
            child_date_of_birth=date(2011, 3, 15),
            child_cnp="6110315120033",
            guardian_cnp="1820315123456",
            guardian_name="Ion Popescu",
            document_number="DA-2016-0042",
            issued_date=date(2016, 7, 22),
            issued_by="Tribunalul Cluj",
        ))

    # Pre-built child profiles
    if not db.query(ChildProfile).filter(ChildProfile.id == "child-elena-0001").first():
        db.add(ChildProfile(
            id="child-elena-0001",
            full_name="Elena Ionescu-Popescu",
            date_of_birth=date(2015, 5, 10),
            cnp="6150510120011",
            user_id=None,
        ))
        db.flush()
        db.add(ChildGuardian(
            id="guardian-elena-maria-0001",
            child_id="child-elena-0001",
            guardian_id=MARIA_ID,
            relationship_type="parent",
            proof_type="birth_certificate",
            proof_verified=True,
        ))
        db.add(ChildDocument(
            id="child-doc-elena-0001",
            child_id="child-elena-0001",
            doc_type="CERT_NASTERE",
            doc_number="CN-2015-8821",
            issued_by="Primăria Cluj-Napoca — Stare Civilă",
            issued_date=date(2015, 5, 18),
            description="Certificat de naștere",
        ))

    if not db.query(ChildProfile).filter(ChildProfile.id == "child-sofia-0002").first():
        db.add(ChildProfile(
            id="child-sofia-0002",
            full_name="Sofia Constantin-Popescu",
            date_of_birth=date(2011, 3, 15),
            cnp="6110315120033",
            user_id=SOFIA_ID,
        ))
        db.flush()
        db.add(ChildGuardian(
            id="guardian-sofia-ion-0002",
            child_id="child-sofia-0002",
            guardian_id=ION_ID,
            relationship_type="adoptive_parent",
            proof_type="adoption_decree",
            proof_verified=True,
        ))
        db.add(ChildDocument(
            id="child-doc-sofia-0002",
            child_id="child-sofia-0002",
            doc_type="DECRET_ADOPTIE",
            doc_number="DA-2016-0042",
            issued_by="Tribunalul Cluj",
            issued_date=date(2016, 7, 22),
            description="Decret de adopție nr. DA-2016-0042",
        ))

    # Government document registry — mock gov DB for children
    gov_docs = [
        # Elena (CNP 6150510120011, born 2015, age ~11) — Școala Generală nr. 7
        ("gov-doc-elena-health-0001",  "6150510120011", "CARD_SANATATE",  "CS-2015-089123", "CNAS Cluj",                               date(2015, 9,  1), date(2029, 9,  1), "Card național de sănătate"),
        ("gov-doc-elena-pasaport-0002","6150510120011", "PASAPORT",       "RO7654321",      "MAI Cluj",                                date(2022, 6, 15), date(2027, 6, 15), "Pașaport biometric"),
        ("gov-doc-elena-carnet-0006",  "6150510120011", "CARNET_ELEV",    "CE-2025-07-1142","Școala Generală nr. 7 Cluj-Napoca",        date(2025, 9,  1), date(2026, 8, 31), "Carnet de elev — an școlar 2025/2026, clasa a V-a"),
        # Sofia (CNP 6110315120033, born 2011, age ~15) — Liceul Teoretic Emil Racoviță
        ("gov-doc-sofia-ci-0003",      "6110315120033", "CI",             "CJ555222",       "SPCLEP Cluj-Napoca",                      date(2025, 4, 20), date(2035, 4, 20), "Carte de identitate"),
        ("gov-doc-sofia-health-0004",  "6110315120033", "CARD_SANATATE",  "CS-2011-045678", "CNAS Cluj",                               date(2011, 9,  1), date(2029, 9,  1), "Card național de sănătate"),
        ("gov-doc-sofia-pasaport-0005","6110315120033", "PASAPORT",       "RO8877665",      "MAI Cluj",                                date(2023, 3, 15), date(2028, 3, 15), "Pașaport biometric"),
        ("gov-doc-sofia-carnet-0007",  "6110315120033", "CARNET_ELEV",    "CE-2025-LR-0884","Liceul Teoretic «Emil Racoviță» Cluj",     date(2025, 9,  1), date(2026, 8, 31), "Carnet de elev — an școlar 2025/2026, clasa a IX-a"),
    ]
    for (gid, cnp, dtype, num, issuer, idate, edate, desc) in gov_docs:
        if not db.query(GovernmentDocRegistry).filter(GovernmentDocRegistry.id == gid).first():
            db.add(GovernmentDocRegistry(
                id=gid, holder_cnp=cnp, doc_type=dtype, doc_number=num,
                issued_by=issuer, issued_date=idate, expires_date=edate, description=desc,
            ))

    db.commit()


def seed_database(db: Session) -> None:
    if db.query(User).filter(User.id == ION_ID).first():
        _seed_extensions(db)  # Ensure newer data is present even in existing DBs
        return

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

    # ── Share tokens (for funcționar demo scan logs) ──────────────────────────
    share_token_1 = ShareToken(
        id="share-token-demo-0001",
        creator_id=ION_ID,
        token="demo-token-ion-cj123456",
        document_ids=json.dumps(["doc-ion-ci-0001", "doc-ion-pasaport-0002"]),
        permissions=json.dumps(["read"]),
        context="Verificare angajare — CFR Cluj",
        expires_at=datetime.utcnow() + timedelta(days=1),
        max_uses=3,
        use_count=3,
        is_active=False,
    )
    share_token_2 = ShareToken(
        id="share-token-demo-0002",
        creator_id=MARIA_ID,
        token="demo-token-maria-cj987654",
        document_ids=json.dumps(["doc-maria-ci-0005"]),
        permissions=json.dumps(["read"]),
        context="Verificare identitate notar",
        expires_at=datetime.utcnow() + timedelta(days=1),
        max_uses=2,
        use_count=2,
        is_active=False,
    )
    share_token_3 = ShareToken(
        id="share-token-demo-0003",
        creator_id=ALEX_ID,
        token="demo-token-alex-cj555111",
        document_ids=json.dumps(["doc-alex-ci-0009"]),
        permissions=json.dumps(["read"]),
        context="Verificare identitate consulat",
        expires_at=datetime.utcnow() + timedelta(days=2),
        max_uses=1,
        use_count=1,
        is_active=False,
    )
    db.add_all([share_token_1, share_token_2, share_token_3])
    db.flush()

    scan_1 = ShareScanLog(
        id="scan-log-demo-0001",
        token_id="share-token-demo-0001",
        scanned_by=FUNC_ID,
        scanned_at=datetime.utcnow() - timedelta(hours=2),
    )
    scan_2 = ShareScanLog(
        id="scan-log-demo-0002",
        token_id="share-token-demo-0002",
        scanned_by=FUNC_ID,
        scanned_at=datetime.utcnow() - timedelta(hours=5),
    )
    scan_3 = ShareScanLog(
        id="scan-log-demo-0003",
        token_id="share-token-demo-0003",
        scanned_by=FUNC_ID,
        scanned_at=datetime.utcnow() - timedelta(days=1),
    )
    db.add_all([scan_1, scan_2, scan_3])
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
    add_audit_entry(
        db,
        action="QR_TOKEN_SCAN",
        actor_id=FUNC_ID,
        actor_name="Gheorghe Munteanu",
        actor_role="funcționar",
        target_user_id=ION_ID,
        metadata={"context": "Verificare angajare — CFR Cluj", "scanned_docs": 2},
    )
    add_audit_entry(
        db,
        action="QR_TOKEN_SCAN",
        actor_id=FUNC_ID,
        actor_name="Gheorghe Munteanu",
        actor_role="funcționar",
        target_user_id=MARIA_ID,
        metadata={"context": "Verificare identitate notar", "scanned_docs": 1},
    )
    add_audit_entry(
        db,
        action="QR_TOKEN_SCAN",
        actor_id=FUNC_ID,
        actor_name="Gheorghe Munteanu",
        actor_role="funcționar",
        target_user_id=ALEX_ID,
        metadata={"context": "Verificare identitate consulat", "scanned_docs": 1},
    )

    db.commit()
    print("✅ Seed data loaded successfully")
    _seed_extensions(db)
