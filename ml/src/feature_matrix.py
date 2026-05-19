"""
Feature matrix assembly.

Orchestrates the full per-subject pipeline:
  load → preprocess → window → extract features → DataFrame

Processes one subject at a time to stay within 16 GB RAM (each pickle is ~1 GB).

References: Spec Section 14 (Training Pipeline), Section 5 (Hardware Constraints).
"""
from __future__ import annotations

import logging
from typing import List, Optional

import pandas as pd
from tqdm import tqdm

from src.config import SUBJECTS, FEATURE_NAMES
from src.data_loader import load_subject
from src.preprocessing import preprocess_bvp, preprocess_eda, preprocess_temp
from src.windowing import create_windows
from src.features.hrv import extract_hrv_features
from src.features.eda import extract_eda_features
from src.features.temperature import extract_temp_features

logger = logging.getLogger(__name__)


def extract_features_from_window(window: dict) -> dict:
    """Extract all 15 features from a single window.

    Parameters
    ----------
    window : dict
        Must contain "bvp", "eda", "temp" numpy arrays.

    Returns
    -------
    dict
        Feature name → value mapping (15 features).
    """
    features = {}
    features.update(extract_hrv_features(window["bvp"]))
    features.update(extract_eda_features(window["eda"]))
    features.update(extract_temp_features(window["temp"]))
    return features


def build_feature_matrix_for_subject(subject_id: str) -> pd.DataFrame:
    """Run the full pipeline for one subject.

    Parameters
    ----------
    subject_id : str
        e.g. "S2", "S3", ..., "S17" (not "S12").

    Returns
    -------
    pd.DataFrame
        Columns: 15 feature columns + "label" (int) + "subject" (str).
        One row per valid window.
    """
    # 1. Load raw signals + downsampled labels
    raw = load_subject(subject_id)

    # 2. Preprocess each signal modality
    raw["bvp"] = preprocess_bvp(raw["bvp"])
    raw["eda"] = preprocess_eda(raw["eda"])
    raw["temp"] = preprocess_temp(raw["temp"])

    # 3. Segment into windows, assign labels
    windows = create_windows(raw)

    if not windows:
        logger.warning("%s: no valid windows produced", subject_id)
        return pd.DataFrame(columns=FEATURE_NAMES + ["label", "subject"])

    # 4. Extract features per window
    rows = []
    for w in windows:
        feats = extract_features_from_window(w)
        feats["label"] = w["label"]
        feats["subject"] = subject_id
        rows.append(feats)

    df = pd.DataFrame(rows)

    # Log class distribution (using debug so it doesn't break the progress bar visually)
    n_stress = int(df["label"].sum())
    n_non_stress = len(df) - n_stress
    nan_count = int(df[FEATURE_NAMES].isna().any(axis=1).sum())
    logger.debug(
        "%s: %d windows (stress=%d, non-stress=%d, rows_with_nan=%d)",
        subject_id, len(df), n_stress, n_non_stress, nan_count,
    )

    return df


def build_full_dataset(subjects: Optional[List[str]] = None) -> pd.DataFrame:
    """Build the complete feature matrix across all subjects.

    Processes subjects one at a time to keep memory usage bounded.

    Parameters
    ----------
    subjects : list of str, optional
        Subject IDs to process. Defaults to all 15 WESAD subjects.

    Returns
    -------
    pd.DataFrame
        Complete feature matrix. Columns: FEATURE_NAMES + "label" + "subject".
    """
    if subjects is None:
        subjects = SUBJECTS

    frames = []
    # tqdm creates a real-time progress bar!
    for sid in tqdm(subjects, desc="Extracting Features", unit="subject"):
        logger.debug("Processing %s...", sid)
        df = build_feature_matrix_for_subject(sid)
        frames.append(df)

    full_df = pd.concat(frames, ignore_index=True)

    # Summary statistics
    total = len(full_df)
    stress = int(full_df["label"].sum())
    nan_rows = int(full_df[FEATURE_NAMES].isna().any(axis=1).sum())
    logger.info(
        "Full dataset: %d windows total, stress=%d (%.1f%%), "
        "non_stress=%d (%.1f%%), rows_with_any_nan=%d (%.1f%%)",
        total, stress, stress / total * 100,
        total - stress, (total - stress) / total * 100,
        nan_rows, nan_rows / total * 100,
    )

    return full_df
