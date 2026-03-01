#!/bin/bash
# Barbershop — start backend + frontend

ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "🔧 Starting Barbershop System..."

# ── Backend ────────────────────────────────────────────────────────────────
cd "$ROOT/backend"

# Copy .env from example if it doesn't exist yet
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "⚠️  Created backend/.env from .env.example — add your ANTHROPIC_API_KEY before using the WhatsApp agent."
fi

# Install Python deps if needed
if ! python -c "import fastapi" 2>/dev/null; then
  echo "📦 Installing Python dependencies..."
  pip install -r requirements.txt
fi

# Seed database if it doesn't exist
if [ ! -f barbershop.db ]; then
  echo "🌱 Seeding database..."
  python seed.py
fi

echo "🚀 Starting FastAPI backend on http://localhost:5000 ..."
uvicorn main:app --reload --port 5000 &
BACKEND_PID=$!

# ── Frontend ───────────────────────────────────────────────────────────────
cd "$ROOT/frontend"

echo "🖥️  Starting Next.js frontend on http://localhost:9000 ..."
npm run dev -- --port 9000 &
FRONTEND_PID=$!

echo ""
echo "✅ Barbershop is running!"
echo ""
echo "   🌐 Customer site   → http://localhost:9000"
echo "   📅 Book page       → http://localhost:9000/book"
echo "   🔧 Admin panel     → http://localhost:9000/admin"
echo "   📖 API docs        → http://localhost:5000/docs"
echo "   💬 WhatsApp hook   → http://localhost:5000/webhook/whatsapp"
echo ""
echo "   To test WhatsApp locally:"
echo "     1. ngrok http 5000"
echo "     2. Set Twilio webhook → https://<ngrok-id>.ngrok-free.app/webhook/whatsapp"
echo "     3. Add ANTHROPIC_API_KEY to backend/.env"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
