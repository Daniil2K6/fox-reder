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

def _add_prosody(text: str, base_pitch: float = 0, base_rate: float = 0, base_volume: float = 0) -> str:
    stripped = text.strip()
    if not stripped:
        return text
    
    # Don't add automatic prosody if user has custom settings
    if base_pitch != 0 or base_rate != 0 or base_volume != 0:
        return text
    
    last_char = stripped[-1]
    if last_char == "?":
        return f'<prosody pitch="+8%" rate="90%">{text}</prosody>'
    elif last_char == "!":
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
        voice_type: str = "default",
        pitch: float = 0.0,
        rate: float = 0.0,
        volume: float = 0.0,
    ) -> bytes:
        if not self._ready:
            self.load()

        import edge_tts

        voice = self._get_voice(language, character)
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp_path = tmp.name
        tmp.close()

        try:
            # Build final text - if custom pitch/rate/volume, use directly without auto-prosody
            final_text = text
            if pitch != 0 or rate != 0 or volume != 0:
                # User has custom settings - use directly with prosody tags
                prosody_parts = []
                if pitch != 0:
                    prosody_parts.append(f'pitch="{int(pitch * 100)}%"')
                if rate != 0:
                    prosody_parts.append(f'rate="{int(rate * 100)}%"')
                if volume != 0:
                    prosody_parts.append(f'volume="{int(volume * 100)}%"')
                if prosody_parts:
                    final_text = f'<prosody {" ".join(prosody_parts)}>{text}</prosody>'
            else:
                # No custom settings - use auto-prosody for punctuation
                final_text = _add_prosody(text)
            
            # Wrap in speak tag with voice
            ssml = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{language}"><voice name="{voice}">{final_text}</voice></speak>'
            communicate = edge_tts.Communicate(ssml, voice)
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
