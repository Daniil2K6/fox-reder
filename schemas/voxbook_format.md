# VoxBook Format Specification

VoxBook — формат для аудио-ориентированного чтения книг с многоголосой озвучкой.

## Форматы

### `.vb` (VoxBook) — полный
Содержит полную разметку с персонажами.

### `.vblite` (VoxBook Lite) — облегчённый
Минимальная разметка, без детальных метаданных персонажей.

---

## Структура VBLite (основной целевой формат)

```json
{
  "format": "vblite",
  "version": 1,
  "metadata": {
    "title": "Название книги",
    "author": "Автор",
    "language": "ru",
    "source": "fb2|epub|txt",
    "generated": "2026-05-09T12:00:00Z",
    "llm_model": "qwen2.5-7b-instruct"
  },
  "chapters": [
    {
      "id": 1,
      "title": "Глава 1",
      "paragraphs": [
        {
          "text": "Строка текста",
          "character": null,
          "voice": null
        },
        {
          "text": "— Привет! — сказал Иван.",
          "character": "Иван",
          "voice": "ru-RU-DmitryNeural"
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "Иван",
      "gender": "male"
    },
    {
      "name": "Мария",
      "gender": "female"
    }
  ]
}
```

### Поля

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|----------|
| `format` | string | да | `"vblite"` |
| `version` | int | да | `1` |
| `metadata` | object | да | Метаданные книги |
| `chapters` | array | да | Массив глав |
| `characters` | array | нет | Список персонажей |

### Chapter

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | int | Номер главы |
| `title` | string | Название |
| `paragraphs` | array | Массив параграфов |

### Paragraph

| Поле | Тип | Описание |
|------|-----|----------|
| `text` | string | Текст для озвучки |
| `character` | string\|null | Имя персонажа |
| `voice` | string\|null | Голос TTS |
| `emotion` | string\|null | Эмоция |

---

## Правила разметки

1. Каждый параграф — неделимый блок текста для одной TTS-озвучки
2. Если `character = null` — озвучка голосом рассказчика (narration)
3. Если `character` указан — озвучка соответствующим голосом из `voice`
4. Если `voice = null` — голос подбирается автоматически по `character.gender` через `VOICE_GROUPS`
5. Максимальная длина `text` — 5000 символов (ограничение TTS)
