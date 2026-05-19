# Phase 1: ML Training Pipeline — Implementation Plan

> **Spec confirmation:** All 21 sections read. Dataset verified on disk: 15 subjects (S2–S17, no S12), labels at 700 Hz, BVP@64Hz, EDA@4Hz, TEMP@4Hz. BVP shape is (N,1) column vector.

---

## 1. Project Structure

```
ml/
├── pyproject.toml
├── requirements.txt
├── datasets/WESAD/          # existing, not committed
├── src/
│   ├── __init__.py
│   ├── config.py            # constants, paths, feature names
│   ├── data_loader.py       # WESAD pickle loading
│   ├── preprocessing.py     # signal filtering per modality
│   ├── windowing.py         # 60s/50% overlap segmenter
│   ├── features/
│   │   ├── __init__.py
│   │   ├── hrv.py           # BVP → HRV features (6)
│   │   ├── eda.py           # EDA features (6)
│   │   └── temperature.py   # TEMP features (3)
│   ├── feature_matrix.py    # orchestrates per-window extraction
│   ├── evaluation.py        # LOSO CV, metrics, comparison
│   └── train.py             # final training + serialization
├── models/                  # serialized .joblib artifacts
├── results/                 # CSV metrics, plots
└── tests/
    ├── test_data_loader.py
    ├── test_preprocessing.py
    ├── test_features.py
    └── test_windowing.py
```

---

## 2. Data Flow (End-to-End)

```
 WESAD .pkl files (per subject)
       │
       ▼
 ┌─────────────────┐
 │  data_loader.py  │  Load pickle, extract wrist BVP/EDA/TEMP + labels
 │                  │  Downsample labels 700Hz → per-signal rate
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │ preprocessing.py │  BVP: bandpass 0.5–4Hz
 │                  │  EDA: lowpass 1Hz
 │                  │  TEMP: moving average smooth
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │  windowing.py    │  60s windows, 50% overlap
 │                  │  Filter out ignored labels {0,5,6,7}
 │                  │  Assign majority label per window
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │ feature_matrix   │  Per window → 15 features
 │  hrv.py (6)      │  mean_hr, std_hr, rmssd, sdnn, nn50, pnn50
 │  eda.py (6)      │  mean/std/slope/peaks/min/max
 │  temperature (3) │  mean/std/slope
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │ evaluation.py    │  LOSO 15-fold CV
 │                  │  RF / XGBoost / LightGBM × 3 imbalance strategies
 │                  │  Metrics: F1, Recall, Precision, ROC-AUC
 └────────┬────────┘
          ▼
 ┌─────────────────┐
 │   train.py       │  Train best model on ALL subjects
 │                  │  Pipeline(StandardScaler, Model)
 │                  │  → stress_pipeline.joblib
 └─────────────────┘
```

---

## 3. Module Specifications

### 3.1 `config.py`

```python
from pathlib import Path

WESAD_DIR = Path("datasets/WESAD")
SUBJECTS = [f"S{i}" for i in range(2, 18) if i != 12]  # 15 subjects

# Sampling rates (from dataset)
SR_BVP = 64    # Hz
SR_EDA = 4     # Hz
SR_TEMP = 4    # Hz
SR_LABEL = 700 # Hz (chest device rate)

# Windowing
WINDOW_SEC = 60
OVERLAP_RATIO = 0.5

# Label mapping
STRESS_LABEL = 2
NON_STRESS_LABELS = {1, 3, 4}
IGNORE_LABELS = {0, 5, 6, 7}

# Feature names (ordered)
FEATURE_NAMES = [
    "mean_hr", "std_hr", "rmssd", "sdnn", "nn50", "pnn50",
    "mean_eda", "std_eda", "slope_eda", "peak_count", "min_eda", "max_eda",
    "mean_temp", "std_temp", "slope_temp",
]
```

### 3.2 `data_loader.py`

**Purpose:** Load one subject's pickle, extract wrist signals, downsample labels.

