import logging
from typing import Optional

logger = logging.getLogger("fox_tts_coqui")


def get_voices() -> dict:
    return {
        "female": {"voice": "female", "gender": "female", "name": "Женский"},
        "male": {"voice": "male", "gender": "male", "name": "Мужской"},
    }


async def synthesize(
    text: str,
    language: str = "ru",
    character_name: Optional[str] = None,
    character_gender: Optional[str] = None,
    **kwargs
) -> bytes:
    raise NotImplementedError("Coqui TTS не установлен. Установи: pip install TTS")


def is_available() -> bool:
    try:
        from TTS.api import TTS
        return True
    except ImportError:
        return False
