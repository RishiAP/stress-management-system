import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/predictions?limit=50&cursor=<id>&range=1h|6h|24h|7d|30d
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);
  const cursor = searchParams.get("cursor") ?? undefined;
  const range = searchParams.get("range") ?? undefined;

  // Compute date filter from range
  let dateFilter: Date | undefined;
  if (range) {
    const now = new Date();
    const ms: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    if (ms[range]) {
      dateFilter = new Date(now.getTime() - ms[range]);
    }
  }

  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
      ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      device: { select: { name: true } },
    },
  });

  const hasMore = predictions.length > limit;
  const items = hasMore ? predictions.slice(0, limit) : predictions;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ items, nextCursor });
}
