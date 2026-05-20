import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/predictions?limit=50&cursor=<id>
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  const predictions = await prisma.prediction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // fetch one extra to determine if there's a next page
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
