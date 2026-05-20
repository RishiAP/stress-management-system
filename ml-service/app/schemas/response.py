"""
Pydantic response schema for POST /predict.
"""

from pydantic import BaseModel


class PredictResponse(BaseModel):
    """Output schema for the /predict endpoint.

    Fields
    ------
    physiological_score : float
        Stress probability from 0.0 (calm) to 1.0 (stressed).
    features_used : dict[str, float]
        The 15 extracted features — returned for debugging and transparency.
    """
    physiological_score: float
    features_used: dict[str, float]
