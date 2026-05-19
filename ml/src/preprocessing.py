"""
Signal preprocessing for BVP, EDA, and TEMP modalities.

Each function applies noise-reduction filters appropriate for the signal type
and consumer-grade sensor characteristics.

References: Spec Section 7 (Feature Extraction), Section 14 (Signal Preprocessing).
"""

import numpy as np
from scipy.signal import butter, filtfilt, medfilt

from src.config import SR_BVP, SR_EDA, BVP_BANDPASS_LOW, BVP_BANDPASS_HIGH


def preprocess_bvp(bvp: np.ndarray, sr: int = SR_BVP) -> np.ndarray:
    """Apply bandpass filter to BVP signal.

    Passes frequencies in [0.5, 4.0] Hz corresponding to 30–240 BPM.
    Uses a 3rd-order Butterworth filter with zero-phase (filtfilt).

    Parameters
    ----------
    bvp : np.ndarray
        Raw BVP signal (1D).
    sr : int
        Sampling rate in Hz (default: 64 Hz for WESAD).

    Returns
    -------
    np.ndarray
        Filtered BVP signal, same length as input.
    """
    nyq = sr / 2.0
    low = BVP_BANDPASS_LOW / nyq
    high = BVP_BANDPASS_HIGH / nyq

    # Clamp to valid Butterworth range (0, 1)
    low = max(low, 1e-5)
    high = min(high, 1.0 - 1e-5)

    b, a = butter(N=3, Wn=[low, high], btype="band")

    # filtfilt requires signal length > padlen (default = 3 * max(len(a), len(b)))
    min_length = 3 * max(len(a), len(b)) + 1
    if len(bvp) < min_length:
        # Signal too short for filtfilt — return as-is with warning
        return bvp.copy()

    return filtfilt(b, a, bvp)


def preprocess_eda(eda: np.ndarray, sr: int = SR_EDA) -> np.ndarray:
    """Apply lowpass filter to EDA signal.

    Cuts off frequencies above 1 Hz to remove high-frequency noise while
    preserving the slow skin conductance level (SCL) and skin conductance
    response (SCR) components.

    Parameters
    ----------
    eda : np.ndarray
        Raw EDA signal (1D).
    sr : int
        Sampling rate in Hz (default: 4 Hz for WESAD).

    Returns
    -------
    np.ndarray
        Filtered EDA signal, same length as input.
    """
    nyq = sr / 2.0
    cutoff = 1.0 / nyq  # 1 Hz cutoff

    # At 4 Hz, nyq=2, cutoff=0.5 — well within (0, 1)
    cutoff = min(cutoff, 1.0 - 1e-5)

    b, a = butter(N=2, Wn=cutoff, btype="low")

    min_length = 3 * max(len(a), len(b)) + 1
    if len(eda) < min_length:
        return eda.copy()

    return filtfilt(b, a, eda)


def preprocess_temp(temp: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    """Apply median filter to TEMP signal for spike removal.

    Temperature changes slowly; median filtering removes transient spikes
    from sensor noise without distorting the underlying trend.

    Parameters
    ----------
    temp : np.ndarray
        Raw temperature signal (1D).
    kernel_size : int
        Median filter kernel size (must be odd). Default: 5 samples.

    Returns
    -------
    np.ndarray
        Smoothed temperature signal, same length as input.
    """
    if len(temp) < kernel_size:
        return temp.copy()

    return medfilt(temp, kernel_size=kernel_size)
