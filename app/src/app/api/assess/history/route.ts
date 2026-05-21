import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = await prisma.assessment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stressRaw: true,
      anxietyRaw: true,
      depressionRaw: true,
      dassModifier: true,
      createdAt: true,
    },
    take: 50,
  });

  return NextResponse.json(history);
}
