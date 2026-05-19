"""
evaluate.py — Beginner-friendly ML evaluation script.

Shows exactly what happens during training and testing:
- How the dataset is split (LOSO)
- What the model sees during training vs testing
- Per-fold results
- Final averaged metrics

Run with:
    python evaluate.py
"""

import warnings
warnings.filterwarnings("ignore")  # keep output clean

import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score, accuracy_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
import joblib

# ─── Load the feature matrix ───────────────────────────────────────────────────
FEATURES_CSV = Path("results/features.csv")
MODEL_PATH   = Path("models/stress_pipeline.joblib")

if not FEATURES_CSV.exists():
    print("ERROR: features.csv not found. Run  bash run.sh  first.")
    exit(1)

df = pd.read_csv(FEATURES_CSV)

FEATURE_COLS = [
    "mean_hr", "std_hr", "rmssd", "sdnn", "nn50", "pnn50",
    "mean_eda", "std_eda", "slope_eda", "peak_count", "min_eda", "max_eda",
    "mean_temp", "std_temp", "slope_temp",
]

subjects = sorted(df["subject"].unique())

# ─── Print dataset overview ────────────────────────────────────────────────────
print("=" * 65)
print("  DATASET OVERVIEW")
print("=" * 65)
print(f"  Total subjects   : {len(subjects)}")
print(f"  Total windows    : {len(df)}")
print(f"  Stress windows   : {int(df['label'].sum())}  (label = 1)")
print(f"  Non-stress wins  : {int((df['label'] == 0).sum())}  (label = 0)")
print(f"  Features per win : {len(FEATURE_COLS)}")
print()
print("  Windows per subject:")
for s in subjects:
    sub = df[df["subject"] == s]
    n_stress = int(sub["label"].sum())
    n_calm   = len(sub) - n_stress
    print(f"    {s:4s}  total={len(sub):3d}  stress={n_stress:2d}  calm={n_calm:2d}")

# ─── LOSO Cross-Validation ─────────────────────────────────────────────────────
print()
print("=" * 65)
print("  LOSO CROSS-VALIDATION  (Leave-One-Subject-Out)")
print("  Each row = one fold: train on 14 subjects, test on 1")
print("=" * 65)
print(f"  {'Fold':<6} {'Test Subject':<14} {'Train Samples':<15} {'Test Samples':<13} {'F1':>6} {'Recall':>8} {'AUC':>7} {'Acc':>6}")
print("  " + "-" * 70)

fold_results = []

for fold_num, test_subject in enumerate(subjects, start=1):
    # ── Split ──────────────────────────────────────────────────
    train_df = df[df["subject"] != test_subject]   # 14 subjects
    test_df  = df[df["subject"] == test_subject]   # 1 subject

    X_train = train_df[FEATURE_COLS].values
    y_train = train_df["label"].values.astype(int)
    X_test  = test_df[FEATURE_COLS].values
    y_test  = test_df["label"].values.astype(int)

    # ── Preprocess + Train (inside fold to prevent data leakage) ──
    imputer = SimpleImputer(strategy="median")
    X_train = imputer.fit_transform(X_train)   # fit ONLY on train
    X_test  = imputer.transform(X_test)        # apply same transform to test

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)    # fit ONLY on train
    X_test  = scaler.transform(X_test)         # apply same transform to test

    model = XGBClassifier(n_estimators=100, eval_metric="logloss",
                          random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    # ── Evaluate on the held-out test subject ──────────────────
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    f1  = f1_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_proba)
    acc = accuracy_score(y_test, y_pred)

    fold_results.append({"subject": test_subject, "f1": f1,
                         "recall": rec, "auc": auc, "acc": acc,
                         "n_train": len(y_train), "n_test": len(y_test)})

    print(f"  {fold_num:<6} {test_subject:<14} {len(y_train):<15} {len(y_test):<13} {f1:>6.3f} {rec:>8.3f} {auc:>7.3f} {acc:>6.3f}")

# ─── Aggregate results ─────────────────────────────────────────────────────────
results_df = pd.DataFrame(fold_results)

print()
print("=" * 65)
print("  FINAL RESULTS  (mean ± std across all 15 folds)")
print("=" * 65)
print(f"  F1 Score  : {results_df['f1'].mean():.3f} ± {results_df['f1'].std():.3f}")
print(f"  Recall    : {results_df['recall'].mean():.3f} ± {results_df['recall'].std():.3f}")
print(f"  ROC-AUC   : {results_df['auc'].mean():.3f} ± {results_df['auc'].std():.3f}")
print(f"  Accuracy  : {results_df['acc'].mean():.3f} ± {results_df['acc'].std():.3f}")
print()
print(f"  Best fold : {results_df.loc[results_df['f1'].idxmax(), 'subject']}  "
      f"(F1={results_df['f1'].max():.3f})")
print(f"  Worst fold: {results_df.loc[results_df['f1'].idxmin(), 'subject']}  "
      f"(F1={results_df['f1'].min():.3f})")

# ─── Test the saved model artifact ─────────────────────────────────────────────
print()
print("=" * 65)
print("  TESTING THE EXPORTED MODEL  (stress_pipeline.joblib)")
print("=" * 65)

if not MODEL_PATH.exists():
    print("  WARNING: model not trained yet. Run  bash run.sh fast  first.")
else:
    pipeline = joblib.load(MODEL_PATH)

    # Re-evaluate on all data (just to show it loads and works)
    X_all = df[FEATURE_COLS].values
    y_all = df["label"].values.astype(int)
    y_pred_all = pipeline.predict(X_all)
    train_f1 = f1_score(y_all, y_pred_all)
    train_acc = accuracy_score(y_all, y_pred_all)

    print(f"  Pipeline steps : {[name for name, _ in pipeline.steps]}")
    print(f"  Training F1    : {train_f1:.3f}  (on all data — expected ~1.0, model knows this data)")
    print(f"  Training Acc   : {train_acc:.3f}")
    print()
    print("  NOTE: Training F1 being high (near 1.0) is NORMAL and expected.")
    print("  The LOSO F1 above is the real generalization score.")
    print()

    # Show a concrete prediction example
    print("  Example predictions:")
    examples = [
        ("High stress (fast HR, high EDA)",
         [102.0, 32.9, 311.8, 229.9, 64, 0.75, 3.40, 0.11, 0.000, 11, 3.14, 3.69, 32.6, 0.03, -0.000]),
        ("Low stress  (calm HR, low EDA) ",
         [80.5, 24.1, 241.0, 187.2, 45, 0.63, 1.36, 0.03, -0.000, 2, 1.30, 1.43, 32.7, 0.03, 0.000]),
    ]
    for desc, feats in examples:
        x = np.array([feats])
        proba = pipeline.predict_proba(x)[0]
        pred  = "STRESS" if pipeline.predict(x)[0] == 1 else "CALM"
        print(f"    {desc} → {pred}  (stress_prob={proba[1]:.2f})")

print()
print("=" * 65)
print("  Done. The model is ready for Phase 2 (FastAPI inference).")
print("=" * 65)
