import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// POST /api/devices — register a new ESP32 device
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name: string = body.name?.trim();

  if (!name || name.length < 1 || name.length > 80) {
    return NextResponse.json(
      { error: "Device name must be 1–80 characters" },
      { status: 400 }
    );
  }

  // Fetch user details from Clerk to populate the DB properly
  const user = await currentUser();
  const primaryEmail = user?.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.local`;

  // Ensure user exists in our DB (sync from Clerk on first device registration)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: primaryEmail,
      name: user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : null,
    },
  });

  // Generate a cryptographically secure device token (shown once)
  const token = crypto.randomBytes(32).toString("hex");

  const device = await prisma.device.create({
    data: { name, token, userId },
    select: { id: true, name: true, isOnline: true, lastSeen: true, createdAt: true, token: true },
  });

  // Return token in this response only — it cannot be retrieved again
  return NextResponse.json(device, { status: 201 });
}

// GET /api/devices — list all devices for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawDevices = await prisma.device.findMany({
    where: { userId },
    select: { id: true, name: true, lastSeen: true, createdAt: true, token: true },
    orderBy: { createdAt: "desc" },
  });

  // Dynamically compute online status (lastSeen within last 30 seconds)
  const now = Date.now();
  const devices = rawDevices.map(device => {
    const isOnline = device.lastSeen ? (now - new Date(device.lastSeen).getTime() < 30000) : false;
    return { ...device, isOnline };
  });

  return NextResponse.json(devices);
}
