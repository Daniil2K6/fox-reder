# Database Schema

**Engine:** SQLite / PostgreSQL  
**ORM:** SQLAlchemy 2.0  
**File:** `backend/fox_reader.db`

---

## Entity-Relationship Diagram (textual)

```
┌───────────────┐       ┌──────────────────┐
│     User      │       │      Book        │
├───────────────┤       ├──────────────────┤
│ id (PK)       │       │ id (PK)          │
│ username      │       │ title            │
│ hashed_pass   │       │ filename         │
│ role          │       │ sha256 (idx)     │
│ is_plus       │       │ file_path        │
│ is_banned     │       │ is_public        │
│ preferred_    │       │ owner_id (FK)→User│
│  voice/lang   │       │ genres           │
│ voice_pitch   │       │ description      │
│ voice_rate    │       │ original_lang    │
│ voice_volume  │       │ is_translated    │
│ avatar_url    │       │ view_count       │
└───────┬───────┘       │ group_id         │
        │               │ preferred_format │
        │               └────────┬─────────┘
        │ 1                     N│
        │  ──────────────────────┘
        │
        │ 1                     N
        ├──────────────────────────┐
        │ 1                     N │
        ├───────────────────────┐ │
        │                      │ │
        ▼                      ▼ ▼
┌───────────────┐    ┌──────────────────┐
│ Subscription  │    │    BookVersion   │
├───────────────┤    ├──────────────────┤
│ id (PK)       │    │ id (PK)          │
│ subscriber_id │    │ book_id (FK)→Book│
│   (FK)→User   │    │ format           │
│ author_id     │    │ file_path        │
│   (FK)→User   │    │ sha256           │
│ (unique pair) │    │ filename         │
└───────────────┘    └──────────────────┘

┌───────────────┐    ┌──────────────────┐
│  Notification │    │      Like        │
├───────────────┤    ├──────────────────┤
│ id (PK)       │    │ id (PK)          │
│ user_id (FK)  │    │ user_id (FK)→User│
│ type          │    │ book_id (FK)→Book│
│ message       │    │ (unique pair)    │
│ link          │    └──────────────────┘
│ is_read       │
│ created_at    │    ┌──────────────────┐
└───────────────┘    │     Comment      │
                     ├──────────────────┤
┌───────────────┐    │ id (PK)          │
│    Series     │    │ book_id (FK)→Book│
├───────────────┤    │ user_id (FK)→User│
│ id (PK)       │    │ content          │
│ name          │    └──────────────────┘
│ owner_id (FK) │
│ cover_image   │    ┌──────────────────┐
│ common_genres │    │   book_series    │
└───────┬───────┘    │ (association)    │
        │            ├──────────────────┤
        │            │ book_id (FK)→Book│
        └───M────────│ series_id(FK)→Ser│
                     │ order_index      │
                     └──────────────────┘
```

---

## Table Details

### `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | Integer | PK, auto | |
| username | String(64) | UNIQUE, NOT NULL, indexed | |
| hashed_password | String | NOT NULL | bcrypt hash |
| role | String | default "user" | "user" or "admin" |
| is_plus | Boolean | default False | animated covers |
| is_banned | Boolean | default False | |
| preferred_voice | String | nullable | |
| preferred_language | String | nullable | |
| voice_pitch | Float | nullable | |
| voice_rate | Float | nullable | |
| voice_volume | Float | nullable | |
| avatar_url | String | nullable | |

### `books`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | Integer | PK, auto | |
| title | String | NOT NULL | |
| filename | String | NOT NULL | original filename |
| sha256 | String | indexed | deduplication |
| file_path | String | NOT NULL | relative to librali/ |
| is_public | Boolean | default False | |
| owner_id | Integer | FK → users.id | |
| genres | String | nullable | comma-separated |
| description | Text | nullable | |
| original_language | String | nullable | |
| is_translated | Boolean | default False | |
| view_count | Integer | default 0 | |
| group_id | Integer | nullable | related books group |
| preferred_format | String | nullable | |

### `book_versions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | Integer | PK, auto | |
| book_id | Integer | FK → books.id | |
| format | String | NOT NULL | fb2/epub/txt/vb/vblite |
| file_path | String | NOT NULL | |
| sha256 | String | NOT NULL | |
| filename | String | NOT NULL | |

### `series`

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, auto |
| name | String | NOT NULL |
| owner_id | Integer | FK → users.id |
| cover_image | String | nullable |
| common_genres | String | nullable |

### `book_series` (association)

| Column | Type | Constraints |
|--------|------|-------------|
| book_id | Integer | PK, FK → books.id |
| series_id | Integer | PK, FK → series.id |
| order_index | Integer | default 0 |

### `likes`

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, auto |
| user_id | Integer | FK → users.id |
| book_id | Integer | FK → books.id |
| *(unique)* | | (user_id, book_id) |

### `comments`

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, auto |
| book_id | Integer | FK → books.id |
| user_id | Integer | FK → users.id |
| content | Text | NOT NULL |

### `subscriptions`

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, auto |
| subscriber_id | Integer | FK → users.id |
| author_id | Integer | FK → users.id |
| *(unique)* | | (subscriber_id, author_id) |

### `notifications`

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, auto |
| user_id | Integer | FK → users.id |
| type | String | NOT NULL |
| message | String | NOT NULL |
| link | String | nullable |
| is_read | Boolean | default False |
| created_at | DateTime | default now |
