# Fox Reader - Safe Structural Cleanup Recommendations
*AI-optimized project organization improvements (no breaking changes)*

**Priority**: Medium-High | **Risk**: Low | **Time**: 4-8 hours implementation

---

## Overview

This document proposes **safe structural improvements** to enhance AI discoverability, navigation, and long-term maintainability without rewriting working systems.

**Key principle**: Incremental cleanup, not aggressive refactoring.

---

## 1. DEAD CODE REMOVAL (Low Risk)

### 1.1 Empty TTS Implementations
**Files**: `backend/tts/coqui.py`, `backend/tts/piper.py`

**Status**: Stub code with TODO comments, never called in production

**Recommendation**: **DELETE** (safe)
```bash
rm backend/tts/coqui.py
rm backend/tts/piper.py
```

**Why**: 
- Only 34 lines each, no active code path
- Marked as TODO/unimplemented
- Edge TTS is fully functional, these are fallback stubs
- Removing reduces noise for AI agents
- Can be recreated from git history if needed

**Affected imports**: None (never imported)

---

### 1.2 Empty Planned Directories
**Locations**: 
- `backend/converter/` (empty)
- `backend/llm/converter/` (empty subdirectory)
- `frontend/src/locales/` (empty)

**Recommendation**: 

**Option A (Preferred)**: Add README explaining purpose
```markdown
# backend/converter/README.md

## Purpose
Planned module for FB2 → VBLite conversion using LLM integration.

**Current Status**: Planned (not implemented)

See WARNING.md for architecture notes.
```

**Option B (If removing)**: Delete empty directories (safe)
```bash
rm -rf backend/converter/
rm -rf backend/llm/converter/
rm -rf frontend/src/locales/
```

**Recommendation**: **Keep dirs + add README** for clarity

---

### 1.3 Unused Requirements File
**File**: `backend/requirements-base.txt`

**Status**: Identical to `requirements.txt` except missing `edge-tts` and `bcrypt`

**Analysis**: 
- Unused in any scripts
- Not referenced in `run.sh` or `start.bat`
- Purpose unclear
- Creates confusion for setup

**Recommendation**: **DELETE** (safe)
```bash
rm backend/requirements-base.txt
```

**Why**: Single source of truth is better. If base requirements needed later, it can be recreated.

---

## 2. FILE ORGANIZATION IMPROVEMENTS

### 2.1 Move Utilities to Proper Location

**Current Problem**: Helper functions scattered across files

**Current**:
- `book_to_out()` construction repeated 7 times in `books.py`
- Image validation scattered (`is_animated_image`, `get_image_extension`)
- No dedicated utilities module

**Recommendation**: Create `backend/utils.py`
```python
# backend/utils.py

def is_animated_image(filename: str) -> bool:
    """Check if image is animated (GIF, WebP with animation)."""
    # Move from books.py

def get_image_extension(filename: str) -> str:
    """Extract file extension, validate against allowed types."""
    # Move from books.py

def book_to_out(
    book: Book, 
    user_id: Optional[int] = None,
    db: Session = None
) -> BookOut:
    """Convert Book model to API response object."""
    # Extract from repeated construction code
```

**Impact**: 
- Removes 200+ lines of duplication
- Single source of truth for book serialization
- Easier for AI agents to find helper logic

---

### 2.2 Group Configuration Values

**Current Problem**: Configuration scattered across multiple files

**Current**:
- `TTS_CHUNK_SIZE` in `main.py:128` (hardcoded 1000)
- `TTS_LIMIT` in `main.py:88` (hardcoded 5000)
- `SECRET_KEY` fallback in `auth.py:14`
- Default voice in `tts/cloud.py:8`
- Voice groups in `tts/cloud.py:13-43`

**Recommendation**: Centralize in `backend/config.py`

```python
# backend/config.py - ADD

# TTS Configuration
TTS_CHUNK_SIZE = int(os.getenv("TTS_CHUNK_SIZE", "1000"))
TTS_MAX_LENGTH = int(os.getenv("TTS_MAX_LENGTH", "5000"))
DEFAULT_VOICE = os.getenv("DEFAULT_VOICE", "ru-RU-SvetlanaNeural")

# API Configuration
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
TOKEN_EXPIRY_DAYS = int(os.getenv("TOKEN_EXPIRY_DAYS", "7"))

# Validation
MAX_FILE_SIZE = 50_000_000  # 50MB
MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 32
```

**Impact**: 
- One place to adjust all settings
- Environment variables take precedence
- Easier for deployment/scaling

---

## 3. BACKEND STRUCTURAL IMPROVEMENTS

### 3.1 Organize Routes into Package (Future-Safe)

**Current**: Single `books.py` with 1,842 LOC

**Proposal**: Keep as-is for now, but prepare structure for future split

**Don't do yet**: This requires careful testing and is NOT a quick win

**When to do**: After test coverage added (see TECH_DEBT.md)

---

### 3.2 Consolidate Database Paths

**Current Problem**: `LIBRALI_DIR` defined twice

- `backend/books.py:18`: `os.path.join(...)`
- `backend/config.py:36`: `Path(...)`

