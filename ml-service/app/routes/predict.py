"""
POST /predict route — the core inference endpoint.

Receives raw sensor windows, extracts features, runs the ML pipeline,
and returns a physiological stress probability score.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.auth import verify_api_key
from app.core.feature_extractor import build_feature_vector
from app.schemas.request import PredictRequest
from app.schemas.response import PredictResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/predict",
    response_model=PredictResponse,
    dependencies=[Depends(verify_api_key)],
    summary="Run stress inference on raw sensor windows",
)
def predict(body: PredictRequest, request: Request) -> PredictResponse:
    """Extract features from raw signals and run ML inference.

    Returns a physiological_score (0–1) and the extracted features.
    """
    # ── Get model from app state ──────────────────────────────────────
    pipeline = request.app.state.model
    if pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Service is starting up.",
        )

    # ── Feature extraction ────────────────────────────────────────────
    try:
        feature_vector, features_dict = build_feature_vector(
            bvp_window=body.bvp_window,
            gsr_window=body.gsr_window,
            temp_window=body.temp_window,
        )
    except ValueError as e:
        # Feature extraction failed — bad signal quality
        logger.warning("Feature extraction failed: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Unexpected feature extraction error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Feature extraction failed: {e}",
        )

    # ── ML Inference ──────────────────────────────────────────────────
    try:
        proba = pipeline.predict_proba(feature_vector)

        # Safety: find the stress class index — never assume it's [1]
        model = pipeline.named_steps["model"]
        stress_idx = list(model.classes_).index(1)
        score = float(proba[0][stress_idx])

    except Exception as e:
        logger.error("Inference failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Model inference failed: {e}",
        )

    logger.info("Prediction: score=%.3f", score)

    return PredictResponse(
        physiological_score=round(score, 4),
        features_used=features_dict,
    )
