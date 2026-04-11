# FoxBooks (fox-reder)

Веб-читалка с личной библиотекой, поддержкой **FB2**, **EPUB**, **TXT** и формата **VoxBook** (`.vb` / `.vblite`), озвучкой через **Edge TTS** и простой социальной обвязкой (публичные книги, комментарии).

Репозиторий: [github.com/Daniil2K6/fox-reder](https://github.com/Daniil2K6/fox-reder)

## Возможности

- Регистрация и вход, хранение книг на сервере (SQLite по умолчанию).
- Загрузка нескольких файлов, дедупликация по SHA256.
- Читалка: непрерывный режим и режим по главам, тёмная/светлая тема.
- Озвучка абзацев (язык и тип голоса настраиваются).
- Публичная библиотека и страница книги с обложкой, описанием и комментариями.

## Быстрый старт

Требования: **Python 3.12+**, **Node.js 18+**.

```bash
chmod +x run.sh
./run.sh --dev
```

- Фронтенд: [http://localhost:3000](http://localhost:3000)
- API (документация Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)

Учётная запись администратора по умолчанию создаётся при первом запуске бэкенда: **`admin` / `admin`** (смените пароль в продакшене).

### Только бэкенд

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Только фронтенд

```bash
cd frontend
npm install
npm run dev
```

Прокси к API настроен в `frontend/next.config.js` (переписывание `/api/*` → `http://127.0.0.1:8000`).

## Переменные окружения (опционально)

| Переменная   | Назначение                          |
|-------------|--------------------------------------|
| `SECRET_KEY`| Секрет JWT (обязательно в проде)    |
| `DATABASE_URL` | Строка подключения SQLAlchemy    |

## Структура проекта

```
backend/   — FastAPI, SQLAlchemy, парсеры FB2/VoxBook, TTS
frontend/  — Next.js 14 (App Router)
run.sh     — установка зависимостей и запуск обоих сервисов
```

## Лицензия

Проект в репозитории пользователя; уточните лицензию при публикации.
