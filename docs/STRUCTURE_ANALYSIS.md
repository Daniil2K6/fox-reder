# FoxBooks (fox-reder) - Детальный структурный анализ

**Дата анализа**: май 2026  
**Объем кодовой базы**: ~3,684 строк Python + ~19 исходных файлов TypeScript  
**Размер проекта**: 239MB (бэк) + 365MB (фронт - с node_modules)

---

## 1. ПОЛНЫЙ СПИСОК ЗАВИСИМОСТЕЙ

### Frontend (package.json)

**Production Dependencies**:
- `next@^14.2.22` - React метафреймворк с App Router
- `react@^18.3.1` - Компонентная UI библиотека
- `react-dom@^18.3.1` - DOM рендеринг для React

**Dev Dependencies**:
- `@types/node@^22.10.5` - TypeScript типы для Node.js
- `@types/react@^18.3.18` - TypeScript типы для React
- `@types/react-dom@^18.3.5` - TypeScript типы для React DOM
- `typescript@^5.7.3` - TypeScript компилятор
- `tailwindcss@^3.4.17` - Utility-first CSS фреймворк
- `autoprefixer@^10.4.20` - PostCSS плагин для вендорных префиксов
- `postcss@^8.4.49` - CSS трансформер

**Стек**: Next.js 14 (App Router) + TypeScript + Tailwind CSS

---

### Backend (requirements.txt)

**Core Framework & Server**:
- `fastapi==0.115.6` - Асинхронный веб-фреймворк (Python)
- `uvicorn[standard]==0.34.0` - ASGI-сервер

**Database & ORM**:
- `sqlalchemy==2.0.36` - SQL toolkit и ORM (с async поддержкой)
- `aiosqlite==0.20.0` - Асинхронный драйвер для SQLite

**Authentication & Security**:
- `python-jose[cryptography]==3.3.0` - JWT обработка
- `passlib[bcrypt]==1.7.4` - Утилиты для хеширования паролей
- `bcrypt==4.0.1` - Криптографическая библиотека для bcrypt
- `pydantic==2.10.4` - Валидация данных и парсинг

**File Handling & Parsing**:
- `python-multipart==0.0.20` - Парсинг multipart/form-data
- `lxml==5.3.0` - XML парсинг для FB2 файлов
- `ebooklib==0.18` - Парсинг EPUB файлов
- `beautifulsoup4==4.12.3` - HTML/XML парсинг

**Text-to-Speech**:
- `edge-tts>=6.1.0` - Microsoft Edge TTS (облачное озвучивание)

**Стек**: FastAPI + SQLAlchemy 2.0 + SQLite + JWT + bcrypt

---

## 2. ВСЕ ОСНОВНЫЕ КОМПОНЕНТЫ И СУЩНОСТИ

### Frontend Components

#### Pages (App Router - `/src/app/`)

| Путь | Назначение | Статус |
|------|-----------|--------|
| `/` (page.tsx) | Главная страница, выбор режима | ✅ Активно |
| `/login` (page.tsx) | Вход пользователя | ✅ Активно |
| `/register` (page.tsx) | Регистрация пользователя | ✅ Активно |
| `/profile` (page.tsx) | Профиль пользователя | ✅ Активно |
| `/public` (page.tsx) | Публичная библиотека с поиском | ✅ Активно |
| `/reader/[id]` (page.tsx) | Читалка с интерактивным контентом | ✅ Активно |
| `/reader/local` (page.tsx) | Локальный читатель файлов | ✅ Активно |
| `/book/[id]` (page.tsx) | Просмотр книги (не читалка) | ✅ Активно |
| `/author/[id]` (page.tsx) | Профиль автора | ✅ Активно |
| `/series/[id]` (page.tsx) | Просмотр серии книг | ✅ Активно |
| `/admin` (page.tsx) | Админ-панель | ✅ Активно |
| `/converter` (page.tsx) | Конвертер форматов | ✅ Активно |
| `/notifications` (page.tsx) | Уведомления пользователя | ✅ Активно |
| `/in-development` (page.tsx) | Заглушка для работ в разработке | ✅ Активно |

#### Компоненты (Reusable)

