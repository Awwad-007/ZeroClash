from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional, List
import uuid

from backend.database import get_session
from backend.models import User
from backend.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    normalize_role,
    VALID_ROLES,
    ROLE_STUDENT,
    ROLE_LAB_ADMIN,
    DEMO_MODE
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "Student"
    department: str = "Engineering"

@router.post("/login")
def login(req: LoginRequest, session: Session = Depends(get_session)):
    clean_email = req.email.strip().lower()
    user = session.exec(select(User).where(User.email == clean_email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    is_valid = False
    if user.hashed_password:
        is_valid = verify_password(req.password, user.hashed_password)
    elif DEMO_MODE:
        # In demo mode, seeded users can log in with campus123
        is_valid = req.password in ("campus123", "demo123", "password", "")

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = create_access_token({
        "sub": user.id,
        "role": normalize_role(user.role),
        "email": user.email
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.model_dump(exclude={"hashed_password"})
    }

@router.post("/register")
def register(req: RegisterRequest, session: Session = Depends(get_session)):
    clean_email = req.email.strip().lower()
    existing = session.exec(select(User).where(User.email == clean_email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )

    norm_role = normalize_role(req.role)
    if norm_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {VALID_ROLES}"
        )

    new_id = f"usr-{norm_role[:3]}-{uuid.uuid4().hex[:6]}"
    hashed = get_password_hash(req.password)
    user = User(
        id=new_id,
        name=req.name.strip(),
        role=req.role,
        email=clean_email,
        department=req.department.strip(),
        no_show_count=0,
        reliability_score=100,
        hashed_password=hashed
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({
        "sub": user.id,
        "role": norm_role,
        "email": user.email
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.model_dump(exclude={"hashed_password"})
    }

@router.get("/me")
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user.model_dump(exclude={"hashed_password"})

@router.get("/demo-users")
def get_demo_users(session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [
        {
            **u.model_dump(exclude={"hashed_password"}),
            "normalized_role": normalize_role(u.role),
            "demo_password": "campus123"
        }
        for u in users
    ]
