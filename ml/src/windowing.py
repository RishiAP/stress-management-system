"""
Signal windowing and label assignment.

Segments continuous per-subject signals into fixed-length windows with
configurable overlap. Assigns a binary stress/non-stress label to each
window via majority vote, discarding windows dominated by ignored labels.

References: Spec Section 6 (Windowing Strategy), Section 3 (Label Mapping).
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

import numpy as np

from src.config import (
    SR_BVP, SR_EDA, SR_TEMP,
    WINDOW_SEC, OVERLAP_RATIO,
    STRESS_LABEL, IGNORE_LABELS,
    LABEL_STRESS, LABEL_NON_STRESS,
)

logger = logging.getLogger(__name__)


def assign_window_label(label_segment: np.ndarray) -> Optional[int]:
    """Assign a binary label to a window via majority vote.

    Parameters
    ----------
    label_segment : np.ndarray
        Raw WESAD labels for this window (at the signal's sampling rate,
        already downsampled from 700 Hz).

    Returns
    -------
    int or None
        1 = Stress, 0 = Non-Stress, None = window should be discarded
        (more than 50% of samples have ignored labels).
    """
    ignore_set = np.array(list(IGNORE_LABELS))
    valid_mask = ~np.isin(label_segment, ignore_set)
    valid_count = valid_mask.sum()

    # Discard window if more than half the samples are ignored
    if valid_count < len(label_segment) * 0.5:
        return None

    valid_labels = label_segment[valid_mask]
    stress_ratio = np.sum(valid_labels == STRESS_LABEL) / len(valid_labels)

    return LABEL_STRESS if stress_ratio > 0.5 else LABEL_NON_STRESS


def create_windows(subject_data: dict,
                   window_sec: int = WINDOW_SEC,
                   overlap: float = OVERLAP_RATIO) -> List[Dict]:
    """Segment all signals into aligned, fixed-length windows.

    Parameters
    ----------
    subject_data : dict
        Output of data_loader.load_subject(). Must contain keys:
        "bvp", "eda", "temp", "labels_bvp", "labels_eda".
    window_sec : int
        Window duration in seconds (default: 60).
    overlap : float
        Overlap ratio (default: 0.5 = 50%).

    Returns
    -------
    list of dict
        Each dict has keys: "bvp", "eda", "temp" (np.ndarray segments),
        "label" (int: 0 or 1).
        Windows with ignored-only labels are excluded.
    """
    step_sec = window_sec * (1 - overlap)

    # Window and step sizes in samples per signal
    bvp_win = int(window_sec * SR_BVP)    # 60 * 64 = 3840
    eda_win = int(window_sec * SR_EDA)    # 60 * 4  = 240
    temp_win = int(window_sec * SR_TEMP)  # 60 * 4  = 240

    bvp_step = int(step_sec * SR_BVP)     # 30 * 64 = 1920
    eda_step = int(step_sec * SR_EDA)     # 30 * 4  = 120
    temp_step = int(step_sec * SR_TEMP)   # 30 * 4  = 120

    bvp = subject_data["bvp"]
    eda = subject_data["eda"]
    temp = subject_data["temp"]
    labels_eda = subject_data["labels_eda"]

    # Number of windows determined by the shortest signal
    total_sec = min(
        len(bvp) / SR_BVP,
        len(eda) / SR_EDA,
        len(temp) / SR_TEMP,
    )
    n_windows = int((total_sec - window_sec) / step_sec) + 1

    if n_windows <= 0:
        logger.warning(
            "Subject %s: signal too short for windowing (%.1fs < %ds)",
            subject_data.get("subject", "?"), total_sec, window_sec,
        )
        return []

    windows = []
    discarded = 0

    for i in range(n_windows):
        bvp_start = i * bvp_step
        eda_start = i * eda_step
        temp_start = i * temp_step

        bvp_seg = bvp[bvp_start: bvp_start + bvp_win]
        eda_seg = eda[eda_start: eda_start + eda_win]
        temp_seg = temp[temp_start: temp_start + temp_win]

        # Use EDA-rate labels for majority vote (lowest rate = broadest coverage)
        lab_seg = labels_eda[eda_start: eda_start + eda_win]
        label = assign_window_label(lab_seg)

        if label is None:
            discarded += 1
            continue

        # Verify segment lengths (edge guard)
        if len(bvp_seg) < bvp_win or len(eda_seg) < eda_win or len(temp_seg) < temp_win:
            discarded += 1
            continue

        windows.append({
            "bvp": bvp_seg,
            "eda": eda_seg,
            "temp": temp_seg,
            "label": label,
        })

    logger.info(
        "Subject %s: %d windows created, %d discarded (ignored labels or short)",
        subject_data.get("subject", "?"), len(windows), discarded,
    )

    return windows
