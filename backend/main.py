import io
import logging
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Добавляем корень проекта в путь импорта (для tts/ из корня)
_project_root = str(Path(__file__).resolve().parent.parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from database import init_db, SessionLocal, User
from auth import router as auth_router, require_user, get_current_user, hash_password
from books import router as books_router
from tts import get_tts_service, TTSService
from config import TTS_MAX_LENGTH, TTS_CHUNK_SIZE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("fox-reader")

# ============================================================================
# CORS Configuration - Restrict Origins
# ============================================================================
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
ALLOWED_ORIGINS_STR = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS_STR.split(",")]

# Validate CORS configuration in production
if ENVIRONMENT == "production":
    if "*" in ALLOWED_ORIGINS:
        logger.critical("SECURITY ERROR: CORS wildcard '*' is not allowed in production")
        raise RuntimeError(
            "CORS misconfiguration: cannot use wildcard '*' in production. "
            "Set ALLOWED_ORIGINS to specific domains (e.g., 'https://example.com,https://www.example.com')"
        )
    if "localhost" in str(ALLOWED_ORIGINS):
        logger.warning("WARNING: localhost in ALLOWED_ORIGINS in production - verify this is intentional")
else:
    logger.info(f"CORS allowed origins (dev): {ALLOWED_ORIGINS}")


def _seed_admin():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=hash_password("admin"),
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info("Seeded default admin user (admin/admin)")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    init_db()
    _seed_admin()
    logger.info("Database ready")
    logger.info("Loading TTS model (this may take a minute on first run)...")
    try:
        get_tts_service()
        logger.info("TTS model ready")
    except Exception as e:
        logger.warning(f"TTS model failed to load at startup: {e}")
        logger.warning("TTS will load on first synthesis request")
    yield
    logger.info("Shutting down")


app = FastAPI(title="Fox Reader", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
    max_age=600,
)

app.include_router(auth_router)
app.include_router(books_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Fox Reader"}


@app.post("/api/tts")
async def synthesize_speech(
    payload: dict,
    user=Depends(get_current_user),
):
    text = payload.get("text", "")
    language = payload.get("language", "en")
    character = payload.get("character")
    character_gender = payload.get("character_gender")
    voice_type = payload.get("voice_type", getattr(user, "preferred_voice", "default"))
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    if len(text) > TTS_MAX_LENGTH:
        text = text[:TTS_MAX_LENGTH]

    try:
        service = get_tts_service()
        audio_bytes = await service.synthesize(
            text, language=language, character=character, character_gender=character_gender,
            voice_type=voice_type
        )
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
        )
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tts/chunk")
async def synthesize_chunk(
    payload: dict,
    user=Depends(get_current_user),
):
    # Сохраняем для отладки
    import json
    debug_file = "/tmp/tts_debug.json"
    with open(debug_file, "w") as f:
        json.dump(payload, f, ensure_ascii=False)
    logger.info(f"TTS chunk payload saved to {debug_file}")
    text = payload.get("text", "")
    language = payload.get("language", "en")
    character = payload.get("character")
    character_gender = payload.get("character_gender")
    voice_type = payload.get("voice_type", getattr(user, "preferred_voice", "default"))
    pitch = payload.get("pitch", 0.0)
    rate = payload.get("rate", 0.0)
    volume = payload.get("volume", 0.0)
    
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    if len(text) > TTS_CHUNK_SIZE:
        text = text[:TTS_CHUNK_SIZE]

    try:
        service = get_tts_service()
        audio_bytes = await service.synthesize(
            text, language=language, character=character, character_gender=character_gender,
            voice_type=voice_type, pitch=pitch, rate=rate, volume=volume
        )
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
        )
    except Exception as e:
        logger.error(f"TTS chunk error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
