import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDassModifier } from "@/lib/dass21";

// POST /api/assess — submit a DASS-21 questionnaire
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const answers: unknown = body.answers;

  // Validate: must be an array of 21 integers, each 0–3
  if (
    !Array.isArray(answers) ||
    answers.length !== 21 ||
    !answers.every((v) => Number.isInteger(v) && v >= 0 && v <= 3)
  ) {
    return NextResponse.json(
      { error: "answers must be an array of 21 integers, each 0–3" },
      { status: 400 }
    );
  }

  let result;
  try {
    result = computeDassModifier(answers as number[]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid answers" },
      { status: 400 }
    );
  }

  // Fetch user details from Clerk to populate the DB properly
  const user = await currentUser();
  const primaryEmail = user?.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.local`;

  // Ensure user exists in our DB (sync from Clerk on first action)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: primaryEmail,
      name: user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : null,
    },
  });

  const assessment = await prisma.assessment.create({
    data: {
      userId,
      answers: answers as number[],
      stressRaw: result.stressRaw,
      anxietyRaw: result.anxietyRaw,
      depressionRaw: result.depressionRaw,
      dassModifier: result.dassModifier,
    },
    select: {
      id: true,
      stressRaw: true,
      anxietyRaw: true,
      depressionRaw: true,
      dassModifier: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ...assessment,
    // Round for display
    dassModifier: Math.round(assessment.dassModifier * 1000) / 1000,
  });
}

// GET /api/assess — get the user's most recent assessment
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latest = await prisma.assessment.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, stressRaw: true, anxietyRaw: true, depressionRaw: true, dassModifier: true, createdAt: true },
  });

  return NextResponse.json(latest ?? null);
}
