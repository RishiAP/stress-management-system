"""
Model loader — downloads from Hugging Face Hub and loads the joblib pipeline.

The model is downloaded once at startup and cached in models/.
On Render free tier, the ephemeral disk may be wiped on spin-down,
so download_model_if_missing() re-downloads when needed.
"""

import logging
from pathlib import Path

import joblib
from huggingface_hub import hf_hub_download

from app.core.config import get_settings

logger = logging.getLogger(__name__)

MODEL_DIR = Path("models")
MODEL_FILENAME = "stress_pipeline.joblib"


def download_model_if_missing() -> Path:
    """Download the model artifact from Hugging Face Hub if not cached locally.

    Returns
    -------
    Path
        Local path to the downloaded model file.
    """
    model_path = MODEL_DIR / MODEL_FILENAME

    if model_path.exists():
        logger.info("Model already cached at %s", model_path)
        return model_path

    settings = get_settings()
    logger.info(
        "Downloading model from HuggingFace: %s/%s",
        settings.hf_repo_id, MODEL_FILENAME,
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # Public repo — no token needed
    downloaded_path = hf_hub_download(
        repo_id=settings.hf_repo_id,
        filename=MODEL_FILENAME,
        local_dir=str(MODEL_DIR),
    )

    logger.info("Model downloaded to %s", downloaded_path)
    return Path(downloaded_path)


def load_model():
    """Download (if needed) and load the sklearn Pipeline.

    Returns
    -------
    sklearn.pipeline.Pipeline
        The trained pipeline with imputer + scaler + model.
    """
    model_path = download_model_if_missing()
    pipeline = joblib.load(model_path)
    logger.info(
        "Model loaded: %s (steps: %s)",
        model_path,
        [name for name, _ in pipeline.steps],
    )
    return pipeline
