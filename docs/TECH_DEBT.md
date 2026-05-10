# Fox Reader - Technical Debt
*Ranked issues to fix before scaling or production*

**Last Updated**: May 8, 2026 (Updated after comprehensive audit)  
**Total Issues**: 16 (5 critical + 5 important + 6 optional)  
**Estimated Fix Time**: 24-32 hours total

---

## 🔴 CRITICAL (Fix This Week - Security/Stability Risks)

Fix these IMMEDIATELY before production deployment.

### 1. Hardcoded JWT Secret
**Location**: `backend/auth.py:14`  
**Severity**: 🔴 CRITICAL  
**Risk**: Authentication completely compromised  
**Time to fix**: 30 min

```python
# CURRENT (INSECURE):
SECRET_KEY = os.getenv("SECRET_KEY", "fox-reader-secret-change-in-production-2026")

# SHOULD BE:
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY and os.getenv("ENVIRONMENT") == "production":
    raise RuntimeError("SECRET_KEY must be set in production")
```

**Impact**: Any attacker can forge JWT tokens and impersonate any user  
**See**: `SECURITY_NOTES.md#1-hardcoded-jwt-secret-in-production`

---

### 2. CORS Allows All Origins
**Location**: `backend/main.py:61`  
**Severity**: 🔴 CRITICAL  
**Risk**: CSRF attacks, token theft  
**Time to fix**: 30 min

```python
# CURRENT (INSECURE):
allow_origins=["*"]

# SHOULD BE:
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
# Validate in production...
allow_origins=ALLOWED_ORIGINS
```

**Impact**: Any website can make authenticated requests to your API  
**See**: `SECURITY_NOTES.md#2-cors-allows-all-origins`

---

### 3. No File Size Limits on Uploads
**Location**: `backend/books.py:172-177`  
**Severity**: 🔴 CRITICAL  
**Risk**: DOS attack, disk exhaustion  
**Time to fix**: 30 min

```python
# CURRENT (INSECURE):
async def upload_book(file: UploadFile = File(...)):  # No size check

# SHOULD BE:
MAX_FILE_SIZE = 50_000_000  # 50MB
async def upload_book(file: UploadFile = File(..., size_limit=MAX_FILE_SIZE)):
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
```

**Impact**: Attacker can fill disk with single large upload  
**See**: `SECURITY_NOTES.md#3-no-file-size-limits-on-upload`

---

### 4. Silent Migration Failures
**Location**: `backend/database.py:186-191`  
**Severity**: 🔴 CRITICAL  
**Risk**: Data integrity issues, failed schema updates  
**Time to fix**: 30 min

```python
# CURRENT (INSECURE):
try:
    conn.execute(text(sql))
except Exception:
    pass  # Silent failure - very bad!

# SHOULD BE:
except Exception as e:
    if "already exists" not in str(e).lower():
        logger.error(f"Migration failed: {sql}\nError: {e}")
        raise  # Fail startup if migration fails
```

**Impact**: Database schema inconsistencies, feature breakage  
**See**: `SECURITY_NOTES.md#4-silent-migration-failures`

---

### 5. Database File Committed to Git
**Location**: `backend/fox_reader.db` (in repo)  
**Severity**: 🔴 CRITICAL (Data leak risk)  
**Time to fix**: 5 min

```bash
# ADD TO .gitignore:
backend/fox_reader.db
backend/fox_reader.db-shm
backend/fox_reader.db-wal
backend/librali/
```

**Impact**: Database exposed in version control, development data leaked  
**See**: `STRUCTURE_CLEANUP.md#6-gitignore-improvements`

---

## 🟡 IMPORTANT (Fix This Sprint - Performance/Reliability)

These affect performance and scalability. Fix within 2-3 weeks.

### 1. N+1 Query Patterns (60+ queries per page)
**Location**: `backend/books.py:375-450`, `492-536`, `541-570`  
**Severity**: 🟡 HIGH  
**Current**: 60+ queries per page load  
**Target**: 3-4 queries  
**Time to fix**: 4-6 hours

**Problem**:
```python
for b in books:
    owner = db.query(User).filter(User.id == b.owner_id).first()  # N queries
    comment_count = db.query(Comment).filter(Comment.book_id == b.id).count()  # N queries
    like_count = db.query(Like).filter(Like.book_id == b.id).count()  # N queries
    like = db.query(Like).filter(Like.user_id == user.id, Like.book_id == b.id).first()  # N queries
```

