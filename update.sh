#!/usr/bin/env bash
# Hot-reload code inside a running container by pulling latest from GitHub.
#
# Usage (from inside the container):
#   bash /app/update.sh
#
# This pulls the latest code and restarts both backend and frontend.
set -euo pipefail

# Resolve repo root: /workspace (devcontainer) or /app (production Docker)
if [ -d /workspace/.git ]; then
  APP_DIR=/workspace
elif [ -d /app/.git ]; then
  APP_DIR=/app
else
  echo "ERROR: Cannot find git repo at /workspace or /app"
  exit 1
fi

cd "$APP_DIR"

echo "==> Pulling latest code (from $APP_DIR)..."
git fetch origin master
git reset --hard origin/master

echo "==> Installing any new Python dependencies..."
pip install --no-cache-dir --user -q -r requirements.txt 2>/dev/null || true
pip install --no-cache-dir --user -q -r backend/requirements.txt 2>/dev/null || true

echo "==> Installing any new frontend dependencies..."
cd "$APP_DIR/orchestra-dashboard"
npm ci --silent 2>/dev/null || true

echo "==> Restarting backend..."
pkill -f 'python -m backend.run' 2>/dev/null || true
sleep 1
cd "$APP_DIR"
nohup python -m backend.run > /tmp/backend.log 2>&1 &

echo "==> Done! Backend restarted. Frontend (Vite) hot-reloads automatically."
echo "    Check /tmp/backend.log for backend output."
