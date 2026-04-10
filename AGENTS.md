# Fox Reader - Project Structure & Guidelines

## Project Overview

**Fox Reader** - Local-first web app with AI text-to-speech and book support.

- **Backend**: FastAPI (Python) on port 8000
- **Frontend**: Next.js (TypeScript) on port 3000
- **Database**: SQLite (fox_reader.db)

---

## Architecture

```
fox-reder/
├── backend/                    # FastAPI server
│   ├── main.py               # App entry, CORS, TTS endpoints, admin seed
│   ├── database.py          # SQLAlchemy models (User, Book, Series, Comment)
│   ├── auth.py            # JWT authentication
│   ├── books.py           # Book CRUD, file parsing, metadata
│   ├── vb_parser.py       # FB2/EPUB/TXT parser
│   ├── tts/
│   │   └── service.py    # Coqui XTTS v2
│   ├── uploads/          # Book files (SHA256 deduup)
│   ├── covers/           # Cover images
│   ├── seed.py          # Database seeding
│   └── requirements.txt  # Python deps
│
├── frontend/                  # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Home (login/local book)
│   │   │   ├── login/page.tsx      # Login
│   │   │   ├── register/page.tsx     # Register
│   │   │   ├── profile/page.tsx     # User profile (my books)
│   │   │   ├── public/page.tsx     # Public library
│   │   │   ├── book/[id]/page.tsx # Book details
│   │   │   ├── reader/
│   │   │   │   ├── [id]/page.tsx  # Server reader
│   │   │   │   └── local/page.tsx # Local reader
│   │   │   └── layout.tsx
│   │   ├── lib/
│   │   │   └── api.ts            # API client
│   │   └── styles/
│   │       └── globals.css
│   └── package.json
│
├── .gitignore               # node_modules, uploads, covers, logs, __pycache__, .venv
└── run.sh                   # Startup script
```

---

## Database Models

### User
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| username | String(64) | Unique |
| hashed_password | String(256) | Bcrypt hash |
| role | String | "user" / "admin" |
| preferred_voice | String(32) | TTS voice |
| preferred_language | String(32) | TTS language |
| created_at | DateTime | Creation timestamp |

### Book
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| title | String(512) | Book title |
| filename | String(512) | Original filename |
| sha256 | String(64) | File hash (unique per owner) |
| file_path | String(1024) | Storage path |
| is_public | Boolean | Public/library flag |
| owner_id | Integer | FK to User |
| cover_image | String(512) | Cover image path |
| genres | String(512) | Comma-separated genres |
| description | Text | Book description |
| text_content | Text | Extracted text |
| series_id | Integer | FK to Series |
| created_at | DateTime | Creation timestamp |

### Series
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| name | String(256) | Series name |
| owner_id | Integer | FK to User |

### Comment
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| book_id | Integer | FK to Book (cascade delete) |
| user_id | Integer | FK to User |
| content | Text | Comment text |
| created_at | DateTime | Creation timestamp |

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Login (returns JWT) |
| GET | /api/auth/me | Yes | Current user info |

### Books
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/books/my | Yes | List own books |
| GET | /api/books/public | No | List public books |
| POST | /api/books/upload | Yes | Upload book file |
| GET | /api/books/{id} | Partial | Book metadata |
| GET | /api/books/{id}/text | Partial | Book text |
| PUT | /api/books/{id}/visibility | Yes | Toggle public |
| DELETE | /api/books/{id} | Yes | Delete book |
| POST | /api/books/{id}/cover | Yes | Upload cover |
| GET | /api/books/{id}/comments | No | Get comments |
| POST | /api/books/{id}/comments | Yes | Add comment |
| GET | /api/books/preview | No | Local book preview |

### TTS
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/tts | Yes | Generate speech |
| POST | /api/tts/chunk | Yes | Generate chunk |

---

## Running the Project

### Development
```bash
# Backend
cd backend
source .venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev -- --port 3000
```

### Quick Start
```bash
chmod +x run.sh
./run.sh --dev
```

---

## Rules for AI Agents

### NEVER MODIFY
1. **Database schema** in `database.py` without migration strategy
2. **Authentication logic** in `auth.py` (security risk)
3. **File storage paths** (`uploads/`, `covers/`) - breaks existing books
4. **Unique constraints** (owner_id + sha256) - deduplication depends on it
5. **Cascade delete** on Book.comments - will lose data

### ALWAYS
1. Use **TypeScript types** from `api.ts` when calling backend
2. Follow **existing patterns** in each file
3. Check imports before adding new dependencies
4. Use `.gitignore` - never commit: node_modules, .venv, uploads, covers, logs, __pycache__, .db

### Code Style
- No comments unless explicitly asked
- Use `useRouter()` only once per component
- Prefer functional components with hooks
- Use Tailwind CSS classes

---

## Testing Checklist

Before declaring feature complete:
1. ✅ Backend compiles: `python -c "from main import app"`
2. ✅ Frontend compiles: `npm run build`
3. ✅ All API endpoints respond (test with curl)
4. ✅ Database migrations run
5. ✅ Git commits with meaningful messages

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| ModuleNotFoundError | Activate venv: `source .venv/bin/activate` |
| Port already in use | Kill process: `lsof -ti:8000 \| xargs kill` |
| Database locked | Restart backend or check connections |
| Python version | Use 3.12 (3.14 has breaking changes) |
| SSH key denied | Add key to GitHub or use HTTPS |