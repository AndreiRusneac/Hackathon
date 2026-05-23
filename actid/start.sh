#!/bin/bash
# A
# ctID — Local dev starter (no Docker needed)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "🇷🇴 ActID — Starting local dev..."

# Kill any existing processes on our ports
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Install backend deps if needed
echo "📦 Checking backend deps..."
pip install -q "python-jose[cryptography]" bcrypt python-multipart pydantic pydantic-settings fastapi "uvicorn[standard]" sqlalchemy aiofiles 2>/dev/null

# Install frontend deps if needed
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "📦 Installing frontend deps..."
  cd "$FRONTEND" && npm install --silent
fi

# Start backend
echo "🚀 Starting backend on http://localhost:8000 ..."
cd "$BACKEND" && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ Backend ready!"
    break
  fi
  sleep 1
done

# Start frontend
echo "🚀 Starting frontend on http://localhost:5173 ..."
cd "$FRONTEND" && VITE_API_URL=http://localhost:8000 npm run dev &
FRONTEND_PID=$!

sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🪪  ActID is running!"
echo ""
echo "  App:    http://localhost:5173"
echo "  API:    http://localhost:8000"
echo "  Docs:   http://localhost:8000/docs"
echo ""
echo "  Demo accounts (parolă: Parola@123):"
echo "  → ion.popescu@gmail.com      (CI expiră în 30 zile)"
echo "  → alex.ionescu@gmail.com     (diaspora Londra)"
echo "  → functionar@spclep.ro       (funcționar)"
echo "  2FA code: 123456"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait and clean up on exit
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
