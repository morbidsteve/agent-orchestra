#!/usr/bin/env bash
# Hot-reload code inside a running container by pulling latest from GitHub.
#
# Usage (from inside the container):
#   bash /app/update.sh
#
# This pulls the latest code and restarts both backend and frontend.
set -euo pipefail

cd /app

echo "==> Pulling latest code..."
git fetch origin master
git reset --hard origin/master

echo "==> Installing any new Python dependencies..."
pip install --no-cache-dir -q -r requirements.txt 2>/dev/null || true
pip install --no-cache-dir -q -r backend/requirements.txt 2>/dev/null || true

echo "==> Installing any new frontend dependencies..."
cd /app/orchestra-dashboard
npm ci --silent 2>/dev/null || true

echo "==> Restarting backend..."
pkill -f 'python -m backend.run' 2>/dev/null || true
cd /app
nohup python -m backend.run > /tmp/backend.log 2>&1 &

echo "==> Done! Backend restarted. Frontend (Vite) hot-reloads automatically."
echo "    Check /tmp/backend.log for backend output."
