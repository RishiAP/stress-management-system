# Hybrid Stress Management System
## Complete ML Architecture & Implementation Specification

> **Document Purpose:** This specification provides a complete engineering and implementation plan for a hybrid physiological + psychological stress detection system. It is intended to be passed directly to an AI coding assistant for module-by-module implementation.

---

## Prompt for the AI Coding Assistant

You are acting as a **senior ML systems architect and biosignal processing engineer**.

Your task is to generate a **complete, practical engineering and implementation plan** for the project described in this document.

**Focus on:**
- Practical deployability over research elegance
- Robust preprocessing for noisy consumer-grade sensors
- Biosignal ML best practices
- Modular, maintainable software architecture
- CPU-friendly classical ML pipelines
- Realistic, implementable details

**Do NOT:**
- Optimize for flashy research architectures
- Prioritize deep learning unless clearly justified
- Over-engineer the MVP

**The goal is:**
- A robust working MVP first
- Clean, modular architecture
- Clearly defined future upgrade path

**After generating the full architecture, also provide:**
1. Recommended development order
2. Module dependency order
3. Implementation milestones
4. Risk areas and common implementation mistakes
5. Recommended validation and testing strategy

**Output format requirements:**
- Numbered sections with clear headers
- ASCII data flow diagrams for all major pipelines
- Python pseudocode snippets for all non-trivial steps
- Modular architecture breakdown with file/folder structure
- Risk analysis per module
- Implementation phases with milestones

---

## 1. Project Overview

Build a **real-time hybrid stress detection system** that combines:

1. Physiological stress detection using low-cost wearable sensors
2. Psychological baseline assessment using the DASS-21 questionnaire
3. Hybrid stress scoring with category-based output and recommendations

The system must be practical, deployable, and robust against noisy consumer-grade sensor data.

---

## 2. Hardware Sensors

> Consumer-grade sensors only — not medical-grade. The preprocessing pipeline must account for noise.

| Sensor | Signal Equivalent | Planned Use |
|---|---|---|
| MAX30102 | BVP / PPG | Heart rate and HRV feature extraction |
| GSR Sensor | EDA | Electrodermal activity / skin conductance |
| Temperature Sensor | TEMP | Skin temperature trends |

### MAX30102 Processing Pipeline

The raw IR waveform is **not** used directly as an ML input.

```
Raw IR waveform
    → Bandpass filter
    → Peak detection
    → RR interval extraction
    → HR and HRV feature computation
```

**Extracted features:** mean HR, HR standard deviation, RMSSD, SDNN, NN50, pNN50

### Real Sensor Sampling Rates

| Sensor | Rate | Notes |
|---|---|---|
| MAX30102 | ~100 Hz | PPG/BVP equivalent |
| GSR Sensor | ~10 Hz | Raw skin conductance |
| Temperature | ~1 Hz | Slow thermal signal, low-frequency is sufficient |

---

## 3. Dataset

**WESAD — Wearable Stress and Affect Detection Dataset**

### Structure

- Subjects: **S2 through S17, excluding S12** (15 subjects total)
- Format: Per-subject `.pkl` (pickle) files
- Top-level keys: `signal`, `label`, `subject`

### Signals Used

Only **wrist device signals** are used to match available hardware.

| Signal | Sampling Rate | Hardware Equivalent |
|---|---|---|
| BVP | 64 Hz | MAX30102 |
| EDA | 4 Hz | GSR Sensor |
| TEMP | 4 Hz | Temperature Sensor |

**Ignored signals:** `ACC`, `EMG`, `RESP`, all chest-device signals

### Label Mapping

| WESAD Label | Meaning | Classification Target |
|---|---|---|
| 0 | Transient / undefined | **IGNORE** |
| 1 | Baseline | Non-Stress |
| 2 | Stress | **Stress** |
| 3 | Amusement | Non-Stress |
| 4 | Meditation | Non-Stress |
| 5, 6, 7 | Undefined protocol segments | **IGNORE** |

