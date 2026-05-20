# Hybrid Stress System — ML Inference Microservice
## Phase 2 Specification Document

> **Document Purpose:** This specification defines the complete
> architecture, implementation plan, and deployment strategy for
> the ML inference microservice. It is written to be given directly
> to an AI coding assistant (Opus 4.6) for planning, followed by
> Sonnet 4.6 for module-by-module implementation.
>
> **Phase context:** Phase 1 (ML training pipeline) is complete.
> A trained `stress_pipeline.joblib` artifact exists. Phase 2 wraps
> that artifact in a deployable FastAPI microservice.

---

## Prompt for Opus 4.6

You are a senior backend engineer and ML deployment specialist.

I am attaching a complete specification document for Phase 2 of a
hybrid stress detection system. Phase 1 (ML training) is already
complete. Your task is to read this entire document carefully and
produce a detailed, engineering-focused implementation plan for the
ML inference microservice described here.

**Your role:**
- Plan the implementation, not just describe it
- Every module must have clear inputs, outputs, and responsibilities
- Every decision must reference a constraint from this document
- Do not invent requirements not stated here
- Do not add features not asked for

**Focus on:**
- Clean, minimal FastAPI service architecture
- Robust input validation with Pydantic
- Reliable model artifact loading at startup from Hugging Face Hub
- Feature extraction that exactly matches the Phase 1 training pipeline
- Proper error handling with correct HTTP status codes
- Render deployment readiness from day one
- Fish shell syntax for all terminal commands
- CPU-only, lightweight dependencies

**Do NOT:**
- Retrain or modify the ML model
- Add authentication (handled by the main app backend)
- Add a database or persistence layer
- Add unnecessary abstractions or complexity
- Use bash shell syntax — this project uses Fish shell

**After generating the full implementation plan, provide:**
1. Recommended module build order with justification
2. Module dependency graph (what cannot be built until what exists)
3. Implementation milestones with clear completion criteria
4. Risk areas — where this service is most likely to break and why
5. Testing strategy per module (unit and integration)

**Output format:**
- Numbered sections with clear headers
- ASCII data flow diagrams for all pipelines
- Python pseudocode for all non-trivial logic
- Fish shell commands for all terminal operations
- Risk table per module

Begin by confirming you have read and understood all 14 sections
of this document. Then produce the implementation plan.

---

## 1. Project Context and Phase Placement

### Overall System Architecture

```
Phase 1 — ML Training (COMPLETE)
    WESAD dataset → preprocessing → feature extraction
    → LOSO training → stress_pipeline.joblib

Phase 2 — ML Inference Microservice (THIS DOCUMENT)
    FastAPI service → wraps trained model
    → deployed on Render
    → called by main app backend

Phase 3 — Main App Backend (FUTURE)
    Handles users, sessions, DASS-21, hybrid scoring

Phase 4 — ESP32 Hardware Integration (FUTURE)
    Sensor acquisition → sends windows to main backend
```

### Repository Structure

```
project-root/
├── ml/                              ← Phase 1 (complete)
│   ├── data/
│   ├── features/
│   ├── training/
│   └── models/
│       └── stress_pipeline.joblib   ← trained artifact
│
├── microservices/                   ← Phase 2 (this document)
│   └── ml-inference/
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py
│       │   ├── routes/
│       │   │   └── predict.py
│       │   ├── core/
│       │   │   ├── config.py
│       │   │   ├── model_loader.py
│       │   │   └── feature_extractor.py
│       │   └── schemas/
│       │       ├── request.py
│       │       └── response.py
│       ├── tests/
│       │   ├── test_predict.py
│       │   └── test_features.py
│       ├── pyproject.toml
│       ├── requirements.txt
│       └── render.yaml
│
└── README.md
```

---

## 2. Service Responsibility Boundary

This service does **exactly one thing**: receive raw sensor windows,
extract features, run the trained ML model, and return a physiological
stress probability score.

Nothing else belongs in this service.

```
Main App Backend
        │
        │  POST /predict
        │  { bvp_window, gsr_window, temp_window }
        ▼
ML Inference Microservice        ← THIS SERVICE
        │
        ├── validate input
        ├── preprocess signals
        ├── extract features
        ├── run pipeline.predict_proba()
        └── return physiological_score
        │
        ▼
Main App Backend
        │
        ├── apply DASS-21 modifier   ← NOT this service
        ├── compute hybrid score     ← NOT this service
        ├── store history            ← NOT this service
        └── respond to client        ← NOT this service
```

