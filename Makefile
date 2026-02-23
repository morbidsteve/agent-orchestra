.PHONY: setup dev test lint build check clean stop

VENV := .venv
BACKEND := backend
FRONTEND := orchestra-dashboard
PID_FILE := .backend.pid

# Detect uv, fall back to pip
UV := $(shell command -v uv 2>/dev/null)
ifdef UV
  PIP_INSTALL = uv pip install --python $(VENV)/bin/python
  VENV_CREATE = uv venv $(VENV)
else
  PIP_INSTALL = $(VENV)/bin/pip install
  VENV_CREATE = python3 -m venv $(VENV)
endif

## setup: Install all dependencies (Python venv + Node modules)
setup: $(VENV)/bin/activate
	$(PIP_INSTALL) -r requirements.txt
	$(PIP_INSTALL) -r $(BACKEND)/requirements.txt
	cd $(FRONTEND) && npm install

$(VENV)/bin/activate:
	$(VENV_CREATE)

## dev: Start backend (background) + frontend (foreground)
dev: stop
	cd $(BACKEND) && ../$(VENV)/bin/python run.py & echo $$! > $(PID_FILE)
	@echo "Backend starting on http://localhost:8000"
	@echo "Frontend starting on http://localhost:5173"
	cd $(FRONTEND) && npm run dev; $(MAKE) stop

## test: Run frontend tests
test:
	cd $(FRONTEND) && npm test

## lint: Run ESLint + TypeScript type check
lint:
	cd $(FRONTEND) && npm run lint
	cd $(FRONTEND) && npx tsc -b --noEmit

## build: Production build of the frontend
build:
	cd $(FRONTEND) && npm run build

## check: Run all quality gates (test + lint + build)
check: test lint build

## clean: Remove generated artifacts
clean: stop
	rm -rf $(VENV)
	rm -rf $(FRONTEND)/node_modules
	rm -rf $(FRONTEND)/dist
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

## stop: Kill running backend server
stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null || true; \
		rm -f $(PID_FILE); \
		echo "Backend stopped"; \
	fi
