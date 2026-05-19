"""
WESAD dataset loader.

Loads per-subject pickle files, extracts wrist-device signals (BVP, EDA, TEMP),
and downsamples the 700 Hz label array to match each signal's sampling rate.

References: Spec Section 3 (Dataset), Section 14 (Training Pipeline).
"""

import pickle
import logging

import numpy as np

from src.config import WESAD_DIR, SR_BVP, SR_EDA, SR_TEMP, SR_LABEL

logger = logging.getLogger(__name__)


def downsample_labels(labels: np.ndarray, from_hz: int, to_hz: int,
                      target_length: int) -> np.ndarray:
    """Downsample a label array by taking every (from_hz // to_hz)-th sample.

    Parameters
    ----------
    labels : np.ndarray
        Label array at the source sampling rate (700 Hz).
    from_hz : int
        Source sampling rate (700 Hz for WESAD labels).
    to_hz : int
        Target sampling rate to downsample to.
    target_length : int
        Expected length of the output (the corresponding signal's length).
        The result is truncated or padded to match exactly.

    Returns
    -------
    np.ndarray
        Downsampled label array with length == target_length.
    """
    factor = from_hz // to_hz
    downsampled = labels[::factor]

    # Align to the signal length — truncate or pad (repeat last) as needed
    if len(downsampled) >= target_length:
        return downsampled[:target_length]
    else:
        # Rare: pad with the last label value to match signal length
        pad_length = target_length - len(downsampled)
        logger.warning(
            "Label array shorter than signal by %d samples after downsampling "
            "(from_hz=%d, to_hz=%d). Padding with last label value.",
            pad_length, from_hz, to_hz,
        )
        return np.pad(downsampled, (0, pad_length), mode="edge")


def load_subject(subject_id: str) -> dict:
    """Load a single WESAD subject's wrist signals and aligned labels.

    Parameters
    ----------
    subject_id : str
        Subject identifier, e.g. "S2", "S3", ..., "S17" (excluding "S12").

    Returns
    -------
    dict with keys:
        - "bvp"        : np.ndarray, shape (N_bvp,), BVP signal at 64 Hz
        - "eda"        : np.ndarray, shape (N_eda,), EDA signal at 4 Hz
        - "temp"       : np.ndarray, shape (N_temp,), TEMP signal at 4 Hz
        - "labels_bvp" : np.ndarray, shape (N_bvp,), labels at 64 Hz
        - "labels_eda" : np.ndarray, shape (N_eda,), labels at 4 Hz
        - "subject"    : str, the subject_id

    Raises
    ------
    FileNotFoundError
        If the pickle file does not exist.
    """
    pkl_path = WESAD_DIR / subject_id / f"{subject_id}.pkl"
    if not pkl_path.exists():
        raise FileNotFoundError(f"WESAD pickle not found: {pkl_path}")

    logger.debug("Loading %s from %s", subject_id, pkl_path)

    with open(pkl_path, "rb") as f:
        data = pickle.load(f, encoding="latin1")

    wrist = data["signal"]["wrist"]

    # Flatten from (N, 1) column vectors to (N,) — verified empirically
    bvp = np.asarray(wrist["BVP"], dtype=np.float64).flatten()
    eda = np.asarray(wrist["EDA"], dtype=np.float64).flatten()
    temp = np.asarray(wrist["TEMP"], dtype=np.float64).flatten()

    labels_raw = np.asarray(data["label"], dtype=np.int32)

    # Downsample labels from 700 Hz to each signal's rate
    labels_bvp = downsample_labels(labels_raw, SR_LABEL, SR_BVP, len(bvp))
    labels_eda = downsample_labels(labels_raw, SR_LABEL, SR_EDA, len(eda))
    # TEMP shares rate with EDA (both 4 Hz), but length might differ slightly
    labels_temp = downsample_labels(labels_raw, SR_LABEL, SR_TEMP, len(temp))

    logger.debug(
        "%s loaded — BVP: %d samples, EDA: %d, TEMP: %d, duration: %.0fs",
        subject_id, len(bvp), len(eda), len(temp), len(bvp) / SR_BVP,
    )

    return {
        "bvp": bvp,
        "eda": eda,
        "temp": temp,
        "labels_bvp": labels_bvp,
        "labels_eda": labels_eda,
        "labels_temp": labels_temp,
        "subject": subject_id,
    }
