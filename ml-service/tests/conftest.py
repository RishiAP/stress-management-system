"""
Shared test fixtures and synthetic signal generators.

Synthetic signals simulate realistic ESP32 sensor data without
depending on real sensor hardware or WESAD dataset.
"""

import os
import numpy as np
import pytest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient


# ── Test API key (used across all integration tests) ─────────────────────
TEST_API_KEY = "test-secret-key-for-unit-tests-only"


# ── Synthetic Signal Generators ──────────────────────────────────────────

def generate_synthetic_bvp(duration_s: float = 30, fs: int = 100) -> list[float]:
    """Generate a realistic PPG-like BVP signal.

    Creates a sine wave at ~1.2 Hz (72 BPM) with harmonics and noise,
    mimicking a real photoplethysmography signal.
    """
    t = np.arange(0, duration_s, 1 / fs)
    heart_rate_hz = 1.2  # ~72 BPM

    # Fundamental + 2nd harmonic + noise
    signal = (
        np.sin(2 * np.pi * heart_rate_hz * t)
        + 0.3 * np.sin(2 * np.pi * 2 * heart_rate_hz * t)
        + 0.1 * np.random.randn(len(t))
    )
    return signal.tolist()


def generate_synthetic_gsr(duration_s: float = 30, fs: int = 10) -> list[float]:
    """Generate a realistic GSR/EDA signal.

    Creates a slow-varying baseline with a few SCR (skin conductance response)
    peaks, mimicking real electrodermal activity.
    """
    t = np.arange(0, duration_s, 1 / fs)

    # Slow tonic baseline (skin conductance level)
    baseline = 0.5 + 0.1 * np.sin(2 * np.pi * 0.05 * t)

    # Add a few SCR peaks (phasic responses)
    scr = np.zeros_like(t)
    for peak_time in [5, 12, 22]:
        if peak_time < duration_s:
            idx = int(peak_time * fs)
            if idx < len(scr):
                # Simple exponential SCR shape
                for j in range(min(30, len(scr) - idx)):
                    scr[idx + j] += 0.05 * np.exp(-j / 10)

    signal = baseline + scr + 0.01 * np.random.randn(len(t))
    return signal.tolist()


def generate_synthetic_temp(duration_s: float = 30, fs: int = 1) -> list[float]:
    """Generate a realistic skin temperature signal.

    Creates a stable temperature around 33°C with small noise,
    mimicking real skin temperature sensor readings.
    """
    n_samples = int(duration_s * fs)
    signal = 33.0 + 0.05 * np.random.randn(n_samples)
    return signal.tolist()


# ── Fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def synthetic_bvp():
    """30s of synthetic BVP at 100 Hz (3000 samples)."""
    return generate_synthetic_bvp(duration_s=30, fs=100)


@pytest.fixture
def synthetic_gsr():
    """30s of synthetic GSR at 10 Hz (300 samples)."""
    return generate_synthetic_gsr(duration_s=30, fs=10)


@pytest.fixture
def synthetic_temp():
    """30s of synthetic TEMP at 1 Hz (30 samples)."""
    return generate_synthetic_temp(duration_s=30, fs=1)


@pytest.fixture
def mock_env(monkeypatch):
    """Set required env vars for testing."""
    monkeypatch.setenv("HF_REPO_ID", "RishiAP/stress-detection-pipeline")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")
    monkeypatch.setenv("API_KEY", TEST_API_KEY)


@pytest.fixture
def mock_pipeline():
    """Create a mock sklearn pipeline that returns a fixed prediction."""
    pipeline = MagicMock()
    pipeline.predict_proba.return_value = np.array([[0.3, 0.7]])
    pipeline.named_steps = {
        "model": MagicMock(classes_=np.array([0, 1]))
    }
    pipeline.steps = [("imputer", None), ("scaler", None), ("model", None)]
    return pipeline


@pytest.fixture
def client(mock_env, mock_pipeline):
    """FastAPI test client with mocked model and env vars."""
    from unittest.mock import patch

    # Patch load_model so the lifespan doesn't try to download from HuggingFace
    with patch("app.main.load_model", return_value=mock_pipeline):
        from app.main import app

        # Force re-create the test client so lifespan runs with the patch
        with TestClient(app) as c:
            yield c
