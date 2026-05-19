# ML Pipeline — Complete Flow & Run Guide

## The Big Picture

```
Raw sensor recordings (15 people wearing wristbands)
            │
            ▼
    Cut into 60-second chunks  →  Extract 15 numbers from each chunk
            │
            ▼
    Train a model on 14 people, test on 1 remaining
    Repeat 15 times (LOSO)
            │
            ▼
    Train FINAL model on all 15 people
            │
            ▼
    Save to stress_pipeline.joblib  →  Phase 2 FastAPI uses this
```

---

## What Actually Happens at Each Stage

### STAGE 1 — Load Raw Data

Each of the 15 subjects has a `.pkl` file (~1 GB each):

```
S2.pkl
  BVP signal : 389,056 samples @ 64 Hz   (blood volume pulse)
  EDA signal :  24,316 samples @  4 Hz   (skin conductance / sweat)
  TEMP signal:  24,316 samples @  4 Hz   (skin temperature)
  Labels     : 4,255,300 @ 700 Hz

Labels meaning:
  0 → ignore   1 → calm (baseline)   2 → STRESS
  3 → amused   4 → meditating        5,6,7 → ignore
```

We map to binary: `label 2 → stress=1`, `labels 1,3,4 → calm=0`, rest discarded.

---

### STAGE 2 — Clean the Signals

```
BVP  → Bandpass filter (0.5–4 Hz)  keeps only heartbeat frequencies
EDA  → Lowpass filter  (1 Hz)      removes high-frequency noise
TEMP → Median filter               removes spike artifacts
```

---

### STAGE 3 — Cut into 60-second Windows

```
100-min recording:
─────────────────────────────────────────────────────────────

Window 1: [══════════════════════════]
Window 2:             [══════════════════════════]
Window 3:                         [══════════════════════════]
          ◄──── 60 sec ────►
                    ◄── 30 sec step (50% overlap) ──►

Result: ~99 windows per subject × 15 subjects = 1,499 total windows
Each window → labeled stress or calm by majority vote of samples inside it
```

---

### STAGE 4 — Extract 15 Features per Window

We don't feed raw signals to the model. We compute 15 summary numbers:

```
BVP → detect heartbeat peaks → measure beat intervals (RR) → 6 HRV features:
  mean_hr    average heart rate (BPM)
  std_hr     how much HR varies
  rmssd      short-term beat-to-beat variation
  sdnn       overall beat variation
  nn50       count of beats differing >50ms
  pnn50      percentage of those beats

EDA → 6 features:
  mean_eda   average sweat level
  std_eda    variability
  slope_eda  rising or falling?
  peak_count number of stress spikes
  min_eda    lowest point
  max_eda    highest point

TEMP → 3 features:
  mean_temp  average skin temperature
  std_temp   variability
  slope_temp warming or cooling?
```

Each window becomes **one row** with 15 numbers + a label (0 or 1):

```
| mean_hr | std_hr | rmssd | ... | slope_temp | label |
|---------|--------|-------|-----|------------|-------|
|  72.5   |  8.3   | 42.1  | ... |  -0.002    |   0   |  calm
|  95.0   | 12.1   | 18.5  | ... |   0.001    |   1   |  stress
|  68.2   |  5.1   | 58.3  | ... |  -0.001    |   0   |  calm
```

Total: 1,499 rows × 17 columns (15 features + label + subject)

---

### STAGE 5 — LOSO Training and Testing

This is where the model learns. We do 15 rounds:

```
Round 1:
  TRAIN on [S3 S4 S5 S6 S7 S8 S9 S10 S11 S13 S14 S15 S16 S17]  (1403 windows)
  TEST  on [S2]                                                   (  96 windows)
  → F1 = 0.743

Round 2:
  TRAIN on [S2 S4 S5 S6 S7 S8 S9 S10 S11 S13 S14 S15 S16 S17]  (1400 windows)
  TEST  on [S3]                                                   (  99 windows)
  → F1 = 0.732

... (13 more rounds) ...

Round 15:
  TRAIN on [S2 S3 S4 S5 S6 S7 S8 S9 S10 S11 S13 S14 S15 S16]   (1400 windows)
  TEST  on [S17]                                                  ( 100 windows)
  → F1 = 0.868

FINAL = average of all 15 rounds → F1: 0.789
```

Inside each round:

```
Training data (14 people)
    ├── Imputer    : fill any missing values using the median
    ├── Scaler     : normalize all features to mean=0, std=1
    └── XGBoost    : train 100 decision trees

Test data (1 person)
    ├── Same imputer applied (NOT refitted — that would be cheating)
    ├── Same scaler applied  (NOT refitted)
    └── Predict → compare to real labels → F1 score
```

