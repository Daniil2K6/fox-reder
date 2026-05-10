# fox-tts

Библиотека TTS для Fox Reader.

## Установка

```bash
pip install -e .
# или с конкретным движком:
pip install -e .[cloud]
```

## Использование

```python
from tts import get_tts_service

service = get_tts_service()
audio = await service.synthesize("Привет мир", language="ru")
```

## Движки

- `cloud` — Microsoft Edge TTS (работает сразу)
- `coqui` — Coqui XTTS v2 (нужна установка)
- `piper` — Piper TTS (нужна установка)
