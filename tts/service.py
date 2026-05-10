import os
import logging
from typing import Optional

logger = logging.getLogger("fox_tts")

# ============================================================================
# TTS Конфигурация - выбор движка
# ============================================================================
TTS_ENGINE = os.getenv("TTS_ENGINE", "cloud")  # cloud, coqui, piper

# ============================================================================
# Публичное API
# ============================================================================
async def synthesize(
    text: str,
    language: str = "ru",
    voice: Optional[str] = None,
    character_gender: Optional[str] = None,
    **kwargs
) -> bytes:
    """Синтез речи - переключает между движками"""
    if TTS_ENGINE == "coqui":
        from .coqui import synthesize as coqui_synthesize
        return await coqui_synthesize(text, language, voice, character_gender, **kwargs)
    elif TTS_ENGINE == "piper":
        from .piper import synthesize as piper_synthesize
        return await piper_synthesize(text, language, voice, character_gender, **kwargs)
    else:
        # cloud - Microsoft edge-tts (по умолчанию)
        from .cloud import synthesize as cloud_synthesize
        return await cloud_synthesize(text, language, voice, character_gender, **kwargs)


def get_available_engines() -> dict:
    """Получить доступные движки"""
    engines = {"cloud": {"name": "Microsoft Edge TTS", "type": "cloud"}}
    
    # Проверяем coqui
    try:
        from .coqui import is_available as coqui_available
        if coqui_available():
            engines["coqui"] = {"name": "Coqui XTTS v2", "type": "local"}
    except:
        pass
    
    # Проверяем piper
    try:
        from .piper import is_available as piper_available
        if piper_available():
            engines["piper"] = {"name": "Piper", "type": "local"}
    except:
        pass
    
    return engines


def set_engine(engine: str) -> bool:
    """Установить активный движок"""
    global TTS_ENGINE
    available = get_available_engines()
    
    if engine in available:
        TTS_ENGINE = engine
        logger.info(f"TTS engine changed to: {engine}")
        return True
    return False


def get_current_engine() -> str:
    """Получить текущий движок"""
    return TTS_ENGINE


def get_voices(engine: Optional[str] = None) -> dict:
    """Получить голоса для движка"""
    eng = engine or TTS_ENGINE
    
    if eng == "coqui":
        from .coqui import get_voices as get_coqui_voices
        return get_coqui_voices()
    elif eng == "piper":
        from .piper import get_voices as get_piper_voices
        return get_piper_voices()
    else:
        from .cloud import get_voices as get_cloud_voices
        return get_cloud_voices()


# ============================================================================
# Singleton для обратной совместимости
# ============================================================================
_instance = None

def get_tts_service() -> 'TTSService':
    """Получить экземпляр TTS сервиса"""
    global _instance
    if _instance is None:
        _instance = _TTSService()
    return _instance


class TTSService:
    """Класс TTS сервиса - для совместимости"""
    
    def __init__(self):
        self.engine = "cloud"
    
    async def synthesize(self, text: str, **kwargs) -> bytes:
        from .cloud import synthesize as cloud_synthesize
        return await cloud_synthesize(text, **kwargs)


class _TTSService(TTSService):
    pass