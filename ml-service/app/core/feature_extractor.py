"""
Feature extraction for ML inference.

CRITICAL: This module's logic MUST exactly match the Phase 1 training pipeline.
The functions are copied from ml/src/features/ and ml/src/preprocessing.py,
adapted only for ESP32 sampling rates (100 Hz BVP, 10 Hz GSR, 1 Hz TEMP).

Any deviation — even a single filter parameter — will silently degrade
model accuracy with no error thrown.

Feature vector column order (must match training):
    [mean_hr, std_hr, rmssd, sdnn, nn50, pnn50,
     mean_eda, std_eda, slope_eda, peak_count, min_eda, max_eda,
     mean_temp, std_temp, slope_temp]
"""

import numpy as np
from scipy.signal import butter, filtfilt, find_peaks

# ── Constants ────────────────────────────────────────────────────────────────
# Must match ml/src/config.py FEATURE_NAMES exactly
FEATURE_ORDER = [
    "mean_hr", "std_hr", "rmssd", "sdnn", "nn50", "pnn50",
    "mean_eda", "std_eda", "slope_eda", "peak_count", "min_eda", "max_eda",
    "mean_temp", "std_temp", "slope_temp",
]

# ESP32 default sampling rates (different from WESAD training rates,
# but the feature math adapts via the sr/fs parameter)
DEFAULT_BVP_FS = 100  # Hz — ESP32 PPG sensor
DEFAULT_GSR_FS = 10   # Hz — ESP32 GSR sensor
DEFAULT_TEMP_FS = 1   # Hz — ESP32 temperature sensor

# BVP bandpass filter bounds — matches Phase 1 exactly
BVP_BANDPASS_LOW = 0.5   # Hz (30 BPM)
BVP_BANDPASS_HIGH = 4.0  # Hz (240 BPM)


# ═══════════════════════════════════════════════════════════════════════════
#  PREPROCESSING — copied from ml/src/preprocessing.py
# ═══════════════════════════════════════════════════════════════════════════

def preprocess_bvp(bvp: np.ndarray, fs: int = DEFAULT_BVP_FS) -> np.ndarray:
    """Bandpass filter BVP signal (0.5–4.0 Hz, order 3 Butterworth).

    Identical to Phase 1 preprocessing.preprocess_bvp(), parameterized for
    ESP32's 100 Hz sampling rate.
    """
    nyq = fs / 2.0
    low = max(BVP_BANDPASS_LOW / nyq, 1e-5)
    high = min(BVP_BANDPASS_HIGH / nyq, 1.0 - 1e-5)

    b, a = butter(N=3, Wn=[low, high], btype="band")

    min_length = 3 * max(len(a), len(b)) + 1
    if len(bvp) < min_length:
        return bvp.copy()

    return filtfilt(b, a, bvp)


def preprocess_eda(eda: np.ndarray, fs: int = DEFAULT_GSR_FS) -> np.ndarray:
    """Lowpass filter EDA/GSR signal (1.0 Hz cutoff, order 2 Butterworth).

    Identical to Phase 1 preprocessing.preprocess_eda(), parameterized for
    ESP32's 10 Hz sampling rate.
    """
    nyq = fs / 2.0
    cutoff = min(1.0 / nyq, 1.0 - 1e-5)

    b, a = butter(N=2, Wn=cutoff, btype="low")

    min_length = 3 * max(len(a), len(b)) + 1
    if len(eda) < min_length:
        return eda.copy()

    return filtfilt(b, a, eda)


# ═══════════════════════════════════════════════════════════════════════════
#  HRV FEATURES — copied from ml/src/features/hrv.py
# ═══════════════════════════════════════════════════════════════════════════

def extract_hrv_features(bvp_window: np.ndarray,
                         fs: int = DEFAULT_BVP_FS) -> dict:
    """Extract 6 time-domain HRV features from a BVP window.

    Identical logic to Phase 1 hrv.extract_hrv_features().

    Parameters
    ----------
    bvp_window : np.ndarray
        Pre-filtered BVP segment (1D).
    fs : int
        Sampling rate in Hz (default: 100 Hz for ESP32).

    Returns
    -------
    dict
        Keys: mean_hr, std_hr, rmssd, sdnn, nn50, pnn50.

    Raises
    ------
    ValueError
        If fewer than 5 valid RR intervals are detected (flat/noisy signal).
    """
    if len(bvp_window) < fs * 5:
        raise ValueError(
            f"BVP window too short for HRV: {len(bvp_window)} samples "
            f"(need at least {fs * 5} = 5 seconds at {fs} Hz)"
        )

    # ── Peak Detection ─────────────────────────────────────────────────
    # Same parameters as Phase 1: distance = sr * 0.3 (max ~200 BPM)
    min_distance = int(fs * 0.3)
    height_threshold = np.mean(bvp_window)

    peaks, _ = find_peaks(
        bvp_window,
        distance=min_distance,
        height=height_threshold,
    )

    if len(peaks) < 3:
        raise ValueError(
            f"Too few peaks detected in BVP: {len(peaks)} "
            f"(need at least 3). Signal may be flat or noisy."
        )

    # ── RR Intervals (milliseconds) ───────────────────────────────────
    rr_samples = np.diff(peaks)
    rr_ms = rr_samples / fs * 1000.0

    # Filter to physiologically plausible range: 300–2000 ms (30–200 BPM)
    rr_ms = rr_ms[(rr_ms > 300) & (rr_ms < 2000)]

    if len(rr_ms) < 2:
        raise ValueError(
            "Insufficient valid RR intervals after filtering. "
            "Signal may not contain detectable heartbeats."
        )

    # ── HRV Features ──────────────────────────────────────────────────
    hr_bpm = 60000.0 / rr_ms
    rr_diff = np.abs(np.diff(rr_ms))

    return {
        "mean_hr": float(np.mean(hr_bpm)),
        "std_hr": float(np.std(hr_bpm, ddof=0)),
        "rmssd": float(np.sqrt(np.mean(rr_diff ** 2))),
        "sdnn": float(np.std(rr_ms, ddof=0)),
        "nn50": int(np.sum(rr_diff > 50)),
        "pnn50": float(np.sum(rr_diff > 50) / len(rr_diff)) if len(rr_diff) > 0 else 0.0,
    }


