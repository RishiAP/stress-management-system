/**
 * HTTP client for the FastAPI ML Inference Microservice.
 *
 * Called internally by /api/ingest — never exposed to the browser.
 * Authenticates via shared X-API-Key header.
 */

export interface MLPredictPayload {
  bvp_window: number[];
  gsr_window: number[];
  temp_window: number[];
}

export interface MLPredictResponse {
  physiological_score: number; // 0.0–1.0
  features_used: Record<string, number>; // 15 extracted features
}

/**
 * Call POST /predict on the ML microservice.
 * Throws on network errors or non-2xx responses.
 */
export async function callMLPredict(
  payload: MLPredictPayload
): Promise<MLPredictResponse> {
  const url = process.env.ML_SERVICE_URL;
  const apiKey = process.env.ML_SERVICE_API_KEY;

  if (!url || !apiKey) {
    throw new Error(
      "ML_SERVICE_URL and ML_SERVICE_API_KEY must be set in environment"
    );
  }

  const res = await fetch(`${url}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
    // Abort after 30s — ESP32 windows come every 30s so this is max acceptable wait
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    let detail = `ML service responded with ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore json parse failure
    }
    throw new Error(detail);
  }

  return res.json() as Promise<MLPredictResponse>;
}

/**
 * Call GET /health on the ML microservice to check if it's ready.
 * Returns false instead of throwing if the service is down.
 */
export async function checkMLHealth(): Promise<boolean> {
  try {
    const url = process.env.ML_SERVICE_URL;
    if (!url) return false;
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json();
    return data?.model_loaded === true;
  } catch {
    return false;
  }
}
