"""
Integration tests for the /predict and /health endpoints.

Tests authentication, validation, CORS, and end-to-end inference.
Uses a mocked ML pipeline (no real model needed for tests).
"""

import pytest

from tests.conftest import (
    TEST_API_KEY,
    generate_synthetic_bvp,
    generate_synthetic_gsr,
    generate_synthetic_temp,
)


class TestHealth:
    """Tests for GET /health — no auth required."""

    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_no_api_key_needed(self, client):
        """Health check must work without any API key header."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    def test_health_shows_model_loaded(self, client):
        resp = client.get("/health")
        assert resp.json()["model_loaded"] is True


class TestAuth:
    """Tests for API key authentication on /predict."""

    def test_missing_api_key_returns_422(self, client):
        """Missing X-API-Key header → 422 (FastAPI's default for missing required header)."""
        resp = client.post("/predict", json={
            "bvp_window": generate_synthetic_bvp(),
            "gsr_window": generate_synthetic_gsr(),
            "temp_window": generate_synthetic_temp(),
        })
        assert resp.status_code == 422

    def test_wrong_api_key_returns_401(self, client):
        resp = client.post(
            "/predict",
            json={
                "bvp_window": generate_synthetic_bvp(),
                "gsr_window": generate_synthetic_gsr(),
                "temp_window": generate_synthetic_temp(),
            },
            headers={"X-API-Key": "wrong-key"},
        )
        assert resp.status_code == 401

    def test_correct_api_key_accepted(self, client):
        resp = client.post(
            "/predict",
            json={
                "bvp_window": generate_synthetic_bvp(),
                "gsr_window": generate_synthetic_gsr(),
                "temp_window": generate_synthetic_temp(),
            },
            headers={"X-API-Key": TEST_API_KEY},
        )
        assert resp.status_code == 200


class TestPredictValidation:
    """Tests for input validation on /predict."""

    def test_short_bvp_returns_422(self, client):
        resp = client.post(
            "/predict",
            json={
                "bvp_window": [1.0] * 10,  # way too short (need 1000)
                "gsr_window": generate_synthetic_gsr(),
                "temp_window": generate_synthetic_temp(),
            },
            headers={"X-API-Key": TEST_API_KEY},
        )
        assert resp.status_code == 422

    def test_short_gsr_returns_422(self, client):
        resp = client.post(
            "/predict",
            json={
                "bvp_window": generate_synthetic_bvp(),
                "gsr_window": [0.5] * 5,  # way too short (need 100)
                "temp_window": generate_synthetic_temp(),
            },
            headers={"X-API-Key": TEST_API_KEY},
        )
        assert resp.status_code == 422

    def test_short_temp_returns_422(self, client):
        resp = client.post(
            "/predict",
            json={
                "bvp_window": generate_synthetic_bvp(),
                "gsr_window": generate_synthetic_gsr(),
                "temp_window": [33.0] * 3,  # way too short (need 10)
            },
            headers={"X-API-Key": TEST_API_KEY},
        )
        assert resp.status_code == 422


class TestPredictInference:
    """Tests for successful /predict calls."""

    def test_returns_physiological_score(self, client):
        resp = client.post(
            "/predict",
            json={
                "bvp_window": generate_synthetic_bvp(),
                "gsr_window": generate_synthetic_gsr(),
                "temp_window": generate_synthetic_temp(),
            },
            headers={"X-API-Key": TEST_API_KEY},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "physiological_score" in data
        assert 0.0 <= data["physiological_score"] <= 1.0

    def test_returns_features_used(self, client):
        resp = client.post(
            "/predict",
            json={
                "bvp_window": generate_synthetic_bvp(),
                "gsr_window": generate_synthetic_gsr(),
                "temp_window": generate_synthetic_temp(),
            },
            headers={"X-API-Key": TEST_API_KEY},
        )
        data = resp.json()
        assert "features_used" in data
        assert len(data["features_used"]) == 15

    def test_score_matches_mock(self, client):
        """Mock pipeline returns proba [0.3, 0.7] → score should be 0.7."""
        resp = client.post(
            "/predict",
            json={
                "bvp_window": generate_synthetic_bvp(),
                "gsr_window": generate_synthetic_gsr(),
                "temp_window": generate_synthetic_temp(),
            },
            headers={"X-API-Key": TEST_API_KEY},
        )
        data = resp.json()
        assert data["physiological_score"] == 0.7


class TestCORS:
    """Tests for CORS middleware."""

    def test_allowed_origin_gets_cors_headers(self, client):
        resp = client.options(
            "/predict",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,X-API-Key",
            },
        )
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_disallowed_origin_no_cors_header(self, client):
        resp = client.options(
            "/predict",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        # FastAPI CORS middleware simply doesn't add the header for disallowed origins
        assert resp.headers.get("access-control-allow-origin") != "http://evil.com"