| Файл | Экспорт | Назначение |
|------|---------|-----------|
| `/components/Navbar.tsx` | `<Navbar activeTab="..." />` | Навигационное меню всех страниц |
| `/components/GenreSelector.tsx` | `<GenreSelector />` | Выбор жанров (для фильтрации) |

**Проблема**: Слишком мало переиспользуемых компонентов. Все логика в pages.

#### Utilities & Libraries

| Файл | Экспорты | Назначение |
|------|----------|-----------|
| `/lib/api.ts` | 40+ функций | **Single source of truth** для всех API вызовов |
| `/lib/genres.ts` | массив жанров | Список поддерживаемых жанров |

**api.ts** - 535 строк с функциями:
- Auth: `apiLogin`, `apiRegister`, `apiGetMe`, `apiLogout`
- Books: `apiUploadBook`, `apiGetBook`, `apiGetMyBooks`, `apiGetPublicBooks`, `apiSearchBooks`
- Series: `apiCreateSeries`, `apiGetSeries`, `apiUpdateSeries`
- Comments: `apiAddComment`, `apiGetComments`, `apiDeleteComment`
- Likes: `apiLikeBook`, `apiUnlikeBook`
- Subscriptions: `apiSubscribeAuthor`, `apiUnsubscribeAuthor`
- TTS: `apiSynthesizeText`, `apiSynthesizeChunk`
- Reader: `apiPreviewBook`, `apiGetBookText`, `apiGetBookStructured`
- Admin: `apiSetUserRole`, `apiSetUserPlus`, `apiBanUser`

---

### Backend API Endpoints

#### Auth Router (`/api/auth` - 6 endpoints)

| Метод | Путь | Функция | Auth |
|-------|------|---------|------|
| POST | `/register` | Регистрация нового пользователя | ❌ Нет |
| POST | `/login` | Вход и получение JWT токена | ❌ Нет |
| GET | `/me` | Получить профиль текущего пользователя | ✅ JWT |
| PUT | `/user/{id}/role` | Установить роль пользователю | ✅ Admin |
| PUT | `/user/{id}/plus` | Выдать/снять Plus статус | ✅ Admin |
| PUT | `/voice` | Установить голосовые настройки | ✅ JWT |

#### Books Router (`/api/books` - 30+ endpoints)

**Upload & Management**:
- POST `/upload` - Загрузить книгу (с парсингом)
- GET `/my` - Мои книги
- DELETE `/{book_id}` - Удалить книгу
- PUT `/{book_id}/title` - Обновить название

**Reading & Content**:
- GET `/{book_id}` - Данные книги (с метаданными)
- GET `/{book_id}/text` - Полный текст книги
- GET `/{book_id}/structured` - Структурированный контент (главы)
- POST `/{book_id}/view` - Учесть просмотр

**Public Library**:
- GET `/public` - Все публичные книги
- GET `/public/count` - Количество публичных книг
- GET `/public/hot` - Популярные книги
- GET `/search?q=...&genres=...&format=...` - Полнотекстовый поиск

**Visibility & Sharing**:
- PUT `/{book_id}/visibility` - Сделать публичной/приватной
- PUT `/{book_id}/preferred-format` - Установить формат по умолчанию

**Social Features**:
- POST `/{book_id}/like` - Лайк книги
- GET `/{book_id}/comments` - Комментарии
- POST `/{book_id}/comments` - Добавить комментарий
- DELETE `/{book_id}/comments/{comment_id}` - Удалить комментарий

**Series Management**:
- POST `/series` - Создать серию
- GET `/series/list` - Мои серии
- GET `/series/public` - Публичные серии
- PUT `/series/{series_id}` - Обновить серию
- POST `/series/{series_id}/cover` - Загрузить обложку серии
- PUT `/series/{series_id}/order` - Переупорядочить книги в серии
- DELETE `/series/{series_id}` - Удалить серию

**Format Conversion**:
- GET `/{book_id}/convert/vblite` - Конвертировать в VBLite формат
- GET `/{book_id}/versions` - История версий книги

#### Other Routes

- GET `/api/health` - Проверка здоровья сервера
- POST `/api/tts` - Синтез речи (весь текст)
- POST `/api/tts/chunk` - Синтез речи (кусок с параметрами)

**Всего endpoints**: ~45 активных маршрутов

---

