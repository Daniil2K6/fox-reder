import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger("tts_service")

VOICE_MAP = {
    "ru": "ru-RU-DmitryNeural",
    "en": "en-US-GuyNeural",
    "es": "es-ES-AlvaroNeural",
    "fr": "fr-FR-HenriNeural",
    "de": "de-DE-ConradNeural",
    "it": "it-IT-DiegoNeural",
    "pt": "pt-BR-AntonioNeural",
    "ja": "ja-JP-KeitaNeural",
    "zh": "zh-CN-YunxiNeural",
    "ko": "ko-KR-InJoonNeural",
    "pl": "pl-PL-MarekNeural",
    "tr": "tr-TR-AhmetNeural",
}

DEFAULT_VOICE = "en-US-GuyNeural"

VOICE_TYPE_MAP = {
    "default": {"pitch": "+0%", "rate": "+0%"},
    "male": {"pitch": "-10%", "rate": "-5%"},
    "female": {"pitch": "+20%", "rate": "+0%"},
    "soft": {"pitch": "+0%", "rate": "-15%"},
}

CHARACTER_VOICE_MAP = {
    "narrator": {
        "ru": "ru-RU-DmitryNeural",
        "en": "en-US-GuyNeural",
    },
    "fox": {
        "ru": "ru-RU-DmitryNeural",
        "en": "en-US-TonyNeural",
    },
    "book": {
        "ru": "ru-RU-DmitryNeural",
        "en": "en-US-ChristopherNeural",
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

def _add_prosody(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return text
    last_char = stripped[-1]
    if last_char == "?":
        # Question: raise pitch, slower rate
        return f'<prosody pitch="+8%" rate="90%">{text}</prosody>'
    elif last_char == "!":
        # Exclamation: raise volume and pitch
        return f'<prosody volume="+20%" pitch="+5%">{text}</prosody>'
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
                return char_voices.get(language, VOICE_MAP.get(language, DEFAULT_VOICE))
        return VOICE_MAP.get(language, DEFAULT_VOICE)

    async def synthesize(
        self,
        text: str,
        language: str = "en",
        character: Optional[str] = None,
        voice_type: str = "default"
    ) -> bytes:
        if not self._ready:
            self.load()

        import edge_tts

        voice = self._get_voice(language, character)
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp_path = tmp.name
        tmp.close()

        try:
            # Process text with SSML for intonation
            processed_text = _add_prosody(text)
            # If processed_text contains SSML tags, wrap in <speak>
            if "<prosody" in processed_text:
                ssml = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{language}"><voice name="{voice}">{processed_text}</voice></speak>'
                communicate = edge_tts.Communicate(ssml, voice)
            else:
                communicate = edge_tts.Communicate(processed_text, voice)
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