### Responsibility Table

| Responsibility | Owner |
|---|---|
| Sensor data acquisition | ESP32 (Phase 4) |
| User authentication and sessions | Main app backend (Phase 3) |
| DASS-21 intake and scoring | Main app backend (Phase 3) |
| Hybrid score fusion | Main app backend (Phase 3) |
| Raw signal preprocessing | **This service** |
| Feature extraction | **This service** |
| ML inference | **This service** |
| Returning physiological score (0–1) | **This service** |

---

## 3. Model Artifact Storage

### Strategy: Hugging Face Hub (Public Repository)

The trained `stress_pipeline.joblib` is stored on Hugging Face Hub
in a **public** model repository. It is downloaded once at service
startup and cached locally. It is **never committed to git**.

**Why not git:**
- Binary files permanently bloat git history
- Every retrain adds a new binary that cannot be removed cleanly
- Slows every clone and Render redeploy

**Why Hugging Face Hub:**
- Industry standard for ML model artifact storage
- Purpose-built for this exact use case
- Free, public repositories with no bandwidth limits
- Official Python client with one-line download
- Built-in model versioning via git-lfs
- Appears on Hugging Face profile — strengthens portfolio

**Why public:**
- This is a college project — visibility is an asset
- Model weights trained on a public dataset (WESAD) contain no
  sensitive data
- No token management needed — simpler code and zero deployment risk

### Hugging Face Setup Steps

1. Create account at https://huggingface.co
2. Create a new model repository — set visibility to **Public**
   - Suggested name: `stress-detection-pipeline`
   - Add a model card describing the project
3. Add one environment variable to Render:
   - `HF_REPO_ID` = `your-username/stress-detection-pipeline`

No access token is required for public repositories.

### Upload Workflow (Fish shell)

```fish
# From project root, after Phase 1 training is complete
source venv/bin/activate.fish

pip install huggingface_hub

# Authenticate once locally
huggingface-cli login

# Upload trained artifact
huggingface-cli upload your-username/stress-detection-pipeline \
    ml/models/stress_pipeline.joblib stress_pipeline.joblib
```

### Retraining Workflow

When the model is retrained in Phase 1, push the new artifact:

```fish
huggingface-cli upload your-username/stress-detection-pipeline \
    ml/models/stress_pipeline.joblib stress_pipeline.joblib
```

Hugging Face Hub versions every upload automatically. Previous
versions are accessible in commit history and can be rolled back.

### Startup Download Logic

```python
from huggingface_hub import hf_hub_download
from pathlib import Path
import os
import joblib

MODEL_PATH = Path("models/stress_pipeline.joblib")

def download_model_if_missing():
    if not MODEL_PATH.exists():
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        hf_hub_download(
            repo_id=os.environ["HF_REPO_ID"],
            filename="stress_pipeline.joblib",
            local_dir=str(MODEL_PATH.parent),
            # No token — public repository
        )

def load_model():
    return joblib.load(MODEL_PATH)
```

Called once during FastAPI `lifespan` at service startup.

---

## 4. API Specification

### Base URL

```
https://<your-render-service>.onrender.com
```

---

### GET /health

Health check. Used by Render and the main backend to verify the
service is alive and the model is loaded.

**Response 200:**
```json
{
  "status": "ok",
  "model_loaded": true
}
```

---

### POST /predict

Receives raw sensor windows. Returns physiological stress probability.

**Request body:**
```json
{
  "bvp_window": [1024.3, 1031.7, 1028.4, "..."],
  "gsr_window": [0.45, 0.47, 0.46, "..."],
  "temp_window": [33.1, 33.2, 33.1, "..."]
}
```

**Input window specifications:**

| Field | Type | Expected Size | Source Rate |
|---|---|---|---|
| `bvp_window` | list[float] | ~3000 values | 30s × 100Hz |
| `gsr_window` | list[float] | ~300 values | 30s × 10Hz |
| `temp_window` | list[float] | ~30 values | 30s × 1Hz |

**Minimum accepted sizes (validation):**