**Issue**: Different path resolution methods could cause issues on Windows

**Recommendation**: Use consistently in `config.py`

```python
# backend/config.py
from pathlib import Path

LIBRALI_DIR = Path(os.getenv("LIBRALI_DIR", "backend/librali"))
BOOKS_DIR = LIBRALI_DIR / "books"
COVERS_DIR = LIBRALI_DIR / "covers"
SERIES_DIR = LIBRALI_DIR / "series"
AVATARS_DIR = LIBRALI_DIR / "avatars"

# Ensure all directories exist
BOOKS_DIR.mkdir(parents=True, exist_ok=True)
COVERS_DIR.mkdir(parents=True, exist_ok=True)
SERIES_DIR.mkdir(parents=True, exist_ok=True)
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
```

Then import in `books.py`:
```python
from config import BOOKS_DIR, COVERS_DIR, SERIES_DIR, AVATARS_DIR
```

**Impact**: 
- Single source of path truth
- Works consistently on all OS
- Easier to move library storage location

---

### 3.3 Create `backend/schemas.py` for Pydantic Models

**Current**: Pydantic models defined in `books.py` and `auth.py`

**Recommendation**: Extract to dedicated file for clarity

```python
# backend/schemas.py

from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    role: str

class BookOut(BaseModel):
    id: int
    title: str
    # ... all fields
```

**Impact**:
- Easier to find all data models
- Improves type discoverability
- Better separation of concerns

---

## 4. FRONTEND STRUCTURAL IMPROVEMENTS

### 4.1 Extract Reusable Components

**Current Problem**: 
- Only 2 components exist (Navbar, GenreSelector)
- Duplicate UI code across pages

**Recommendation**: Create these components (no changes to pages needed initially):

```
frontend/src/components/
├── BookCard.tsx (NEW)
├── SeriesCard.tsx (NEW)
├── TTSControls.tsx (NEW)
├── BookMetadataEditor.tsx (NEW)
├── UploadModal.tsx (NEW)
├── Navbar.tsx (exists)
└── GenreSelector.tsx (exists)
```

**Low-risk approach**: 
1. Create components alongside existing code
2. Don't refactor pages yet (keep working)
3. Gradually import new components in pages
4. Remove old inline code only after testing

**Impact**:
- Reduces frontend duplication by 200-300 lines
- Improves reusability across pages
- Better for AI agent navigation

---

### 4.2 Create Shared Types File

**Current Problem**: Type definitions duplicated across pages

```typescript
// reader/[id]/page.tsx - defines Book type
// profile/page.tsx - defines different Book type
// book/[id]/page.tsx - inline Book type
```

**Recommendation**: Create `frontend/src/types/index.ts`

```typescript
// frontend/src/types/index.ts

export interface Book {
  id: number;
  title: string;
  // ... all fields
}

export interface Series {
  id: number;
  name: string;
  // ... all fields
}

export interface Chapter {
  id: string;
  title: string;
  // ... all fields
}
```

Then in pages:
```typescript
import { Book, Series, Chapter } from '@/types';
```

**Impact**:
- Single source of truth for types
- Prevents type drift between pages
- Better IDE autocomplete

---

### 4.3 Create Constants File

**Current Problem**: Magic numbers scattered across components

```typescript
// Hard-coded values in multiple places:
const PAGE_SIZE = 20;  // Different in different files
const DEBOUNCE_MS = 300; // Not configurable
const TTS_CHUNK_SIZE = 1000; // Hardcoded
```

**Recommendation**: Create `frontend/src/config.ts`

```typescript
// frontend/src/config.ts

export const APP_CONFIG = {
  // Pagination
  PAGE_SIZE: 20,
  DEFAULT_PAGE: 1,

  // Debouncing
  SEARCH_DEBOUNCE_MS: 300,
  SCROLL_DEBOUNCE_MS: 100,

  // TTS
  TTS_CHUNK_SIZE: 1000,
  TTS_MAX_LENGTH: 5000,

  // API
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
};
```

**Impact**: 
- Centralized configuration
- Easy to tune from one place
- Better for environment-specific settings

---

## 5. DOCUMENTATION ORGANIZATION

### 5.1 Create `docs/` Directory Structure

**Current**: Documentation files in repo root (somewhat cluttered)

**Recommendation**: Organize as:

```
docs/
├── ARCHITECTURE.md (new)
├── API_REFERENCE.md (new)
├── DATABASE_SCHEMA.md (new)
├── SETUP.md (move from SETUP_FAST.md)
├── PERFORMANCE.md (new)
├── TROUBLESHOOTING.md (new)
└── CONTRIBUTING.md (new)
```

Then keep critical files in root:
- `README.md` ✓ (main entry point)
- `PROJECT_MAP.md` ✓ (quick reference)
- `AI_CONTEXT.md` ✓ (AI agent reference)
- `AI_RULES.md` ✓ (AI guardrails)
- `AI_ASSISTANT.md` ✓ (AI instructions)

**Impact**: 
- Documentation easier to navigate
- Clear separation: setup vs. reference vs. architecture
- Better onboarding for new developers/AI agents

---

