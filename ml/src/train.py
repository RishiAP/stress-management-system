"""
Final model training and serialization.

Trains the best model/strategy combination on ALL subjects and serializes
as a single sklearn Pipeline artifact (scaler + model bundled together).

References: Spec Section 11 (Model Serialization), Section 8 (Normalization).
"""

import logging

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.config import FEATURE_NAMES, MODELS_DIR, PIPELINE_FILENAME
from src.evaluation import get_model, apply_imbalance_strategy

logger = logging.getLogger(__name__)


def train_final_model(df: pd.DataFrame,
                      model_name: str = "RF",
                      strategy: str = "weighted") -> Pipeline:
    """Train the final production model on all subjects.

    Parameters
    ----------
    df : pd.DataFrame
        Full feature matrix (all subjects).
    model_name : str
        Model to train: "RF", "XGB", or "LGBM".
    strategy : str
        Imbalance strategy: "none", "weighted", or "smote".

    Returns
    -------
    sklearn.pipeline.Pipeline
        Fitted pipeline: Imputer → StandardScaler → Model.
    """
    X = df[FEATURE_NAMES].values
    y = df["label"].values.astype(int)

    logger.info(
        "Training final model: %s + %s on %d samples (%d stress, %d non-stress)",
        model_name, strategy, len(y), int(y.sum()), int((1 - y).sum()),
    )

    # ── Handle SMOTE before pipeline (needs resampled data) ─────────────
    if strategy == "smote":
        from imblearn.over_sampling import SMOTE
        # Impute NaN first so SMOTE can work
        imp = SimpleImputer(strategy="median")
        X_clean = imp.fit_transform(X)
        sm = SMOTE(random_state=42)
        X_resampled, y_resampled = sm.fit_resample(X_clean, y)
        logger.info(
            "SMOTE: %d → %d samples", len(y), len(y_resampled),
        )
    else:
        X_resampled = X
        y_resampled = y

    # ── Build sklearn Pipeline ──────────────────────────────────────────
    model = get_model(model_name)
    model = apply_imbalance_strategy(model, model_name, strategy, y_resampled)

    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", model),
    ])

    pipeline.fit(X_resampled, y_resampled)

    return pipeline


def save_pipeline(pipeline: Pipeline, filename: str = PIPELINE_FILENAME) -> str:
    """Serialize the pipeline to disk.

    Parameters
    ----------
    pipeline : Pipeline
        Fitted sklearn Pipeline.
    filename : str
        Output filename (saved under MODELS_DIR).

    Returns
    -------
    str
        Absolute path to the saved file.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MODELS_DIR / filename

    joblib.dump(pipeline, out_path)

    size_mb = out_path.stat().st_size / 1e6
    logger.info("Pipeline saved: %s (%.1f MB)", out_path, size_mb)

    if size_mb > 50:
        logger.warning(
            "Pipeline size (%.1f MB) exceeds 50 MB target for Render deployment!",
            size_mb,
        )

    return str(out_path)


def verify_pipeline(pipeline_path: str, X_sample: np.ndarray) -> bool:
    """Verify that a serialized pipeline loads and produces valid output.

    Parameters
    ----------
    pipeline_path : str
        Path to the .joblib file.
    X_sample : np.ndarray
        A few sample feature vectors for testing (shape: [n, 15]).

    Returns
    -------
    bool
        True if verification passes.
    """
    loaded = joblib.load(pipeline_path)

    # Check predict_proba output shape
    proba = loaded.predict_proba(X_sample)
    assert proba.shape == (len(X_sample), 2), \
        f"Expected shape ({len(X_sample)}, 2), got {proba.shape}"

    # Check probabilities sum to 1
    sums = proba.sum(axis=1)
    assert np.allclose(sums, 1.0, atol=1e-6), \
        f"Probabilities don't sum to 1: {sums}"

    # Check predictions are binary
    preds = loaded.predict(X_sample)
    assert set(preds).issubset({0, 1}), \
        f"Unexpected predictions: {set(preds)}"

    logger.info("Pipeline verification PASSED (%s)", pipeline_path)
    return True