| Field | Minimum |
|---|---|
| `bvp_window` | 1000 values |
| `gsr_window` | 100 values |
| `temp_window` | 10 values |

**Response 200:**
```json
{
  "physiological_score": 0.74,
  "features_used": {
    "mean_hr": 88.2,
    "std_hr": 4.1,
    "rmssd": 28.3,
    "sdnn": 35.7,
    "nn50": 12,
    "pnn50": 0.18,
    "mean_eda": 0.52,
    "std_eda": 0.04,
    "slope_eda": 0.002,
    "peak_count": 3,
    "min_eda": 0.44,
    "max_eda": 0.61,
    "mean_temp": 33.2,
    "std_temp": 0.1,
    "slope_temp": -0.003
  }
}
```

`features_used` is returned for debugging and transparency. The main
backend may log it or ignore it.

**Error responses:**

| Code | Condition |
|---|---|
| 422 | Input validation failure (window too short, wrong type) |
| 500 | Feature extraction failure (e.g. flat BVP, no peaks detected) |
| 500 | Inference failure |

---

## 5. CORS — Origin Access Control

### Strategy: Environment-Controlled Allowlist

Allowed origins are configured entirely via environment variables.
No origins are hardcoded in the codebase. This allows origins to be
updated on Render without any code changes or redeployment.

### Environment Variable

```
ALLOWED_ORIGINS=https://main-backend.onrender.com,https://staging-backend.onrender.com
```

- Comma-separated list of allowed origin URLs
- Set in Render dashboard — never hardcoded in source
- No trailing slashes in origin URLs
- Must include protocol (`https://`)

### Parsing Logic

```python
import os

def get_allowed_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    if not raw:
        raise RuntimeError("ALLOWED_ORIGINS env var is not set")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        raise RuntimeError("ALLOWED_ORIGINS is set but contains no valid origins")
    return origins
```

Service refuses to start if `ALLOWED_ORIGINS` is missing or empty.
This is intentional — an open CORS policy is a misconfiguration, not
a safe default.

### FastAPI CORS Middleware Registration

```python
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)
```

**Settings rationale:**

| Setting | Value | Reason |
|---|---|---|
| `allow_origins` | from env | No wildcard — explicit allowlist only |
| `allow_credentials` | False | No cookies or auth headers in this service |
| `allow_methods` | POST, GET only | Only methods this service uses |
| `allow_headers` | Content-Type only | Minimal surface — no extra headers needed |

### Local Development Override

During local development, the main backend runs on localhost.
Add localhost to `ALLOWED_ORIGINS` via a local `.env` file:

```fish
# .env (never committed to git — add to .gitignore)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

Load it locally using:

```fish
export (cat .env | xargs)
uvicorn app.main:app --reload --port 8000
```

### `.env` must be in `.gitignore`

```
# .gitignore
venv/
.env
models/
__pycache__/
*.pyc
```

### CORS Testing Requirements

Add to `tests/test_predict.py`:

- Request from allowed origin returns correct CORS headers
- Request from unlisted origin returns 400 or is rejected by middleware
- Service fails to start if `ALLOWED_ORIGINS` env var is missing

---

## 6. API Key Authentication

### Why CORS Is Not Enough

CORS is a browser-only mechanism. It does not stop:
- Direct `curl` or `httpx` requests
- Postman or any HTTP client
- Any server-to-server call from an unknown origin

Without an API key, anyone who discovers the Render URL can call
`/predict` freely. An API key ensures only the main app backend —
which holds the shared secret — can reach this service.

### Strategy: Shared Secret via Request Header

The microservice and the main app backend share a secret API key
set via environment variables on both services. No key is ever
stored in code or committed to git.

```
Main App Backend
    └── sends every /predict request with header:
        X-API-Key: <secret>

ML Inference Microservice
    └── FastAPI dependency checks header on every /predict call
        ├── missing or wrong key → 401 Unauthorized
        └── correct key → proceed to feature extraction
