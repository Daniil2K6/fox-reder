# Fox Reader - Security Notes
*Realistic security audit - focused on actual risks*

**Assessment Date**: May 8, 2026  
**Risk Level**: 🔴 **CRITICAL** (4 issues) + 🟡 **IMPORTANT** (5 issues)

---

## ⚠️ CRITICAL ISSUES (Fix Immediately)

### 1. Hardcoded JWT Secret in Production
**Location**: `backend/auth.py:14`

**Issue**:
```python
SECRET_KEY = os.getenv("SECRET_KEY", "fox-reader-secret-change-in-production-2026")
```

**Risk**: Default fallback value means any production deployment without `SECRET_KEY` env var uses public secret. All JWT tokens can be forged by attacker.

**Impact**: 
- Authentication completely compromised
- Attacker can impersonate any user
- Can grant admin privileges to themselves

**Fix** (Priority: TODAY):
```python
# backend/auth.py

import logging

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")

# CRITICAL: Fail startup if not set in production
if not SECRET_KEY:
    if os.getenv("ENVIRONMENT") == "production":
        logger.critical("ERROR: SECRET_KEY must be set in production environment")
        raise RuntimeError(
            "SECRET_KEY environment variable is not set. "
            "This is a critical security requirement. "
            "See .env.example for setup."
        )
    else:
        logger.warning("Using development secret key (INSECURE for production)")
        SECRET_KEY = "dev-only-insecure-secret-change-before-deploying"
```

**Deployment**: 
```bash
# .env (never commit this file)
SECRET_KEY=<generate-strong-random-key>
ENVIRONMENT=production

# Generate with:
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

### 2. CORS Allows All Origins
**Location**: `backend/main.py:61`

**Issue**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ❌ SECURITY RISK
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Risk**: 
- Any domain can make authenticated requests to your API
- CSRF attacks possible (though mitigated by SameSite cookies if used)
- Token theft via malicious websites
- Cross-origin requests bypass same-origin policy

**Example attack**:
```javascript
// Evil website attacker.com
fetch('http://localhost:8000/api/books/delete', {
  method: 'DELETE',
  headers: { 'Authorization': 'Bearer user-token-from-cookie' },
  credentials: 'include'
})
// User's book gets deleted without their knowledge
```

**Impact**: Medium-High (requires user to visit attacker site with valid token)

**Fix** (Priority: TODAY):
```python
# backend/main.py

import os
import logging

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Validate configuration
if os.getenv("ENVIRONMENT") == "production":
    if ALLOWED_ORIGINS == ["*"]:
        logger.critical("CORS misconfigured: ALLOWED_ORIGINS cannot be '*' in production")
        raise RuntimeError(
            "CORS security misconfiguration: must specify allowed origins. "
            "Set ALLOWED_ORIGINS environment variable."
        )
    if "localhost" in str(ALLOWED_ORIGINS):
        logger.warning("localhost in ALLOWED_ORIGINS in production - verify this is intended")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
    max_age=600,  # Browser caches preflight for 10 minutes
)
```

**Deployment**:
```bash
# .env
ALLOWED_ORIGINS=https://example.com,https://www.example.com
ENVIRONMENT=production
```

---

### 3. No File Size Limits on Upload
**Location**: `backend/books.py:172-177`

**Issue**:
```python
@router.post("/upload")
async def upload_book(file: UploadFile = File(...)):
    # ❌ No size_limit parameter
    # ❌ No size check before saving
```

**Risk**: 
- DOS attack: Upload 100GB files → server runs out of disk
- Memory exhaustion: Large files loaded into memory
- Service degradation for legitimate users
- Requires manual intervention to clean up

**Example attack**:
```bash
# Create 5GB file and upload it
dd if=/dev/zero of=huge.bin bs=1M count=5000
curl -F "file=@huge.bin" http://localhost:8000/api/books/upload
# Repeat 10x → server disk full
```

**Impact**: High (easy to execute, takes service offline)

**Fix** (Priority: TODAY):
```python
# backend/config.py - ADD
MAX_FILE_SIZE = 50_000_000  # 50MB

# backend/books.py - UPDATE

from fastapi import File, UploadFile, HTTPException
from config import MAX_FILE_SIZE

