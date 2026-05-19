"""
HRV feature extraction from BVP/PPG signals.

Extracts 6 time-domain HRV features from a BVP window:
mean_hr, std_hr, rmssd, sdnn, nn50, pnn50.

The pipeline: filtered BVP → systolic peak detection → RR intervals → features.

References: Spec Section 7.1 (BVP → HRV Features).
"""

import numpy as np
from scipy.signal import find_peaks

from src.config import SR_BVP, HRV_FEATURES


def _hrv_fallback() -> dict:
    """Return NaN feature dict when peak detection yields insufficient data."""
    return {name: np.nan for name in HRV_FEATURES}


def extract_hrv_features(bvp_window: np.ndarray,
                         sr: int = SR_BVP) -> dict:
    """Extract 6 time-domain HRV features from a BVP window.

    Parameters
    ----------
    bvp_window : np.ndarray
        Pre-filtered BVP segment (1D). Expected length: window_sec × sr.
    sr : int
        Sampling rate in Hz (default: 64 Hz for WESAD BVP).

    Returns
    -------
    dict
        Keys: mean_hr, std_hr, rmssd, sdnn, nn50, pnn50.
        Values are np.nan if peak detection fails.
    """
    if len(bvp_window) < sr * 5:
        # Less than 5 seconds — unreliable HRV
        return _hrv_fallback()

    # ── Peak Detection ───────────────────────────────────────────────────
    # min_distance: at 240 BPM, interval = 0.25s → sr * 0.25 samples
    min_distance = int(sr * 0.3)  # conservative: max ~200 BPM

    # Adaptive height threshold: peaks above signal mean
    height_threshold = np.mean(bvp_window)

    peaks, _ = find_peaks(
        bvp_window,
        distance=min_distance,
        height=height_threshold,
    )

    if len(peaks) < 3:
        return _hrv_fallback()

    # ── RR Intervals (milliseconds) ─────────────────────────────────────
    rr_samples = np.diff(peaks)
    rr_ms = rr_samples / sr * 1000.0

    # Filter to physiologically plausible range: 300–2000 ms (30–200 BPM)
    rr_ms = rr_ms[(rr_ms > 300) & (rr_ms < 2000)]

    if len(rr_ms) < 2:
        return _hrv_fallback()

    # ── HRV Features ────────────────────────────────────────────────────
    hr_bpm = 60000.0 / rr_ms  # Convert RR (ms) to heart rate (BPM)
    rr_diff = np.abs(np.diff(rr_ms))  # Successive RR differences

    mean_hr = float(np.mean(hr_bpm))
    std_hr = float(np.std(hr_bpm, ddof=0))
    rmssd = float(np.sqrt(np.mean(rr_diff ** 2)))
    sdnn = float(np.std(rr_ms, ddof=0))
    nn50 = int(np.sum(rr_diff > 50))
    pnn50 = float(nn50 / len(rr_diff)) if len(rr_diff) > 0 else 0.0

    return {
        "mean_hr": mean_hr,
        "std_hr": std_hr,
        "rmssd": rmssd,
        "sdnn": sdnn,
        "nn50": nn50,
        "pnn50": pnn50,
    }