```

`/health` is exempt — no API key required for health checks.
Render needs to reach `/health` without credentials to verify
the service is alive.

### Generating the API Key

Generate a cryptographically secure key locally:

```fish
python -c "import secrets; print(secrets.token_hex(32))"
```

This produces a 64-character hex string. Copy it immediately.

Set it as an environment variable on **both** services:

| Service | Variable Name | Value |
|---|---|---|
| ML Inference (this service) | `API_KEY` | `<generated secret>` |
| Main App Backend (Phase 3) | `ML_SERVICE_API_KEY` | same secret |

Never regenerate unless rotating — both services must always hold
the same value.

### FastAPI Dependency Implementation

```python
# app/core/auth.py

import os
from fastapi import Header, HTTPException

def verify_api_key(x_api_key: str = Header(...)):
    expected = os.environ.get("API_KEY")
    if not expected:
        raise RuntimeError("API_KEY environment variable is not set")
    if x_api_key != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key"
        )
```

### Applying the Dependency

Applied only to `/predict` — not to `/health`:

```python
# app/routes/predict.py

from fastapi import APIRouter, Depends
from app.core.auth import verify_api_key

router = APIRouter()

@router.post("/predict", dependencies=[Depends(verify_api_key)])
def predict(...):
    ...
```

```python
# app/main.py

@app.get("/health")
def health():
    # No auth dependency — Render health checks must reach this freely
    return {"status": "ok", "model_loaded": app.state.model is not None}
```

### How the Main Backend Calls This Service

```python
# In Phase 3 main app backend — example outgoing request
import httpx
import os

response = httpx.post(
    f"{os.environ['ML_SERVICE_URL']}/predict",
    json={
        "bvp_window": bvp_window,
        "gsr_window": gsr_window,
        "temp_window": temp_window,
    },
    headers={
        "X-API-Key": os.environ["ML_SERVICE_API_KEY"]
    }
)
```

### Key Rotation

If the key is ever exposed:

1. Generate a new key with `secrets.token_hex(32)`
2. Update `API_KEY` on Render (this service)
3. Update `ML_SERVICE_API_KEY` on the main backend
4. Both services redeploy automatically on Render env var update

---

## 7. Feature Extraction Specification

> **Critical constraint:** The feature extraction logic in this
> service must exactly match the feature extraction used during
> WESAD training in Phase 1. Any mismatch — even a single different
> filter parameter or feature ordering — will silently degrade model
> performance with no error thrown. Copy the extractor from Phase 1
> directly rather than reimplementing it.

### 5.1 BVP → HRV Features

Input: raw BVP/PPG window at 100 Hz
Output: 6 HRV features

```
BVP window (100 Hz)
    → bandpass filter (0.5–4.0 Hz, order 3 Butterworth)
    → systolic peak detection (min distance = 0.4s)
    → RR intervals (ms) = diff(peaks) / fs * 1000
    → HRV feature computation
```

| Feature | Formula |
|---|---|
| `mean_hr` | 60000 / mean(RR) |
| `std_hr` | std(60000 / RR) |
| `rmssd` | sqrt(mean(diff(RR)²)) |
| `sdnn` | std(RR) |
| `nn50` | count(abs(diff(RR)) > 50ms) |
| `pnn50` | nn50 / len(diff(RR)) |

Raise ValueError if fewer than 5 RR intervals detected.

### 5.2 GSR / EDA Features

Input: raw GSR window at 10 Hz
Output: 6 EDA features

```
GSR window (10 Hz)
    → lowpass filter (1.0 Hz, order 3 Butterworth)
    → linear trend via polyfit(degree=1)
    → peak detection (prominence=0.01)
    → feature computation
```

| Feature | Formula |
|---|---|
| `mean_eda` | mean(filtered) |
| `std_eda` | std(filtered) |
| `slope_eda` | polyfit slope |
| `peak_count` | len(peaks) |
| `min_eda` | min(filtered) |
| `max_eda` | max(filtered) |

### 5.3 Temperature Features

Input: raw temperature window at 1 Hz
Output: 3 TEMP features

```
TEMP window (1 Hz)
    → linear trend via polyfit(degree=1)
    → feature computation
