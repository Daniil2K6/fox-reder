# Fox Reader

Local-first web app with AI text-to-speech and book support.

## Features

- **Book management**: Upload FB2, EPUB, or TXT files with SHA256 deduplication
- **AI TTS**: Coqui XTTS v2 reads books aloud (auto-downloads on first run)
- **Auth**: Guest, User, and Admin roles (admin auto-seeded on first run)
- **Library**: Personal + public book sharing
- **Local-first**: Everything runs on your machine
- **Local reading**: Open books without uploading to server
- **Book details**: Cover images, genres, descriptions, comments

## Quick Start

```bash
# One command to set up and run:
chmod +x run.sh
./run.sh
```

Development mode (hot reload):

```bash
./run.sh --dev
```

Or manually:

```bash
# 1. Install Python dependencies
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Install frontend dependencies
cd ../frontend
npm install

# 3. Start backend
cd ../backend
source .venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# 4. Start frontend (in another terminal)
cd frontend
npm run dev
```

Open http://localhost:3000

## Default Admin

On first run, an admin user is auto-created:

- **Username**: `admin`
- **Password**: `admin`

## Architecture

```
backend/
├── main.py              # FastAPI app + TTS endpoints + admin seed
├── database.py          # SQLAlchemy models (User, Book, Comment)
├── auth.py              # JWT auth with roles
├── books.py             # Book CRUD + file parsing + metadata
├── tts/
│   ├── __init__.py
│   └── service.py       # Coqui XTTS v2 (auto-download, GPU detection)
├── uploads/             # Book file storage
├── covers/              # Cover image storage
├── seed.py              # Database seeding script
└── models/xtts/         # TTS model cache

frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx         # Home with local book option
│   │   ├── login/           # Login page
│   │   ├── register/        # Register page
│   │   ├── profile/         # User profile (formerly library)
│   │   ├── book/[id]/      # Book details page
│   │   ├── public/         # Public library
│   │   ├── reader/[id]/    # Server book reader
│   │   └── reader/local/   # Local book reader
│   └── lib/api.ts           # API client
├── next.config.js           # API proxy rewrites
└── tailwind.config.js       # Fox orange theme
```

## TTS Details

- Model: `tts_models/multilingual/multi-dataset/xtts_v2`
- Auto-downloads on first run (~1.7GB)
- Supports: English, Russian, Spanish, French, German, and more
- GPU acceleration: CUDA or Apple MPS (auto-detected)
- Falls back to CPU if no GPU available

## API

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/register` | POST | No | Create account |
| `/api/auth/login` | POST | No | Login (returns JWT) |
| `/api/auth/me` | GET | Yes | Current user info |
| `/api/books/upload` | POST | Yes | Upload book file |
| `/api/books/my` | GET | Yes | List own books |
| `/api/books/public` | GET | No | List public books |
| `/api/books/{id}` | GET | Partial | Book metadata |
| `/api/books/{id}/text` | GET | Partial | Book text content |
| `/api/books/{id}/visibility` | PUT | Yes | Toggle public/private |
| `/api/books/{id}` | DELETE | Yes | Delete book |
| `/api/books/{id}/cover` | POST | Yes | Upload cover image |
| `/api/books/{id}/comments` | GET/POST | Yes | Get/Add comments |
| `/api/books/{id}/preview` | GET | No | Local book preview |
| `/api/tts` | POST | Yes | Generate speech from text |
| `/api/tts/chunk` | POST | Yes | Generate speech chunk |
| `/api/health` | GET | No | Health check |
