import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/predictions/latest
 *
 * Returns the single most recent prediction for the authenticated user,
 * PLUS independent device status info (lastSeen) so the dashboard can
 * distinguish between OFFLINE and NOT_WORN states.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch latest prediction and device status in parallel
  const [prediction, device] = await Promise.all([
    prisma.prediction.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        hybridScore: true,
        category: true,
        physiologicalScore: true,
        dassModifier: true,
        heartRate: true,
        gsrLevel: true,
        temperature: true,
        deviceId: true,
        createdAt: true,
        device: { select: { name: true, isOnline: true, lastSeen: true } },
      },
    }),
    // Get the most recently active device for this user (independently)
    prisma.device.findFirst({
      where: { userId },
      orderBy: { lastSeen: "desc" },
      select: { name: true, isOnline: true, lastSeen: true },
    }),
  ]);

  const now = Date.now();
  
  const modifiedDevice = device ? {
    ...device,
    isOnline: device.lastSeen ? (now - new Date(device.lastSeen).getTime() < 30000) : false
  } : null;
  
  const modifiedPrediction = prediction ? {
    ...prediction,
    device: prediction.device ? {
      ...prediction.device,
      isOnline: prediction.device.lastSeen ? (now - new Date(prediction.device.lastSeen).getTime() < 30000) : false
    } : null
  } : null;

  return NextResponse.json({
    prediction: modifiedPrediction,
    device: modifiedDevice,
  });
}