> **Why not just split 80/20 randomly?**
> Because all 99 windows from S3 are related — same person, same session.
> If some go to train and some to test, the model just memorizes that person.
> LOSO ensures the test person was completely invisible during training.

---

### STAGE 6 — Final Model Export

After LOSO confirms the model generalizes (F1=0.789), we train one final model
on **all 1,499 windows** from all 15 subjects — no held-out test set:

```
All 1,499 windows
    │
    ├── SMOTE: synthetically balance classes
    │   (332 stress → 1,167 synthetic+real stress, matching calm count)
    │
    ├── Imputer + StandardScaler + XGBoost (100 trees)
    │
    └── stress_pipeline.joblib  ← deploy this to FastAPI
```

---

## How to Run It

### Step 0 — Open terminal in the right folder

```bash
cd /home/rishi/Documents/dev/stress-management-system/ml
```

---

### Step 1 — First time (full pipeline, ~5 min)

```bash
bash run.sh
```

**Terminal output you'll see:**

```
══ Environment ══
[INFO] Creating virtual environment...
[INFO] Installing dependencies...

══ Unit Tests ══
........................... [100%]
27 passed in 24s
[DONE] All tests passed

══ Training ══
[INFO] Processing S2 (1/15)... → 96 windows (stress=21, calm=75)
[INFO] Processing S3 (2/15)... → 99 windows (stress=22, calm=77)
[INFO] Processing S4 (3/15)... → 99 windows
... (all 15 subjects) ...
[INFO] Full dataset: 1499 windows total
[INFO] Running LOSO model comparison (9 experiments)...
[INFO] Training final model: XGB + smote
[INFO] Pipeline saved: models/stress_pipeline.joblib (0.1 MB)
[DONE] stress_pipeline.joblib is ready for Phase 2

  Outputs:
    models/stress_pipeline.joblib  ← deploy this
    results/loso_comparison.csv    ← model comparison metrics
    results/features.csv           ← cached features (fast rerun)
```

---

### Step 2 — After first time (fast retrain, ~30 sec)

```bash
bash run.sh fast
```

Skips feature extraction (uses saved `results/features.csv`), goes straight to training.

---

### Step 3 — See the train/test split clearly

```bash
bash run.sh eval
```

```
══ LOSO CROSS-VALIDATION ══
Each row = train on 14 subjects, test on 1

Fold  Test Subject  Train Samples  Test Samples    F1   Recall    AUC
1     S10           1396           103           0.738   1.000   0.994
2     S11           1397           102           0.807   1.000   1.000
3     S13           1397           102           0.977   0.955   1.000
4     S14           1397           102           0.087   0.045   1.000  ← outlier
5     S15           1398           101           0.718   0.609   0.970
...
15    S9            1400            99           0.833   0.714   0.994

FINAL RESULTS:
  F1 Score : 0.789 ± 0.215
  Recall   : 0.803 ± 0.259
  ROC-AUC  : 0.988 ± 0.016

  Training F1 = 1.000  ← expected, model saw this data (not the real score)
  LOSO F1     = 0.789  ← THIS is the real generalization score
```

---

### Step 4 — Just run tests (no training)

```bash
bash run.sh test
```

---

## Understanding the Scores

| Score | Value | What it means |
|-------|-------|---------------|
| LOSO F1 = 0.789 | Good | 78.9% accuracy balancing catching stress vs false alarms |
| ROC-AUC = 0.988 | Excellent | Nearly perfect at ranking windows by stress level |
| Training F1 = 1.0 | Expected | Model memorized its own training data — normal, ignore |
| S14 F1 = 0.087 | Outlier | That person's physiology is very different from others |

> S14 being a bad fold is a known problem in biosignal ML called
> **inter-subject variability** — people's physiological responses to stress
> vary widely. The DASS-21 layer in Phase 2 partially compensates for this.

---

## The File That Goes to Phase 2

```
models/stress_pipeline.joblib
```

Contains 3 steps bundled together:

```python
pipeline = joblib.load("models/stress_pipeline.joblib")

# Use it like this (Phase 2 FastAPI will do this):
features = [[72.5, 8.3, 42.1, 51.2, 12, 0.24,   # HRV features
             0.65, 0.12, 0.001, 3, 0.42, 0.91,   # EDA features
             33.5, 0.15, -0.002]]                 # TEMP features

stress_prob = pipeline.predict_proba(features)[0][1]
# → 0.73 means 73% confident this is a stress window
```

That `stress_prob` goes into the hybrid scoring formula with the DASS-21 modifier.
