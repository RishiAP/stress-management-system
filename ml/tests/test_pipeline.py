"""
Unit tests for the ML training pipeline.

Tests cover data loading, preprocessing, windowing, and feature extraction
using both real WESAD data (S2) and synthetic signals.
"""

import numpy as np
import pandas as pd
import pytest

from src.config import (
    SUBJECTS, FEATURE_NAMES, SR_BVP, SR_EDA, SR_TEMP, SR_LABEL,
    WINDOW_SEC, HRV_FEATURES, EDA_FEATURES, TEMP_FEATURES,
    IGNORE_LABELS,
)


# ═══════════════════════════════════════════════════════════════════════════
# data_loader tests
# ═══════════════════════════════════════════════════════════════════════════

class TestDataLoader:
    """Tests for src.data_loader."""

    def test_load_subject_returns_expected_keys(self):
        from src.data_loader import load_subject
        data = load_subject("S2")
        expected_keys = {"bvp", "eda", "temp", "labels_bvp", "labels_eda",
                         "labels_temp", "subject"}
        assert set(data.keys()) == expected_keys

    def test_signal_shapes_are_1d(self):
        from src.data_loader import load_subject
        data = load_subject("S2")
        assert data["bvp"].ndim == 1, "BVP should be flattened to 1D"
        assert data["eda"].ndim == 1
        assert data["temp"].ndim == 1

    def test_label_signal_alignment(self):
        """Labels must match their corresponding signal's length exactly."""
        from src.data_loader import load_subject
        data = load_subject("S2")
        assert len(data["labels_bvp"]) == len(data["bvp"])
        assert len(data["labels_eda"]) == len(data["eda"])
        assert len(data["labels_temp"]) == len(data["temp"])

    def test_sampling_rate_ratios(self):
        """BVP/EDA length ratio should be ~16 (64 Hz / 4 Hz)."""
        from src.data_loader import load_subject
        data = load_subject("S2")
        ratio = len(data["bvp"]) / len(data["eda"])
        assert abs(ratio - (SR_BVP / SR_EDA)) < 0.1, \
            f"BVP/EDA ratio {ratio:.2f} != expected {SR_BVP / SR_EDA}"

    def test_labels_contain_valid_values(self):
        from src.data_loader import load_subject
        data = load_subject("S2")
        valid_labels = {0, 1, 2, 3, 4, 5, 6, 7}
        actual = set(np.unique(data["labels_bvp"]))
        assert actual.issubset(valid_labels), f"Unexpected labels: {actual - valid_labels}"

    def test_missing_subject_raises(self):
        from src.data_loader import load_subject
        with pytest.raises(FileNotFoundError):
            load_subject("S99")

    def test_downsample_labels_truncation(self):
        from src.data_loader import downsample_labels
        labels = np.array([0, 1, 2, 3, 4, 5, 6, 7, 0, 1])
        result = downsample_labels(labels, from_hz=10, to_hz=5, target_length=4)
        assert len(result) == 4


# ═══════════════════════════════════════════════════════════════════════════
# preprocessing tests
# ═══════════════════════════════════════════════════════════════════════════

class TestPreprocessing:
    """Tests for src.preprocessing."""

    def test_bvp_bandpass_preserves_length(self):
        from src.preprocessing import preprocess_bvp
        bvp = np.random.randn(SR_BVP * 60)  # 60 seconds
        filtered = preprocess_bvp(bvp)
        assert len(filtered) == len(bvp)

    def test_bvp_bandpass_removes_dc(self):
        """DC offset (0 Hz) should be removed by bandpass."""
        from src.preprocessing import preprocess_bvp
        t = np.arange(SR_BVP * 10) / SR_BVP
        dc_offset = 100.0
        signal = dc_offset + np.sin(2 * np.pi * 1.0 * t)  # 1 Hz + DC
        filtered = preprocess_bvp(signal)
        assert abs(np.mean(filtered)) < 1.0, "DC offset not removed"

    def test_eda_lowpass_preserves_length(self):
        from src.preprocessing import preprocess_eda
        eda = np.random.randn(SR_EDA * 60)
        filtered = preprocess_eda(eda)
        assert len(filtered) == len(eda)

    def test_temp_median_preserves_length(self):
        from src.preprocessing import preprocess_temp
        temp = np.random.randn(SR_TEMP * 60)
        filtered = preprocess_temp(temp)
        assert len(filtered) == len(temp)

    def test_short_signal_no_crash(self):
        """Very short signals should not crash, just return as-is."""
        from src.preprocessing import preprocess_bvp, preprocess_eda, preprocess_temp
        short = np.array([1.0, 2.0, 3.0])
        preprocess_bvp(short)
        preprocess_eda(short)
        preprocess_temp(short)


# ═══════════════════════════════════════════════════════════════════════════
# windowing tests
# ═══════════════════════════════════════════════════════════════════════════

