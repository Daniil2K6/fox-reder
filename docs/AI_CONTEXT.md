# Fox Reader - AI Context Reference
*Pre-parsed project knowledge to reduce token usage for future agents*

## Project Glossary
| Term | Definition |
|------|-------------|
| VBLite | Structured book format with chapters/characters, `.vblite` extension |
| VB | Legacy VoxBook format, `.vb` extension |
| struct.json | Parsed structured content for FB2/VB books, stored as `{book_path}.struct.json` |
| LIBRALI_DIR | Base storage directory: `backend/librali/` |
| TTS | Text-to-Speech via Edge TTS cloud service |
| Plus User | User with `is_plus=true`, extra features (animated covers, priority support) |
| Group ID | Links multi-format books (EPUB+FB2+TXT) to same Book record |

## Model Relationships (Quick Reference)
```
User 1 ──┐
           ├─→ Book 1 ──→ BookVersion (multiple formats)
           │     ├─→ Comment (multiple)
           │     ├─→ Like (multiple, unique per user)
           │     └─→ Series (many-to-many via book_series)
           │
           ├─→ Series (owned)
           ├─→ Comment (multiple)
           ├─→ Like (multiple)
           ├─→ Subscription (subscriber → author)
           └─→ Notification (multiple)
```

## Endpoint Map (Cheat Sheet)
### Auth Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | New user registration |
| POST | `/api/auth/login` | JWT token issuance |
| GET | `/api/auth/me` | Get current user details |
| PUT | `/api/auth/voice` | Update TTS preferences |

### Book Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/books/upload` | Upload new book/multi-format version |
| GET | `/api/books/my` | Get current user's books |
| GET | `/api/books/public` | Get public books (paginated) |
| GET | `/api/books/{id}` | Get single book details |
| GET | `/api/books/{id}/structured` | Get structured content (VBLite/ FB2) |
| POST | `/api/books/{id}/like` | Toggle like on book |
| POST | `/api/books/{id}/comment` | Add comment to book |

## Naming Conventions
- **Backend**: snake_case (Python standard) for functions/variables, PascalCase for Pydantic models (`BookOut`, `UserOut`)
- **Frontend**: camelCase (TypeScript standard), PascalCase for React components
- **Files**: snake_case for Python, kebab-case for frontend pages/components
- **Storage files**: `sha256[:16]_filename.ext` for books, `cover_{id}.ext` for covers, `series_{id}.ext` for series

## Common Patterns
1. **Multi-format books**: Add `BookVersion` linked to parent `Book` via `book_id`
2. **Series assignment**: Use many-to-many `book_series` table with `order_index`
3. **TTS requests**: Send `text`, `language`, optional `character`/`character_gender`/`voice_type`
4. **Auth checks**: Use `require_user` dependency for protected routes, `get_current_user` for optional auth
5. **File storage**: Always use `LIBRALI_DIR` subfolders (`books/`, `covers/`, `series/`, `avatars/`)

## Reusable Commands
```bash
# Backend quick restart
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend quick restart
cd frontend && npm run dev

# Database quick check
sqlite3 backend/fox_reader.db "SELECT name FROM sqlite_master WHERE type='table';"

# Test TTS
curl -X POST http://localhost:8000/api/tts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "language": "en"}' --output test.mp3
```

## Dangerous Areas (High Risk of Breaking Changes)
1. `backend/database.py` - Changing models requires migration logic in `init_db()`
2. `frontend/src/lib/api.ts` - Single source of truth for all API calls, breaking changes here break entire frontend
3. `backend/main.py` - CORS settings, router includes, lifespan events
4. `frontend/next.config.js` - API proxy configuration, breaking this breaks all backend communication
5. `backend/vb_parser.py` - File parsing logic, breaking this breaks book uploads for FB2/VB formats

## Frontend/Backend Coupling Points
- `BookOut` (backend Pydantic) ↔ Book interface (frontend) - must stay in sync when adding fields
- `UserOut` (backend) ↔ User type (frontend localStorage) - must stay in sync
- API route paths - frontend `api.ts` function paths must match backend router prefixes
- TTS parameters - frontend `apiTTSChunkWithCharacter` must match backend `/api/tts/chunk` payload

---

## 🚀 AI OPTIMIZATION PRIORITIES (Post-Review)

### Phase 1: Critical Fixes (TODAY)
**Security issues that must be fixed first**:
1. Move `SECRET_KEY` to environment variable, fail on missing in production
2. Restrict CORS to specific origins (no `["*"]`)
3. Add file upload size limits (50MB)
4. Stop silent failures in database migrations

See `SECURITY_NOTES.md` for implementation details.