```python
def load_subject(subject_id: str) -> dict:
    """Returns {'bvp': np.ndarray, 'eda': np.ndarray,
                'temp': np.ndarray, 'labels': np.ndarray}
    Labels downsampled to match each signal's rate."""
    path = WESAD_DIR / subject_id / f"{subject_id}.pkl"
    with open(path, "rb") as f:
        data = pickle.load(f, encoding="latin1")
    
    bvp = data["signal"]["wrist"]["BVP"].flatten()   # (N,1) → (N,)
    eda = data["signal"]["wrist"]["EDA"].flatten()
    temp = data["signal"]["wrist"]["TEMP"].flatten()
    labels_700hz = data["label"]  # at 700 Hz
    
    # Downsample labels to each signal's rate
    labels_bvp = downsample_labels(labels_700hz, SR_LABEL, SR_BVP)
    labels_eda = downsample_labels(labels_700hz, SR_LABEL, SR_EDA)
    # EDA and TEMP share same rate, so labels_eda == labels_temp
    
    return {"bvp": bvp, "eda": eda, "temp": temp,
            "labels_bvp": labels_bvp, "labels_eda": labels_eda}

def downsample_labels(labels, from_hz, to_hz):
    """Downsample by taking every (from_hz/to_hz)-th sample."""
    factor = from_hz // to_hz
    return labels[::factor][:expected_len]  # align to signal length
```

> **Risk:** Label array length after downsampling may not exactly match signal length due to rounding. Always truncate to `min(len(signal), len(downsampled_labels))`.

### 3.3 `preprocessing.py`

```python
from scipy.signal import butter, filtfilt, medfilt

def preprocess_bvp(bvp, sr=SR_BVP):
    """Bandpass filter 0.5–4.0 Hz (covers 30–240 BPM)."""
    nyq = sr / 2
    b, a = butter(N=3, Wn=[0.5/nyq, 4.0/nyq], btype="band")
    return filtfilt(b, a, bvp)

def preprocess_eda(eda, sr=SR_EDA):
    """Lowpass filter at 1 Hz to remove high-freq noise."""
    nyq = sr / 2
    b, a = butter(N=2, Wn=1.0/nyq, btype="low")
    return filtfilt(b, a, eda)

def preprocess_temp(temp, kernel_size=5):
    """Median filter for spike removal."""
    return medfilt(temp, kernel_size=kernel_size)
```

> **Risk:** `filtfilt` requires signal length > 3× filter order × padlen. For EDA at 4Hz, a 60s window = 240 samples — safe. But check edge cases.

### 3.4 `windowing.py`

```python
def create_windows(subject_data: dict, window_sec=60, overlap=0.5):
    """Segment all signals into aligned windows.
    Returns list of dicts: {'bvp': array, 'eda': array,
                            'temp': array, 'label': int}
    """
    step_sec = window_sec * (1 - overlap)  # 30s step
    
    # Calculate window sizes per signal
    bvp_win = window_sec * SR_BVP   # 3840 samples
    eda_win = window_sec * SR_EDA   # 240 samples
    temp_win = window_sec * SR_TEMP # 240 samples
    
    bvp_step = int(step_sec * SR_BVP)
    eda_step = int(step_sec * SR_EDA)
    
    # Determine number of windows from shortest signal
    total_sec = min(len(subject_data["bvp"]) / SR_BVP,
                    len(subject_data["eda"]) / SR_EDA)
    n_windows = int((total_sec - window_sec) / step_sec) + 1
    
    windows = []
    for i in range(n_windows):
        bvp_start = i * bvp_step
        eda_start = i * eda_step
        
        bvp_seg = subject_data["bvp"][bvp_start:bvp_start + bvp_win]
        eda_seg = subject_data["eda"][eda_start:eda_start + eda_win]
        temp_seg = subject_data["temp"][eda_start:eda_start + temp_win]
        
        # Label: majority vote from label array segment
        lab_seg = subject_data["labels_eda"][eda_start:eda_start + eda_win]
        label = assign_window_label(lab_seg)
        
        if label is not None:  # None = ignored
            windows.append({"bvp": bvp_seg, "eda": eda_seg,
                           "temp": temp_seg, "label": label})
    return windows

def assign_window_label(label_segment):
    """Majority vote. Returns 1 (stress) or 0 (non-stress) or None."""
    # Filter out ignored labels
    valid_mask = ~np.isin(label_segment, list(IGNORE_LABELS))
    if valid_mask.sum() < len(label_segment) * 0.5:
        return None  # too many ignored samples
    
    valid = label_segment[valid_mask]
    stress_ratio = np.sum(valid == STRESS_LABEL) / len(valid)
    return 1 if stress_ratio > 0.5 else 0
```

