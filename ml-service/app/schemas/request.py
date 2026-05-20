"""
Pydantic request schema for POST /predict.

Validates minimum window lengths per the Phase 2 spec Section 4.
"""

from pydantic import BaseModel, field_validator


# Minimum accepted sizes from spec Section 4
MIN_BVP_SAMPLES = 1000
MIN_GSR_SAMPLES = 100
MIN_TEMP_SAMPLES = 10


class PredictRequest(BaseModel):
    """Input schema for the /predict endpoint.

    Fields
    ------
    bvp_window : list[float]
        Raw BVP/PPG values from ESP32 (100 Hz). Min 1000 values (~10s).
    gsr_window : list[float]
        Raw GSR/EDA values from ESP32 (10 Hz). Min 100 values (~10s).
    temp_window : list[float]
        Raw temperature values from ESP32 (1 Hz). Min 10 values (~10s).
    """
    bvp_window: list[float]
    gsr_window: list[float]
    temp_window: list[float]

    @field_validator("bvp_window")
    @classmethod
    def bvp_min_length(cls, v: list[float]) -> list[float]:
        if len(v) < MIN_BVP_SAMPLES:
            raise ValueError(
                f"bvp_window too short: got {len(v)} values, "
                f"need at least {MIN_BVP_SAMPLES} (~{MIN_BVP_SAMPLES // 100}s at 100Hz)"
            )
        return v

    @field_validator("gsr_window")
    @classmethod
    def gsr_min_length(cls, v: list[float]) -> list[float]:
        if len(v) < MIN_GSR_SAMPLES:
            raise ValueError(
                f"gsr_window too short: got {len(v)} values, "
                f"need at least {MIN_GSR_SAMPLES} (~{MIN_GSR_SAMPLES // 10}s at 10Hz)"
            )
        return v

    @field_validator("temp_window")
    @classmethod
    def temp_min_length(cls, v: list[float]) -> list[float]:
        if len(v) < MIN_TEMP_SAMPLES:
            raise ValueError(
                f"temp_window too short: got {len(v)} values, "
                f"need at least {MIN_TEMP_SAMPLES} (~{MIN_TEMP_SAMPLES}s at 1Hz)"
            )
        return v
