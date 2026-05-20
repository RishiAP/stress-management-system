"""
API key authentication — FastAPI dependency.

Reads the shared secret from the API_KEY environment variable.
Applied only to /predict — /health remains open for Render health checks.
"""

import os

from fastapi import Header, HTTPException


def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> None:
    """FastAPI dependency that validates the X-API-Key header.

    Raises
    ------
    RuntimeError
        If API_KEY env var is not set (caught at startup).
    HTTPException 401
        If the provided key doesn't match.
    """
    expected = os.environ.get("API_KEY", "").strip()
    if not expected:
        raise RuntimeError("API_KEY environment variable is not set")
    if x_api_key != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key",
        )
