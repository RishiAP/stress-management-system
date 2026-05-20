#!/usr/bin/env bash
# =============================================================================
# upload_model.sh — Upload stress_pipeline.joblib to Hugging Face Hub
#
# Usage:
#   bash upload_model.sh
#
# Prerequisites:
#   - Model trained: models/stress_pipeline.joblib must exist
#   - HuggingFace account: https://huggingface.co (free)
#   - First run: will prompt for HF login token
# =============================================================================

set -e

VENV="venv"
MODELS_DIR="models"
HF_REPO="RishiAP/stress-detection-pipeline"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'
BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[DONE]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Check models folder exists ──────────────────────────────────────────────
if [ ! -d "$MODELS_DIR" ]; then
    error "Models directory not found at $MODELS_DIR. Run 'bash run.sh' first to train."
fi

if [ ! -f "$MODELS_DIR/stress_pipeline.joblib" ]; then
    error "Model file not found at $MODELS_DIR/stress_pipeline.joblib. Run 'bash run.sh' first to train."
fi

# ── Activate venv ────────────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
    error "Virtual environment not found. Run 'bash run.sh' first."
fi
source "$VENV/bin/activate"

# ── Install dependencies if needed ───────────────────────────────────────────
if ! python -c "import huggingface_hub" 2>/dev/null; then
    info "Installing huggingface_hub..."
    pip install huggingface_hub -q
fi

# ── Run Python Upload Script ──────────────────────────────────────────────────
python upload_model.py

