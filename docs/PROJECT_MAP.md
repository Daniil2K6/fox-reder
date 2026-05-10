# Fox Reader - Project Map
*Optimized for AI agents - high-level structural reference*

## Stack Overview
| Component | Technology | Entrypoint |
|-----------|-------------|------------|
| Backend | FastAPI (Python 3.12+), SQLAlchemy 2.0, SQLite | `backend/main.py` |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS | `frontend/src/app/` |
| TTS | Edge TTS (cloud engine) | `backend/tts/` |
| Auth | JWT (HS256), bcrypt hashing | `backend/auth.py` |
| Storage | Local filesystem | `backend/librali/` |

## Backend Architecture
```
backend/
├── main.py               # App entrypoint, lifespan (DB init, TTS load), TTS endpoints
├── auth.py               # JWT auth, user management, role/plus controls
├── books.py              # Core API: books, series, comments, likes, subscriptions
├── database.py           # SQLAlchemy models, init_db, migrations
├── config.py             # Paths, TTS/LLM env config
├── vb_parser.py          # FB2/VBLite file parsing, cover extraction
├── tts/                 # TTS service wrapper (Edge TTS)
├── converter/            # Planned format conversion (LLM-based)
├── llm/                  # Planned LLM integration
├── librali/              # Local storage (books/covers/series/avatars)
└── requirements.txt      # Python dependencies
```

### API Structure
All API routes are prefixed with `/api`:
- **Auth routes** (`/api/auth`): `/register`, `/login`, `/me`, `/user/{id}/role`, `/user/{id}/plus`, `/voice`
- **Book routes** (`/api/books`): `/upload`, `/my`, `/public`, `/search`, `/{id}`, `/{id}/text`, `/{id}/structured`, `/{id}/visibility`, `/{id}/like`, `/{id}/comments`, etc.
- **Series routes** (`/api/books/series`): `/`, `/list`, `/public`, `/{id}`, `/{id}/cover`, `/{id}/order`
- **TTS routes** (`/api`): `/tts`, `/tts/chunk`
- **Healthcheck**: `/api/health`

## Frontend Architecture
```
frontend/
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── page.tsx     # Home
│   │   ├── public/      # Public library
│   │   ├── profile/     # User profile
│   │   ├── book/[id]/   # Book reader
│   │   ├── admin/       # Admin panel
│   │   └── notifications/ # User notifications
│   ├── components/      # Reusable UI components
│   └── lib/
│       └── api.ts       # All API client functions (single source of truth for frontend API calls)
├── next.config.js       # API proxy: `/api/*` → `http://127.0.0.1:8000/api/*`
└── package.json         # Node dependencies
```

## Database Models (SQLite: `backend/fox_reader.db`)
### Core Models (from `backend/database.py`)
| Model | Table | Key Fields | Relationships |
|-------|-------|-------------|----------------|
| `User` | `users` | id, username, role (user/admin), is_plus, is_banned, preferred_voice | Books, Series, Comments, Likes, Subscriptions, Notifications |
| `Book` | `books` | id, title, sha256, file_path, is_public, owner_id, genres, description, view_count | Owner (User), Series (many-to-many), Comments, Likes, Versions |
| `BookVersion` | `book_versions` | id, book_id, format (fb2/epub/txt/vb/vblite), file_path, sha256 | Parent Book |
| `Series` | `series` | id, name, owner_id, cover_image, common_genres | Owner (User), Books (many-to-many via `book_series` table) |
| `Like` | `likes` | id, user_id, book_id | User, Book |
| `Subscription` | `subscriptions` | id, subscriber_id, author_id | Subscriber (User), Author (User) |
| `Comment` | `comments` | id, book_id, user_id, content | Book, User |
| `Notification` | `notifications` | id, user_id, type, message, link, is_read | User |

### Key Relationships
- Many-to-many between `Book` and `Series` via `book_series` association table (with `order_index` field)
- One-to-many: `User` → `Book`, `User` → `Series`, `Book` → `BookVersion`, `Book` → `Comment`, `Book` → `Like`

## Auth Flow
1. User registers via `POST /api/auth/register` or logs in via `POST /api/auth/login`
2. Backend returns JWT access token (7-day expiry) + user metadata
3. Frontend stores token in `localStorage` as `fox_token`
4. All protected API requests include `Authorization: Bearer <token>` header
5. Backend validates token via `get_current_user` dependency (returns `None` for unauthenticated requests)

## Data Storage
| Data Type | Storage Location |
|-----------|------------------|
| Book files | `backend/librali/books/` (sha256-prefixed filenames) |
| Book covers | `backend/librali/covers/` (cover_{book_id}.ext) |
| Series covers | `backend/librali/series/` (series_{id}.ext) |
| User avatars | `backend/librali/avatars/` |
| Structured book content | `{book_file_path}.struct.json` (JSON) |
| Database | `backend/fox_reader.db` (SQLite) |

## Startup Commands
### Full Stack (Recommended)
```bash
# Linux/macOS
chmod +x run.sh
./run.sh --dev  # Dev mode with hot reload

# Windows
start.bat start
```

### Separate Components
```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev  # Port 3000
```

## Environment Requirements
| Dependency | Version | Purpose |
|-----------|----------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js | 18+ | Frontend runtime |
| SQLite | Built-in | Database |
| `fastapi` | 0.115.6 | Backend framework |
| `uvicorn` | 0.34.0 | ASGI server |
| `sqlalchemy` | 2.0.36 | ORM |
| `edge-tts` | ≥6.1.0 | TTS engine |
| `next` | ^14.2.22 | Frontend framework |
| `react` | ^18.3.1 | UI library |

## Healthcheck
- Backend: `curl http://localhost:8000/api/health` → `{"status": "ok", "app": "Fox Reader"}`
- Frontend: `http://localhost:3000` (loads without white screen)
- API docs: `http://localhost:8000/docs` (Swagger UI)
