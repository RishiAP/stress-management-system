# ML Training Pipeline — Hybrid Stress System

Phase 1 of the hybrid stress detection system: WESAD data loading,
feature extraction, LOSO cross-validation, and model serialization.

## Project Structure

```
ml/
├── pyproject.toml          # Project metadata + dependencies
├── requirements.txt        # Pinned versions for Render deployment
├── src/
│   ├── config.py           # All constants (paths, rates, feature names)
│   ├── data_loader.py      # WESAD pickle loading + label downsampling
│   ├── preprocessing.py    # BVP bandpass, EDA lowpass, TEMP median filter
│   ├── windowing.py        # 60s/50% overlap windowing + label assignment
│   ├── feature_matrix.py   # Per-subject pipeline orchestrator
│   ├── evaluation.py       # LOSO CV × 3 models × 3 strategies
│   ├── train.py            # Final model training + joblib serialization
│   ├── main.py             # CLI entry point
│   └── features/
│       ├── hrv.py          # BVP → 6 HRV features
│       ├── eda.py          # EDA → 6 features
│       └── temperature.py  # TEMP → 3 features
├── tests/
│   └── test_pipeline.py    # 27 unit + integration tests
├── datasets/WESAD/         # WESAD dataset (not committed)
├── models/                 # Serialized pipeline artifacts
└── results/                # CSV metrics + feature cache
```

## Quick Start (Fish Shell)

```fish
# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate.fish

# 2. Install all dependencies
pip install -e ".[dev]"

# 3. Run unit tests (verifies all modules)
python -m pytest tests/ -v

# 4. Run the full pipeline (feature extraction + LOSO + train)
python -m src.main
```

## All Run Modes

### Full pipeline (first time — extracts features from all 15 subjects)
```fish
python -m src.main
```
- Processes all 15 WESAD subjects (~2 min on i3-1115G4)
- Runs 9-experiment LOSO comparison (RF/XGB/LGBM × none/weighted/SMOTE)
- Trains final RF+weighted model on all subjects
- Saves `models/stress_pipeline.joblib` and `results/loso_comparison.csv`

### Fast retrain (skip feature extraction, use cached CSV)
```fish
python -m src.main --load-features results/features.csv
```

### Train a specific model + strategy
```fish
# Best from comparison: XGBoost + SMOTE
python -m src.main --load-features results/features.csv --skip-comparison --model XGB --strategy smote

# Random Forest + balanced weights (spec default)
python -m src.main --load-features results/features.csv --skip-comparison --model RF --strategy weighted

# LightGBM + no imbalance handling
python -m src.main --load-features results/features.csv --skip-comparison --model LGBM --strategy none
```

### Features only (no training)
```fish
python -m src.main --features-only
```

### Run tests only
```fish
# All tests (27 total)
python -m pytest tests/ -v

# Specific test class
python -m pytest tests/ -v -k TestHRVFeatures

# Fast tests only (skip S2 integration test)
python -m pytest tests/ -v -k "not test_build_single_subject"
```

## CLI Reference

| Flag | Default | Description |
|------|---------|-------------|
| `--features-only` | off | Stop after feature extraction |
| `--load-features PATH` | None | Load features from CSV instead of extracting |
| `--skip-comparison` | off | Skip 3×3 LOSO comparison |
| `--model {RF,XGB,LGBM}` | `RF` | Model for final training |
| `--strategy {none,weighted,smote}` | `weighted` | Imbalance strategy |

## Output Artifacts

| File | Description |
|------|-------------|
| `results/features.csv` | Full feature matrix (1499 rows × 17 cols) |
| `results/loso_comparison.csv` | LOSO metrics for all 9 experiments |
| `models/stress_pipeline.joblib` | Serialized sklearn Pipeline (Imputer+Scaler+Model) |

## Using the Serialized Pipeline

```python
import joblib
import numpy as np

# Load once at startup
pipeline = joblib.load("models/stress_pipeline.joblib")

# Inference: pass a (1, 15) feature vector
# Feature order: [mean_hr, std_hr, rmssd, sdnn, nn50, pnn50,
#                 mean_eda, std_eda, slope_eda, peak_count, min_eda, max_eda,
#                 mean_temp, std_temp, slope_temp]
features = np.array([[72.5, 8.3, 42.1, 51.2, 12, 0.24,
                      0.65, 0.12, 0.001, 3, 0.42, 0.91,
                      33.5, 0.15, -0.002]])

proba = pipeline.predict_proba(features)[0]
stress_prob = proba[1]   # probability of stress class
print(f"Stress probability: {stress_prob:.3f}")
```

## LOSO Results (from last run)

| Model | None | Weighted | SMOTE |
|-------|------|----------|-------|
| RF    | 0.802 ± 0.229 | 0.791 ± 0.232 | 0.806 ± 0.234 |
| XGB   | 0.789 ± 0.208 | 0.809 ± 0.186 | **0.814 ± 0.124** |
| LGBM  | 0.785 ± 0.173 | 0.807 ± 0.173 | 0.779 ± 0.187 |

Primary metric: F1-score (mean ± std across 15 LOSO folds).

## Dataset Requirements

Place WESAD data at:
```
ml/datasets/WESAD/
    S2/S2.pkl
    S3/S3.pkl
    ...
    S17/S17.pkl   (S12 excluded — not present in dataset)
```