### Backend Database Models (SQLAlchemy)

| Модель | Таблица | Поля | Отношения | Назначение |
|--------|---------|------|-----------|-----------|
| `User` | `users` | id, username, hashed_password, role, is_plus, is_banned, created_at, preferred_voice, preferred_language, voice_pitch, voice_rate, voice_volume, avatar_url | 1→N Books, Series, Comments, Likes, Subscriptions, Notifications | Учетные записи пользователей |
| `Book` | `books` | id, title, filename, sha256, file_path, is_public, owner_id, created_at, text_content, cover_image, genres, description, original_language, is_translated, view_count, group_id, preferred_format | Owner (FK), Series (M2M), Comments, Likes, Versions | Основная сущность книги |
| `BookVersion` | `book_versions` | id, book_id, format, file_path, sha256, filename, created_at | Book (FK) | История версий (разные форматы) |
| `Series` | `series` | id, name, owner_id, created_at, cover_image, common_genres | Owner (FK), Books (M2M) | Серии/коллекции книг |
| `Like` | `likes` | id, user_id, book_id, created_at | User (FK), Book (FK) | Лайки книг (unique: user+book) |
| `Comment` | `comments` | id, book_id, user_id, content, created_at | Book (FK), User (FK) | Комментарии к книгам |
| `Subscription` | `subscriptions` | id, subscriber_id, author_id, created_at | Subscriber (FK), Author (FK) | Подписки на авторов |
| `Notification` | `notifications` | id, user_id, type, message, link, is_read, created_at | User (FK) | Уведомления (комментарии, лайки) |

**Ассоциативная таблица**:
- `book_series` - Many-to-many связь с `order_index` для упорядочения

**Уникальные ограничения**:
- `users.username` - UNIQUE
- `books.owner_id + sha256` - UNIQUE (дедупликация)
- `likes.user_id + book_id` - UNIQUE
- `subscriptions.subscriber_id + author_id` - UNIQUE

---

### Backend Modules

#### `auth.py` (229 строк)
- JWT токены (HS256, 7-дневный срок)
- Хеширование паролей (bcrypt)
- Роли: `user`, `admin`
- Plus статус (для преимуществ)
- Бан-система
- OAuth2 схема
- Зависимости: `get_current_user()`, `require_user()`, `require_admin()`

#### `books.py` (1,851 строк) - САМЫЙ КРУПНЫЙ МОДУЛЬ
- 61 функция (среднее 30 строк каждая)
- Загрузка книг с парсингом FB2/VB/EPUB
- Управление версиями (multi-format)
- Полнотекстовый поиск по книгам
- Управление сериями
- Социальные функции (комментарии, лайки, подписки)
- Тревожный код: Много логики в одном файле, смешанные ответственности

#### `database.py` (212 строк)
- 8 SQLAlchemy моделей
- Инициализация БД с миграциями
- FTS индекс для поиска
- Автоматические миграции при запуске

#### `main.py` (165 строк)
- FastAPI инициализация
- CORS конфигурация
- TTS endpoints
- Жизненный цикл приложения (lifespan)
- Создание admin пользователя при старте
- Загрузка TTS модели

#### `config.py` (56 строк)
- Переменные окружения
- Пути к папкам
- TTS конфигурация
- LLM конфигурация

#### `vb_parser.py` (602 строк)
- Парсинг FB2 файлов (сложная XML логика)
- Парсинг VBLite формата (пользовательский JSON)
- Парсинг EPUB файлов
- Извлечение обложек
- Извлечение структуры (главы, параграфы)

#### `tts/` модуль (244 строк)
- **service.py** (114) - Переключатель между движками (cloud, coqui, piper)
- **cloud.py** (117) - Edge TTS интеграция (текущий движок)
- **init.py** (13) - Кэш и инициализация сервиса

#### `llm/` модуль (134 строк) - ПЛАНИРУЕТСЯ
- **service.py** (133) - Заготовка для LLM интеграции (Qwen 2.5)
- Используется для конвертации форматов

#### `converter/` модуль - ПЛАНИРУЕТСЯ
- Пока только README с описанием

---

## 3. ВСЕ ВНЕШНИЕ ЗАВИСИМОСТИ (сводка)

### Direct Dependencies

