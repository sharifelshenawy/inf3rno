import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRideMember, isRideLeader } from "@/lib/ride-helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, userId: targetUserId } = await params;

  // Verify the requester is a member
  const isMember = await isRideMember(id, session.user.id);
  if (!isMember) {
    return NextResponse.json(
      { error: "Not a member of this ride" },
      { status: 403 }
    );
  }

  // Fetch the target member
  const targetMember = await prisma.rideMember.findUnique({
    where: { rideId_userId: { rideId: id, userId: targetUserId } },
  });

  if (!targetMember) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  // Leader cannot be removed
  if (targetMember.role === "LEADER") {
    return NextResponse.json(
      { error: "The ride leader cannot be removed" },
      { status: 400 }
    );
  }

  // Authorization: leader can remove anyone, any member can remove themselves
  const isLeaderUser = await isRideLeader(id, session.user.id);
  const isSelf = session.user.id === targetUserId;

  if (!isLeaderUser && !isSelf) {
    return NextResponse.json(
      { error: "Only the leader or the member themselves can remove a member" },
      { status: 403 }
    );
  }

  await prisma.rideMember.delete({
    where: { rideId_userId: { rideId: id, userId: targetUserId } },
  });

  // Also delete any votes by this user for this ride
  await prisma.rideVote.deleteMany({
    where: { rideId: id, userId: targetUserId },
  });

  return NextResponse.json({ success: true });
}
