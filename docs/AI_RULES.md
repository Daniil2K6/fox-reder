# Fox Reader - AI Development Rules
*Strict rules to prevent hallucinations, dependency chaos, and wasted tokens*

## Core Rules (NEVER VIOLATE)
1. **NEVER guess model fields** - Always inspect `backend/database.py` before modifying endpoints or frontend interfaces
2. **NEVER guess API structures** - All API functions are defined in `frontend/src/lib/api.ts` for frontend, `backend/books.py`/`backend/auth.py` for backend
3. **NEVER install random dependencies** - Only add to `backend/requirements.txt` or `frontend/package.json` if explicitly required by new code
4. **NEVER rewrite architecture without approval** - This is a stable FastAPI + Next.js stack, do not migrate frameworks
5. **NEVER spam shell commands** - Batch independent commands, avoid recursive greps without a plan
6. **Prefer existing code** - Reuse parsers in `backend/vb_parser.py`, API functions in `frontend/src/lib/api.ts`, models in `backend/database.py`
7. **Verify before editing** - Read full file content before making changes, use exact string matches for edits

## Workflow Checklists
### Backend Task Checklist
- [ ] Inspect relevant model in `backend/database.py` (field names, types, relationships)
- [ ] Check existing endpoints in `backend/books.py` or `backend/auth.py` for similar patterns
- [ ] Verify Pydantic response models (e.g., `BookOut`, `UserOut`) match database fields
- [ ] Test endpoint via Swagger UI at `http://localhost:8000/docs`
- [ ] Verify backend health: `curl http://localhost:8000/api/health`

### Frontend Task Checklist
- [ ] Check existing API functions in `frontend/src/lib/api.ts` before creating new ones
- [ ] Verify Next.js App Router page structure in `frontend/src/app/`
- [ ] Reuse existing components in `frontend/src/components/`
- [ ] Test frontend: `http://localhost:3000` (check for white screen errors)
- [ ] Verify API proxy in `frontend/next.config.js` (all `/api/*` routes to backend)

### Database Task Checklist
- [ ] Inspect `backend/database.py` for existing models and relationships
- [ ] Check `init_db()` function for existing migrations before adding new ones
- [ ] Use SQLite `fox_reader.db` directly for quick checks: `sqlite3 backend/fox_reader.db ".schema"`
- [ ] Never drop tables - use additive migrations only

### API Task Checklist
- [ ] Check `frontend/src/lib/api.ts` for existing client functions
- [ ] Verify backend router prefix (auth: `/api/auth`, books: `/api/books`)
- [ ] Test endpoint via Swagger UI before modifying frontend
- [ ] Ensure JWT token is included for protected routes (handled automatically by `api.ts` `request()` function)

## Anti-Patterns to Avoid
- ❌ Creating new API endpoints when existing ones can be extended
- ❌ Modifying `backend/config.py` paths without updating `LIBRALI_DIR` references
- ❌ Forgetting to update both `BookOut` (backend) and frontend Book interface when adding book fields
- ❌ Using `any` type in TypeScript without explicit justification
- ❌ Committing `backend/fox_reader.db` or `frontend/.next/` builds
- ❌ Ignoring CORS settings in `backend/main.py` when adding new API routes

## Emergency Fixes
- **White screen on frontend**: Clear Next.js cache: `rm -rf frontend/.next`
- **TTS not working**: Check Edge TTS installation: `pip show edge-tts`
- **Database errors**: Check `backend/fox_reader.db` permissions
- **Auth failures**: Clear localStorage: `localStorage.clear()` in browser console
