import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/predictions/latest
 *
 * Returns the single most recent prediction for the authenticated user.
 * Called every 5 seconds by the dashboard polling hook.
 * Much simpler and Vercel-compatible vs WebSockets.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prediction = await prisma.prediction.findFirst({
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
      device: { select: { name: true, isOnline: true } },
    },
  });

  return NextResponse.json(prediction ?? null);
}
