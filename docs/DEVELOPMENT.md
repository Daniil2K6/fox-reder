# Fox Reader - Документация разработки

## Требования

- Node.js 18+
- Python 3.10+
- uv (менеджер пакетов Python)

## Запуск

### Backend

```bash
cd backend
uv venv .venv
source .venv/bin/activate  # или .venv\Scripts\activate на Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Структура проекта

```
fox-reder/
├── backend/          # FastAPI сервер
│   ├── main.py      # Точка входа
│   ├── books.py    # API книг
│   ├── auth.py     # Аутентификация
│   ├── database.py # SQLAlchemy модели
│   ├── vb_parser.py # Парсер VBLite
│   └── tts/       # TTS сервис
├── frontend/       # Next.js приложение
│   └── src/
│       ├── app/   # Страницы
│       ├── components/ # Компоненты
│       └── lib/  # API функции
├── docs/           # Документация
└── uploads/       # Загруженные книги
```

## VBLite2 формат

Формат файла книг:

```json
{
  "format_version": "vblite2",
  "title": "Название книги",
  "author": "Автор",
  "content": [
    {
      "title": "Глава 1",
      "content": [
        {
          "type": "text",
          "text": "Текст параграфа",
          "character": {
            "name": "Имя персонажа",
            "gender": "male" // или "female"
          }
        }
      ]
    }
  ]
}
```

## Настройка голоса

Голоса по первой букве имени:
- А-Л → женский (SvetlanaNeural)
- М-У → мужской (DmitryNeural)  
- Ф-Я → мужской (DmitryNeural)

Приоритет выбора голоса:
1. voice_type из настроек пользователя
2. character_gender из персонажа
3. Первая буква имени персонажа
4. Голос по умолчанию

## Добавление тестовой книги

```python
# Запустить backend для создания admin
cd backend
uvicorn main:app --port 8000

# В другом терминале:
python ../add_test_book.py
```

## API

- `GET /api/books` - Список книг
- `GET /api/books/{id}` - Информация о книге
- `GET /api/books/{id}/structured` - Структурированный контент
- `POST /api/tts/chunk` - Синтез речи
- `POST /api/auth/login` - Вход
- `POST /api/auth/register` - Регистрация