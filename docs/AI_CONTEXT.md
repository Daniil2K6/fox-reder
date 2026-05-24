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
| Plus User | User with `is_plus=true`, extra features (animated GIF/WebP covers) |
| Group ID | Links multi-format books (EPUB+FB2+TXT) to same Book record |

## Model Relationships
```
User 1 ──┐
           ├─→ Book 1 ──→ BookVersion (multiple formats)
           │     ├─→ Comment (multiple)
           │     ├─→ Like (multiple, unique per user)
           │     └─→ Series (many-to-many via book_series with order_index)
           │
           ├─→ Series (owned, has description field, not common_genres)
           ├─→ Comment, Like, Subscription, Notification
```

## Key Endpoint Changes
| Method | Path | Change |
|--------|------|--------|
| POST | `/api/books/series` | Now accepts `description` (not `common_genres`), sets `owner_id` |
| GET | `/api/books/series/{id}` | Returns `description` (not `common_genres`) |
| PUT | `/api/books/series/{id}` | Handles `description`, no longer merges genres to books |
| POST | `/api/books/series/{id}/cover` | Animated GIF/WebP blocked for non-plus (403) |
| GET | `/api/books/series/list` | Optional `?owner_id=N` filter |
| POST | `/api/books/upload` | `series_name` field creates or appends to series |

## Naming Conventions
- **Backend**: snake_case (Python), PascalCase for Pydantic models
- **Frontend**: camelCase (TypeScript), PascalCase for React components
- **Storage**: `sha256[:16]_filename.ext` for books, `cover_{id}.ext` for covers, `series_{id}.ext` for series
- **DB column**: `Series.description` (was `common_genres`, renamed with migration)

## Common Patterns
1. **Page number in URL**: Public library syncs `page` state to `?page=N` via `window.history.replaceState`
2. **Series description**: Free text field, stored as `Series.description` (VARCHAR 512)
3. **Cover upload flow**: File selected → preview shown → "Сохранить обложку" button pressed → API call
4. **Save feedback**: Buttons show "…" during request, then "✓ Сохранено" for 2 seconds
5. **Public layout IIFE**: `{page <= 1 && (() => { ... })()}` — renders hot/series/authors only on page 1
6. **Inline styles only**: Profile and public pages use inline `style={}` objects, no Tailwind classes
7. **Absolute authors panel**: Desktop uses `position: absolute` with overflow hidden; SM stacked mode limits to 10

## Frontend State Patterns
- **Profile page**: Single large file (~1400 LOC) with useState/useEffect for all state
- **Public page**: `page` state synced to URL, `screenSize` state for responsive layout (xl/lg/md/sm)
- **Modals**: Fixed position overlays with `stopPropagation`, z-index stacking
- **Save buttons**: `saveFeedback` state: null → "saving" → "saved" (resets after 2s)

## Reusable Commands
```bash
# Type check (after any change)
cd frontend && npx tsc --noEmit

# Backend restart
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Database check
sqlite3 backend/fox_reader.db "SELECT name FROM sqlite_master WHERE type='table';"

# Seed database
cd backend && python3 seed.py

# Test TTS
curl -X POST http://localhost:8000/api/tts -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"text":"Hello","language":"en"}' --output test.mp3
```

## Dangerous Areas
1. `backend/database.py` — Model changes require migration in `init_db()`
2. `frontend/src/lib/api.ts` — Changing function signatures breaks all callers
3. `backend/books.py` — Massive file (~2000 LOC), easy to miss search/replace
4. `frontend/src/app/public/page.tsx` — IIFE + ternary + page logic, fragile nesting
5. `frontend/src/app/profile/page.tsx` — ~1400 LOC with complex state and modals

## Frontend/Backend Coupling Points
- `BookOut` (backend) ↔ Book interface (frontend) — must sync fields
- `UserOut` (backend) ↔ User object in localStorage — must sync fields
- `apiCreateSeries(name, description)` ↔ `POST /api/books/series {name, description}`
- `apiUpdateSeries(id, {name?, description?, cover_image?})` ↔ `PUT /api/books/series/{id}`
- `apiUploadSeriesCover(id, file)` ↔ `POST /api/books/series/{id}/cover`

## Performance Baseline
- Database queries per page load: 60+ (known N+1 issue)
- books.py file size: ~2000 LOC
- Frontend components: 3 (Navbar, GenreModal, BookEditModal)
- Test coverage: 0%

## Current Project Status
**Stability**: ✅ Stable (working well)  
**Security**: 🔴 Critical (hardcoded JWT secret, open CORS) — fix before production  
**Maintainability**: 🟡 Moderate (monolithic files, no tests, high duplication)
