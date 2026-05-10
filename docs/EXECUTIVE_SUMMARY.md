# FoxBooks (fox-reder) - Сводка анализа архитектуры

## Краткая информация о проекте

**Название**: FoxBooks (fox-reder)  
**Тип**: Полнофункциональная веб-платформа для чтения и публикации электронных книг  
**Стек**: 
- Backend: Python 3.12 + FastAPI + SQLAlchemy 2.0 + SQLite
- Frontend: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS

**Размер**: ~3,700 строк кода + конфиги + документация  
**Статус**: MVP (работающий продукт) с техническим долгом

---

## Ключевые характеристики

### Функциональность
- ✅ Аутентификация (JWT + bcrypt)
- ✅ Загрузка и парсинг книг (FB2, EPUB, TXT, VoxBook)
- ✅ Читалка с озвучкой (Edge TTS)
- ✅ Публичная библиотека с поиском
- ✅ Социальные функции (комментарии, лайки, подписки)
- ✅ Управление сериями книг
- ✅ Админ-панель
- 🔄 Конвертация форматов (планируется)
- 🔄 LLM интеграция (планируется)

### Качество кода
- 📊 Архитектура: 6/10 (требует рефакторинга)
- 📊 Безопасность: 8/10 (критические ошибки исправлены)
- 📊 Масштабируемость: 4/10 (монолитная структура)
- 📊 Тестирование: 0/10 (отсутствует)
- 📊 Документация: 6/10 (базовая, есть PROJECT_MAP.md)

**Общий рейтинг**: 5.6/10 - приемлемо для MVP, требует улучшений перед production

---

## Основные проблемы

### 🔴 Критические (нужно исправить)

1. **Монолитный books.py (1,851 строк)**
   - Смешивает логику 8 разных сущностей
   - Невозможно тестировать отдельно
   - **Рекомендация**: разделить на 5-6 файлов

2. **Отсутствие слоя сервисов**
   - Бизнес-логика в routers-ах
   - Нет переиспользования кода
   - **Рекомендация**: создать service layer

3. **TTS как синглтон**
   - Хранится в памяти приложения
   - Может потерять состояние при ошибке
   - **Рекомендация**: использовать пул объектов

### 🟠 Важные

4. **Нет парсинга больших файлов**
   - Синхронный парсинг может зависнуть сервер
   - Нет timeout-ов
   - **Рекомендация**: async парсинг + очередь

5. **Отсутствие кеширования**
   - Каждый запрос = чтение с диска
   - **Рекомендация**: Redis cache

6. **Недостаточно type-safety (frontend)**
   - `api.ts` использует `any`
   - Нет runtime валидации
   - **Рекомендация**: Zod schemas

7. **Нет тестов**
   - 0% coverage
   - Рискованно рефакторить
   - **Рекомендация**: минимум 50% для критических путей

### 🟡 Рекомендуемые улучшения

8. Логирование операций (audit trail)
9. Error tracking (Sentry)
10. Rate limiting на endpoints
11. Docstrings в коде
12. Migration system (Alembic)
13. Docker + docker-compose

---

## Структура зависимостей

### Backend Dependencies (13 пакетов)

**Framework**: 
- fastapi==0.115.6
- uvicorn[standard]==0.34.0

**Database**:
- sqlalchemy==2.0.36
- aiosqlite==0.20.0

**Auth & Security**:
- python-jose[cryptography]==3.3.0
- passlib[bcrypt]==1.7.4
- bcrypt==4.0.1
- pydantic==2.10.4

**File Processing**:
- python-multipart==0.0.20
- lxml==5.3.0
- ebooklib==0.18
- beautifulsoup4==4.12.3

**TTS**:
- edge-tts>=6.1.0

### Frontend Dependencies (3 + типы)

**Production**:
- next@^14.2.22
- react@^18.3.1
- react-dom@^18.3.1

