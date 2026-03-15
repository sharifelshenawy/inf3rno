import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  // Find ride by invite code
  const ride = await prisma.ride.findUnique({
    where: { inviteCode: code },
  });

  if (!ride) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 404 }
    );
  }

  // Check ride status
  if (ride.status === "CANCELLED" || ride.status === "COMPLETED") {
    return NextResponse.json(
      { error: "This ride is no longer accepting members" },
      { status: 400 }
    );
  }

  // Check if already a member
  const existingMember = await prisma.rideMember.findUnique({
    where: {
      rideId_userId: { rideId: ride.id, userId: session.user.id },
    },
  });

  if (existingMember) {
    return NextResponse.json(
      { error: "You are already a member of this ride", rideId: ride.id },
      { status: 409 }
    );
  }

  // Fetch user's suburb info
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { suburb: true, suburbLat: true, suburbLng: true },
  });

  // Add as RIDER member
  await prisma.rideMember.create({
    data: {
      rideId: ride.id,
      userId: session.user.id,
      role: "RIDER",
      startSuburb: user?.suburb || null,
      startLat: user?.suburbLat || null,
      startLng: user?.suburbLng || null,
    },
  });

  return NextResponse.json({ rideId: ride.id }, { status: 201 });
}
