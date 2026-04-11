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

SECRET_KEY = os.getenv("SECRET_KEY", "fox-reader-secret-change-in-production-2026")
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


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime
    preferred_voice: str = "default"
    preferred_language: str = "ru"

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
    return Token(access_token=token, token_type="bearer", username=user.username, role=user.role)


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.username})
    return Token(access_token=token, token_type="bearer", username=user.username, role=user.role)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)):
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "created_at": user.created_at,
        "preferred_voice": user.preferred_voice or "default",
        "preferred_language": user.preferred_language or "ru",
    }

@router.put("/voice")
def set_voice_preference(
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    voice = payload.get("voice", "default")
    language = payload.get("language", "ru")
    user.preferred_voice = voice
    user.preferred_language = language
    db.commit()
    return {"voice": voice, "language": language}


class UpdateLanguageRequest(BaseModel):
    language: str


@router.post("/update-language")
def update_language(
    payload: UpdateLanguageRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if payload.language not in ["ru", "en"]:
        raise HTTPException(status_code=400, detail="Invalid language")
    user.preferred_language = payload.language
    db.commit()
    return {"language": user.preferred_language}
