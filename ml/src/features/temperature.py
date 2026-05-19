"""
Temperature feature extraction.

Extracts 3 features from a TEMP window:
mean_temp, std_temp, slope_temp.

References: Spec Section 7.3 (Temperature Features).
"""

import numpy as np

from src.config import SR_TEMP


def extract_temp_features(temp_window: np.ndarray,
                          sr: int = SR_TEMP) -> dict:
    """Extract 3 temperature features from a preprocessed TEMP window.

    Parameters
    ----------
    temp_window : np.ndarray
        Pre-filtered temperature segment (1D). Expected length: window_sec × sr.
    sr : int
        Sampling rate in Hz (default: 4 Hz for WESAD TEMP).

    Returns
    -------
    dict
        Keys: mean_temp, std_temp, slope_temp.
    """
    mean_temp = float(np.mean(temp_window))
    std_temp = float(np.std(temp_window, ddof=0))

    # ── Temperature trend ───────────────────────────────────────────────
    if len(temp_window) > 1:
        x = np.arange(len(temp_window), dtype=np.float64)
        coeffs = np.polyfit(x, temp_window, deg=1)
        slope_temp = float(coeffs[0])
    else:
        slope_temp = 0.0

    return {
        "mean_temp": mean_temp,
        "std_temp": std_temp,
        "slope_temp": slope_temp,
    }
