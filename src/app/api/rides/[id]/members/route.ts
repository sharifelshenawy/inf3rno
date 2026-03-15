import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRideLeader } from "@/lib/ride-helpers";
import { sendRideInviteEmail } from "@/lib/email";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const isLeader = await isRideLeader(id, session.user.id);
  if (!isLeader) {
    return NextResponse.json(
      { error: "Only the ride leader can add members" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { handle } = body as { handle?: string };

  if (!handle || handle.trim().length === 0) {
    return NextResponse.json(
      { error: "Handle is required" },
      { status: 400 }
    );
  }

  // Find user by handle
  const targetUser = await prisma.user.findUnique({
    where: { handle: handle.trim().toLowerCase() },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Check if already a member
  const existingMember = await prisma.rideMember.findUnique({
    where: { rideId_userId: { rideId: id, userId: targetUser.id } },
  });

  if (existingMember) {
    return NextResponse.json(
      { error: "User is already a member of this ride" },
      { status: 409 }
    );
  }

  // Get the ride for context
  const ride = await prisma.ride.findUnique({
    where: { id },
  });

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (ride.status === "CANCELLED" || ride.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Cannot add members to a cancelled or completed ride" },
      { status: 400 }
    );
  }

  // Create member with their suburb as start location
  const member = await prisma.rideMember.create({
    data: {
      rideId: id,
      userId: targetUser.id,
      role: "RIDER",
      startSuburb: targetUser.suburb || null,
      startLat: targetUser.suburbLat || null,
      startLng: targetUser.suburbLng || null,
    },
    include: {
      user: { select: { id: true, handle: true, displayName: true } },
    },
  });

  // Send invite email
  const inviter = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { handle: true, displayName: true },
  });

  const inviterName = inviter?.displayName || inviter?.handle || "Someone";
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const voteUrl = `${appUrl}/rides/${id}/vote`;

  try {
    await sendRideInviteEmail(
      targetUser.email,
      ride.title,
      inviterName,
      voteUrl
    );
  } catch {
    // Don't fail the request if email fails
  }

  return NextResponse.json(member, { status: 201 });
}
