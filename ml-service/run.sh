#!/usr/bin/env bash
# =============================================================================
# run.sh — One-command ML inference service runner
#
# Usage:
#   bash run.sh          → setup + start dev server (port 8000)
#   bash run.sh test     → setup + run all tests
#   bash run.sh freeze   → generate pinned requirements.txt for Render
# =============================================================================

set -e

VENV="venv"
ENV_FILE=".env"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[DONE]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}"; }

# ── Step 1: Create venv if missing ───────────────────────────────────────────
header "Environment"
if [ ! -d "$VENV" ]; then
    info "Creating virtual environment..."
    python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"

# ── Step 2: Install deps if missing ──────────────────────────────────────────
if ! python -c "import fastapi" 2>/dev/null; then
    info "Installing dependencies..."
    pip install -e ".[dev]" -q
else
    info "Dependencies already installed — skipping"
fi

# ── Step 3: Create .env if missing ───────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    info "Creating default .env for local development..."
    API_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
    cat > "$ENV_FILE" <<EOF
# Local development environment — NEVER commit this file
HF_REPO_ID=RishiAP/stress-detection-pipeline
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
API_KEY=$API_KEY
EOF
    success ".env created with auto-generated API key"
    echo ""
    echo -e "  ${BOLD}Your local API key:${NC} $API_KEY"
    echo "  Use this in X-API-Key header when testing /predict"
    echo ""
fi

# ── Load env vars from .env ──────────────────────────────────────────────────
set -a
source "$ENV_FILE"
set +a
info "Loaded env vars from .env"

# ── Handle modes ─────────────────────────────────────────────────────────────
if [ "$1" = "test" ]; then
    header "Running Tests"
    python -m pytest tests/ -v --tb=short
    success "All tests passed"
    exit 0
fi

if [ "$1" = "freeze" ]; then
    header "Generating requirements.txt"
    pip freeze > requirements.txt
    success "requirements.txt generated ($(wc -l < requirements.txt) packages)"
    exit 0
fi

# ── Default: Start dev server ────────────────────────────────────────────────
header "Starting Dev Server"
info "Server: http://localhost:8000"
info "Docs:   http://localhost:8000/docs"
info "Health: http://localhost:8000/health"
echo ""
uvicorn app.main:app --reload --port 8000