**Solution**: Use SQLAlchemy joins and eager loading
- Add database indexes
- Use `selectinload()` for relationships
- Aggregate likes/comments in query

**Affected endpoints**: 
- `GET /api/books/public` (20 books = 80 queries)
- `GET /api/books/search` (loads all books into memory!)
- `GET /api/books/my` (user's books)
- `GET /api/books/users-with-books` (all authors)

**See**: `ARCHITECTURAL_REVIEW.md#14-n1-query-patterns`

---

### 2. In-Memory Sorting Problem
**Location**: `backend/books.py:405-414`  
**Severity**: 🟡 HIGH  
**Problem**: Loads ALL public books into memory for like-based sorting  
**Time to fix**: 1 hour

```python
# CURRENT (BAD):
if sort_by == "likes":
    books = query.all()  # ALL books loaded!
    books.sort(key=lambda b: ...)  # Python sorting

# SHOULD BE:
.order_by(func.count(Like.id).desc()).group_by(Book.id)
```

**Impact**: Doesn't scale beyond 10,000 books  
**See**: `ARCHITECTURAL_REVIEW.md#16-in-memory-sorting-problem`

---

### 3. Missing Denormalized Fields
**Location**: `backend/database.py` model definitions  
**Severity**: 🟡 MEDIUM  
**Problem**: `like_count`, `comment_count` recalculated on every request  
**Time to fix**: 2-3 hours

**Solution**: Add columns to Book model:
```python
class Book(Base):
    __tablename__ = "books"
    
    # NEW FIELDS:
    like_count: int = Column(Integer, default=0)
    comment_count: int = Column(Integer, default=0)
    
    # Update via ORM events or triggers on like/comment insert/delete
```

**Expected improvement**: 20 queries → 3-4 queries per page

---

### 4. No Rate Limiting
**Location**: All endpoints, especially `/api/auth/login`, `/api/books/upload`, `/api/tts`  
**Severity**: 🟡 MEDIUM  
**Problem**: Open to brute force and DOS  
**Time to fix**: 2 hours

```python
# Add rate limiting:
@router.post("/login")
@limiter.limit("5/minute")  # Max 5 attempts per IP per minute
async def login(...):
    pass

@router.post("/upload")
@limiter.limit("10/hour")  # Max 10 uploads per IP per hour
async def upload_book(...):
    pass
```

**See**: `SECURITY_NOTES.md#1-no-rate-limiting`

---

### 5. Unvalidated Series Reorder
**Location**: `backend/books.py:1131-1138`  
**Severity**: 🟡 MEDIUM  
**Problem**: Accepts arbitrary `book_ids`, doesn't validate they belong to series  
**Time to fix**: 1 hour

```python
# FIX:
def reorder_series_books(series_id: int, book_ids: List[int], db: Session):
    # Validate all book_ids belong to this series
    series = db.query(Series).filter(Series.id == series_id).first()
    existing_ids = {b.id for b in series.books}
    
    for book_id in book_ids:
        if book_id not in existing_ids:
            raise HTTPException(status_code=400, detail="Book not in this series")
```

---

## 🟢 OPTIONAL (Fix When Time Allows - Code Quality)

These improve maintainability but aren't breaking. Fix in next 1-2 months.

### 1. Code Duplication: BookOut Construction
**Location**: `backend/books.py` (7 identical blocks)  
**Severity**: 🟢 OPTIONAL  
**Problem**: 200+ lines duplicated, hard to maintain  
**Time to fix**: 2-3 hours

**Solution**: Extract helper function
```python
def _book_to_out(book: Book, user_id: Optional[int] = None, db: Session = None) -> BookOut:
    """Convert Book model to API response, handling all calculations."""
    like_count = db.query(Like).filter(Like.book_id == book.id).count()
    comment_count = db.query(Comment).filter(Comment.book_id == book.id).count()
    # ... etc
    return BookOut(...)
```

Then replace all 7 instances with: `_book_to_out(book, user.id, db)`

---

### 2. Dead Code Cleanup
**Location**: Multiple files  
**Severity**: 🟢 OPTIONAL  
**Problem**: Stub code clutters navigation  
**Time to fix**: 1 hour

Remove:
- `backend/tts/coqui.py` (34 LOC stub)
- `backend/tts/piper.py` (34 LOC stub)
- `backend/requirements-base.txt` (unused)

---

### 3. No Test Suite
**Location**: Entire project  
**Severity**: 🟢 OPTIONAL (but important for refactoring)  
**Problem**: 0% test coverage, risky to refactor  
**Time to fix**: 10-15 hours for critical paths

**Recommendation**: 
- Add pytest for backend (20 key endpoints)
- Add Jest/React Testing for frontend (5-10 components)
- Enables safe refactoring

---

### 4. Frontend Component Extraction
**Location**: `frontend/src/app/`  
**Severity**: 🟢 OPTIONAL  
**Problem**: Only 2 reusable components, duplicated logic  
**Time to fix**: 3-4 hours

Create:
- `BookCard.tsx`
- `SeriesCard.tsx`
- `TTSControls.tsx`
- `BookMetadataEditor.tsx`
- `UploadModal.tsx`

---

### 5. Split Monolithic Backend Routes
**Location**: `backend/books.py` (1,842 LOC)  
**Severity**: 🟢 OPTIONAL (risky without tests first)  
**Problem**: Single file is hard to navigate  
**Time to fix**: 3-4 hours (after tests added)

Split into:
- `backend/routes/books.py` (600 LOC) - CRUD operations
- `backend/routes/series.py` (300 LOC)
- `backend/routes/comments.py` (150 LOC)
- `backend/routes/likes.py` (100 LOC)
- `backend/routes/subscriptions.py` (100 LOC)

---

### 6. Configuration Consistency
**Location**: Scattered across `main.py`, `auth.py`, `config.py`, `tts/cloud.py`  
**Severity**: 🟢 OPTIONAL  
**Problem**: Hardcoded values in multiple places  
**Time to fix**: 2 hours

Centralize in `config.py`:
```python
TTS_CHUNK_SIZE = int(os.getenv("TTS_CHUNK_SIZE", "1000"))
TTS_MAX_LENGTH = int(os.getenv("TTS_MAX_LENGTH", "5000"))
DEFAULT_VOICE = os.getenv("DEFAULT_VOICE", "ru-RU-SvetlanaNeural")
```

---

## 📊 Prioritization Matrix

| Issue | Priority | Time | Impact | Risk |
|-------|----------|------|--------|------|
| Hardcoded JWT | 🔴 TODAY | 30m | 🔴 Critical | Low |
| CORS wildcard | 🔴 TODAY | 30m | 🔴 Critical | Low |
| File size limits | 🔴 TODAY | 30m | 🔴 Critical | Low |
| Silent migrations | 🔴 TODAY | 30m | 🔴 Critical | Low |
| N+1 queries | 🟡 WEEK 1 | 4-6h | 🔴 Critical | Medium |
| Rate limiting | 🟡 WEEK 1 | 2h | 🟡 High | Low |
| Denormalized fields | 🟡 WEEK 2 | 2-3h | 🟡 High | Medium |
| BookOut helper | 🟢 WEEK 2 | 2-3h | 🟡 Medium | Low |
| Tests | 🟢 MONTH 1 | 10-15h | 🔴 Critical | Low |
| Component extraction | 🟢 MONTH 1 | 3-4h | 🟡 Medium | Low |
| Split books.py | 🟢 MONTH 2 | 3-4h | 🟡 Medium | High |

---

## ✅ Recommended Approach

### Week 1 (THIS WEEK)
- [ ] Fix all 5 critical security issues (2 hours)
- [ ] Add database indexes (1 hour)
- [ ] Extract BookOut helper (2-3 hours)
- [ ] Add rate limiting (2 hours)
- **Total: 7-8 hours**

### Week 2-3 (THIS SPRINT)
- [ ] Optimize N+1 queries (4-6 hours)
- [ ] Add denormalized fields (2-3 hours)
- [ ] Validate input parameters (2 hours)
- **Total: 8-11 hours**

### Following Month
- [ ] Add test coverage (10-15 hours)
- [ ] Extract components (3-4 hours)
- [ ] Clean up dead code (1 hour)
- [ ] Centralize configuration (2 hours)
- **Total: 16-22 hours**

---

## 🎯 Success Criteria

After fixing all issues:

✅ No security vulnerabilities (4 critical → 0)  
✅ Queries per page: 60+ → 3-4  
✅ Code duplication: 200 lines → 0 lines  
✅ Test coverage: 0% → 80%+  
✅ Dead code: 68 LOC → 0 LOC  
✅ Oversized files split  
✅ AI agents can navigate code easily  

---

## 📚 Related Documents

- `SECURITY_NOTES.md` - Detailed security fixes
- `STRUCTURE_CLEANUP.md` - Safe structural improvements
- `ARCHITECTURAL_REVIEW.md` - Comprehensive audit report
- `PROJECT_MAP.md` - Architecture reference
