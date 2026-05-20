# 🧠 Hybrid Physiological Stress Management System

[![Python Version](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-1.0%2B-F7931E?logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![HuggingFace](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Models-yellow)](https://huggingface.co/RishiAP/stress-detection-pipeline)
[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?logo=render&logoColor=white)](https://render.com)

A production-grade, end-to-end hybrid physiological monitoring system. This system processes raw bio-signals from wearable sensors to classify psychological and physiological stress using high-accuracy Machine Learning.

---

## 🔄 System Architecture & Data Flow

The system operates as follows:
1. **Model Cache (Startup / Cold Start)**: The FastAPI inference service starts, checks for a cached model, and if missing, automatically retrieves the trained pipeline (`stress_pipeline.joblib`) from your public Hugging Face Hub repository.
2. **Data Ingestion**: A client app or hardware hub (ESP32) samples raw Blood Volume Pulse (BVP @ 100Hz), Galvanic Skin Response (GSR @ 10Hz), and Temperature (TEMP @ 1Hz).
3. **Transmission**: The raw sensor windows (minimum 10-second segments) are streamed to the Main Application Backend.
4. **Stress Inference**: The Main Backend forwards these windows to the ML Microservice via `POST /predict` (secured with `X-API-Key`).
5. **Feature Extraction & Math**: The microservice filters the signals (Butterworth bandpass/lowpass), extracts 15 HRV and GSR features, and runs them through the ML pipeline to return a stress probability score.

---

## 📂 Repository Layout

```
stress-management-system/
├── ml/                      # Phase 1: Training & Evaluation Pipeline
│   ├── src/                 # Feature extraction logic & windowing algorithms
│   │   ├── features/        # HRV, EDA, and Temperature feature math
│   │   └── preprocessing.py # Butterworth filters (0.5-4Hz BVP, 1Hz EDA)
│   ├── models/              # Exported models & huggingface model cards
│   ├── upload_model.py      # Python script to upload artifacts to HuggingFace
│   ├── upload_model.sh      # Bash wrapper for HuggingFace model uploading
│   └── run.sh               # Automation script (train, test, evaluate)
│
├── ml-service/              # Phase 2: FastAPI Inference Microservice
│   ├── app/                 # FastAPI application
│   │   ├── core/            # Configuration, authentication, & model loading
│   │   ├── routes/          # Prediction router (/predict, /health)
│   │   └── schemas/         # Pydantic schemas validating window lengths
│   ├── tests/               # 31 Pytest unit & integration tests
│   ├── requirements.txt     # Pinned Python package dependencies for production
│   └── run.sh               # Dev server runner and test automation script
│
├── app/                     # Phase 3: Next.js Full-Stack Application
│   ├── src/                 # Application source code
│   │   ├── app/             # App Router pages and API routes (/api/ingest)
│   │   ├── components/      # shadcn/ui components & live dashboard UI
│   │   ├── hooks/           # Data fetching and polling hooks
│   │   └── lib/             # Baseline Psychological scoring, Prisma, and ML Client logic
│   ├── prisma/              # Database schema (PostgreSQL)
│   └── package.json         # Node dependencies (Next.js 16, Tailwind, Clerk)
│
├── render.yaml              # Render Infrastructure-as-Code Blueprint
├── requirements.md          # Physiological signal processing requirements (Phase 1)
└── microservices_requirements.md # Microservice engineering requirements (Phase 2)
```

---

## ⚡ Quick Start

### Phase 1: Machine Learning Training
1. **Setup & Train**:
   ```bash
   cd ml
   bash run.sh
   ```
   This will set up a virtual environment, install dependencies, run LOSO (Leave-One-Subject-Out) cross-validation, and export `stress_pipeline.joblib` inside `models/`.
2. **Push to HuggingFace**:
   Make sure you have a write token from your [HuggingFace settings](https://huggingface.co/settings/tokens).
   ```bash
   bash upload_model.sh
   ```

### Phase 2: Running the Microservice Locally
1. **Start the API server**:
   ```bash
   cd ../ml-service
   bash run.sh
   ```
   On first run, this generates a local `.env` file with a secure, random `API_KEY` and automatically fetches the pipeline model from HuggingFace.
2. **Verify status**:
   - Healthcheck: `http://localhost:8000/health`
   - API Docs: `http://localhost:8000/docs` (Swagger UI)

---

## ⚙️ Production Deployment (Render)

This repository is optimized for one-click deployments on **Render**.
1. Commit your changes and push them to your GitHub repository.
2. Connect your GitHub account to Render.
3. Render will automatically read the root-level `render.yaml` and configure the service.
4. Set the following environment variables in your Render Dashboard:
   - `HF_REPO_ID`: Your Hugging Face repository identifier (e.g. `RishiAP/stress-detection-pipeline`).
   - `API_KEY`: A shared cryptographic key to secure the `/predict` endpoint.
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed origins (e.g., `https://my-app.com`).
