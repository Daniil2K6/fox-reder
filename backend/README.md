# Fox Reader Backend - Структура
# =========================

## Основные файлы
auth.py           - Аутентификация и авторизация (FastAPI роутер)
books.py          - API книг (CRUD, загрузка, библиотека)
config.py         - Конфигурация проекта (пути, TTS_ENGINE, LLM)
database.py       - SQLAlchemy модели и БД
main.py           - Точка входа FastAPI приложения
seed.py           - Начальное заполнение БД
vb_parser.py      - Парсер VBLite/FB2 форматов
requirements*.txt - Зависимости Python

## Папки
tts/             - Модуль синтеза речи (switch cloud/coqui/piper)
llm/              - Модуль LLM (API для llama.cpp)
librali/          - Файлы проекта:
  uploads/       - Загруженные книги
  covers/        - Обложки книг
  avatars/       - Аватарки пользователей
  books/        - PDF/EPUBFB2 книги

## Неактивные папки (можно удалить)
avatars/          - Старые аватарки (пусто)
covers/          - Старые обложки (пусто)
models/          - Неиспользуется (пусто)
uploads/         - Дубликат librali/uploads
fox_reader.db    - База данных SQLite