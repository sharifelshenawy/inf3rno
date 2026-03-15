import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isRideMember,
  validateRouteId,
  validateDestinationName,
} from "@/lib/ride-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user is a member
  const isMember = await isRideMember(id, session.user.id);
  if (!isMember) {
    return NextResponse.json(
      { error: "Not a member of this ride" },
      { status: 403 }
    );
  }

  // Verify ride is in VOTING status
  const ride = await prisma.ride.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (ride.status !== "VOTING") {
    return NextResponse.json(
      { error: "Voting is only allowed when ride status is VOTING" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { routeId, destinationName } = body as {
    routeId?: string;
    destinationName?: string;
  };

  if (!routeId) {
    return NextResponse.json(
      { error: "routeId is required" },
      { status: 400 }
    );
  }

  // Validate routeId exists in routes.json
  if (!validateRouteId(routeId)) {
    return NextResponse.json(
      { error: "Invalid route ID" },
      { status: 400 }
    );
  }

  // Validate destination if provided
  if (destinationName) {
    if (!validateDestinationName(routeId, destinationName)) {
      return NextResponse.json(
        { error: "Invalid destination for this route" },
        { status: 400 }
      );
    }
  }

  // Upsert vote (one vote per user per ride)
  const vote = await prisma.rideVote.upsert({
    where: {
      rideId_userId: { rideId: id, userId: session.user.id },
    },
    create: {
      rideId: id,
      userId: session.user.id,
      routeId,
      destinationName: destinationName || null,
    },
    update: {
      routeId,
      destinationName: destinationName || null,
    },
  });

  return NextResponse.json(vote);
}
