import io
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from database import init_db, SessionLocal, User
from auth import router as auth_router, require_user, get_current_user, hash_password
from books import router as books_router
from tts import get_tts_service, TTSService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("fox-reader")


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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    voice_type = payload.get("voice_type", getattr(user, "preferred_voice", "default"))
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    if len(text) > 5000:
        text = text[:5000]

    try:
        service = get_tts_service()
        audio_bytes = await service.synthesize(
            text, language=language, character=character, voice_type=voice_type
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
    text = payload.get("text", "")
    language = payload.get("language", "en")
    character = payload.get("character")
    voice_type = payload.get("voice_type", getattr(user, "preferred_voice", "default"))
    pitch = payload.get("pitch", 0.0)
    rate = payload.get("rate", 0.0)
    volume = payload.get("volume", 0.0)
    
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    if len(text) > 1000:
        text = text[:1000]

    try:
        service = get_tts_service()
        audio_bytes = await service.synthesize(
            text, language=language, character=character, voice_type=voice_type,
            pitch=pitch, rate=rate, volume=volume
        )
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
        )
    except Exception as e:
        logger.error(f"TTS chunk error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
