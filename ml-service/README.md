# ⚡ ML Inference Microservice

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Pytest](https://img.shields.io/badge/Pytest-9.0-green?logo=pytest&logoColor=white)](https://docs.pytest.org)
[![Uvicorn](https://img.shields.io/badge/Uvicorn-0.22-4F5D75?logo=gunicorn&logoColor=white)](https://www.uvicorn.org)

This directory hosts the **FastAPI Inference Microservice**, designed to consume raw streams of bio-signals, perform on-the-fly signal processing, and execute real-time stress classification using the trained XGBoost model.

---

## 🔬 Signal Processing & Feature Extraction

To ensure model accuracy matches the 91.8% baseline from Phase 1 training, raw signal windows are processed with identical mathematical parameters. The service translates raw time-series arrays into a **15-dimensional feature vector**:

```
[ mean_hr, std_hr, rmssd, sdnn, nn50, pnn50, 
  mean_eda, std_eda, slope_eda, peak_count, min_eda, max_eda, 
  mean_temp, std_temp, slope_temp ]
```

### Signal Filtering Rules
- **Blood Volume Pulse (BVP)**: Sampled at **100 Hz**. Filters out motion artifacts using a 3rd-order Butterworth bandpass filter ($0.5\text{ Hz}$ to $4.0\text{ Hz}$, equivalent to 30–240 BPM). Heartbeats are located using peak-finding with a minimum distance threshold of $0.3$ seconds.
- **Electrodermal Activity (GSR/EDA)**: Sampled at **10 Hz**. Smoothed using a 2nd-order lowpass Butterworth filter with a $1.0\text{ Hz}$ cutoff frequency. Skin Conductance Responses (SCR) are detected using peak prominence thresholds of $0.01$.
- **Skin Temperature (TEMP)**: Sampled at **1 Hz**. No filtering is applied due to the low-frequency nature of the signal.

---

## 📡 API Endpoints

### 🟢 `GET /health`
Public health status check. Used by Render to verify that the container is healthy and the machine learning model has loaded successfully.
* **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "model_loaded": true
  }
  ```

### 🔵 `POST /predict`
Runs inference on a set of raw sensor windows. Requires an `X-API-Key` header matching the environment `API_KEY`.

* **Request Header**:
  ```http
  X-API-Key: your_secure_api_key_here
  Content-Type: application/json
  ```
* **Required Body Limits (Min 10-Second Windows)**:
  - `bvp_window`: Must contain at least `1000` samples (at 100 Hz).
  - `gsr_window`: Must contain at least `100` samples (at 10 Hz).
  - `temp_window`: Must contain at least `10` samples (at 1 Hz).
* **Payload Example**:
  ```json
  {
    "bvp_window": [-45.2, -32.1, 12.0, 56.4, ...],
    "gsr_window": [0.456, 0.458, 0.462, ...],
    "temp_window": [32.14, 32.15, 32.14, ...]
  }
  ```
* **Success Response `200 OK`**:
  ```json
  {
    "physiological_score": 0.8412,
    "features_used": {
      "mean_hr": 78.43,
      "std_hr": 3.12,
      "rmssd": 38.12,
      "sdnn": 42.45,
      "nn50": 3,
      "pnn50": 0.12,
      "mean_eda": 0.461,
      "std_eda": 0.003,
      "slope_eda": 0.0001,
      "peak_count": 0,
      "min_eda": 0.456,
      "max_eda": 0.462,
      "mean_temp": 32.143,
      "std_temp": 0.004,
      "slope_temp": -0.0001
    }
  }
  ```

### 🔴 Error Responses
- **`401 Unauthorized`**: Missing or invalid `X-API-Key` header.
- **`422 Unprocessable Entity`**: Provided window size is too short, or BVP signal lacks clean heartbeat features (e.g. flatlined or high noise).
- **`503 Service Unavailable`**: Microservice is starting up and the model has not finished downloading from Hugging Face yet.

---

## 🛠️ Operations & Local Scripts

Manage the service lifecycle using the automated script wrapper:

* **Start API Server (Development)**:
  ```bash
  bash run.sh
  ```
  *Auto-generates a secure `.env` locally on first execution and runs the server with reload capabilities at http://localhost:8000.*

* **Execute Test Suite**:
  ```bash
  bash run.sh test
  ```
  *Runs 31 validations across preprocessing filters, HRV mathematics, validation layers, auth middleware, and CORS.*

* **Freeze Dependencies**:
  ```bash
  bash run.sh freeze
  ```
  *Pins current library packages into `requirements.txt` to ensure build consistency on Render.*
