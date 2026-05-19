"""
Global configuration constants for the ML training pipeline.

All values derived from the project specification (requirements.md)
and verified against the actual WESAD dataset on disk.
"""

from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────
WESAD_DIR = Path(__file__).resolve().parent.parent / "datasets" / "WESAD"
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"

# ── Subjects ─────────────────────────────────────────────────────────────
# S2 through S17, excluding S12 (15 subjects total) — Spec Section 3
SUBJECTS = [f"S{i}" for i in range(2, 18) if i != 12]

# ── Sampling Rates (Hz) ─────────────────────────────────────────────────
# Wrist device rates from WESAD — Spec Section 3
SR_BVP = 64   # BVP / PPG
SR_EDA = 4    # Electrodermal activity
SR_TEMP = 4   # Skin temperature
SR_LABEL = 700  # Label array is at chest device rate (verified empirically)

# ── Windowing — Spec Section 6 ──────────────────────────────────────────
WINDOW_SEC = 60       # 60-second windows for training
OVERLAP_RATIO = 0.5   # 50% overlap

# ── Label Mapping — Spec Section 3 ──────────────────────────────────────
STRESS_LABEL = 2
NON_STRESS_LABELS = {1, 3, 4}
IGNORE_LABELS = {0, 5, 6, 7}

# Binary targets
LABEL_STRESS = 1
LABEL_NON_STRESS = 0

# ── Feature Names (ordered) — Spec Section 7 ────────────────────────────
HRV_FEATURES = ["mean_hr", "std_hr", "rmssd", "sdnn", "nn50", "pnn50"]
EDA_FEATURES = ["mean_eda", "std_eda", "slope_eda", "peak_count", "min_eda", "max_eda"]
TEMP_FEATURES = ["mean_temp", "std_temp", "slope_temp"]

FEATURE_NAMES = HRV_FEATURES + EDA_FEATURES + TEMP_FEATURES  # 15 total

# ── BVP Bandpass Filter — Spec Section 7.1 ──────────────────────────────
BVP_BANDPASS_LOW = 0.5   # Hz — corresponds to 30 BPM
BVP_BANDPASS_HIGH = 4.0  # Hz — corresponds to 240 BPM

# ── Model Training — Spec Sections 4, 9 ─────────────────────────────────
RANDOM_STATE = 42
N_ESTIMATORS = 100

# ── Serialization — Spec Section 11 ─────────────────────────────────────
PIPELINE_FILENAME = "stress_pipeline.joblib"
