import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger("fox_tts_cloud")

DEFAULT_VOICE = "ru-RU-SvetlanaNeural"

# ============================================================================
# VOICE_GROUPS - голоса по первой букве имени
# ============================================================================
VOICE_GROUPS = {
    "А": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Анна (жен)"},
    "Б": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Белла (жен)"},
    "В": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Валентина (жен)"},
    "Г": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Галина (жен)"},
    "Д": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Дарья (жен)"},
    "Е": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Елена (жен)"},
    "Ё": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Ёлка (жен)"},
    "Ж": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Жанна (жен)"},
    "З": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Зинаида (жен)"},
    "И": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Ирина (жен)"},
    "К": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Клавдия (жен)"},
    "Л": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Людмила (жен)"},
    "М": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Михаил (муж)"},
    "Н": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Николай (муж)"},
    "О": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Олег (муж)"},
    "П": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Пётр (муж)"},
    "Р": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Роман (муж)"},
    "С": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Сергей (муж)"},
    "Т": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Тимофей (муж)"},
    "У": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Универсальный (муж)"},
    "Ф": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Фёдор (муж)"},
    "Х": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Харитон (муж)"},
    "Ц": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Цезарь (муж)"},
    "Ч": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Чеслав (муж)"},
    "Ш": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Ш��ндор (муж)"},
    "Щ": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Щукин (муж)"},
    "Э": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Эдуард (муж)"},
    "Ю": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Юрий (муж)"},
    "Я": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Ярослав (муж)"},
}


def get_voice_by_first_letter(letter: str) -> dict:
    """Получить голос по первой букве имени персонажа"""
    if not letter:
        return {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "По умолчанию"}
    
    first = letter.upper()
    if first in VOICE_GROUPS:
        return VOICE_GROUPS[first]
    return {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "По умолчанию"}


def get_voices() -> dict:
    """Получить все голоса"""
    return VOICE_GROUPS


async def synthesize(
    text: str,
    language: str = "ru",
    character_name: Optional[str] = None,
    character_gender: Optional[str] = None,
    voice_type: Optional[str] = None,
    pitch: float = 0.0,
    rate: float = 0.0,
    volume: float = 0.0,
    **kwargs
) -> bytes:
    """Синтез речи через Microsoft edge-tts"""
    import edge_tts
    
    # Определяем голос по voice_type или character
    if voice_type == "female":
        voice = "ru-RU-SvetlanaNeural"
    elif voice_type == "male":
        voice = "ru-RU-DmitryNeural"
    elif voice_type == "soft":
        voice = "ru-RU-SvetlanaNeural"
    elif character_gender == "female":
        voice = "ru-RU-SvetlanaNeural"
    elif character_gender == "male":
        voice = "ru-RU-DmitryNeural"
    elif character_name:
        voice_info = get_voice_by_first_letter(character_name[0])
        voice = voice_info["voice"]
    else:
        voice = DEFAULT_VOICE
    
    if language == "en":
        voice = "en-US-JennyNeural" if voice == "ru-RU-SvetlanaNeural" else "en-US-GuyNeural"
    
    # Генерируем аудио
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp_path = tmp.name
    tmp.close()
    
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(tmp_path)
        
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def is_available() -> bool:
    """Проверить доступность"""
    try:
        import edge_tts
        return True
    except:
        return False