# Fox Reader - Fast Setup Guide
*Minimal commands to get the project running quickly*

## Prerequisites
- Python 3.12+
- Node.js 18+
- macOS/Linux/Windows

## Fastest Startup (Full Stack)
### Linux/macOS
```bash
chmod +x run.sh
./run.sh --dev
```
Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- Default admin: `admin` / `admin`

### Windows
```cmd
start.bat start
```

## Minimal Startup (Separate Components)
### Backend Only
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Only
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on port 3000, proxies API requests to backend via `next.config.js`.

## Healthcheck Steps
1. **Backend health**:
   ```bash
   curl http://localhost:8000/api/health
   # Expected: {"status": "ok", "app": "Fox Reader"}
   ```
2. **Frontend load**:
   Open http://localhost:3000 - should load without white screen
3. **API docs**:
   Open http://localhost:8000/docs - Swagger UI should load
4. **Auth test**:
   ```bash
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=admin&password=admin"
   # Should return access_token
   ```

## Common Fixes
| Issue | Fix |
|-------|-----|
| White screen on frontend | `rm -rf frontend/.next` + restart frontend |
| Backend import errors | `pip install -r backend/requirements.txt` |
| TTS not working | `pip install --upgrade edge-tts` |
| Port 8000/3000 in use | Kill process: `lsof -i :8000` then `kill -9 <PID>` |
| Database locked | Delete `backend/fox_reader.db` (resets data) or check file permissions |
| Frontend API 404 | Verify `next.config.js` proxy: `/api/*` → `http://127.0.0.1:8000/api/*` |

## Known Issues
- TTS `pitch`/`rate` parameters have limited support in Edge TTS
- `sort_by=likes` on public books uses slow in-memory sorting for large datasets
- Animated GIF/webp covers require Plus user status
- `run.sh` may fail if `python3` is not in PATH (use `python` instead)