### Binary Classification Target

```
Stress     → WESAD label == 2
Non-Stress → WESAD labels ∈ {1, 3, 4}  (merged)
Ignored    → WESAD labels ∈ {0, 5, 6, 7}
```

---

## 4. ML Strategy

### Approach

**Classical ML with hand-crafted feature engineering.** No deep learning in the MVP.

### Preferred Models

- Random Forest
- XGBoost
- LightGBM

### Why Classical ML

| Reason | Detail |
|---|---|
| Interpretability | Features and decisions are auditable |
| Small dataset | N=15 subjects — deep learning would overfit |
| CPU-friendly | No GPU required for training or inference |
| Fast iteration | Short training cycles, easy debugging |
| Deployable | Small model artifacts, fits Render free tier |

> Deep learning (e.g. CNN on raw signals, LSTM on sequences) is noted as **future work only** and should be mentioned in a dedicated future extensions section.

---

## 5. Development Hardware Constraints

| Spec | Value |
|---|---|
| CPU | Intel i3-1115G4 |
| RAM | 16 GB |
| GPU | None |
| OS | Arch Linux |

**Architecture must be:**
- Trainable on CPU in reasonable time
- Memory-efficient (no loading all subjects into RAM simultaneously)
- Avoiding heavy hyperparameter search grids initially

---

## 6. Windowing Strategy

### WESAD Training Windows

| Parameter | Value |
|---|---|
| Window size | **60 seconds** |
| Overlap | **50%** |

**Reasoning:**
- HRV features (RMSSD, SDNN) require at minimum 30–50 RR intervals to be statistically stable
- At 60–80 BPM, 60 seconds provides ~60–80 beats — sufficient for reliable HRV computation
- 50% overlap significantly increases sample count across only 15 subjects

### Real-Time Inference Windows

| Parameter | Value |
|---|---|
| Window size | **30 seconds** |
| Overlap | **None** |

**Reasoning:**
- 30 seconds balances prediction responsiveness with feature reliability
- No overlap needed — each window is an independent inference call
- Acceptable latency for ESP32 → Render round trip

---

## 7. Feature Extraction Strategy

### 7.1 BVP → HRV Features

Applies to both WESAD BVP (64 Hz) and MAX30102 (100 Hz).

```
BVP / PPG signal
    → Bandpass filter (0.5–4.0 Hz)
    → Systolic peak detection
    → RR interval series (ms)
    → HRV feature extraction
```

| Feature | Description |
|---|---|
| `mean_hr` | Mean heart rate in BPM |
| `std_hr` | Standard deviation of heart rate |
| `rmssd` | Root mean square of successive RR differences |
| `sdnn` | Standard deviation of all NN intervals |
| `nn50` | Count of successive differences > 50ms |
| `pnn50` | Proportion of NN intervals with difference > 50ms |

### 7.2 EDA / GSR Features

Applies to both WESAD EDA (4 Hz) and GSR Sensor (~10 Hz).

| Feature | Description |
|---|---|
| `mean_eda` | Mean skin conductance level |
| `std_eda` | Standard deviation of conductance |
| `slope_eda` | Linear trend over the window |
| `peak_count` | Number of detected GSR peaks |
| `min_eda` | Minimum conductance value |
| `max_eda` | Maximum conductance value |

### 7.3 Temperature Features

Applies to both WESAD TEMP (4 Hz) and Temperature Sensor (~1 Hz).

| Feature | Description |
|---|---|
| `mean_temp` | Mean skin temperature |
| `std_temp` | Temperature variability within window |
| `slope_temp` | Temperature trend (rising/falling) |

**Note:** Temperature changes slowly. Even at 1 Hz, 30 seconds provides sufficient resolution for trend detection.

---

## 8. Normalization Strategy

**Method:** Global `StandardScaler` fitted across all WESAD training subjects.

