# Agent Orchestra — Production Container
# Runs both backend (port 8000) and frontend dev server (port 5173)

FROM node:22-slim AS frontend-deps

WORKDIR /app/orchestra-dashboard
COPY orchestra-dashboard/package.json orchestra-dashboard/package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------

FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl make nodejs npm gpg \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI (gh)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Python dependencies
COPY requirements.txt ./
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null; \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy full source
COPY . .

# Copy pre-installed node_modules from frontend-deps stage
COPY --from=frontend-deps /app/orchestra-dashboard/node_modules orchestra-dashboard/node_modules

# Bind to 0.0.0.0 so ports are accessible from the host
ENV BACKEND_HOST=0.0.0.0

# Expose backend + frontend ports
EXPOSE 8000 5173

# Start backend + frontend (Vite with --host to bind 0.0.0.0)
CMD bash -c 'python -m backend.run & cd orchestra-dashboard && npx vite --host 0.0.0.0'
