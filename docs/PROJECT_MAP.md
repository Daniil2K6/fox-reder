# Fox Reader - Project Map
*Optimized for AI agents - high-level structural reference*

## Stack Overview
| Component | Technology | Entrypoint |
|-----------|-------------|------------|
| Backend | FastAPI (Python 3.12+), SQLAlchemy 2.0, SQLite | `backend/main.py` |
| Frontend | Next.js 14 (App Router), TypeScript, inline styles (no Tailwind) | `frontend/src/app/` |
| TTS | Edge TTS (cloud engine) | `backend/tts/` |
| Auth | JWT (HS256), bcrypt hashing | `backend/auth.py` |
| Storage | Local filesystem | `backend/librali/` |

## Backend Architecture
```
backend/
├── main.py               # App entrypoint, lifespan (DB init, TTS load), TTS endpoints
├── auth.py               # JWT auth, user management, role/plus controls
├── books.py              # Core API: books, series, comments, likes, subscriptions (~2000 LOC)
├── database.py           # SQLAlchemy models, init_db, migrations
├── config.py             # Paths, TTS/LLM env config
├── vb_parser.py          # FB2/VBLite file parsing, cover extraction
├── tts/                 # TTS service wrapper (Edge TTS)
├── librali/              # Local storage (books/covers/series/avatars)
├── seed.py               # Database seeding (50 authors, 86 books)
└── requirements.txt      # Python dependencies
```

### API Structure
All API routes are prefixed with `/api`:
- **Auth routes** (`/api/auth`): `/register`, `/login`, `/me`, `/user/{id}/role`, `/user/{id}/plus`, `/voice`
- **Book routes** (`/api/books`): `/upload`, `/my`, `/public`, `/search`, `/{id}`, `/{id}/text`, `/{id}/structured`, `/{id}/visibility`, `/{id}/like`, `/{id}/comments`, etc.
- **Series routes** (`/api/books/series`): `/`, `/list`, `/public`, `/{id}`, `/{id}/cover`, `/{id}/order`
- **TTS routes** (`/api`): `/tts`, `/tts/chunk`
- **Healthcheck**: `/api/health`

### Series endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/books/series` | Create series (name, description, owner_id) |
| GET | `/api/books/series/list` | List series (optional `?owner_id=N`) |
| GET | `/api/books/series/public` | List public series |
| GET | `/api/books/series/{id}` | Get series detail + books |
| PUT | `/api/books/series/{id}` | Update series (name, description, cover_image) |
| POST | `/api/books/series/{id}/cover` | Upload series cover (animated GIF/WebP requires plus) |
| POST | `/api/books/series/{id}/order` | Reorder books in series |
| DELETE | `/api/books/series/{id}` | Delete series |

## Frontend Architecture
```
frontend/
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── page.tsx     # Home
│   │   ├── public/      # Public library (hot, series, authors, paginated books)
│   │   ├── profile/     # User profile (books, series CRUD, settings)
│   │   ├── book/[id]/   # Book reader
│   │   ├── admin/       # Admin panel
│   │   └── notifications/ # User notifications
│   ├── components/      # Navbar, GenreModal, BookEditModal
│   └── lib/
│       └── api.ts       # All API client functions (single source of truth)
├── next.config.js       # API proxy: `/api/*` → `http://127.0.0.1:8000/api/*`
└── package.json         # Node dependencies
```

## Database Models (SQLite: `backend/fox_reader.db`)
### Core Models (from `backend/database.py`)
| Model | Table | Key Fields | Notes |
|-------|-------|-------------|-------|
| `User` | `users` | id, username, role, is_plus, is_banned, preferred_voice | Plus → animated covers |
| `Book` | `books` | id, title, sha256, file_path, is_public, owner_id, genres, description, view_count | Many-to-many with Series |
| `BookVersion` | `book_versions` | id, book_id, format, file_path, sha256 | Multi-format support |
| `Series` | `series` | id, name, owner_id, cover_image, description | `description` field (text), not `common_genres` |
| `Like` | `likes` | id, user_id, book_id | |
| `Subscription` | `subscriptions` | id, subscriber_id, author_id | |
| `Comment` | `comments` | id, book_id, user_id, content | |
| `Notification` | `notifications` | id, user_id, type, message, link, is_read | |

### Key Relationships
- Many-to-many between `Book` and `Series` via `book_series` (with `order_index`)
- One-to-many: `User` → `Book`, `User` → `Series`, `Book` → `BookVersion`, `Book` → `Comment`, `Book` → `Like`

## Public Library Page (`/public`)
- **Hot books**: 4 popular books, shown only on page 1
- **Series grid**: responsive — xl: 5×4 (20), lg: 4×3 (12), md: 3×2 (6), sm: 2×2 (4)
- **Authors panel**: absolute positioned sidebar on desktop, inline block on mobile (max 10 authors)
- **Books grid**: 4 columns — page 1: 20 books (4×5), pages 2+: 36 books (4×9)
- **Pagination**: page number synced to `?page=N` URL, restored on browser back
- **Tabs**: All, Books, Series, Authors

## Profile Page (`/profile`)
- **Books tab**: upload, list, search, edit metadata, delete
- **Series tab**: grid of series cards (2 columns), click to open details panel
- **Series details panel**: edit name, description (textarea), upload cover (with save button, animated for plus), drag-and-drop book reorder, delete series button
- **Series creation modal**: name, description, cover upload
- **Settings tab**: change username/password

## Auth Flow
1. Register via `POST /api/auth/register` or login via `POST /api/auth/login`
2. Backend returns JWT access token (7-day expiry) + user metadata
3. Frontend stores token in `localStorage` as `fox_token` (user object as `fox_user`)
4. All protected API requests include `Authorization: Bearer <token>` header
5. Backend validates token via `get_current_user` dependency (returns `None` for unauthenticated requests)
6. Logout confirmation modal in Navbar

## Data Storage
| Data Type | Storage Location |
|-----------|------------------|
| Book files | `backend/librali/books/` (sha256-prefixed filenames) |
| Book covers | `backend/librali/covers/` (cover_{book_id}.ext) |
| Series covers | `backend/librali/series/` (series_{id}.ext) |
| User avatars | `backend/librali/avatars/` |
| Structured content | `{book_file_path}.struct.json` (JSON) |
| Database | `backend/fox_reader.db` (SQLite) |

## Cover Upload & Plus Features
- Cover inputs use `accept="image/*"` (GIF/WebP included)
- Backend validates animated images:
  - Series cover: `POST /api/books/series/{id}/cover` (line 1210-1215)
  - Book cover: `POST /api/books/{id}/cover` (line 1436-1439)
  - Avatar: `POST /api/books/user/avatar` (line 1834-1837)
- Non-plus users get 403 for animated GIF/WebP
- Frontend shows hint: "GIF/WEBP" for plus, "статич." for others

## Startup Commands
### Full Stack (Recommended)
```bash
# Linux/macOS
chmod +x run.sh
./run.sh --dev

# Windows
start.bat start
```

### Separate Components
```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend && npm run dev  # Port 3000
```

## Healthcheck
- Backend: `curl http://localhost:8000/api/health` → `{"status": "ok"}`
- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