```python
# Fit once on all training feature vectors
scaler = StandardScaler()
scaler.fit(X_train_all_subjects)

# Applied during inference on incoming ESP32 windows
X_inference_scaled = scaler.transform(X_inference)
```

**Scaler must be serialized together with the model** as a single pipeline artifact (see Section 11).

**Reasoning:**
- Simple, reproducible deployment
- Avoids cold-start problem of per-user adaptive calibration
- WESAD subject diversity provides reasonable generalization baseline

**Future work:**
- Per-user running baseline calibration after warmup period
- Adaptive normalization anchored to first N minutes of user data

---

## 9. Class Imbalance Handling

WESAD stress segments (label=2) are considerably shorter than non-stress segments, creating natural class imbalance.

### Primary Strategy

Use `class_weight="balanced"` on all models:

```python
RandomForestClassifier(class_weight="balanced")
XGBClassifier(scale_pos_weight=n_negative / n_positive)
LGBMClassifier(class_weight="balanced")
```

### Experimental Comparison During Training

Evaluate and compare three conditions:

| Condition | Description |
|---|---|
| Baseline | No imbalance handling |
| Weighted | `class_weight="balanced"` |
| SMOTE | Synthetic minority oversampling |

**SMOTE caveat:** SMOTE on time-series derived features can produce synthetic samples that do not respect temporal signal structure, potentially inflating performance metrics artificially. Use only as an experiment, not as the primary strategy.

**Recommended default:** `class_weight="balanced"`

---

## 10. LOSO Cross-Validation Strategy

**Leave-One-Subject-Out (LOSO)** is mandatory for biosignal ML evaluation.

```
For each subject S in {S2, S3, ..., S17} excluding S12:
    Train on all subjects except S
    Test on subject S
    Record F1, Precision, Recall, ROC-AUC

Final performance = mean ± std across all 15 folds
```

**Why LOSO is mandatory:**
- Random train/test splits across subjects cause severe data leakage
- Adjacent windows from the same subject have highly correlated features
- LOSO is the only strategy that honestly tests generalization to unseen users

---

## 11. Model Serialization Strategy

Bundle scaler and model into a **single sklearn Pipeline** artifact:

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
import joblib

pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('model', RandomForestClassifier(class_weight='balanced', n_estimators=100))
])

pipeline.fit(X_train, y_train)

joblib.dump(pipeline, 'stress_pipeline.joblib')

# Inference
pipeline = joblib.load('stress_pipeline.joblib')
proba = pipeline.predict_proba(X_window)[0][stress_class_index]
```

**Benefits:**
- Single artifact to version, deploy, and load
- Eliminates preprocessing mismatch between training and inference
- Typical size: under 50MB for 100-tree Random Forest on ~15 features
- Fits within Render free tier memory limit (~512MB)

---

## 12. Evaluation Metrics

| Metric | Role | Priority |
|---|---|---|
| F1-Score | Primary metric — handles class imbalance well | **Primary** |
| Recall | Avoid missing genuine stress events | High |
| Precision | Avoid false stress alerts | High |
| ROC-AUC | Threshold-independent performance measure | High |
| Accuracy | Reported for completeness only | Secondary |

Report all metrics as **mean ± standard deviation across LOSO folds**.

---

## 13. DASS-21 Integration Architecture

### Design Principle

DASS-21 is a **periodic psychological assessment**, not a per-inference sensor input. It adjusts the system's stress sensitivity at the session level, not at the window level.

### Two-Endpoint Architecture

#### Endpoint 1 — `POST /assess`
Called **once per session** or periodically (e.g. weekly).

```json
{
  "dass21_answers": [0, 1, 2, 0, 1, 3, 0, 2, 1, 0, 1, 2, 0, 1, 3, 0, 2, 1, 0, 1, 2]
}
```

- 21 integers, each in range 0–3
- Backend extracts the **stress subscale** (DASS-21 items: 1, 6, 8, 11, 12, 14, 18 — zero-indexed: 0, 5, 7, 10, 11, 13, 17)
- Computes DASS modifier and stores in session state

#### Endpoint 2 — `POST /predict`
Called every **30 seconds** during active monitoring.

```json
{
  "bvp_window": [1024.3, 1031.7, ...],
  "gsr_window": [0.45, 0.47, ...],
  "temp_window": [33.1, 33.2, ...]
}
```

> No DASS-21 data in inference payload. Backend applies the cached session modifier.

### Hybrid Scoring Formula

```python
# Step 1: physiological ML score
physiological_score = pipeline.predict_proba(features)[0][stress_class]
# range: 0.0 – 1.0

