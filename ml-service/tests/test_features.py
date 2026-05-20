"""
Unit tests for feature extraction.

Tests that each extractor returns the correct keys, types, and that
the assembled feature vector has the right shape and column order.
"""

import numpy as np
import pytest

from app.core.feature_extractor import (
    FEATURE_ORDER,
    build_feature_vector,
    extract_eda_features,
    extract_hrv_features,
    extract_temp_features,
    preprocess_bvp,
    preprocess_eda,
)
from tests.conftest import (
    generate_synthetic_bvp,
    generate_synthetic_gsr,
    generate_synthetic_temp,
)


class TestPreprocessing:
    """Tests for signal preprocessing filters."""

    def test_bvp_bandpass_preserves_length(self, synthetic_bvp):
        result = preprocess_bvp(np.array(synthetic_bvp))
        assert len(result) == len(synthetic_bvp)

    def test_eda_lowpass_preserves_length(self, synthetic_gsr):
        result = preprocess_eda(np.array(synthetic_gsr))
        assert len(result) == len(synthetic_gsr)

    def test_bvp_bandpass_removes_dc(self, synthetic_bvp):
        """DC offset should be removed by bandpass filter."""
        bvp = np.array(synthetic_bvp) + 1000  # large DC offset
        result = preprocess_bvp(bvp)
        assert abs(np.mean(result)) < abs(np.mean(bvp))


class TestHRVFeatures:
    """Tests for HRV feature extraction from BVP."""

    EXPECTED_KEYS = {"mean_hr", "std_hr", "rmssd", "sdnn", "nn50", "pnn50"}

    def test_returns_all_keys(self, synthetic_bvp):
        bvp = preprocess_bvp(np.array(synthetic_bvp))
        result = extract_hrv_features(bvp)
        assert set(result.keys()) == self.EXPECTED_KEYS

    def test_returns_correct_types(self, synthetic_bvp):
        bvp = preprocess_bvp(np.array(synthetic_bvp))
        result = extract_hrv_features(bvp)
        for key in ["mean_hr", "std_hr", "rmssd", "sdnn", "pnn50"]:
            assert isinstance(result[key], float), f"{key} should be float"
        assert isinstance(result["nn50"], int), "nn50 should be int"

    def test_heart_rate_plausible(self, synthetic_bvp):
        """Synthetic signal at 1.2 Hz → mean HR should be near 72 BPM."""
        bvp = preprocess_bvp(np.array(synthetic_bvp))
        result = extract_hrv_features(bvp)
        assert 50 < result["mean_hr"] < 120, f"mean_hr={result['mean_hr']} out of range"

    def test_raises_on_flat_signal(self):
        """Flat signal → no peaks → should raise ValueError."""
        flat = np.zeros(3000)
        with pytest.raises(ValueError, match="Too few peaks"):
            extract_hrv_features(flat)

    def test_raises_on_short_signal(self):
        """Signal shorter than 5 seconds → should raise ValueError."""
        short = np.sin(np.arange(100))  # only 1 second at 100 Hz
        with pytest.raises(ValueError, match="too short"):
            extract_hrv_features(short)


class TestEDAFeatures:
    """Tests for EDA/GSR feature extraction."""

    EXPECTED_KEYS = {"mean_eda", "std_eda", "slope_eda", "peak_count", "min_eda", "max_eda"}

    def test_returns_all_keys(self, synthetic_gsr):
        result = extract_eda_features(np.array(synthetic_gsr))
        assert set(result.keys()) == self.EXPECTED_KEYS

    def test_returns_correct_types(self, synthetic_gsr):
        result = extract_eda_features(np.array(synthetic_gsr))
        for key in ["mean_eda", "std_eda", "slope_eda", "min_eda", "max_eda"]:
            assert isinstance(result[key], float)
        assert isinstance(result["peak_count"], int)

    def test_flat_signal_no_peaks(self):
        flat = np.ones(300)
        result = extract_eda_features(flat)
        assert result["peak_count"] == 0
        assert result["slope_eda"] == pytest.approx(0.0, abs=1e-10)


class TestTempFeatures:
    """Tests for temperature feature extraction."""

    EXPECTED_KEYS = {"mean_temp", "std_temp", "slope_temp"}

    def test_returns_all_keys(self, synthetic_temp):
        result = extract_temp_features(np.array(synthetic_temp))
        assert set(result.keys()) == self.EXPECTED_KEYS

    def test_mean_near_33(self, synthetic_temp):
        result = extract_temp_features(np.array(synthetic_temp))
        assert 32 < result["mean_temp"] < 34


class TestFeatureVector:
    """Tests for the assembled feature vector."""

    def test_shape_is_1x15(self, synthetic_bvp, synthetic_gsr, synthetic_temp):
        vec, _ = build_feature_vector(synthetic_bvp, synthetic_gsr, synthetic_temp)
        assert vec.shape == (1, 15)

    def test_column_order_matches_training(self, synthetic_bvp, synthetic_gsr, synthetic_temp):
        """Feature order must exactly match Phase 1 training pipeline."""
        expected_order = [
            "mean_hr", "std_hr", "rmssd", "sdnn", "nn50", "pnn50",
            "mean_eda", "std_eda", "slope_eda", "peak_count", "min_eda", "max_eda",
            "mean_temp", "std_temp", "slope_temp",
        ]
        assert FEATURE_ORDER == expected_order

    def test_features_dict_has_15_keys(self, synthetic_bvp, synthetic_gsr, synthetic_temp):
        _, feats = build_feature_vector(synthetic_bvp, synthetic_gsr, synthetic_temp)
        assert len(feats) == 15

    def test_no_nan_in_vector(self, synthetic_bvp, synthetic_gsr, synthetic_temp):
        vec, _ = build_feature_vector(synthetic_bvp, synthetic_gsr, synthetic_temp)
        assert not np.isnan(vec).any(), "Feature vector contains NaN"