@router.post("/upload")
async def upload_book(
    file: UploadFile = File(...),
    series: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    # Check file size BEFORE processing
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1_000_000:.0f}MB"
        )
    
    # Also check while reading (defense in depth)
    contents = b""
    async for chunk in file.file:
        contents += chunk
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large during upload. Maximum size: {MAX_FILE_SIZE / 1_000_000:.0f}MB"
            )
    
    # Continue with upload logic...
```

**Add rate limiting** (bonus):
```python
# backend/main.py - ADD

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@router.post("/upload")
@limiter.limit("10/hour")  # Max 10 uploads per IP per hour
async def upload_book(...):
    pass
```

---

### 4. Silent Migration Failures
**Location**: `backend/database.py:186-191`

**Issue**:
```python
def init_db():
    # ... creates tables ...
    migrations = [
        "ALTER TABLE users ADD COLUMN preferred_voice VARCHAR(32)...",
        # ... more migrations ...
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception:
                pass  # ❌ SILENT FAILURE - all errors hidden
```

**Risk**: 
- **Critical errors hidden**: Syntax errors in migrations go unnoticed
- **Data corruption**: Column modifications fail silently
- **Permission errors**: Database user lacks required privileges
- **Inconsistent state**: Schema doesn't match expectations
- **Data loss**: Migration that was supposed to run didn't

**Example**:
```python
# Typo in migration SQL:
"ALTER TABLE users ADD COLUM preferred_voice ..."  # COLUM instead of COLUMN
# Error is silently swallowed → feature broken but nobody knows
```

**Impact**: High (data integrity risk)

**Fix** (Priority: TODAY):
```python
# backend/database.py - UPDATE

import logging

logger = logging.getLogger(__name__)

def init_db():
    # ... creates tables ...
    migrations = [
        "ALTER TABLE users ADD COLUMN preferred_voice VARCHAR(32)...",
        # ... more migrations ...
    ]
    
    with engine.connect() as conn:
        for i, sql in enumerate(migrations, 1):
            try:
                logger.info(f"Running migration {i}/{len(migrations)}: {sql[:60]}...")
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                error_msg = str(e).lower()
                
                # Column/table already exists is expected (idempotent)
                if "already exists" in error_msg:
                    logger.debug(f"Migration {i} skipped (already applied)")
                    continue
                
                # Anything else is an error
                logger.error(f"Migration {i} FAILED: {sql}")
                logger.error(f"Error details: {e}")
                raise RuntimeError(f"Database migration failed at step {i}: {e}")
    
    logger.info("All migrations completed successfully")
```

---

## 🟡 IMPORTANT ISSUES (Fix Soon)

### 1. No Rate Limiting
**Affected Endpoints**:
- `/api/auth/login` - Brute force attack possible
- `/api/auth/register` - Account enumeration, spam
- `/api/tts`, `/api/tts/chunk` - DOS via TTS requests
- `/api/books/upload` - DOS via large number of requests

**Risk**: Medium (requires active attack)

**Fix**:
```python
# backend/main.py - ADD

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."}
    )

# backend/auth.py - UPDATE

@router.post("/login")
@limiter.limit("5/minute")  # Max 5 attempts per IP per minute
async def login(payload: UserCreate, db: Session = Depends(get_db)):
    pass

@router.post("/register")
@limiter.limit("3/minute")  # Max 3 registrations per IP per minute
async def register(payload: UserCreate, db: Session = Depends(get_db)):
    pass
```

---

### 2. No Password Strength Enforcement
**Location**: `backend/auth.py:24-26`

**Issue**:
```python
class UserCreate(BaseModel):
    username: str  # ❌ No length check
    password: str  # ❌ No strength requirement
```

**Risk**: User can register with:
- 1-character username: "a"
- 1-character password: "x"
- No special characters requirement
- No complexity rules

**Fix**:
```python
# backend/auth.py - UPDATE

from pydantic import BaseModel, Field, validator

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def password_strength(cls, v):
        """Enforce password complexity."""
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain digit')
        return v
    
    @validator('username')
    def username_valid(cls, v):
        """Enforce username format."""
        if not v.isalnum():
            raise ValueError('Username must contain only alphanumeric characters')
        return v
