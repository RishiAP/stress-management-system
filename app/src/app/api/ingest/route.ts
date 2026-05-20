import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callMLPredict } from "@/lib/ml-client";
import { computeHybridScore } from "@/lib/hybrid-score";

// Minimum window sizes matching ml-service validators
const MIN_BVP = 1000; // 100 Hz × 10s minimum
const MIN_GSR = 100; // 10 Hz × 10s minimum
const MIN_TEMP = 10; // 1 Hz × 10s minimum

/**
 * POST /api/ingest
 *
 * Called by ESP32 devices. Uses device-token auth — NOT Clerk.
 * Authorization: Bearer <device_token>
 *
 * Body: { bvp_window: number[], gsr_window: number[], temp_window: number[] }
 *
 * Flow:
 *   1. Validate Bearer token → look up device + userId
 *   2. Validate window sizes
 *   3. Update device.lastSeen + isOnline = true
 *   4. Forward to ML microservice
 *   5. Fetch latest DASS-21 modifier for this user
 *   6. Compute hybrid score
 *   7. Store Prediction record
 *   8. Return result to ESP32
 */
export async function POST(req: NextRequest) {
  // ── 1. Device token auth ──────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <device_token>" },
      { status: 401 }
    );
  }

  const device = await prisma.device.findUnique({
    where: { token },
    select: { id: true, userId: true },
  });

  if (!device) {
    return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
  }

  // ── 2. Parse & validate body ──────────────────────────────────────────────
  let body: { bvp_window: unknown; gsr_window: unknown; temp_window: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { bvp_window, gsr_window, temp_window } = body;

  if (
    !Array.isArray(bvp_window) ||
    bvp_window.length < MIN_BVP ||
    !Array.isArray(gsr_window) ||
    gsr_window.length < MIN_GSR ||
    !Array.isArray(temp_window) ||
    temp_window.length < MIN_TEMP
  ) {
    return NextResponse.json(
      {
        error: "Window sizes too small",
        required: { bvp_window: MIN_BVP, gsr_window: MIN_GSR, temp_window: MIN_TEMP },
      },
      { status: 422 }
    );
  }

  // ── 3. Update device presence ─────────────────────────────────────────────
  await prisma.device.update({
    where: { id: device.id },
    data: { isOnline: true, lastSeen: new Date() },
  });

  // ── 4. Call ML microservice ───────────────────────────────────────────────
  let mlResult;
  try {
    mlResult = await callMLPredict({
      bvp_window: bvp_window as number[],
      gsr_window: gsr_window as number[],
      temp_window: temp_window as number[],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `ML service unavailable: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 503 }
    );
  }

  // ── 5. Get latest DASS-21 modifier (0 if user hasn't assessed yet) ─────────
  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: device.userId },
    orderBy: { createdAt: "desc" },
    select: { dassModifier: true },
  });
  const dassModifier = latestAssessment?.dassModifier ?? 0;

  // ── 6. Hybrid score ───────────────────────────────────────────────────────
  const { hybridScore, category } = computeHybridScore(
    mlResult.physiological_score,
    dassModifier
  );

  // ── 7. Extract vitals for fast dashboard queries ──────────────────────────
  const features = mlResult.features_used;
  const heartRate = features.mean_hr ?? null;
  const gsrLevel = features.mean_eda ?? null;
  const temperature = features.mean_temp ?? null;

  // ── 8. Store prediction ───────────────────────────────────────────────────
  await prisma.prediction.create({
    data: {
      userId: device.userId,
      deviceId: device.id,
      physiologicalScore: mlResult.physiological_score,
      featuresUsed: mlResult.features_used,
      dassModifier,
      hybridScore,
      category,
      heartRate,
      gsrLevel,
      temperature,
    },
  });

  // Dashboard picks up new data via polling /api/predictions/latest
  return NextResponse.json({ hybridScore, category, physiologicalScore: mlResult.physiological_score, dassModifier });
}