> **Risk:** Windows at label transition boundaries will have mixed labels. The majority-vote threshold (>50% stress) handles this. Windows with >50% ignored labels are discarded entirely.

### 3.5 Feature Extraction

#### `features/hrv.py`

```python
from scipy.signal import find_peaks

def extract_hrv_features(bvp_window, sr=SR_BVP):
    """BVP window → 6 HRV features."""
    # Peak detection on filtered BVP
    min_distance = int(sr * 0.4)  # min 0.4s between peaks (150 BPM max)
    peaks, _ = find_peaks(bvp_window, distance=min_distance,
                          height=np.mean(bvp_window))
    
    if len(peaks) < 3:
        return _hrv_fallback()  # not enough peaks
    
    # RR intervals in milliseconds
    rr = np.diff(peaks) / sr * 1000
    
    # Filter physiological RR range (300–2000ms → 30–200 BPM)
    rr = rr[(rr > 300) & (rr < 2000)]
    if len(rr) < 2:
        return _hrv_fallback()
    
    hr = 60000.0 / rr  # BPM
    rr_diff = np.abs(np.diff(rr))
    
    return {
        "mean_hr": np.mean(hr),
        "std_hr": np.std(hr),
        "rmssd": np.sqrt(np.mean(rr_diff**2)),
        "sdnn": np.std(rr),
        "nn50": np.sum(rr_diff > 50),
        "pnn50": np.sum(rr_diff > 50) / len(rr_diff) if len(rr_diff) > 0 else 0,
    }

def _hrv_fallback():
    """Return NaN dict when peaks insufficient."""
    return {k: np.nan for k in
            ["mean_hr","std_hr","rmssd","sdnn","nn50","pnn50"]}
```

> **Risk:** Peak detection is the most fragile step. Use `height=np.mean(bvp_window)` as adaptive threshold. Windows producing NaN features must be handled downstream (impute or drop).

#### `features/eda.py`

```python
def extract_eda_features(eda_window, sr=SR_EDA):
    """EDA window → 6 features."""
    x = np.arange(len(eda_window))
    slope = np.polyfit(x, eda_window, 1)[0] if len(eda_window) > 1 else 0
    
    # SCR peak detection (skin conductance responses)
    peaks, _ = find_peaks(eda_window, prominence=0.01)
    
    return {
        "mean_eda": np.mean(eda_window),
        "std_eda": np.std(eda_window),
        "slope_eda": slope,
        "peak_count": len(peaks),
        "min_eda": np.min(eda_window),
        "max_eda": np.max(eda_window),
    }
```

#### `features/temperature.py`

```python
def extract_temp_features(temp_window, sr=SR_TEMP):
    """TEMP window → 3 features."""
    x = np.arange(len(temp_window))
    slope = np.polyfit(x, temp_window, 1)[0] if len(temp_window) > 1 else 0
    return {
        "mean_temp": np.mean(temp_window),
        "std_temp": np.std(temp_window),
        "slope_temp": slope,
    }
```

### 3.6 `feature_matrix.py`

```python
def build_feature_matrix_for_subject(subject_id):
    """Full pipeline: load → preprocess → window → extract → DataFrame."""
    raw = load_subject(subject_id)
    raw["bvp"] = preprocess_bvp(raw["bvp"])
    raw["eda"] = preprocess_eda(raw["eda"])
    raw["temp"] = preprocess_temp(raw["temp"])
    
    windows = create_windows(raw)
    
    rows = []
    for w in windows:
        feats = {}
        feats.update(extract_hrv_features(w["bvp"]))
        feats.update(extract_eda_features(w["eda"]))
        feats.update(extract_temp_features(w["temp"]))
        feats["label"] = w["label"]
        feats["subject"] = subject_id
        rows.append(feats)
    
    return pd.DataFrame(rows)

def build_full_dataset():
    """Process all 15 subjects → single DataFrame."""
    frames = []
    for sid in SUBJECTS:
        df = build_feature_matrix_for_subject(sid)
        frames.append(df)
        print(f"{sid}: {len(df)} windows, "
              f"stress={df['label'].sum()}, non-stress={len(df)-df['label'].sum()}")
    return pd.concat(frames, ignore_index=True)
```