```

---

### 3. No Input Validation on Resource IDs
**Location**: Multiple endpoints like `backend/books.py:????`

**Issue**:
```python
@router.get("/{book_id}")
def get_book(book_id: int):  # ❌ No range check
    book = db.query(Book).filter(Book.id == book_id).first()
    return book
```

**Risk**: 
- Invalid IDs cause unnecessary database queries
- No access control check on private books
- Potential information disclosure

**Example**:
```bash
# User A tries to access User B's private book
GET /api/books/99999  # User B's book
# If no access check, User A sees book details
```

**Fix**:
```python
# backend/books.py - UPDATE

@router.get("/{book_id}")
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if book_id < 1:
        raise HTTPException(status_code=400, detail="Invalid book ID")
    
    book = db.query(Book).filter(Book.id == book_id).first()
    
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Access control: Check if book is public or user owns it
    if not book.is_public:
        if not user or book.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return book
```

---

### 4. No HTTPS Enforcement
**Impact**: Tokens sent over HTTP if deployed on HTTP

**Mitigation** (Backend):
```python
# backend/main.py - ADD (if behind proxy)

from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["example.com", "www.example.com"]
)

# For HTTPS redirect, configure in reverse proxy (nginx, CloudFlare)
```

**Deployment**: Use HTTPS in production (via Let's Encrypt, reverse proxy, etc.)

---

### 5. No Audit Logging
**Impact**: No record of who deleted/modified what

**Fix** (Future enhancement):
```python
# Add audit logging for critical operations
logger.info(f"User {user.id} deleted book {book.id}")
logger.info(f"User {user.id} changed admin role for {target_user.id}")
logger.info(f"User {user.id} banned user {banned_user.id}")
```

---

## 🟢 SECURE PRACTICES (Already Good)

✓ **JWT tokens** - Good implementation  
✓ **Password hashing** - Using bcrypt  
✓ **Database queries** - Using parameterized queries (SQLAlchemy)  
✓ **Role-based access** - Admin/user separation exists  
✓ **Dependency injection** - FastAPI `Depends()` for auth  

---

## 📋 IMPLEMENTATION CHECKLIST

### Immediate (Today - 30 minutes)
- [ ] Set `SECRET_KEY` environment variable, fail on missing in prod
- [ ] Configure `ALLOWED_ORIGINS` and validate in code
- [ ] Add `MAX_FILE_SIZE` check to upload endpoint
- [ ] Fix migration error handling (stop silent failures)

### This Week (2-3 hours)
- [ ] Add rate limiting to auth endpoints
- [ ] Add rate limiting to upload/TTS endpoints
- [ ] Add password strength validation
- [ ] Add input validation on IDs

### This Month
- [ ] Add HTTPS redirect (if not already in proxy)
- [ ] Add audit logging for critical operations
- [ ] Set up `.env.example` template
- [ ] Document security requirements in SETUP.md

---

## 🔒 Deployment Security Checklist

Before deploying to production:

- [ ] `SECRET_KEY` set to strong random value (min 32 chars)
- [ ] `ALLOWED_ORIGINS` restricted to your domain(s)
- [ ] `ENVIRONMENT=production` set
- [ ] HTTPS enabled (SSL certificate installed)
- [ ] Database backups configured
- [ ] `.env` file is in `.gitignore` and never committed
- [ ] No debug mode enabled (`DEBUG=false`)
- [ ] Rate limiting enabled on all public endpoints
- [ ] File upload size limits enforced
- [ ] Input validation on all user inputs
- [ ] Logging configured and monitored

---

## 🚨 Realistic Threat Model

**Who might attack**:
- Script kiddies testing default credentials
- Competitors trying to enumerate users
- Attackers finding server via port scanning

**Attack vectors**:
- Brute force login (mitigated by rate limiting)
- Large file upload (mitigated by size limits)
- Token forgery (mitigated by SECRET_KEY enforcement)
- CSRF attacks (mitigated by CORS restriction)

**What we're NOT worried about** (out of scope):
- SQL injection (SQLAlchemy prevents this)
- XSS (Next.js has built-in XSS protection)
- DDOS (requires CDN/WAF, not application level)
- Physical server theft (requires data center security)

---

## 📚 References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Last Updated**: May 8, 2026  
**Next Review**: After critical issues are fixed
