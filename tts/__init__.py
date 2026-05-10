# TTS модуль
# Инициализирует и предоставляет доступ к TTS сервисам
from .service import synthesize, get_available_engines, set_engine, get_current_engine, get_voices
from .service import TTSService, get_tts_service

__all__ = [
    "synthesize",
    "get_available_engines", 
    "set_engine",
    "get_current_engine", 
    "get_voices",
    "TTSService",
    "get_tts_service",
]