```

| Feature | Formula |
|---|---|
| `mean_temp` | mean(signal) |
| `std_temp` | std(signal) |
| `slope_temp` | polyfit slope |

### 5.4 Feature Vector Assembly

**Column order must exactly match training:**

```python
X = [
    mean_hr, std_hr, rmssd, sdnn, nn50, pnn50,     # HRV (6)
    mean_eda, std_eda, slope_eda, peak_count,        # EDA (4)
    min_eda, max_eda,                                # EDA (2)
    mean_temp, std_temp, slope_temp                  # TEMP (3)
]
# Shape: (1, 15)
```

The StandardScaler inside the joblib pipeline handles normalization
automatically. Do NOT manually normalize before passing to the model.

---

## 8. Application Module Specifications

### `app/core/auth.py`

FastAPI dependency for API key verification.
Reads `API_KEY` from environment.
Raises `RuntimeError` at startup if `API_KEY` is not set.
Returns `401 Unauthorized` if `X-API-Key` header is missing or wrong.

### `app/core/config.py`

Loads and validates all environment variables at startup.

Required variables:
- `HF_REPO_ID` — Hugging Face model repository ID
- `ALLOWED_ORIGINS` — comma-separated list of allowed request origins
- `API_KEY` — shared secret for backend-to-service authentication

Service must raise `RuntimeError` and refuse to start if any
required variable is missing or empty.

### `app/core/model_loader.py`

Responsibilities:
- Download model from Hugging Face Hub if not cached locally
- Load joblib pipeline into memory
- Expose loaded model to FastAPI app state via lifespan

### `app/core/feature_extractor.py`

Responsibilities:
- `extract_hrv_features(bvp_window, fs=100) → dict`
- `extract_eda_features(gsr_window, fs=10) → dict`
- `extract_temp_features(temp_window) → dict`
- `build_feature_vector(hrv, eda, temp) → np.ndarray shape (1,15)`

This module is the most critical for correctness. Feature logic must
match Phase 1 exactly.

### `app/schemas/request.py`

Pydantic model for POST /predict input.
Validates minimum window lengths per field.
Returns 422 with clear message on validation failure.

### `app/schemas/response.py`

Pydantic model for POST /predict output.
Fields: `physiological_score` (float), `features_used` (dict).

### `app/routes/predict.py`

Handles POST /predict endpoint.
Calls feature extractor → builds feature vector → runs model →
returns response.
Catches ValueError from extractor → 422.
Catches all other exceptions → 500 with message.

### `app/main.py`

FastAPI application entry point.
Registers CORSMiddleware using origins from `config.get_allowed_origins()`.
Lifespan: download model → load model → store in app.state.
Registers predict router.
Exposes GET /health.

---

## 9. Development Environment

### Setup (Fish shell)

```fish
# Navigate to service directory
cd microservices/ml-inference

# Create virtual environment if not present
python -m venv venv

# Activate — Fish shell syntax
source venv/bin/activate.fish

# Install with dev dependencies
pip install -e ".[dev]"

# Run locally
uvicorn app.main:app --reload --port 8000
```

### `pyproject.toml`

```toml
[project]
name = "ml-inference-service"
version = "1.0.0"
description = "ML inference microservice for stress detection"
requires-python = ">=3.10"

dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "pydantic",
    "numpy",
    "scipy",
    "scikit-learn",
    "joblib",
    "huggingface_hub",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "httpx",
    "pytest-asyncio",
]
```

### `requirements.txt`

Generated after development is complete:

```fish
pip freeze > requirements.txt
```

This pinned file is what Render uses for deployment.

---

## 10. Deployment Configuration

### `render.yaml`

```yaml
services:
  - type: web
    name: stress-ml-inference
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: HF_REPO_ID
        sync: false
      - key: ALLOWED_ORIGINS
        sync: false
      - key: API_KEY
        sync: false
    healthCheckPath: /health
```

### Render Environment Variables

| Variable | Value | Set via |
|---|---|---|
| `HF_REPO_ID` | `your-username/stress-detection-pipeline` | Render dashboard manually |
| `ALLOWED_ORIGINS` | `https://main-backend.onrender.com` | Render dashboard manually |
| `API_KEY` | output of `secrets.token_hex(32)` | Render dashboard manually |

All three variables are required. Service refuses to start if any is missing.

### Render Free Tier Constraints

- RAM: ~512MB — Random Forest (100 trees, 15 features) is under 50MB
- Spin-down: service spins down after inactivity — first request after
  spin-up re-downloads model if disk was wiped
- The `download_model_if_missing()` cache check handles this correctly
- Upgrade to Starter ($7/mo) if cold start latency is unacceptable