> **Key:** Process one subject at a time to stay within 16GB RAM. Each subject's pickle is ~1GB; after feature extraction the DataFrame for that subject is tiny.

### 3.7 `evaluation.py` — LOSO CV

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from imblearn.over_sampling import SMOTE

def get_models():
    return {
        "RF": RandomForestClassifier(n_estimators=100, random_state=42),
        "XGB": XGBClassifier(n_estimators=100, use_label_encoder=False,
                             eval_metric="logloss", random_state=42),
        "LGBM": LGBMClassifier(n_estimators=100, random_state=42, verbose=-1),
    }

def apply_class_weight(model, model_name, y_train):
    """Apply class_weight='balanced' or scale_pos_weight."""
    n_neg = np.sum(y_train == 0)
    n_pos = np.sum(y_train == 1)
    if model_name == "XGB":
        model.set_params(scale_pos_weight=n_neg / n_pos)
    else:
        model.set_params(class_weight="balanced")
    return model

def loso_cv(df, model_name, imbalance_strategy="weighted"):
    """Leave-One-Subject-Out cross-validation.
    
    imbalance_strategy: 'none' | 'weighted' | 'smote'
    Returns dict of metric arrays (one value per fold).
    """
    results = {"f1": [], "precision": [], "recall": [],
               "roc_auc": [], "subject": []}
    
    for test_subject in SUBJECTS:
        train_df = df[df["subject"] != test_subject]
        test_df = df[df["subject"] == test_subject]
        
        X_train = train_df[FEATURE_NAMES].values
        y_train = train_df["label"].values
        X_test = test_df[FEATURE_NAMES].values
        y_test = test_df["label"].values
        
        # Handle NaN from failed HRV extraction
        imputer = SimpleImputer(strategy="median")
        X_train = imputer.fit_transform(X_train)
        X_test = imputer.transform(X_test)
        
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)
        
        model = get_models()[model_name]
        
        if imbalance_strategy == "weighted":
            model = apply_class_weight(model, model_name, y_train)
        elif imbalance_strategy == "smote":
            sm = SMOTE(random_state=42)
            X_train, y_train = sm.fit_resample(X_train, y_train)
        
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]
        
        results["f1"].append(f1_score(y_test, y_pred))
        results["precision"].append(precision_score(y_test, y_pred))
        results["recall"].append(recall_score(y_test, y_pred))
        results["roc_auc"].append(roc_auc_score(y_test, y_proba))
        results["subject"].append(test_subject)
    
    return results

def run_full_comparison(df):
    """3 models × 3 strategies = 9 experiments."""
    all_results = []
    for model_name in ["RF", "XGB", "LGBM"]:
        for strategy in ["none", "weighted", "smote"]:
            res = loso_cv(df, model_name, strategy)
            for metric in ["f1", "precision", "recall", "roc_auc"]:
                vals = res[metric]
                all_results.append({
                    "model": model_name, "strategy": strategy,
                    "metric": metric,
                    "mean": np.mean(vals), "std": np.std(vals),
                })
    return pd.DataFrame(all_results)
```

### 3.8 `train.py` — Final Model Serialization

```python
def train_final_model(df, model_name="RF", strategy="weighted"):
    """Train on ALL subjects, serialize as Pipeline."""
    X = df[FEATURE_NAMES].values
    y = df["label"].values
    
    model = get_models()[model_name]
    if strategy == "weighted":
        model = apply_class_weight(model, model_name, y)
    
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", model),
    ])
    
    pipeline.fit(X, y)
    
    out_path = Path("models/stress_pipeline.joblib")
    out_path.parent.mkdir(exist_ok=True)
    joblib.dump(pipeline, out_path)
    
    # Verify round-trip
    loaded = joblib.load(out_path)
    assert np.allclose(loaded.predict_proba(X[:5]),
                       pipeline.predict_proba(X[:5]))
    print(f"Saved: {out_path} ({out_path.stat().st_size / 1e6:.1f} MB)")
```

---

## 4. Module Dependency Order

```
config.py                    ← no deps, build FIRST
    │
data_loader.py               ← depends on config
    │
preprocessing.py             ← depends on config (sampling rates)
    │
