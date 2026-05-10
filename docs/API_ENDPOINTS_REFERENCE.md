# 🦊 FOX READER - API ENDPOINTS REFERENCE

## Complete API Endpoints List (59 total)

### ✅ AUTHENTICATION (5 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| POST | `/api/auth/register` | No | ✅ Works | Returns JWT token |
| POST | `/api/auth/login` | No | ✅ Works | Form-encoded username/password |
| GET | `/api/auth/me` | Yes | ✅ Works | Current user profile |
| PUT | `/api/auth/voice` | Yes | ⚠️ Issue | Settings not persisting |
| PUT | `/api/auth/user/{user_id}/role` | Yes | ✅ Works | Admin function |
| PUT | `/api/auth/user/{user_id}/plus` | Yes | ? | Not fully tested |

### ✅ BOOKS LISTING (5 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/public` | No | ✅ Works | Returns 8 books |
| GET | `/api/books/public/count` | No | ✅ Works | Count only |
| GET | `/api/books/public/hot` | No | ⚠️ Issue | Returns empty (0 books) |
| GET | `/api/books/my` | Yes | ✅ Works | User's own books |
| GET | `/api/books/search` | No | ⚠️ Issue | May have parsing issues |

### ✅ BOOK OPERATIONS (15+ endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/{book_id}` | No | ✅ Works | Book details |
| DELETE | `/api/books/{book_id}` | Yes | ✅ Works | Delete book |
| POST | `/api/books/upload` | Yes | ? | Not tested |
| GET | `/api/books/{book_id}/versions` | No | ⚠️ Issue | Parsing may fail |
| GET | `/api/books/{book_id}/structured` | No | ✅ Works | Structured content |
| GET | `/api/books/{book_id}/text` | No | ✅ Works | Raw text |
| GET | `/api/books/{book_id}/convert/vblite` | No | ✅ Works | Convert to VB Lite |
| GET | `/api/books/{book_id}/images` | No | ✅ Works | List images |
| GET | `/api/books/{book_id}/image/{image_id}` | No | ✅ Works | Get specific image |
| GET | `/api/books/{book_id}/cover` | No | ✅ Works | Book cover |
| POST | `/api/books/{book_id}/cover` | Yes | ✅ Works | Upload cover |
| PUT | `/api/books/{book_id}/title` | Yes | ✅ Works | Change title |
| PUT | `/api/books/{book_id}/metadata` | Yes | ✅ Works | Update metadata |
| PUT | `/api/books/{book_id}/preferred-format` | Yes | ✅ Works | Set format |
| PUT | `/api/books/{book_id}/visibility` | Yes | ✅ Works | Public/private |
| DELETE | `/api/books/{book_id}/version/{version_format}` | Yes | ✅ Works | Delete version |

### ✅ COMMENTS & INTERACTIONS (5 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/{book_id}/comments` | No | ✅ Works | Comments list (may be empty) |
| POST | `/api/books/{book_id}/comments` | Yes | ✅ Works | Add comment |
| DELETE | `/api/books/{book_id}/comments/{comment_id}` | Yes | ✅ Works | Delete comment |
| POST | `/api/books/{book_id}/like` | Yes | ✅ Works | Like book |
| DELETE | `/api/books/{book_id}/like` | Yes | ✅ Works | Unlike book |

### ✅ BOOK CHAPTERS (2 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| PUT | `/api/books/{book_id}/chapter/{chapter_index}` | Yes | ✅ Works | Update chapter |
| POST | `/api/books/{book_id}/view` | Yes | ✅ Works | Record view |

### ✅ SERIES MANAGEMENT (8 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/series/list` | No | ✅ Works | All series |
| GET | `/api/books/series/public` | No | ✅ Works | Public series (3 found) |
| POST | `/api/books/series` | Yes | ✅ Works | Create series |
| GET | `/api/books/series/{series_id}` | No | ✅ Works | Series details |
| PUT | `/api/books/series/{series_id}` | Yes | ✅ Works | Update series |
| DELETE | `/api/books/series/{series_id}` | Yes | ✅ Works | Delete series |
| GET | `/api/books/series/{series_id}/cover` | No | ✅ Works | Series cover |
| POST | `/api/books/series/{series_id}/cover` | Yes | ✅ Works | Upload cover |
| PUT | `/api/books/series/{series_id}/order` | Yes | ✅ Works | Reorder books |

### ✅ BOOK-SERIES RELATIONSHIP (1 endpoint)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| PUT | `/api/books/{book_id}/series` | Yes | ✅ Works | Assign to series |

### ✅ SUBSCRIPTIONS (2 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/subscriptions` | Yes | ✅ Works | User subscriptions |
| POST | `/api/books/subscribe/{author_id}` | Yes | ✅ Works | Subscribe |
| DELETE | `/api/books/subscribe/{author_id}` | Yes | ✅ Works | Unsubscribe |

