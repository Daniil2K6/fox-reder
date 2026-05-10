import logging
from typing import Optional

logger = logging.getLogger("fox_tts_piper")


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
    raise NotImplementedError("Piper не установлен")


def is_available() -> bool:
    try:
        import piper_tts
        return True
    except ImportError:
        return False
