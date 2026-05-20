"""
Configuration — loads and validates all required environment variables.

Required env vars:
  HF_REPO_ID       — Hugging Face model repo (e.g. RishiAP/stress-detection-pipeline)
  ALLOWED_ORIGINS  — Comma-separated CORS origins
  API_KEY          — Shared secret for /predict authentication

Service refuses to start if any variable is missing or empty.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Validated application settings loaded from environment."""
    hf_repo_id: str
    allowed_origins: list[str]
    api_key: str


def _require_env(name: str) -> str:
    """Read a required environment variable, raising RuntimeError if missing."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Required environment variable '{name}' is not set or empty. "
            f"Set it in .env (local) or Render dashboard (production)."
        )
    return value


def get_allowed_origins() -> list[str]:
    """Parse ALLOWED_ORIGINS env var into a list of origin URLs."""
    raw = _require_env("ALLOWED_ORIGINS")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS is set but contains no valid origins. "
            "Expected comma-separated URLs like: https://example.com,https://other.com"
        )
    return origins


def get_settings() -> Settings:
    """Load and validate all required settings from environment."""
    return Settings(
        hf_repo_id=_require_env("HF_REPO_ID"),
        allowed_origins=get_allowed_origins(),
        api_key=_require_env("API_KEY"),
    )
