import logging
from typing import Optional

logger = logging.getLogger("fox_tts_piper")

# Piper TTS будет здесь когда установим


def get_voices() -> dict:
    """Получить голоса Piper"""
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
    """Синтез речи через Piper"""
    # TODO: установить Piper и реализовать
    raise NotImplementedError("Piper не установлен")


def is_available() -> bool:
    """Проверить доступность"""
    try:
        import piper_tts
        return True
    except ImportError:
        return False