# Step 2: DASS-21 stress subscale modifier
stress_subscale_items = [0, 5, 7, 10, 11, 13, 17]  # zero-indexed
dass_stress_raw = sum(dass21_answers[i] for i in stress_subscale_items)
# range: 0 – 42

dass_modifier = (dass_stress_raw / 42) * 0.20
# range: 0.0 – 0.20 (max ±20% shift)

# Step 3: hybrid score
hybrid_score_normalized = min(max(physiological_score + dass_modifier, 0.0), 1.0)
hybrid_score = hybrid_score_normalized * 100
# range: 0 – 100

# Step 4: category label
if hybrid_score < 40:
    category = "Low Stress"
elif hybrid_score < 65:
    category = "Moderate Stress"
else:
    category = "High Stress"
```

**Design rationale:**
- Physiological ML model remains the primary signal
- DASS-21 nudges sensitivity — it never overrides the ML output
- 20% cap prevents psychological baseline from dominating when physiology is calm
- High DASS-21 score → system becomes more sensitive to physiological stress signals

---

## 14. System Architecture & Data Flow

### Training Pipeline

```
WESAD Dataset (per-subject pickle files)
    │
    ├── Load subject pickle
    ├── Extract wrist signals: BVP, EDA, TEMP
    ├── Filter out ignored labels: {0, 5, 6, 7}
    ├── Map labels: {2} → Stress, {1,3,4} → Non-Stress
    │
    ├── Signal Preprocessing
    │   ├── BVP: bandpass filter → peak detection → RR intervals
    │   ├── EDA: lowpass filter → normalize baseline
    │   └── TEMP: smoothing
    │
    ├── Windowing (60s, 50% overlap)
    │
    ├── Feature Extraction per window
    │   ├── HRV features (6)
    │   ├── EDA features (6)
    │   └── TEMP features (3)
    │   Total: ~15 features per window
    │
    ├── Feature Matrix assembly [N_windows × 15]
    │
    ├── LOSO Cross-Validation (15 folds)
    │   ├── Train: StandardScaler + RF / XGBoost / LightGBM
    │   └── Evaluate: F1, Recall, Precision, ROC-AUC
    │
    └── Final Model Training (all subjects)
        └── Serialize: stress_pipeline.joblib
```

### Real-Time Inference Pipeline

```
ESP32 Hardware
    ├── MAX30102  → BVP buffer (100 Hz, 30s = 3000 samples)
    ├── GSR       → EDA buffer (10 Hz,  30s = 300 samples)
    └── TEMP      → Temp buffer (1 Hz,   30s = 30 samples)
    │
    └── POST /predict  →  FastAPI on Render
                              │
                              ├── Receive raw sensor windows
                              ├── Signal preprocessing
                              │   ├── BVP: filter → peaks → RR intervals
                              │   ├── EDA: filter → normalize
                              │   └── TEMP: smooth
                              │
                              ├── Feature extraction (~15 features)
                              │
                              ├── Load stress_pipeline.joblib
                              │   └── StandardScaler + ML model (bundled)
                              │
                              ├── predict_proba → physiological_score
                              │
                              ├── Load DASS-21 modifier from session state
                              │
                              ├── Compute hybrid_score (0–100)
                              ├── Assign category label
                              │
                              └── Response:
                                  {
                                    "stress_score": 72.4,
                                    "category": "High Stress",
                                    "physiological_score": 0.68,
                                    "dass_modifier": 0.10
                                  }