---

## 11. Testing Requirements

### Unit Tests — `tests/test_features.py`

- Each extractor returns correct keys
- Each extractor returns correct value types
- HRV extractor raises ValueError on flat/short BVP window
- Feature vector has shape (1, 15)
- Feature vector column order matches expected order

### Integration Tests — `tests/test_predict.py`

- POST /predict with valid windows and correct API key returns 200
- POST /predict with missing `X-API-Key` header returns 401
- POST /predict with wrong `X-API-Key` value returns 401
- POST /predict with short bvp_window returns 422
- POST /predict with short gsr_window returns 422
- POST /predict with short temp_window returns 422
- Response contains `physiological_score` in range 0.0–1.0
- GET /health returns 200 with no API key required
- GET /health returns 200 with `model_loaded: true`

### Synthetic Data Helpers

Tests must not depend on real sensor data. Implement helpers:
- `generate_synthetic_bvp(duration_s, fs)` — realistic PPG-like signal
- `generate_synthetic_gsr(duration_s, fs)` — slow-varying conductance
- `generate_synthetic_temp(duration_s, fs)` — stable temperature with noise

---

## 12. Constraints Summary

| Constraint | Requirement |
|---|---|
| Shell | Fish — always use `venv/bin/activate.fish` |
| Python | >= 3.10 |
| Environment | `python -m venv venv` — no conda, no poetry |
| Dependencies | `pyproject.toml` + pinned `requirements.txt` |
| Model storage | Hugging Face Hub public repo — never in git |
| Model format | Single joblib Pipeline (scaler + model bundled) |
| API key | Required on all `/predict` calls via `X-API-Key` header — never in code or git |
| CORS | Origin allowlist via `ALLOWED_ORIGINS` env var only — no wildcard, no hardcoding |
| `/health` endpoint | No auth required — must remain open for Render health checks |
| DASS-21 | Not in this service — handled by main backend |
| Inference | CPU-only — no GPU dependencies |
| Deployment | Render free tier — stay under 512MB RAM |
| Feature order | Must exactly match Phase 1 training pipeline |

---

## 13. Risk Areas

| Risk | Why It Happens | Mitigation |
|---|---|---|
| Feature mismatch | Extractor reimplemented instead of copied from Phase 1 | Copy feature_extractor.py directly from ml/ module |
| Wrong feature column order | Feature vector assembled in different order than training | Document and test exact column order |
| Wrong class index | `model.classes_` order not guaranteed to be [0, 1] | Always use `list(model.classes_).index(1)` |
| Cold start model re-download | Render free tier wipes ephemeral disk on spin-down | Cache check in `download_model_if_missing()` handles this |
| Insufficient RR intervals | Very noisy or flat BVP window from bad sensor contact | Raise 422 with clear message — never return silent garbage score |
| Wrong HF_REPO_ID format | Typo in `username/repo-name` on Render | Verify format exactly before first deploy |
| Scaler applied twice | Manual normalization + pipeline internal scaler | Never normalize manually — pipeline handles it |
| CORS misconfiguration | `ALLOWED_ORIGINS` not set or wrong URL format | Service refuses to start if missing — verify URLs include `https://` and no trailing slash |
| Open CORS in development | Wildcard origin left in code | Origins always come from env var — never hardcode `*` |
| API key committed to git | Key placed in code or `.env` accidentally pushed | Add `.env` to `.gitignore` — generate key only in Render dashboard |
| Auth applied to `/health` | `verify_api_key` dependency applied globally | Apply dependency only to `/predict` router — never to `/health` |
| Key mismatch between services | Main backend has different key than microservice | Set same `secrets.token_hex(32)` output on both Render services |

---

## 14. Future Phases

This document covers Phase 2 only. The following are out of scope
and must not be implemented here.

**Phase 3 — Main App Backend**
Handles user accounts, sessions, DASS-21 questionnaire intake,
hybrid score fusion (physiological_score + dass_modifier), stress
history storage, and client responses.

**Phase 4 — ESP32 Hardware Integration**
ESP32 acquires sensor data, buffers 30-second windows, and sends
them to the main backend. The main backend forwards to this service.

**Phase 5 — Personalization**
Per-user adaptive normalization and running baseline calibration.
Added to this service after MVP is stable and validated.