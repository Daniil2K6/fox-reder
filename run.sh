#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_MODE="${1:-}"

echo "=== Fox Reader Setup ==="

# Backend setup - create venv if not exists
if [ ! -f "$SCRIPT_DIR/backend/.venv/bin/activate" ]; then
    echo "[1/5] Creating Python virtual environment..."
    python3 -m venv "$SCRIPT_DIR/backend/.venv"
fi

echo "[2/5] Installing Python dependencies..."
source "$SCRIPT_DIR/backend/.venv/bin/activate"
pip install --upgrade pip -q
pip install -r "$SCRIPT_DIR/backend/requirements.txt" -q 2>&1

# Frontend setup
echo "[3/5] Installing Node dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install 2>&1

if [ "$DEV_MODE" = "--dev" ]; then
    echo "[4/4] Starting Fox Reader in DEV mode..."
    echo ""
    echo "Backend:  http://localhost:8000"
    echo "Frontend: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""

    cd "$SCRIPT_DIR/backend"
    source "$SCRIPT_DIR/backend/.venv/bin/activate"
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!

    cd "$SCRIPT_DIR/frontend"
    npm run dev &
    FRONTEND_PID=$!
else
    # Build frontend
    echo "[4/5] Building frontend..."
    npm run build 2>&1

    # Start services
    echo "[5/5] Starting Fox Reader..."
    echo ""
    echo "Backend:  http://localhost:8000"
    echo "Frontend: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""

    cd "$SCRIPT_DIR/backend"
    source "$SCRIPT_DIR/backend/.venv/bin/activate"
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!

    cd "$SCRIPT_DIR/frontend"
    npm run start &
    FRONTEND_PID=$!
fi

cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "Goodbye!"
}
trap cleanup EXIT INT TERM

wait