**Development**:
- typescript@^5.7.3
- tailwindcss@^3.4.17
- autoprefixer@^10.4.20
- postcss@^8.4.49
- @types/* (для Node.js и React)

---

## API Endpoints (45+ активных)

### Auth (6 endpoints)
- POST /register
- POST /login
- GET /me
- PUT /user/{id}/role (admin)
- PUT /user/{id}/plus (admin)
- PUT /voice

### Books (30+ endpoints)
- Upload/Management: upload, delete, update title
- Reading: /text, /structured, view tracking
- Public: list, search, hot books
- Visibility: make public/private, set format
- Social: like, comments, subscriptions
- Series: CRUD + cover + ordering
- Conversion: convert to VBLite

### TTS (2 endpoints)
- POST /tts (полный текст)
- POST /tts/chunk (кусок с параметрами)

### Other
- GET /health

---

## Database Models (8 таблиц)

```
User (12 полей)
├─ Books (1→N)
├─ Series (1→N)
├─ Comments (1→N)
├─ Likes (1→N)
├─ Subscriptions (1→N)
└─ Notifications (1→N)

Book (15 полей)
├─ Owner (FK→User)
├─ Series (M2M via book_series table)
├─ Versions (1→N)
├─ Comments (1→N)
└─ Likes (1→N)

BookVersion (6 полей)
└─ Book (FK)

Series (5 полей)
├─ Owner (FK→User)
└─ Books (M2M)

Comment (5 полей)
├─ Book (FK)
└─ User (FK)

Like (4 полей)
├─ User (FK)
└─ Book (FK)

Subscription (4 полей)
├─ Subscriber (FK→User)
└─ Author (FK→User)

Notification (8 полей)
└─ User (FK)
```

---

## Frontend Pages (14 маршрутов)

| Page | Purpose |
|------|---------|
| / | Home (choose mode) |
| /login | Sign in |
| /register | Create account |
| /profile | User profile |
| /public | Public library + search |
| /reader/[id] | Read book (interactive) |
| /reader/local | Read local files |
| /book/[id] | View book (metadata) |
| /author/[id] | Author profile |
| /series/[id] | View series |
| /admin | Admin panel |
| /converter | Format converter |
| /notifications | User notifications |
| /in-development | Placeholder |

---

## Frontend Components (2 компонента)

- **Navbar** - Navigation menu (all pages)
- **GenreSelector** - Genre filter

**Проблема**: Слишком мало переиспользуемых компонентов. Вся логика в pages.

---

## Plan улучшений (4-5 недель работы)

### Неделя 1: Архитектура (Refactoring)
- [ ] Разделить books.py (1,851 → 300-400 строк)
- [ ] Создать service layer
- [ ] Разделить parsers

**Выгода**: -1,800 строк, +300% тестируемости

### Неделя 2: Performance
- [ ] Redis cache
- [ ] Async file parsing
- [ ] Query optimization

**Выгода**: 10x быстрее для горячих путей

### Неделя 3: Quality
- [ ] Unit tests (pytest)
- [ ] Component tests (Jest)
- [ ] Type validation (Zod)
- [ ] Logging & monitoring

**Выгода**: 0% → 50% test coverage

### Неделя 4: Production
- [ ] Docker setup
- [ ] Database migrations
- [ ] Rate limiting
- [ ] Error tracking

**Выгода**: ready for deployment

### Неделя 5: Documentation
- [ ] Code docstrings
- [ ] Architecture docs
- [ ] Deployment guide
- [ ] Troubleshooting

**Выгода**: -50% onboarding time

---

## Рекомендации по приоритизации

### ДО production:
1. ✅ Исправить критические security issues (DONE)
2. Разделить books.py на модули (1-2 дня)
3. Добавить базовые тесты (3-5 дней)
4. Настроить rate limiting (1 день)
5. Docker + миграции (2 дня)

### ПОСЛЕ production (nice-to-have):
- Redis caching
- Async парсинг
- Advanced monitoring
- Kubernetes deployment

---

## Выводы

**Что хорошо:**
- ✅ Работающий MVP с полным функционалом
- ✅ Безопасность исправлена
- ✅ Нет циклических зависимостей
- ✅ Используется async/await (FastAPI)
- ✅ SQLAlchemy с ORM

**Что нужно улучшить:**
- 🔴 Монолитная структура
- 🔴 Нет тестов
- 🔴 Отсутствие cache
- 🟠 Синхронный парсинг
- 🟠 Мало компонентов на frontend

**Рекомендация:**
Проект готов к production с минимальными улучшениями (2-3 недели работы). Для масштабирования нужен полный рефакторинг архитектуры (4-5 недель).