```

### DASS-21 Assessment Flow

```
User completes DASS-21 questionnaire
    │
    └── POST /assess
            │
            ├── Receive 21 answers [0–3]
            ├── Extract stress subscale items
            ├── Compute dass_modifier (0.0–0.20)
            └── Store in session state
                    │
                    └── Applied to all subsequent /predict calls
```

---

## 15. ESP32 → FastAPI Communication

### Communication Strategy

ESP32 acts as a **dumb data courier** — it buffers raw sensor samples and sends them to the backend. All preprocessing and feature extraction is performed server-side.

**Benefits:**
- Feature engineering can be updated without reflashing ESP32 firmware
- Backend remains the single source of truth for ML logic
- ESP32 complexity stays minimal

### Payload Sizes (30-second window)

| Signal | Rate | Samples | Approx. JSON Size |
|---|---|---|---|
| BVP | 100 Hz | 3000 floats | ~24 KB |
| GSR | 10 Hz | 300 floats | ~2.4 KB |
| TEMP | 1 Hz | 30 floats | ~240 B |
| **Total** | | | **~27 KB** |

Payload size is well within HTTP limits and acceptable for a 30-second send interval.

---

## 16. Deployment Architecture

```
Development (Arch Linux, i3-1115G4, 16GB RAM)
    ├── WESAD training pipeline (CPU)
    ├── LOSO evaluation
    └── Model artifact: stress_pipeline.joblib

Production (Render Free Tier)
    ├── FastAPI microservice
    ├── stress_pipeline.joblib (loaded at startup)
    ├── POST /assess  — DASS-21 intake
    └── POST /predict — 30s sensor window inference

ESP32 (Field Device)
    ├── Sensor acquisition (MAX30102, GSR, TEMP)
    ├── 30-second window buffering
    └── HTTP POST to Render endpoint
```

### Render Deployment Constraints

- RAM limit: ~512 MB (free tier)
- Avoid large hyperparameter-optimized ensembles
- Random Forest with 100 trees on 15 features ≈ under 50 MB serialized
- No GPU — inference must be CPU-only (already satisfied by sklearn/joblib)

---

## 17. Stress Output Specification

| Field | Type | Description |
|---|---|---|
| `stress_score` | float (0–100) | Final hybrid stress score |
| `category` | string | `"Low Stress"` / `"Moderate Stress"` / `"High Stress"` |
| `physiological_score` | float (0–1) | Raw ML model probability |
| `dass_modifier` | float (0–0.2) | DASS-21 contribution |

### Category Thresholds

| Range | Category |
|---|---|
| 0 – 39 | Low Stress |
| 40 – 64 | Moderate Stress |
| 65 – 100 | High Stress |

---

## 18. Complete ML Pipeline Checklist

The implementation plan must cover all of the following:

1. WESAD data loading and parsing pipeline
2. Signal extraction and label filtering
3. Signal synchronization handling
4. Preprocessing per signal type (BVP, EDA, TEMP)
5. Windowing strategy (training vs. inference)
6. HRV feature extraction from BVP/PPG
7. EDA/GSR feature extraction
8. Temperature feature extraction
9. Feature matrix assembly
10. Global StandardScaler normalization
11. Class imbalance handling (`class_weight="balanced"`)
12. LOSO cross-validation implementation
13. Model training — Random Forest, XGBoost, LightGBM
14. Model comparison and selection
15. Final model serialization as sklearn Pipeline (joblib)
16. FastAPI service structure (`/assess`, `/predict`)
17. Real-time inference pipeline (feature extraction → scoring)
18. DASS-21 intake and modifier computation
19. Hybrid scoring formula implementation
20. Stress score and category output
21. Recommendation engine architecture
22. Suggested project folder structure
23. Modular software architecture breakdown
24. Future scalability plan

---

## 19. Development Environment Configuration

### Python Environment

All development must use a **local Python virtual environment**. The implementation plan must include setup instructions following these exact conventions.

**Create the virtual environment (if not already present):**

```bash
python -m venv venv
```

**Activate using Fish shell:**

```fish
source venv/bin/activate.fish
```

> This project is developed on **Fish shell**. Do NOT use `source venv/bin/activate` (bash syntax). Always use `venv/bin/activate.fish`.

**The virtual environment directory (`venv/`) must be:**
- Created at the project root
- Added to `.gitignore`
- Never committed to version control

---

### Dependency Management

Use **both** of the following for dependency management:

#### `pyproject.toml` (primary)

Used for project metadata and top-level dependency declaration:

```toml
[project]
name = "hybrid-stress-system"
version = "0.1.0"
description = "Hybrid physiological and psychological stress detection system"
requires-python = ">=3.10"

