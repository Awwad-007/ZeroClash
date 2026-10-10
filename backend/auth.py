import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from backend.database import get_session
from backend.models import User

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "zeroclash-jwt-secret-key-replace-in-production-1234567890")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
DEMO_MODE = os.getenv("DEMO_MODE", "true").strip().lower() in ("true", "1", "yes")

# Standardized Roles
ROLE_STUDENT = "student"
ROLE_FACULTY = "faculty"
ROLE_RESEARCHER = "researcher"
ROLE_LAB_ADMIN = "lab_admin"
VALID_ROLES = [ROLE_STUDENT, ROLE_FACULTY, ROLE_RESEARCHER, ROLE_LAB_ADMIN]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def normalize_role(role_raw: str) -> str:
    """
    Normalizes human-readable or formatted role strings into canonical lowercase enum strings.
    e.g. "Lab Admin" -> "lab_admin", "Student" -> "student".
    """
    if not role_raw:
        return ROLE_STUDENT
    clean = str(role_raw).strip().lower().replace(" ", "_").replace("-", "_")
    if "admin" in clean:
        return ROLE_LAB_ADMIN
    if "faculty" in clean or "prof" in clean:
        return ROLE_FACULTY
    if "research" in clean:
        return ROLE_RESEARCHER
    return ROLE_STUDENT

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not plain_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8")[:72], salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def _get_demo_default_user(role_hint: Optional[str] = None) -> User:
    target_role = normalize_role(role_hint) if role_hint else ROLE_LAB_ADMIN
    if target_role == ROLE_LAB_ADMIN:
        return User(
            id="usr-admin-sarah",
            name="Sarah Jenkins",
            email="admin@campus.edu",
            role="lab_admin",
            department="Campus Operations",
            reliability_score=1.0
        )
    return User(
        id="usr-student-alex",
        name="Alex M.",
        email="alex@campus.edu",
        role="student",
        department="Computer Science",
        reliability_score=0.92
    )

async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    x_demo_user_id: Optional[str] = Header(None, alias="X-Demo-User-Id"),
    session: Session = Depends(get_session)
) -> Optional[User]:
    # 1. Bearer Token Check
    if token:
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user_id = payload["sub"]
            user = session.get(User, user_id)
            if user:
                return user
            # Token valid but user might be from test session without DB write
            return User(
                id=user_id,
                name=payload.get("name", user_id),
                email=payload.get("email", f"{user_id}@campus.edu"),
                role=payload.get("role", ROLE_STUDENT)
            )

    # 2. Demo Mode Header Fallback (Preserves persona switcher for hackathon demo)
    if DEMO_MODE and x_demo_user_id:
        user = session.get(User, x_demo_user_id)
        if user:
            return user
        # In test or unseeded environment, return simulated demo user
        role = ROLE_LAB_ADMIN if "admin" in x_demo_user_id.lower() else (
            ROLE_FACULTY if "faculty" in x_demo_user_id.lower() else (
                ROLE_RESEARCHER if "research" in x_demo_user_id.lower() else ROLE_STUDENT
            )
        )
        return User(
            id=x_demo_user_id,
            name=x_demo_user_id.replace("usr-", "").replace("-", " ").title(),
            email=f"{x_demo_user_id}@campus.edu",
            role=role
        )

    return None

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    x_demo_user_id: Optional[str] = Header(None, alias="X-Demo-User-Id"),
    session: Session = Depends(get_session)
) -> User:
    user = await get_current_user_optional(token, x_demo_user_id, session)
    if user:
        return user

    # In DEMO_MODE if no user specified, fallback to default demo persona (admin-level to allow legacy unauthenticated demo calls)
    if DEMO_MODE:
        return session.get(User, "usr-admin-sarah") or _get_demo_default_user(ROLE_LAB_ADMIN)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials were not provided or have expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

def require_role(allowed_roles: List[str]):
    """
    Role-based access control dependency. Ensures current user possesses one of allowed_roles.
    """
    normalized_allowed = [normalize_role(r) for r in allowed_roles]

    async def role_checker(
        token: Optional[str] = Depends(oauth2_scheme),
        x_demo_user_id: Optional[str] = Header(None, alias="X-Demo-User-Id"),
        session: Session = Depends(get_session)
    ) -> User:
        user = await get_current_user_optional(token, x_demo_user_id, session)
        if not user:
            if DEMO_MODE:
                # If lab_admin is required and no explicit user passed, default to admin persona in demo
                if ROLE_LAB_ADMIN in normalized_allowed:
                    user = session.get(User, "usr-admin-sarah") or _get_demo_default_user(ROLE_LAB_ADMIN)
                else:
                    user = session.get(User, "usr-student-alex") or _get_demo_default_user(ROLE_STUDENT)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        user_role = normalize_role(user.role)
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: required role in {allowed_roles}, but user '{user.name}' has role '{user.role}'"
            )
        return user

    return role_checker

# Preconfigured lab_admin dependency
require_lab_admin = require_role([ROLE_LAB_ADMIN])