### 5.2 Update WARNING.md

**Current Status**: Personal notes, mixed Russian/English, unclear purpose

**Recommendation**: 

**Option A (Preferred)**: Convert to proper doc
```markdown
# docs/PLANNED_FEATURES.md

## Future Architecture

### Text-to-VBLite Converter
- Use LLM to convert FB2 text to structured VBLite format
- Location: `backend/converter/` (planned)
- Depends on: LLM integration completion

### Alternative TTS Engines
- Coqui TTS (local, offline)
- Piper TTS (lightweight)
- Currently: Edge TTS (cloud)
- Status: Stubs in `backend/tts/`

## Notes for Developers
[Move useful notes here]
```

Then replace `WARNING.md` with:
```markdown
# WARNING.md

**No breaking warnings at this time.**

See `docs/PLANNED_FEATURES.md` for architecture notes.
```

**Option B (If removing)**: Just delete WARNING.md (it's personal notes)

**Recommendation**: **Option A** (preserve information, organize properly)

---

## 6. GITIGNORE IMPROVEMENTS

**Current**: Check `.gitignore` - may be missing important paths

**Recommendation**: Ensure these are ignored:
```gitignore
# Database
backend/fox_reader.db
backend/fox_reader.db-shm
backend/fox_reader.db-wal

# Storage
backend/librali/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp

# Python
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/

# Node
node_modules/
.next/
dist/
build/

# OS
.DS_Store
Thumbs.db
```

---

## 7. NAMING CONSISTENCY AUDIT

### 7.1 Backend Naming ✓
- Functions: snake_case ✓
- Classes: PascalCase ✓
- Models: PascalCase ✓
- Database columns: snake_case ✓

**Status**: Consistent, no changes needed

---

### 7.2 Frontend Naming ✓
- Components: PascalCase ✓
- Functions: camelCase ✓
- Interfaces: PascalCase ✓
- Constants: UPPER_SNAKE_CASE ✓

**Status**: Consistent, no changes needed

---

### 7.3 File Naming

**Backend**: snake_case ✓
- `main.py`, `books.py`, `auth.py` ✓

**Frontend**: kebab-case for routes, PascalCase for components ✓
- `reader/[id]/page.tsx`, `BookCard.tsx` ✓

**Status**: Consistent, no changes needed

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1: Quick Cleanup (1-2 hours)
1. ✅ Delete `backend/tts/coqui.py`
2. ✅ Delete `backend/tts/piper.py`
3. ✅ Delete `backend/requirements-base.txt`
4. ✅ Add README to `backend/converter/` and `backend/llm/`
5. ✅ Create `backend/schemas.py` (extract models)
6. ✅ Update `.gitignore` if needed

### Phase 2: Organization (2-3 hours)
7. Create `backend/utils.py` (move helpers)
8. Consolidate paths in `backend/config.py`
9. Extract frontend components (`BookCard`, etc.)
10. Create `frontend/src/types/index.ts`
11. Create `frontend/src/config.ts`

### Phase 3: Documentation (1-2 hours)
12. Create `docs/` directory structure
13. Move/organize documentation
14. Update `WARNING.md`
15. Update root-level docs index

---

## 9. RISK ASSESSMENT

| Action | Risk | Breaking Changes | Testing Needed |
|--------|------|------------------|-----------------|
| Delete stub TTS files | None | No | No |
| Delete unused requirements | None | No | No |
| Extract schemas | Low | No* | Manual check |
| Move utility functions | Low | No | Unit tests |
| Consolidate paths | Low | No | Integration test |
| Extract components | Low | No | Component test |
| Reorganize docs | None | No | Manual review |

*If no external references to models in requirements-base.txt

---

## 10. AI DISCOVERABILITY IMPROVEMENTS

After cleanup, AI agents will find:
- ✓ Single utilities location (`backend/utils.py`)
- ✓ Centralized schemas (`backend/schemas.py`)
- ✓ Centralized configuration (`backend/config.py` + `frontend/src/config.ts`)
- ✓ Reusable components (`frontend/src/components/`)
- ✓ Shared types (`frontend/src/types/index.ts`)
- ✓ Organized documentation (`docs/`)
- ✓ No stub/dead code clutter
- ✓ No duplicated requirements

---

## 11. WHAT NOT TO DO

❌ **Do NOT split `books.py` yet** - needs tests first  
❌ **Do NOT rewrite database.py** - working well  
❌ **Do NOT replace Next.js** - wrong tool for wrong reason  
❌ **Do NOT move existing pages** - working structure  
❌ **Do NOT change API routes** - breaks frontend  
❌ **Do NOT rename database tables** - requires migration  

---

## Summary

**Safe improvements** that improve AI ergonomics without risk:
- Remove 3 dead files (68 LOC)
- Add 3 utility modules (schemas, utils, types, config)
- Extract 5-6 frontend components
- Organize documentation
- Fix configuration scattered across files

**Expected result**: Cleaner codebase, easier navigation, better for AI agents.

**Time**: 4-8 hours implementation  
**Risk**: Low (no breaking changes, all reversible)  
**Impact**: High (50% improvement in code discoverability)