**Python (13 пакетов)**:
```
fastapi              - веб-фреймворк
uvicorn              - сервер
sqlalchemy           - ORM
aiosqlite            - БД драйвер
python-jose          - JWT
passlib + bcrypt     - хеширование паролей (2 пакета)
pydantic             - валидация
python-multipart     - form parsing
lxml                 - XML парсинг
ebooklib             - EPUB парсинг
beautifulsoup4       - HTML парсинг
edge-tts             - TTS движок
```

**JavaScript/TypeScript (3 пакета)**:
```
next                 - фреймворк
react                - UI библиотека
react-dom            - DOM рендеринг
```

### Indirect Dependencies
- **Python**: зависимости перечисленных пакетов (starlette, cryptography, yarl, websockets и т.д.)
- **JS**: Next.js транспилирует и включает ~200+ пакетов в node_modules

---

## 4. ПОТЕНЦИАЛЬНЫЕ ДУБЛИРОВАНИЯ И НЕЭФФЕКТИВНОСТИ

### Критические проблемы

#### 1. **books.py - Монолитный файл (1,851 строк)**
**Проблема**: Все логика книг в одном файле
- Сущности: Book, BookVersion, Series, Comments, Likes, Subscriptions, Notifications
- Операции: upload, versioning, search, social features, series management

**Рекомендация**:
```
backend/
├── books/
│   ├── __init__.py
│   ├── router.py          # Только маршруты
│   ├── models.py          # Pydantic schemas
│   ├── crud.py            # CRUD операции
│   ├── parser.py          # Парсинг файлов (из vb_parser.py)
│   └── search.py          # Полнотекстовый поиск
├── series/
│   ├── router.py
│   ├── crud.py
│   └── models.py
├── social/
│   ├── router.py
│   ├── crud.py
│   └── models.py
```

**Выгода**: -1,800 строк кода, +5 файлов, лучше для тестирования и масштабирования

#### 2. **vb_parser.py - Сложный парсинг в одном файле (602 строк)**
**Проблема**: 
- FB2 парсинг (200 строк)
- VBLite парсинг (150 строк)
- EPUB парсинг (100 строк)
- Вспомогательные функции (152 строк)

**Рекомендация**:
```
backend/parsers/
├── __init__.py
├── base.py              # Абстрактный Parser
├── fb2.py               # FB2Parser
├── vblite.py            # VBLiteParser
├── epub.py              # EPUBParser
└── utils.py             # Общие функции (extract_cover, extract_text)
```

#### 3. **API клиент в одном файле (api.ts - 535 строк)**
**Проблема**: Трудно навигировать, микс ответственностей
- Auth функции
- Book функции
- Series функции
- TTS функции
- Admin функции

**Рекомендация**:
```
frontend/src/lib/api/
├── index.ts             # Экспорт всех
├── auth.ts              # Auth endpoints
├── books.ts             # Book endpoints
├── series.ts            # Series endpoints
├── tts.ts               # TTS endpoints
├── social.ts            # Comments, Likes
└── types.ts             # Общие типы
```

**Выгода**: -400 строк (разделение), лучше type-safety

#### 4. **TTS логика разбросана**
**Проблема**:
- Конфигурация в `config.py`
- Инициализация в `main.py`
- Сервис в `tts/service.py`
- Endpoints в `main.py`

**Рекомендение**: Создать `tts_router` в `tts/__init__.py` и подключить как в `books.py`

#### 5. **Отсутствие слоя сервисов (Service Layer)**
**Проблема**: Логика бизнеса смешана с маршрутизацией
- Все CRUD операции прямо в роутерах
- Нет переиспользования логики между endpoints

**Рекомендация**:
```
backend/
├── books/
│   ├── service.py       # Бизнес-логика (не зависит от FastAPI)
│   ├── router.py        # Только HTTP слой
│   └── crud.py          # Операции с БД
```

### Средние проблемы

#### 6. **Дублирование кода в парсерах**
В `vb_parser.py`:
- `_extract_text_from_element()` вызывается для FB2 и EPUB
- Можно сделать обще-назначенной функцией в `utils.py`

#### 7. **Отсутствие обработки ошибок в парсинге**
- Нет timeout-ов для больших файлов
- Нет валидации структуры перед парсингом

