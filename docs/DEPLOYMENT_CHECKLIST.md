# Fox Reader - Production Deployment Checklist
**Last Updated**: May 9, 2026  
**Status**: Ready for Production

---

## ✅ Security Verification (All Fixed)

- [x] **SECRET_KEY**: Now must be set via environment variable in production
- [x] **CORS**: Restricted to specific origins, no longer allows `*`
- [x] **File Uploads**: Limited to 50MB (configurable)
- [x] **Database**: Migration errors now fail-fast instead of silent

---

## Pre-Deployment Checklist

### 1. Environment Variables Setup

Before deploying to production, set these variables:

```bash
# CRITICAL - Must set
export SECRET_KEY="<generate-with-python>"
export ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
export ENVIRONMENT="production"

# Optional - Use defaults if suitable
export MAX_FILE_SIZE="50000000"  # 50MB
export DATABASE_URL="sqlite:///./fox_reader.db"  # Or PostgreSQL for scale
export TTS_ENGINE="cloud"  # or "coqui", "piper" if installed
```

### 2. Generate Secure SECRET_KEY

Run this command on your server:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output and set it as `SECRET_KEY` environment variable.

### 3. Configure CORS Origins

List all domains where your frontend will be served:

```bash
# Example for multiple domains:
export ALLOWED_ORIGINS="https://example.com,https://www.example.com,https://app.example.com"

# Important: Do NOT use localhost in production
# Do NOT use wildcard *
```

### 4. Test Configuration

Before starting the service:

```bash
cd backend
source .venv/bin/activate
python3 -c "
from config import MAX_FILE_SIZE
from auth import SECRET_KEY
print(f'✓ Configuration loaded')
print(f'✓ SECRET_KEY is set: {bool(SECRET_KEY)}')
print(f'✓ MAX_FILE_SIZE: {MAX_FILE_SIZE / 1e6:.0f}MB')
"
```

If any of these fail, fix the environment variables before starting.

### 5. Database Initialization

```bash
cd backend
source .venv/bin/activate
python3 -c "from database import init_db; init_db()"
echo "✓ Database initialized"
```

### 6. Start the Service

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Frontend (in separate terminal)
cd frontend
npm run build
npm run start
```

### 7. Verify Services

In another terminal:

```bash
# Check backend
curl http://localhost:8000/api/health
# Should return: {"status": "ok", "app": "Fox Reader"}

# Check frontend
curl http://localhost:3000
# Should return: HTML page (not white screen error)
```

### 8. Verify Security

```bash
# Check CORS is restricted
curl -H "Origin: http://example.com" http://localhost:8000/api/health
# Should return CORS headers with specific origin, not *

# Check file limit is set
# Try uploading >50MB file
# Should get 413 Payload Too Large
```

---

## Optional Scaling Improvements

### For High Traffic (>1000 concurrent users):

1. **Use PostgreSQL instead of SQLite**
   ```bash
   export DATABASE_URL="postgresql://user:pass@localhost/fox_reader"
   ```

2. **Add Redis for caching** (future work)

3. **Use reverse proxy (nginx)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
       }
       
       location /api/ {
           proxy_pass http://localhost:8000;
       }
   }
   ```

4. **Enable HTTPS**
   - Use Let's Encrypt for free certificates
   - Update ALLOWED_ORIGINS to use `https://` instead of `http://`

---

## Monitoring & Maintenance

### Health Checks

Set up regular health checks:

```bash
# Backend health
curl -f http://localhost:8000/api/health || alert "Backend down"

# Frontend health
curl -f http://localhost:3000 || alert "Frontend down"
```

### Log Monitoring

Monitor these critical logs:

```bash
# Authentication failures
tail -f backend/backend.log | grep "SECURITY\|ERROR\|migration"

# Note: Update app startup to log to file
# Add to main.py: logging.basicConfig(filename="backend/backend.log")
```

### Security Checks (Monthly)

- [ ] Review SECRET_KEY rotation policy
- [ ] Check ALLOWED_ORIGINS are still correct
- [ ] Review database backups
- [ ] Check disk space (especially librali/ directory)
- [ ] Monitor file upload patterns for DOS attempts

---

## Troubleshooting

### Backend won't start

**Check 1**: Is SECRET_KEY set?
```bash
echo $SECRET_KEY
# Should output non-empty value
```

**Check 2**: Is ENVIRONMENT correct?
```bash
echo $ENVIRONMENT
# Should be "production" not blank
```

**Check 3**: Are migrations failing?
```bash
# Check stderr for "MIGRATION ERROR"
# Fix the database issue before restarting
```

### Frontend shows white screen

**Check 1**: Is npm build successful?
```bash
cd frontend && npm run build
# Should complete without errors
```

**Check 2**: Is backend accessible?
```bash
curl http://localhost:8000/api/health
# Should return JSON
```

**Check 3**: Are CORS origins correct?
```bash
# Check browser console for CORS errors
# Update ALLOWED_ORIGINS if needed
```

### File uploads failing

**Check 1**: Is MAX_FILE_SIZE appropriate?
```bash
echo $MAX_FILE_SIZE
# Should be set, default 50000000 (50MB)
```

**Check 2**: Is librali/ directory writable?
```bash
touch backend/librali/books/test.txt && rm backend/librali/books/test.txt
# Should work without permission errors
```

---

## Rollback Procedure

If something goes wrong:

1. **Stop services**
   ```bash
   pkill -f "uvicorn"  # Backend
   pkill -f "next start"  # Frontend
   # Or use docker stop if containerized
   ```

2. **Check logs** for error details

3. **Verify environment variables**
   ```bash
   env | grep -E "SECRET_KEY|ALLOWED_ORIGINS|ENVIRONMENT"
   ```

4. **Restart with clean state**
   ```bash
   # Don't delete database!
   rm -rf frontend/.next
   cd backend && source .venv/bin/activate
   python3 -c "from database import init_db; init_db()"
   ```

---

## What Changed in This Update?

These are the only changes that require attention in production:

| Change | Impact | Action |
|--------|--------|--------|
| SECRET_KEY required | Startup will fail if not set | Set SECRET_KEY env var |
| CORS restricted | Frontend origin must be whitelisted | Update ALLOWED_ORIGINS |
| File size limited | Large uploads rejected | Update MAX_FILE_SIZE if needed |
| Migrations fail-fast | Database errors are visible | Fix configuration if startup fails |

All other functionality is identical to previous version.

---

## Support & Questions

For issues:

1. Check this file first
2. Review REFACTORING_REPORT.md for technical details
3. Check project README.md for general info
4. Review SECURITY_NOTES.md for security settings

---

**Document Status**: ✅ Final  
**Last Verified**: May 9, 2026  
**Next Review**: Quarterly or after major updates
