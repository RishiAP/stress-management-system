#!/usr/bin/env bash
# =============================================================================
# run.sh — One-command ML pipeline runner
# Usage:
#   ./run.sh          → full pipeline (first time)
#   ./run.sh fast     → skip feature extraction, use cached features
#   ./run.sh eval     → show train/test split + per-fold results
#   ./run.sh test     → run unit tests only
# =============================================================================

set -e  # stop on any error

VENV="venv"
FEATURES_CSV="results/features.csv"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[DONE]${NC} $*"; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}"; }

# ── Step 1: Create venv if missing ───────────────────────────────────────────
header "Environment"
if [ ! -d "$VENV" ]; then
    info "Creating virtual environment..."
    python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"

# ── Step 2: Install deps if missing ──────────────────────────────────────────
if ! python -c "import sklearn" 2>/dev/null; then
    info "Installing dependencies..."
    pip install -e ".[dev]" -q
else
    info "Dependencies already installed — skipping"
fi

# ── Step 3: Run tests ─────────────────────────────────────────────────────────
header "Unit Tests"
python -m pytest tests/ -q --tb=short
success "All tests passed"

if [ "$1" = "test" ]; then exit 0; fi

# ── Eval mode: show train/test split and per-fold results ─────────────────────
if [ "$1" = "eval" ]; then
    header "Evaluation (LOSO Train/Test Split)"
    python evaluate.py
    exit 0
fi

# ── Step 4: Train ─────────────────────────────────────────────────────────────
header "Training"
if [ "$1" = "fast" ] && [ -f "$FEATURES_CSV" ]; then
    info "Fast mode: loading cached features from $FEATURES_CSV"
    python -m src.main \
        --load-features "$FEATURES_CSV" \
        --skip-comparison \
        --model XGB \
        --strategy smote
else
    info "Full pipeline: extracting features from all 15 WESAD subjects..."
    python -m src.main \
        --model XGB \
        --strategy smote
fi

# ── Step 5: Verify artifact ───────────────────────────────────────────────────
header "Model Artifact"
python - <<'EOF'
import joblib, numpy as np

p = joblib.load("models/stress_pipeline.joblib")
steps = [name for name, _ in p.steps]

# Quick sanity inference
x = np.array([[72.5, 8.3, 42.1, 51.2, 12, 0.24,
               0.65, 0.12, 0.001, 3, 0.42, 0.91,
               33.5, 0.15, -0.002]])
proba = p.predict_proba(x)[0]

import os
size_mb = os.path.getsize("models/stress_pipeline.joblib") / 1e6

print(f"  Pipeline steps : {steps}")
print(f"  Model          : {type(p.named_steps['model']).__name__}")
print(f"  Artifact size  : {size_mb:.1f} MB")
print(f"  Test inference : stress_prob={proba[1]:.3f}")
EOF

echo ""
success "stress_pipeline.joblib is ready for Phase 2 (FastAPI)"
echo ""
echo -e "  ${BOLD}Outputs:${NC}"
echo "    models/stress_pipeline.joblib  ← deploy this"
echo "    results/loso_comparison.csv    ← model comparison metrics"
echo "    results/features.csv           ← cached features (fast rerun)"