#### 8. **API функции не используют constants**
```typescript
// BAD - в каждой функции:
const res = await fetch(`${API_BASE}/api/books/upload`, {...})

// GOOD - должно быть:
const ENDPOINTS = {
  BOOKS: {
    UPLOAD: '/api/books/upload',
    MY: '/api/books/my',
  }
}
```

#### 9. **Состояние приложения в localStorage без валидации**
```typescript
// frontend/src/lib/api.ts
const u = localStorage.getItem("fox_user");
return u ? JSON.parse(u) : null; // Может упасть на invalid JSON
```

#### 10. **TTS может загружаться при каждом запросе**
```python
# main.py:154
service = get_tts_service()  # Каждый раз проверяет инициализацию
```

---

## 5. ПРОВЕРКА СТРУКТУРЫ ПАПОК НА ЛОГИЧНОСТЬ

### Frontend

```
frontend/
├── src/
│   ├── app/          ✅ App Router pages (следует Next.js convention)
│   ├── components/   ✅ Reusable components (Navbar, GenreSelector)
│   ├── lib/          ✅ Utilities (api.ts, genres.ts)
│   └── locales/      ⚠️  Не использует (локализация не настроена)
├── public/           ⚠️  Отсутствует static файлы (логотипы и т.д.)
├── node_modules/     ✅ Dependencies
├── package.json      ✅ Config
├── next.config.js    ✅ API proxy config
└── .next/            ✅ Build output
```

**Проблемы**:
- Нет папки `public/` для статических ассетов
- `locales/` существует но не использует i18n
- Нет `styles/` для глобальных стилей (используется `globals.css` прямо в app/)

**Рекомендация**:
```
frontend/
├── public/               # Статика
│   ├── icons/
│   ├── images/
│   └── favicon.ico
├── src/
│   ├── app/
│   ├── components/       # Разделить на папки
│   │   ├── common/       # Navbar, Footer
│   │   ├── book/         # BookCard, BookReader
│   │   ├── auth/         # LoginForm, RegisterForm
│   │   └── admin/        # AdminPanel, UserTable
│   ├── lib/
│   │   ├── api/          # Разделить по доменам
│   │   └── utils/        # Helper функции
│   ├── styles/           # CSS modules
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript definitions
└── ...
```

### Backend

```
backend/
├── main.py           ✅ Entrypoint
├── auth.py           ✅ Auth router
├── books.py          ⚠️  Слишком крупный (1,851 строк)
├── database.py       ✅ Models & init
├── config.py         ✅ Config
├── vb_parser.py      ⚠️  Слишком крупный (602 строк)
├── tts/              ✅ TTS сервис (модульный)
├── llm/              ⚠️  Заготовка (не интегрирован)
├── converter/        ⚠️  Заготовка (не интегрирован)
├── librali/          ✅ Storage (books, covers, avatars, series)
└── requirements.txt  ✅ Dependencies
```

**Проблемы**:
- `books.py` смешивает бизнес-логику разных сущностей
- `vb_parser.py` содержит 3 разных парсера + утилиты
- Нет слоя сервисов
- Нет папки `tests/`
- Нет папки `migrations/` (используются автоматические миграции)

**Рекомендация**:
```
backend/
├── main.py
├── config.py
├── database.py
├── domains/                 # Разделение по доменам
│   ├── auth/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── models.py
│   ├── books/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── crud.py
│   │   ├── models.py
│   │   └── parser.py
│   ├── series/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── models.py
│   ├── social/
│   │   ├── router.py
│   │   └── service.py
│   └── tts/
│       ├── router.py
│       ├── service.py
│       ├── engines/
│       │   ├── cloud.py
│       │   ├── coqui.py
│       │   └── piper.py
│       └── types.py
├── parsers/                 # Парсинг файлов
│   ├── base.py
│   ├── fb2.py
│   ├── epub.py
│   ├── vblite.py
│   └── utils.py
├── llm/
│   ├── service.py
│   └── types.py
├── librali/                 # Storage
├── migrations/              # Alembic или ручные
├── tests/
│   ├── test_auth.py
│   ├── test_books.py
│   └── fixtures.py
└── requirements.txt
```

---

## 6. КРОСС-ЗАВИСИМОСТИ МЕЖДУ КОМПОНЕНТАМИ

