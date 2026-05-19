"""
EDA / GSR feature extraction.

Extracts 6 features from an EDA window:
mean_eda, std_eda, slope_eda, peak_count, min_eda, max_eda.

References: Spec Section 7.2 (EDA / GSR Features).
"""

import numpy as np
from scipy.signal import find_peaks

from src.config import SR_EDA


def extract_eda_features(eda_window: np.ndarray,
                         sr: int = SR_EDA) -> dict:
    """Extract 6 EDA features from a preprocessed EDA window.

    Parameters
    ----------
    eda_window : np.ndarray
        Pre-filtered EDA segment (1D). Expected length: window_sec × sr.
    sr : int
        Sampling rate in Hz (default: 4 Hz for WESAD EDA).

    Returns
    -------
    dict
        Keys: mean_eda, std_eda, slope_eda, peak_count, min_eda, max_eda.
    """
    mean_eda = float(np.mean(eda_window))
    std_eda = float(np.std(eda_window, ddof=0))
    min_eda = float(np.min(eda_window))
    max_eda = float(np.max(eda_window))

    # ── Linear trend (slope) ────────────────────────────────────────────
    if len(eda_window) > 1:
        x = np.arange(len(eda_window), dtype=np.float64)
        coeffs = np.polyfit(x, eda_window, deg=1)
        slope_eda = float(coeffs[0])
    else:
        slope_eda = 0.0

    # ── SCR peak detection ──────────────────────────────────────────────
    # Skin conductance responses appear as transient peaks.
    # Use a small prominence threshold to catch subtle responses.
    peaks, _ = find_peaks(eda_window, prominence=0.01)
    peak_count = int(len(peaks))

    return {
        "mean_eda": mean_eda,
        "std_eda": std_eda,
        "slope_eda": slope_eda,
        "peak_count": peak_count,
        "min_eda": min_eda,
        "max_eda": max_eda,
    }
