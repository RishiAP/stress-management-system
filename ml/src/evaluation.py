"""
LOSO cross-validation and model comparison.

Implements Leave-One-Subject-Out cross-validation with three models
(Random Forest, XGBoost, LightGBM) and three class imbalance strategies
(none, weighted, SMOTE) for a total of 9 experimental conditions.

References: Spec Section 10 (LOSO), Section 9 (Class Imbalance),
            Section 12 (Evaluation Metrics).
"""

import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from src.config import (
    SUBJECTS, FEATURE_NAMES,
    RANDOM_STATE, N_ESTIMATORS, RESULTS_DIR,
)

logger = logging.getLogger(__name__)


def get_model(model_name: str):
    """Instantiate a fresh model by name.

    Parameters
    ----------
    model_name : str
        One of "RF", "XGB", "LGBM".

    Returns
    -------
    Classifier instance (unfitted).
    """
    if model_name == "RF":
        return RandomForestClassifier(
            n_estimators=N_ESTIMATORS,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    elif model_name == "XGB":
        return XGBClassifier(
            n_estimators=N_ESTIMATORS,
            eval_metric="logloss",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    elif model_name == "LGBM":
        return LGBMClassifier(
            n_estimators=N_ESTIMATORS,
            random_state=RANDOM_STATE,
            verbose=-1,
            n_jobs=-1,
        )
    else:
        raise ValueError(f"Unknown model: {model_name}")


def apply_imbalance_strategy(model, model_name: str, strategy: str,
                             y_train: np.ndarray):
    """Configure a model for class imbalance handling.

    Parameters
    ----------
    model : classifier
        The model instance to configure (mutated in place).
    model_name : str
        "RF", "XGB", or "LGBM".
    strategy : str
        "none", "weighted", or "smote".
    y_train : np.ndarray
        Training labels (used to compute scale_pos_weight for XGB).

    Returns
    -------
    classifier
        The same model, configured for the strategy.
    """
    if strategy == "weighted":
        n_neg = int(np.sum(y_train == 0))
        n_pos = int(np.sum(y_train == 1))

        if model_name == "XGB":
            model.set_params(scale_pos_weight=n_neg / max(n_pos, 1))
        else:
            model.set_params(class_weight="balanced")

    return model


def loso_cv(df: pd.DataFrame, model_name: str,
            imbalance_strategy: str = "weighted") -> dict:
    """Run Leave-One-Subject-Out cross-validation.

    Parameters
    ----------
    df : pd.DataFrame
        Full feature matrix with columns: FEATURE_NAMES + "label" + "subject".
    model_name : str
        One of "RF", "XGB", "LGBM".
    imbalance_strategy : str
        One of "none", "weighted", "smote".

    Returns
    -------
    dict
        Keys: "f1", "precision", "recall", "roc_auc", "accuracy", "subject".
        Each value is a list of per-fold scores.
    """
    results = {
        "f1": [], "precision": [], "recall": [],
        "roc_auc": [], "accuracy": [], "subject": [],
    }

    subjects = sorted(df["subject"].unique())

    for test_subject in subjects:
        train_df = df[df["subject"] != test_subject]
        test_df = df[df["subject"] == test_subject]

        if len(test_df) == 0 or test_df["label"].nunique() < 2:
            logger.warning(
                "Skipping fold %s: no test data or single-class test set",
                test_subject,
            )
            continue

        X_train = train_df[FEATURE_NAMES].values.copy()
        y_train = train_df["label"].values.copy()
        X_test = test_df[FEATURE_NAMES].values.copy()
        y_test = test_df["label"].values.copy()

        # ── Handle NaN from failed HRV extraction ───────────────────────
        imputer = SimpleImputer(strategy="median")
        X_train = imputer.fit_transform(X_train)
        X_test = imputer.transform(X_test)

        # ── Scale features ──────────────────────────────────────────────
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)

        # ── Apply SMOTE if requested (on training data only) ────────────
        if imbalance_strategy == "smote":
            from imblearn.over_sampling import SMOTE
            sm = SMOTE(random_state=RANDOM_STATE)
            try:
                X_train, y_train = sm.fit_resample(X_train, y_train)
            except ValueError as e:
                logger.warning("SMOTE failed for fold %s: %s", test_subject, e)
                # Fall back to no resampling for this fold

        # ── Train model ─────────────────────────────────────────────────
        model = get_model(model_name)
        model = apply_imbalance_strategy(model, model_name,
                                         imbalance_strategy, y_train)
        model.fit(X_train, y_train)

        # ── Evaluate ────────────────────────────────────────────────────
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]

        results["f1"].append(f1_score(y_test, y_pred, zero_division=0))
        results["precision"].append(precision_score(y_test, y_pred, zero_division=0))
        results["recall"].append(recall_score(y_test, y_pred, zero_division=0))
        results["roc_auc"].append(roc_auc_score(y_test, y_proba))
        results["accuracy"].append(accuracy_score(y_test, y_pred))
        results["subject"].append(test_subject)

        logger.info(
            "  Fold %s: F1=%.3f, Prec=%.3f, Rec=%.3f, AUC=%.3f",
            test_subject,
            results["f1"][-1], results["precision"][-1],
            results["recall"][-1], results["roc_auc"][-1],
        )

    return results


def run_full_comparison(df: pd.DataFrame) -> pd.DataFrame:
    """Run the full 3×3 model comparison experiment.

    3 models (RF, XGB, LGBM) × 3 imbalance strategies (none, weighted, smote)
    = 9 LOSO evaluations.

    Parameters
    ----------
    df : pd.DataFrame
        Full feature matrix.

    Returns
    -------
    pd.DataFrame
        Summary table with columns: model, strategy, metric, mean, std.
    """
    all_results = []
    model_names = ["RF", "XGB", "LGBM"]
    strategies = ["none", "weighted", "smote"]

    for model_name in model_names:
        for strategy in strategies:
            logger.info("=" * 60)
            logger.info("Running LOSO: model=%s, strategy=%s", model_name, strategy)
            logger.info("=" * 60)

            res = loso_cv(df, model_name, strategy)

            for metric in ["f1", "precision", "recall", "roc_auc", "accuracy"]:
                vals = res[metric]
                if vals:
                    all_results.append({
                        "model": model_name,
                        "strategy": strategy,
                        "metric": metric,
                        "mean": float(np.mean(vals)),
                        "std": float(np.std(vals)),
                    })

    comparison_df = pd.DataFrame(all_results)

    # Save to CSV
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS_DIR / "loso_comparison.csv"
    comparison_df.to_csv(out_path, index=False)
    logger.info("Comparison results saved to %s", out_path)

    return comparison_df


def print_comparison_summary(comparison_df: pd.DataFrame) -> None:
    """Print a formatted summary of the model comparison."""
    # Pivot to show F1 scores prominently
    f1_df = comparison_df[comparison_df["metric"] == "f1"].copy()
    f1_df["summary"] = f1_df.apply(
        lambda r: f"{r['mean']:.3f} ± {r['std']:.3f}", axis=1
    )

    print("\n" + "=" * 60)
    print("LOSO Cross-Validation Results — F1 Score (mean ± std)")
    print("=" * 60)

    pivot = f1_df.pivot(index="model", columns="strategy", values="summary")
    pivot = pivot.reindex(columns=["none", "weighted", "smote"])
    print(pivot.to_string())

    # Find best combination
    best_idx = f1_df["mean"].idxmax()
    best = f1_df.loc[best_idx]
    print(f"\nBest: {best['model']} + {best['strategy']} "
          f"→ F1 = {best['mean']:.3f} ± {best['std']:.3f}")
    print("=" * 60)