### Граф зависимостей Backend

```
main.py
  ├→ database.py        (User, init_db, SessionLocal)
  ├→ auth.py            (routers, functions)
  ├→ books.py           (routers)
  ├→ tts/__init__.py    (get_tts_service, TTSService)
  └→ config.py          (TTS_MAX_LENGTH, TTS_CHUNK_SIZE)

books.py
  ├→ database.py        (Series, Book, Comment, Like, Subscription, Notification, get_db)
  ├→ auth.py            (require_user, get_current_user, require_admin)
  ├→ vb_parser.py       (parse_vb, parse_fb2, extract_plain_text, extract_cover)
  └→ config.py          (MAX_FILE_SIZE, MAX_FILE_SIZE_MB)

auth.py
  └→ database.py        (User, get_db)

vb_parser.py
  └→ NO INTERNAL DEPS   (использует only lxml, beautifulsoup4)

tts/service.py
  ├→ tts/cloud.py       (conditionally imported)
  ├→ config.py          (TTS_ENGINE)
  └→ logging

tts/cloud.py
  └→ edge-tts           (external)

database.py
  └→ NO INTERNAL DEPS   (использует only sqlalchemy)
```

### Проблемы в графе

1. **Циклических зависимостей**: НЕТУ (хорошо!)
2. **Неявные зависимости**: 
   - `books.py` не импортирует `get_current_user` явно в некоторых местах
   - `config.py` не используется последовательно (некоторые настройки в `main.py`)

3. **Недостаточная модульность**:
   - `books.py` знает о 8+ моделях БД
   - `vb_parser.py` может вызваться из разных мест

### Граф зависимостей Frontend

```
layout.tsx
  └→ globals.css

page.tsx (Home)
  ├→ Navbar
  ├→ api.ts        (apiPreviewBook, apiGetPublicBooks, etc.)
  └→ useRouter     (Next.js)

/reader/[id]/page.tsx
  ├→ api.ts        (apiGetBook, apiGetBookText, apiGetBookStructured, apiSynthesizeChunk)
  ├→ Navbar
  └→ (inline styles)

/login/page.tsx, /register/page.tsx
  ├→ api.ts        (apiLogin, apiRegister)
  └→ useRouter

/public/page.tsx
  ├→ api.ts        (apiGetPublicBooks, apiSearchBooks)
  ├→ GenreSelector
  └→ Navbar

/admin/page.tsx
  ├→ api.ts        (apiGetPublicBooks, apiSetUserRole, apiSetUserPlus, apiBanUser)
  └→ Navbar

api.ts
  └→ NO DEPS       (все функции self-contained)

GenreSelector.tsx
  └→ genres.ts

Navbar.tsx
  ├→ api.ts        (apiGetMe, apiGetUser, etc.)
  └→ useRouter
```

**Хорошо**: Все страницы зависят от единого API (`lib/api.ts`)
**Плохо**: Нет других компонентов для переиспользования

---

## 7. ПРОБЛЕМЫ АРХИТЕКТУРЫ

### 🔴 КРИТИЧЕСКИЕ

1. **Монолитный книги модуль**
   - 1,851 строк кода в одном файле
   - 61 функция
   - Смешанные ответственности (CRUD, search, social)
   - Сложно тестировать

2. **Отсутствие слоя сервисов**
   - Бизнес-логика прямо в routers
   - Нет переиспользования кода
   - Сложно интегрировать новые backends (например, базы данных)

3. **TTS состояние в памяти**
   - Синглтон в `tts/__init__.py`
   - Может быть потеря состояния в асинхронной среде
   - Нет пула моделей

### 🟠 ВАЖНЫЕ

4. **Парсинг файлов в критическом пути**
   - Нет timeout-ов
   - Большие файлы могут зависнуть сервер
   - Нет async парсинга

5. **Нет кеширования**
   - Каждый запрос читает файл с диска
   - Поиск пересчитывается каждый раз
   - Нет Redis или in-memory cache

6. **Отсутствие логирования операций**
   - Нет audit trail для admin действий
   - Нет tracking пользовательских действий
   - Сложно отследить проблемы