### Phase 2: Quick Wins (This Week)
**High-value, low-risk improvements**:
1. Extract `book_to_out()` helper function (removes 200 LOC duplication)
2. Add 5 database indexes (reduces 60+ queries → 3-4 queries)
3. Delete dead code: `coqui.py`, `piper.py`, `requirements-base.txt`
4. Fix configuration scattered across files (centralize in `config.py`)

See `STRUCTURE_CLEANUP.md` for detailed recommendations.

### Phase 3: Performance (Next 2 Weeks)
**Scalability improvements**:
1. Optimize N+1 query patterns in `public_books()`, `my_books()`, `search_books()`
2. Replace in-memory sorting with database ordering
3. Add denormalized fields: `like_count`, `comment_count` on Book model
4. Cache file existence check: `has_structure` as DB column

See `TECH_DEBT.md` for prioritized issues.

### Phase 4: Code Quality (Following Month)
**Maintainability improvements**:
1. Add test coverage (pytest for backend, Jest for frontend)
2. Extract frontend components (BookCard, SeriesCard, TTSControls)
3. Split `books.py` (1,842 LOC → 4 files × 400-600 LOC)
4. Create shared types: `frontend/src/types/index.ts`

---

## ⚡ Performance Baseline

**Current state** (before optimization):
- Database queries per page load: 60+
- books.py file size: 1,842 LOC
- Code duplication: 200+ lines (BookOut construction)
- Test coverage: 0%
- Frontend components: 2

**Expected after optimization**:
- Database queries per page load: 3-4 (98% reduction)
- books.py file size: 600 LOC (67% reduction)
- Code duplication: 0 lines
- Test coverage: 80%+
- Frontend components: 8+

---

## 🔴 Critical Code Locations (Don't Touch Without Tests)

**High-risk files**:
- `backend/database.py:186-191` - Silent migration failures (needs fix)
- `backend/books.py:375-450` - N+1 query pattern (needs optimization)
- `backend/auth.py:14` - Hardcoded SECRET_KEY (needs fix)
- `backend/main.py:61` - CORS allows all (needs fix)
- `frontend/src/lib/api.ts` - Single source of truth for API (changes break frontend)

**Safe to refactor after tests exist**:
- `backend/books.py` - Can split after adding tests
- `backend/vb_parser.py` - Can extract helpers after tests
- `frontend/src/app/*/page.tsx` - Can extract components gradually

---

## 📊 Code Quality Metrics (Current vs. Target)

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Backend LOC | 3,237 | 1,600 | -50% |
| Oversized file (books.py) | 1,842 | 600 | -67% |
| Code duplication | 200+ lines | 0 | -100% |
| Database queries/page | 60+ | 3-4 | -98% |
| Test coverage | 0% | 80% | +80% |
| Unused code | 68 LOC | 0 | -100% |
| Frontend components | 2 | 8 | +300% |

---

## 🎯 For AI Agents: Safe Optimization Roadmap

**Tasks suitable for autonomous AI work** (after security fixes):

### Low Risk (Can assign immediately):
✅ Extract helper functions from duplicated code  
✅ Delete dead code (stubs, empty files)  
✅ Centralize configuration values  
✅ Add database indexes  
✅ Create shared type definitions  

### Medium Risk (Needs verification before merge):
⚠️ Optimize N+1 queries (needs manual testing)  
⚠️ Split large files (needs test coverage first)  
⚠️ Extract frontend components (needs visual testing)  

### High Risk (Human review required):
❌ Database schema changes  
❌ API endpoint changes  
❌ Authentication/authorization changes  
❌ Breaking API changes  

---

## 📝 Documentation Files (Use These)

For different aspects of the project:

- **`PROJECT_MAP.md`** - High-level architecture & tech stack
- **`AI_CONTEXT.md`** (this file) - AI optimization priorities
- **`AI_RULES.md`** - AI guardrails & anti-patterns
- **`AI_ASSISTANT.md`** - Setup & common patterns
- **`STRUCTURE_CLEANUP.md`** - Safe structural improvements
- **`SECURITY_NOTES.md`** - Security audit & fixes
- **`TECH_DEBT.md`** - Prioritized technical debt

---

## 🚦 Current Project Status

**Stability**: ✅ Stable (working well)  
**Scalability**: 🟡 Moderate (N+1 queries, needs optimization)  
**Maintainability**: 🟡 Moderate (high duplication, no tests)  
**Security**: 🔴 Critical (hardcoded secrets, open CORS)  
**Code Quality**: 🟡 Fair (1,842 LOC in one file)  

**Recommendation**: Fix critical security issues TODAY, then optimize performance and add tests.