# ═══════════════════════════════════════════════════════════════════════════
#  EDA FEATURES — copied from ml/src/features/eda.py
# ═══════════════════════════════════════════════════════════════════════════

def extract_eda_features(eda_window: np.ndarray,
                         fs: int = DEFAULT_GSR_FS) -> dict:
    """Extract 6 EDA features from a GSR/EDA window.

    Identical logic to Phase 1 eda.extract_eda_features().

    Parameters
    ----------
    eda_window : np.ndarray
        Pre-filtered EDA segment (1D).
    fs : int
        Sampling rate in Hz (default: 10 Hz for ESP32).

    Returns
    -------
    dict
        Keys: mean_eda, std_eda, slope_eda, peak_count, min_eda, max_eda.
    """
    mean_eda = float(np.mean(eda_window))
    std_eda = float(np.std(eda_window, ddof=0))
    min_eda = float(np.min(eda_window))
    max_eda = float(np.max(eda_window))

    # ── Linear trend (slope) ──────────────────────────────────────────
    if len(eda_window) > 1:
        x = np.arange(len(eda_window), dtype=np.float64)
        coeffs = np.polyfit(x, eda_window, deg=1)
        slope_eda = float(coeffs[0])
    else:
        slope_eda = 0.0

    # ── SCR peak detection — same prominence=0.01 as Phase 1 ─────────
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


# ═══════════════════════════════════════════════════════════════════════════
#  TEMPERATURE FEATURES — copied from ml/src/features/temperature.py
# ═══════════════════════════════════════════════════════════════════════════

def extract_temp_features(temp_window: np.ndarray) -> dict:
    """Extract 3 temperature features.

    Identical logic to Phase 1 temperature.extract_temp_features().
    No filtering at 1 Hz — too few samples for meaningful smoothing.

    Parameters
    ----------
    temp_window : np.ndarray
        Raw temperature segment (1D).

    Returns
    -------
    dict
        Keys: mean_temp, std_temp, slope_temp.
    """
    mean_temp = float(np.mean(temp_window))
    std_temp = float(np.std(temp_window, ddof=0))

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


# ═══════════════════════════════════════════════════════════════════════════
#  ORCHESTRATOR — builds the (1, 15) feature vector for the pipeline
# ═══════════════════════════════════════════════════════════════════════════

def build_feature_vector(
    bvp_window: list[float],
    gsr_window: list[float],
    temp_window: list[float],
    bvp_fs: int = DEFAULT_BVP_FS,
    gsr_fs: int = DEFAULT_GSR_FS,
) -> tuple[np.ndarray, dict]:
    """Preprocess signals, extract features, assemble into model input.

    Parameters
    ----------
    bvp_window : list[float]
        Raw BVP/PPG values from ESP32.
    gsr_window : list[float]
        Raw GSR/EDA values from ESP32.
    temp_window : list[float]
        Raw temperature values from ESP32.
    bvp_fs : int
        BVP sampling rate (default: 100 Hz).
    gsr_fs : int
        GSR sampling rate (default: 10 Hz).

    Returns
    -------
    tuple[np.ndarray, dict]
        - Feature vector with shape (1, 15), column order matches training.
        - Dict of feature name → value for response transparency.

    Raises
    ------
    ValueError
        If HRV extraction fails (flat/noisy BVP, insufficient peaks).
    """
    bvp = np.array(bvp_window, dtype=np.float64)
    gsr = np.array(gsr_window, dtype=np.float64)
    temp = np.array(temp_window, dtype=np.float64)

    # ── Preprocess ─────────────────────────────────────────────────────
    bvp_filtered = preprocess_bvp(bvp, fs=bvp_fs)
    gsr_filtered = preprocess_eda(gsr, fs=gsr_fs)
    # No TEMP filter at 1 Hz — too few samples

    # ── Extract features ───────────────────────────────────────────────
    hrv_feats = extract_hrv_features(bvp_filtered, fs=bvp_fs)
    eda_feats = extract_eda_features(gsr_filtered, fs=gsr_fs)
    temp_feats = extract_temp_features(temp)

    # ── Assemble in EXACT training order ───────────────────────────────
    all_feats = {}
    all_feats.update(hrv_feats)
    all_feats.update(eda_feats)
    all_feats.update(temp_feats)

    # Build vector in the exact column order the model was trained on
    feature_vector = np.array(
        [[all_feats[name] for name in FEATURE_ORDER]],
        dtype=np.float64,
    )

    return feature_vector, all_feats