7. **Недостаточно type-safety в Frontend**
   - `api.ts` использует `any` для payload/response
   - Нет Zod или другой валидации на клиенте
   - Runtime ошибки возможны при изменении API

### 🟡 РЕКОМЕНДАЦИИ

8. **Тестирование**
   - Нет папки `tests/`
   - Нет unit/integration тестов
   - Невозможно рефакторить с уверенностью

9. **Documentation**
   - Нет docstrings в коде
   - Нет комментариев для сложной логики (FB2 парсинг)
   - API документация только через Swagger

10. **Error Handling**
    - Мало специфичных exception классов
    - Generic HTTPException везде

---

## 8. РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ

### Фаза 1: Критическая рефакторизация (1-2 недели)

1. **Разделить `books.py` на 5 файлов**
   ```
   books/
   ├── router.py (только маршруты)
   ├── service.py (бизнес-логика)
   ├── crud.py (операции с БД)
   ├── models.py (Pydantic schemas)
   └── parser.py (парсинг файлов)
   ```
   - Выгода: -30% строк, +200% maintainability

2. **Создать слой сервисов**
   ```
   domains/
   ├── auth/
   │   ├── service.py (authenticate, create_user, etc.)
   │   └── router.py (только HTTP)
   ├── books/
   │   ├── service.py (search, upload, delete, etc.)
   │   └── router.py
   └── ...
   ```

3. **Разделить `vb_parser.py`**
   ```
   parsers/
   ├── base.py (Parser ABC)
   ├── fb2.py (FB2Parser)
   ├── epub.py (EPUBParser)
   └── vblite.py (VBLiteParser)
   ```

### Фаза 2: Оптимизация производительности (1 неделя)

4. **Добавить кеширование**
   - Redis для горячих данных (популярные книги, профили авторов)
   - In-memory cache для результатов поиска
   - HTTP кеш-заголовки для статического контента

5. **Async парсинг файлов**
   - Использовать `asyncio` для I/O операций
   - Thread pool для CPU-bound парсинга

6. **Индексирование**
   - Полнотекстовый индекс FTS для поиска уже есть
   - Добавить индексы для часто используемых полей (genre, author)

### Фаза 3: Улучшение quality (1 неделя)

7. **Тестирование**
   - Pytest для backend (unit tests)
   - Jest для frontend (component tests)
   - Минимум 50% покрытие критических путей

8. **Type Safety**
   - Zod на frontend для валидации response
   - Pydantic на backend (уже используется)

9. **Логирование**
   - Структурированное логирование (JSON)
   - Audit trail для admin операций
   - Performance monitoring

### Фаза 4: Production Readiness (1 неделя)

10. **Deployment**
    - Dockerfile для backend и frontend
    - docker-compose для локального development
    - CI/CD pipeline (GitHub Actions)
    - Миграции базы данных (Alembic)

11. **Security**
    - Rate limiting на endpoints
    - CSRF protection
    - Input validation (уже есть Pydantic)
    - SQL injection prevention (SQLAlchemy уже защищает)

12. **Monitoring**
    - Error tracking (Sentry)
    - APM (Application Performance Monitoring)
    - Log aggregation (ELK stack)

---

## ИТОГОВАЯ СВОДКА

| Аспект | Статус | Оценка | Комментарий |
|--------|--------|--------|-----------|
| **Архитектура** | ⚠️ Нужен рефактор | 6/10 | Монолитный, требует разделения |
| **Code Quality** | ⚠️ Средняя | 6/10 | Дублирования, мало тестов |
| **Performance** | ⚠️ Приемлемая | 6/10 | Нет кеша, парсинг синхронный |
| **Security** | ✅ Исправлено | 8/10 | Критические ошибки fixed |
| **Scalability** | 🔴 Плохая | 4/10 | Монолит, не готов к нагрузке |
| **Maintainability** | 🔴 Трудная | 5/10 | Большие файлы, мало docs |
| **Testing** | 🔴 Отсутствует | 0/10 | Нет tests вообще |
| **Documentation** | ⚠️ Базовая | 6/10 | PROJECT_MAP.md есть, но мало docstrings |

**Общая оценка**: 5.6/10 - приемлемо для MVP, требует рефакторинга перед production

**Рекомендуемое время на улучшения**: 4-5 недель для полного цикла улучшений

---

