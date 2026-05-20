"""
FastAPI application entry point.

Lifespan: downloads model from Hugging Face → loads into memory.
Registers CORS middleware and the /predict route.
Exposes GET /health (no auth) for Render health checks.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_allowed_origins
from app.core.model_loader import load_model
from app.routes.predict import router as predict_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: download + load model. Shutdown: cleanup."""
    logger.info("Starting ML inference service...")

    # Load model into app state — available to all requests
    try:
        app.state.model = load_model()
        logger.info("Model loaded successfully — service ready")
    except Exception as e:
        logger.error("Failed to load model: %s", e, exc_info=True)
        app.state.model = None

    yield  # App runs here

    logger.info("Shutting down ML inference service")


app = FastAPI(
    title="Stress ML Inference Service",
    description="Physiological stress detection from raw sensor windows",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ───────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# ── Routes ───────────────────────────────────────────────────────────────
app.include_router(predict_router)


@app.get("/health", summary="Health check (no auth)")
def health():
    """Health check endpoint — no API key required.

    Used by Render to verify the service is alive.
    """
    return {
        "status": "ok",
        "model_loaded": app.state.model is not None,
    }
