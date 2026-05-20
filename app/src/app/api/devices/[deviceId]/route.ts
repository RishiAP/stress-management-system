import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/devices/[deviceId] — unregister a device
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deviceId } = await params;

  // Verify the device belongs to the requesting user before deletion
  const device = await prisma.device.findFirst({
    where: { id: deviceId, userId },
    select: { id: true },
  });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  await prisma.device.delete({ where: { id: deviceId } });

  return NextResponse.json({ success: true });
}
