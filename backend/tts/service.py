import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger("tts_service")

# ============================================================================
# ГОЛОСА ПО ПЕРВЫМ БУКВАМ ИМЕНИ ПЕРСОНАЖА
# ============================================================================
# Женские голоса (А-Е)
VOICE_GROUPS = {
    "А": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Анна (жен)"},
    "Б": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Белла (жен)"},
    "В": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Валентина (жен)"},
    "Г": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Галина (жен)"},
    "Д": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Дарья (жен)"},
    "Е": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Елена (жен)"},
    
    # Женские голоса (Ё-Л)
    "Ё": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Ёлка (жен)"},
    "Ж": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Жанна (жен)"},
    "З": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Зинаида (жен)"},
    "И": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Ирина (жен)"},
    "К": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Клавдия (жен)"},
    "Л": {"voice": "ru-RU-SvetlanaNeural", "gender": "female", "name": "Людмила (жен)"},
    
    # Мужские голоса (М-Р)
    "М": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Михаил (муж)"},
    "Н": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Николай (муж)"},
    "О": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Олег (муж)"},
    "П": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Пётр (муж)"},
    "Р": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Роман (муж)"},
    
    # Мужские голоса (С-Я)
    "С": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Сергей (муж)"},
    "Т": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Тимофей (муж)"},
    "У": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Универсальный (муж)"},
    "Ф": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Фёдор (муж)"},
    "Х": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Харитон (муж)"},
    "Ц": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Цезарь (муж)"},
    "Ч": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Чеслав (муж)"},
    "Ш": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Шандор (муж)"},
    "Щ": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Щукин (муж)"},
    "Ъ": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Твердый (муж)"},
    "Ы": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Ышный (муж)"},
    "Ь": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Мягкий (муж)"},
    "Э": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Эдуард (муж)"},
    "Ю": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Юрий (муж)"},
    "Я": {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "Ярослав (муж)"},
}

def get_voice_by_first_letter(letter: str) -> dict:
    """Получить голос по первой букве имени персонажа"""
    if not letter:
        return {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "По умолчанию"}
    
    first = letter.upper()
    
    # Проверяем есть ли буква в группе
    if first in VOICE_GROUPS:
        return VOICE_GROUPS[first]
    
    # Для неизвестных букв - мужской голос
    return {"voice": "ru-RU-DmitryNeural", "gender": "male", "name": "По умолчанию"}

DEFAULT_VOICE = "ru-RU-SvetlanaNeural"

# ============================================================================
# VOICE_TYPE_MAP - настройки для типов голоса (мужской, женский и т.д.)
# ============================================================================
VOICE_TYPE_MAP = {
    "default": {"pitch": "+0%", "rate": "+0%"},
    "male": {"pitch": "-10%", "rate": "-5%"},
    "female": {"pitch": "+20%", "rate": "+0%"},
    "soft": {"pitch": "+0%", "rate": "-15%"},
}

CHARACTER_VOICE_MAP = {
    "narrator": {
        "ru": "ru-RU-SvetlanaNeural",
        "en": "en-US-JennyNeural",
    },
    "fox": {
        "ru": "ru-RU-SvetlanaNeural",
        "en": "en-US-JennyNeural",
    },
    "male": {
        "ru": "ru-RU-DmitryNeural",
        "en": "en-US-GuyNeural",
    },
    "female": {
        "ru": "ru-RU-SvetlanaNeural",
        "en": "en-US-JennyNeural",
    },
}

def _add_prosody(text: str, base_pitch: float = 0, base_rate: float = 0, base_volume: float = 0) -> str:
    # Возвращаем текст как есть - не добавляем SSML теги для знаков препинания
    # Они читаются как текст и ломают озвучивание
    return text

class TTSService:
    def __init__(self):
        self._ready = False

    def load(self):
        if self._ready:
            return
        logger.info("TTS engine ready (edge-tts / Microsoft Neural)")
        self._ready = True

    def _get_voice(self, language: str, character: Optional[str] = None) -> str:
        if character:
            char_voices = CHARACTER_VOICE_MAP.get(character.lower())
            if char_voices:
                return char_voices.get(language, DEFAULT_VOICE)
        return DEFAULT_VOICE
    
    def _get_voice_for_voice_type(self, voice_type: str, language: str = "ru") -> str:
        """Получить голос по типу (male/female/имя голоса)"""
        voice_type = voice_type.lower()
        if voice_type == "male":
            return "ru-RU-DmitryNeural" if language == "ru" else "en-US-GuyNeural"
        elif voice_type == "female":
            return "ru-RU-SvetlanaNeural" if language == "ru" else "en-US-JennyNeural"
        # Это имя голоса
        return voice_type

    def _get_voice_for_character(
        self,
        character_name: Optional[str] = None,
        character_gender: Optional[str] = None,
        language: str = "ru"
    ) -> str:
        """Получить голос для конкретного персонажа по gender или первой букве имени"""
        # Если указан пол персонажа - используем его
        if character_gender:
            if character_gender == "female":
                voice_info = {"voice": "ru-RU-SvetlanaNeural", "gender": "female"}
            else:  # male или любой другой
                voice_info = {"voice": "ru-RU-DmitryNeural", "gender": "male"}
        elif character_name:
            voice_info = get_voice_by_first_letter(character_name[0])
        else:
            return DEFAULT_VOICE
        
        if language == "en":
            if voice_info["gender"] == "female":
                return "en-US-JennyNeural"
            else:
                return "en-US-GuyNeural"
        
        return voice_info["voice"]

    async def synthesize(
        self,
        text: str,
        language: str = "en",
        character: Optional[str] = None,
        character_gender: Optional[str] = None,
        voice_type: str = "default",
        pitch: float = 0.0,
        rate: float = 0.0,
        volume: float = 0.0,
    ) -> bytes:
        if not self._ready:
            self.load()

        import edge_tts

        # Определяем голос
        # Приоритет: voice_type > character_gender > character > default
        if voice_type and voice_type != "default" and voice_type != "male" and voice_type != "female":
            # voice_type это конкретное имя голоса или тип
            voice = self._get_voice_for_voice_type(voice_type, language)
        elif character or character_gender:
            voice = self._get_voice_for_character(character, character_gender, language)
        else:
            voice = self._get_voice(language, None)

        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp_path = tmp.name
        tmp.close()

        try:
            # Используем plain text без SSML тегов
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(tmp_path)
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


_instance: Optional[TTSService] = None


def get_tts_service() -> TTSService:
    global _instance
    if _instance is None:
        _instance = TTSService()
        _instance.load()
    return _instance