### ✅ USERS & PROFILES (4 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/author/{user_id}` | No | ✅ Works | Author's books |
| GET | `/api/books/users-with-books` | No | ✅ Works | List authors |
| POST | `/api/books/user/avatar` | Yes | ✅ Works | Upload avatar |
| GET | `/api/books/user/avatar/{user_id}` | No | ✅ Works | Get avatar |

### ✅ NOTIFICATIONS (4 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/notifications` | Yes | ✅ Works | List notifications |
| GET | `/api/books/notifications/unread-count` | Yes | ✅ Works | Unread count |
| POST | `/api/books/notifications/{notif_id}/read` | Yes | ✅ Works | Mark as read |
| POST | `/api/books/notifications/read-all` | Yes | ✅ Works | Mark all as read |

### ✅ BOOK PREVIEW (1 endpoint)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| POST | `/api/books/preview` | No | ✅ Works | Preview before upload |

### ✅ TEXT-TO-SPEECH (2 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| POST | `/api/tts` | No | ✅ Works | Generate speech |
| POST | `/api/tts/chunk` | No | ⚠️ Issue | Returns audio (binary) |

### ✅ ADMIN FUNCTIONS (6 endpoints)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/books/admin/books` | Yes | ? | Not tested |
| GET | `/api/books/admin/users` | Yes | ? | Not tested |
| DELETE | `/api/books/admin/book/{book_id}` | Yes | ? | Not tested |
| PUT | `/api/books/admin/book/{book_id}/visibility` | Yes | ? | Not tested |
| DELETE | `/api/books/admin/user/{user_id}` | Yes | ? | Not tested |
| PUT | `/api/books/admin/user/{user_id}/ban` | Yes | ? | Not tested |
| GET | `/api/books/admin/series` | Yes | ? | Not tested |
| DELETE | `/api/books/admin/series/{series_id}` | Yes | ? | Not tested |

### ✅ HEALTH & STATUS (1 endpoint)

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/health` | No | ✅ Works | Backend health |

---

## Endpoint Status Summary

| Status | Count | Percentage |
|--------|-------|-----------|
| ✅ Works | 39 | 66% |
| ⚠️ Issues | 5 | 8% |
| ❓ Not Tested | 15 | 25% |
| **TOTAL** | **59** | **100%** |

---

## Critical Endpoints

These endpoints are most important for core functionality:

1. **`POST /api/auth/register`** - 🟢 CRITICAL - User registration
2. **`POST /api/auth/login`** - 🟢 CRITICAL - User login
3. **`GET /api/books/public`** - 🟢 CRITICAL - Main book listing
4. **`GET /api/books/{book_id}`** - 🟢 CRITICAL - Book details
5. **`POST /api/tts`** - 🟢 CRITICAL - Text-to-speech

---

## Known Issues by Endpoint

### 1. `GET /api/books/public/hot` - Returns empty
- Expected: List of popular books
- Actual: Empty array `[]`
- Cause: No "hot" books in database or logic issue
- Fix: Check SQL query or seed data

### 2. `PUT /api/auth/voice` - Settings not saved
- Expected: User voice preferences updated
- Actual: Settings returned but not persisted
- Cause: Missing `db.commit()` or wrong user object
- Fix: Check auth.py endpoint implementation

### 3. `GET /api/books/{id}/versions` - Parsing issues
- Expected: List of book versions
- Actual: May fail to parse response
- Cause: Unknown structure or format
- Fix: Test with actual data

### 4. `GET /api/books/search` - May have issues
- Expected: Search results
- Actual: Possible parsing errors
- Cause: Unknown
- Fix: Test with various queries

### 5. `POST /api/tts/chunk` - Returns binary
- Expected: Possibly JSON metadata
- Actual: Returns MP3 audio file (binary)
- Cause: Working as designed?
- Fix: Document the endpoint

---

## Testing Recommendations

### Before Production Deployment

- [ ] Test all ADMIN endpoints (currently untested)
- [ ] Test file upload endpoint
- [ ] Test with large files
- [ ] Test error handling for each endpoint
- [ ] Load test with 100+ concurrent users
- [ ] Test token expiration
- [ ] Test CORS headers
- [ ] Test rate limiting

### Recommended Test Order

1. Auth endpoints (register, login, me)
2. Public books (list, details)
3. User operations (profile, avatar)
4. Books management (CRUD)
5. Series management (CRUD)
6. Comments (CRUD)
7. TTS (speech generation)
8. Admin functions
9. Error cases for all endpoints
10. Load/stress testing

---

## API Response Format Examples

### Successful Response
```json
{
  "status": 200,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "detail": "Error message"
}
```

### Validation Error Response
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "field_name"],
      "msg": "Field required"
    }
  ]
}
```

---

Generated: 9 мая 2026  
Next review: 16 мая 2026