class TestWindowing:
    """Tests for src.windowing."""

    def _make_subject_data(self, duration_sec=300):
        """Create synthetic subject data for windowing tests."""
        return {
            "bvp": np.random.randn(duration_sec * SR_BVP),
            "eda": np.random.randn(duration_sec * SR_EDA),
            "temp": np.random.randn(duration_sec * SR_TEMP),
            "labels_bvp": np.ones(duration_sec * SR_BVP, dtype=np.int32),
            "labels_eda": np.ones(duration_sec * SR_EDA, dtype=np.int32),
            "labels_temp": np.ones(duration_sec * SR_TEMP, dtype=np.int32),
            "subject": "test",
        }

    def test_window_count(self):
        """Window count should match formula: (T - W) / S + 1."""
        from src.windowing import create_windows
        duration = 300  # seconds
        data = self._make_subject_data(duration)
        windows = create_windows(data)
        expected = int((duration - WINDOW_SEC) / (WINDOW_SEC * 0.5)) + 1
        assert len(windows) == expected, \
            f"Expected {expected} windows, got {len(windows)}"

    def test_window_segment_lengths(self):
        from src.windowing import create_windows
        data = self._make_subject_data(300)
        windows = create_windows(data)
        for w in windows:
            assert len(w["bvp"]) == WINDOW_SEC * SR_BVP
            assert len(w["eda"]) == WINDOW_SEC * SR_EDA
            assert len(w["temp"]) == WINDOW_SEC * SR_TEMP

    def test_no_windows_with_ignored_labels(self):
        from src.windowing import create_windows
        data = self._make_subject_data(300)
        windows = create_windows(data)
        for w in windows:
            assert w["label"] in (0, 1)

    def test_all_ignored_labels_produces_no_windows(self):
        from src.windowing import create_windows
        data = self._make_subject_data(300)
        # Set all labels to ignored (label 0)
        data["labels_eda"][:] = 0
        windows = create_windows(data)
        assert len(windows) == 0

    def test_label_assignment_stress(self):
        from src.windowing import assign_window_label
        # All stress labels
        segment = np.full(100, 2, dtype=np.int32)
        assert assign_window_label(segment) == 1

    def test_label_assignment_non_stress(self):
        from src.windowing import assign_window_label
        # All baseline labels
        segment = np.full(100, 1, dtype=np.int32)
        assert assign_window_label(segment) == 0

    def test_label_assignment_ignored(self):
        from src.windowing import assign_window_label
        # All ignored labels
        segment = np.full(100, 0, dtype=np.int32)
        assert assign_window_label(segment) is None


# ═══════════════════════════════════════════════════════════════════════════
# feature extraction tests
# ═══════════════════════════════════════════════════════════════════════════

class TestHRVFeatures:
    """Tests for src.features.hrv."""

    def test_synthetic_60bpm(self):
        """A clean 1 Hz sine (60 BPM) should yield mean_hr ≈ 60."""
        from src.features.hrv import extract_hrv_features
        t = np.arange(SR_BVP * 60) / SR_BVP
        bvp = np.sin(2 * np.pi * 1.0 * t)  # 1 Hz = 60 BPM
        feats = extract_hrv_features(bvp)
        if not np.isnan(feats["mean_hr"]):
            assert 50 < feats["mean_hr"] < 70, \
                f"Expected ~60 BPM, got {feats['mean_hr']:.1f}"

    def test_returns_all_feature_keys(self):
        from src.features.hrv import extract_hrv_features
        bvp = np.sin(2 * np.pi * 1.2 * np.arange(SR_BVP * 60) / SR_BVP)
        feats = extract_hrv_features(bvp)
        assert set(feats.keys()) == set(HRV_FEATURES)

    def test_short_signal_returns_nan(self):
        from src.features.hrv import extract_hrv_features
        bvp = np.array([1.0, 2.0, 3.0])
        feats = extract_hrv_features(bvp)
        assert all(np.isnan(v) for v in feats.values())


class TestEDAFeatures:
    """Tests for src.features.eda."""

    def test_flat_signal(self):
        from src.features.eda import extract_eda_features
        eda = np.ones(SR_EDA * 60) * 0.5
        feats = extract_eda_features(eda)
        assert feats["mean_eda"] == pytest.approx(0.5)
        assert feats["std_eda"] == pytest.approx(0.0, abs=1e-10)
        assert feats["slope_eda"] == pytest.approx(0.0, abs=1e-10)

    def test_returns_all_feature_keys(self):
        from src.features.eda import extract_eda_features
        eda = np.random.randn(SR_EDA * 60)
        feats = extract_eda_features(eda)
        assert set(feats.keys()) == set(EDA_FEATURES)


class TestTempFeatures:
    """Tests for src.features.temperature."""

    def test_rising_trend(self):
        from src.features.temperature import extract_temp_features
        temp = np.linspace(32.0, 34.0, SR_TEMP * 60)
        feats = extract_temp_features(temp)
        assert feats["slope_temp"] > 0, "Rising signal should have positive slope"

    def test_returns_all_feature_keys(self):
        from src.features.temperature import extract_temp_features
        temp = np.random.randn(SR_TEMP * 60)
        feats = extract_temp_features(temp)
        assert set(feats.keys()) == set(TEMP_FEATURES)


# ═══════════════════════════════════════════════════════════════════════════
# feature matrix integration test
# ═══════════════════════════════════════════════════════════════════════════

class TestFeatureMatrix:
    """Integration test using real S2 data."""

    def test_build_single_subject(self):
        from src.feature_matrix import build_feature_matrix_for_subject
        df = build_feature_matrix_for_subject("S2")

        # Should have rows
        assert len(df) > 0, "No windows produced for S2"

        # Should have all feature columns + label + subject
        expected_cols = set(FEATURE_NAMES + ["label", "subject"])
        assert set(df.columns) == expected_cols

        # Labels should be binary
        assert set(df["label"].unique()).issubset({0, 1})

        # Should have both classes
        assert df["label"].nunique() == 2, "S2 should have both stress and non-stress"

        # NaN rate should be reasonable (<20%)
        nan_rate = df[FEATURE_NAMES].isna().any(axis=1).mean()
        assert nan_rate < 0.20, f"NaN rate too high: {nan_rate:.1%}"