dependencies = [
    "numpy",
    "pandas",
    "scipy",
    "scikit-learn",
    "xgboost",
    "lightgbm",
    "joblib",
    "fastapi",
    "uvicorn",
    "pydantic",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "jupyter",
    "matplotlib",
    "seaborn",
]
```

#### `requirements.txt` (secondary)

Used for pinned, reproducible installs for deployment on Render:

```
numpy==<pinned>
pandas==<pinned>
scipy==<pinned>
scikit-learn==<pinned>
xgboost==<pinned>
lightgbm==<pinned>
joblib==<pinned>
fastapi==<pinned>
uvicorn==<pinned>
pydantic==<pinned>
```

> Exact versions should be pinned after initial development using `pip freeze > requirements.txt` inside the active venv.

#### Install workflow

```fish
# Create and activate environment
python -m venv venv
source venv/bin/activate.fish

# Install from pyproject.toml during development
pip install -e ".[dev]"

# Or install from requirements.txt for reproducible deployment
pip install -r requirements.txt
```

---

### Environment Constraints

| Constraint | Value |
|---|---|
| Shell | Fish (`venv/bin/activate.fish`) |
| Python version | >= 3.10 |
| Environment manager | `python -m venv` only (no conda, no poetry) |
| Dependency declaration | `pyproject.toml` |
| Pinned lockfile | `requirements.txt` (generated via `pip freeze`) |
| GPU dependencies | None — CPU-only packages only |

---

## 20. Important Constraints Summary

| Constraint | Requirement |
|---|---|
| ML approach | Classical ML first, no deep learning in MVP |
| Models | Random Forest, XGBoost, LightGBM |
| Validation | LOSO cross-validation mandatory |
| Hardware | CPU-only training and inference |
| Normalization | Global StandardScaler, serialized with model |
| Class imbalance | `class_weight="balanced"` as default |
| DASS-21 | Rule-based modifier layer, NOT a training target |
| Sensors | Consumer-grade — preprocessing must handle noise |
| Deployment | FastAPI on Render, joblib pipeline artifact |
| ESP32 | Raw data courier — feature extraction is server-side |

---

## 21. Future Work (Do Not Implement in MVP)

The following should be **mentioned as a future extensions section** but not implemented now:

- Deep learning: CNN on raw BVP signals, LSTM for temporal modeling
- Personalized adaptive normalization (per-user baseline calibration)
- Frequency-domain HRV features (LF/HF ratio, LF/HF band power)
- SMOTE-based augmentation (after validating it doesn't inflate metrics)
- DASS-21 dynamic threshold adaptation
- Continuous user recalibration after warmup period
- Multi-class stress classification (beyond binary)
- Edge inference on ESP32 (post-quantization if model size allows)
- Database persistence for longitudinal stress tracking