import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, User

logger = logging.getLogger(__name__)

# CRITICAL: Fail startup if SECRET_KEY not set in production
SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        logger.critical("SECURITY ERROR: SECRET_KEY environment variable must be set in production")
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY environment variable is not set. "
            "This is required in production. "
            "Set it with: export SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
        )
    else:
        # Development mode: use insecure default only locally
        logger.warning("⚠️  Using development SECRET_KEY - INSECURE for production")
        SECRET_KEY = "dev-only-insecure-secret-change-before-deploying-2026"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class UserCreate(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str
    id: int
    is_plus: bool = False
    is_banned: bool = False


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_plus: bool = False
    is_banned: bool = False
    created_at: datetime
    preferred_voice: str = "default"
    preferred_language: str = "ru"
    voice_pitch: float = 0.0
    voice_rate: float = 0.0
    voice_volume: float = 0.0

    class Config:
        from_attributes = True


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if token is None:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.username == username).first()
    return user


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@router.post("/register", response_model=Token)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(username=data.username, hashed_password=hash_password(data.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.username})
    return Token(
        access_token=token,
        token_type="bearer",
        username=user.username,
        role=user.role,
        id=user.id,
    )


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been banned")
    token = create_access_token({"sub": user.username})
    return Token(
        access_token=token,
        token_type="bearer",
        username=user.username,
        role=user.role,
        id=user.id,
        is_plus=user.is_plus,
        is_banned=user.is_banned,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "is_plus": user.is_plus,
        "is_banned": user.is_banned,
        "created_at": user.created_at,
        "preferred_voice": user.preferred_voice or "default",
        "preferred_language": user.preferred_language or "ru",
        "voice_pitch": user.voice_pitch or 0.0,
        "voice_rate": user.voice_rate or 0.0,
        "voice_volume": user.voice_volume or 0.0,
    }


@router.put("/user/{user_id}/role")
def set_user_role(
    user_id: int,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    new_role = payload.get("role", "user")
    if new_role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    target_user.role = new_role
    db.commit()
    return {"id": target_user.id, "username": target_user.username, "role": target_user.role, "is_plus": target_user.is_plus}


@router.put("/user/{user_id}/plus")
def toggle_user_plus(
    user_id: int,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    target_user.is_plus = payload.get("is_plus", False)
    db.commit()
    return {"id": target_user.id, "username": target_user.username, "role": target_user.role, "is_plus": target_user.is_plus}

@router.put("/voice")
def set_voice_preference(
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    voice = payload.get("voice_type", "default")
    language = payload.get("language", "ru")
    pitch = payload.get("pitch", 0.0)
    rate = payload.get("rate", 0.0)
    volume = payload.get("volume", 0.0)
    
    user.preferred_voice = voice
    user.preferred_language = language
    user.voice_pitch = pitch
    user.voice_rate = rate
    user.voice_volume = volume
    
    db.commit()
    return {
        "voice_type": voice, 
        "language": language,
        "pitch": pitch,
        "rate": rate,
        "volume": volume,
    }