windowing.py                 ← depends on config (window params, labels)
    │
features/hrv.py              ← standalone (scipy)
features/eda.py              ← standalone (scipy)
features/temperature.py      ← standalone (numpy)
    │
feature_matrix.py            ← depends on ALL above
    │
evaluation.py                ← depends on feature_matrix, config
    │
train.py                     ← depends on evaluation (model selection)
```

---

## 5. Implementation Milestones

| # | Milestone | Completion Criteria |
|---|-----------|-------------------|
| M1 | Data loading | `load_subject("S2")` returns dict with correct shapes. BVP: 389056, EDA: 24316, labels aligned. |
| M2 | Preprocessing | Filtered BVP has no energy outside 0.5–4Hz. Visual sanity check on 10s segment. |
| M3 | Windowing | S2 produces expected window count. No windows with ignored-only labels. |
| M4 | Feature extraction | 15 features per window, <5% NaN rate on HRV features. |
| M5 | Full dataset build | All 15 subjects processed. Feature matrix shape ~[N, 17] (15 features + label + subject). |
| M6 | LOSO CV complete | 9 experiments (3 models × 3 strategies). Results CSV saved. |
| M7 | Model serialized | `stress_pipeline.joblib` < 50MB. Predict_proba round-trip verified. |

---

## 6. Risk Areas & Common Mistakes

| Module | Risk | Mitigation |
|--------|------|------------|
| data_loader | Label downsampling off-by-one | Truncate to `min(len(signal), len(downsampled))` |
| data_loader | BVP shape is (N,1) not (N,) | Always `.flatten()` after extraction |
| preprocessing | `filtfilt` crash on short segments | Assert minimum segment length before filtering |
| windowing | Mixed-label windows at transitions | Majority vote with 50% validity threshold |
| hrv.py | Too few peaks → NaN features | Fallback dict + downstream imputer |
| hrv.py | Peak detection hyperparams too strict/loose | Validate: expect 60–80 peaks in 60s window at rest |
| evaluation | Data leakage if not strict LOSO | Never fit scaler/imputer on test fold |
| evaluation | SMOTE applied before train/test split | SMOTE only on training fold, never test |
| train.py | Scaler not bundled in pipeline | Use sklearn Pipeline to guarantee bundling |
| General | Loading all 15 pickles at once (~15GB) | Process one subject at a time, store feature DataFrames |

---

## 7. Testing Strategy

| Module | Test | Method |
|--------|------|--------|
| data_loader | Shapes match expected | Assert BVP len / EDA len == 16 (64/4) |
| data_loader | Labels contain only {0,1,2,3,4,5,6,7} | `assert set(labels).issubset({0..7})` |
| preprocessing | BVP filter removes DC and HF | FFT before/after, check energy in passband |
| windowing | Window count formula | `n = (total_sec - 60) / 30 + 1`, verify ±1 |
| windowing | No ignored-label-only windows | Assert all returned labels ∈ {0, 1} |
| hrv.py | Known synthetic BVP | Generate 60s sine at 1Hz (60BPM), expect mean_hr≈60 |
| eda.py | Flat signal → zero slope, std | `slope_eda ≈ 0, std_eda ≈ 0` |
| evaluation | LOSO fold count == 15 | Assert len(results["subject"]) == 15 |
| evaluation | No subject in both train and test | Assert `test_subject not in train_df["subject"]` |
| train.py | Pipeline inference shape | `predict_proba(X[0:1]).shape == (1, 2)` |

---

## 8. Dependencies (pyproject.toml)

```toml
[project]
name = "hybrid-stress-system"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "numpy",
    "pandas",
    "scipy",
    "scikit-learn",
    "xgboost",
    "lightgbm",
    "imbalanced-learn",
    "joblib",
]

[project.optional-dependencies]
dev = ["pytest", "matplotlib", "seaborn"]
```

> **Note:** `imbalanced-learn` added for SMOTE experiment. Fish shell activation: `source venv/bin/activate.fish`

---

## 9. Upcoming Phases (Not In Scope)

- **Phase 2:** FastAPI service with `/assess` and `/predict` endpoints, DASS-21 fusion layer, real-time feature extraction from ESP32 payloads
- **Phase 3:** ESP32 firmware, Render deployment, end-to-end integration testing
