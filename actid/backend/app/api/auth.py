import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..ledger import add_audit_entry
from ..models.models import PendingAuth, User
from ..schemas.schemas import LoginRequest, LoginResponse, TokenResponse, TwoFARequest

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_OTP = "123456"


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(token: str, db: Session) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalid sau expirat",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


# ─── Dependency ──────────────────────────────────────────────────────────────

from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token-form")


def get_current_user_dep(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return get_current_user(token, db)


def require_role(*roles: str):
    def _dep(current_user: User = Depends(get_current_user_dep)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Acces interzis pentru rolul tău")
        return current_user
    return _dep


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.email == req.identifier) | (User.cnp == req.identifier)
    ).first()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email/CNP sau parolă incorectă",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cont dezactivat")

    session_token = secrets.token_urlsafe(32)
    pending = PendingAuth(
        user_id=user.id,
        session_token=session_token,
        otp_code=DEMO_OTP,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(pending)
    db.commit()

    return LoginResponse(
        session_token=session_token,
        message=f"Cod OTP trimis pe telefonul *****{(user.phone or '000')[-3:]}",
        demo_otp=DEMO_OTP,
        user_name=user.full_name,
    )


@router.post("/verify-2fa", response_model=TokenResponse)
def verify_2fa(req: TwoFARequest, db: Session = Depends(get_db)):
    pending = (
        db.query(PendingAuth)
        .filter(
            PendingAuth.session_token == req.session_token,
            PendingAuth.used == False,
            PendingAuth.expires_at > datetime.utcnow(),
        )
        .first()
    )

    if not pending:
        raise HTTPException(status_code=401, detail="Sesiune invalidă sau expirată")

    if pending.otp_code != req.otp_code:
        raise HTTPException(status_code=401, detail="Cod OTP incorect")

    pending.used = True
    db.flush()

    user = db.query(User).filter(User.id == pending.user_id).first()

    access_token = create_access_token({"sub": user.id, "role": user.role})

    add_audit_entry(
        db,
        action="LOGIN_SUCCESS",
        actor_id=user.id,
        actor_name=user.full_name,
        actor_role=user.role,
        metadata={"method": "ROeID+2FA", "city": user.city},
    )
    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "city": user.city,
            "country": user.country,
            "cnp": user.cnp,
        },
    )


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user_dep)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "city": current_user.city,
        "country": current_user.country,
        "cnp": current_user.cnp,
    }


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    add_audit_entry(
        db,
        action="LOGOUT",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
    )
    db.commit()
    return {"message": "Deconectat cu succes"}
