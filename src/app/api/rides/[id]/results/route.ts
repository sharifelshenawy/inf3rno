import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRideMember } from "@/lib/ride-helpers";
import { tallyVotes } from "@/lib/vote-tally";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const isMember = await isRideMember(id, session.user.id);
  if (!isMember) {
    return NextResponse.json(
      { error: "Not a member of this ride" },
      { status: 403 }
    );
  }

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      votes: true,
      members: {
        include: {
          user: {
            select: { id: true, handle: true, displayName: true },
          },
        },
      },
    },
  });

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  const memberLocations = ride.members
    .filter((m) => m.startLat !== null && m.startLng !== null)
    .map((m) => ({
      lat: m.startLat as number,
      lng: m.startLng as number,
      displayName: m.user.displayName || m.user.handle || "Rider",
    }));

  const tally = tallyVotes(
    ride.votes,
    ride.vibe,
    ride.difficulty,
    ride.creatorId,
    memberLocations
  );

  return NextResponse.json({
    winningRouteId: tally.winningRouteId,
    winningRoute: tally.winningRoute
      ? {
          id: tally.winningRoute.id,
          name: tally.winningRoute.name,
          description: tally.winningRoute.description,
          vibe: tally.winningRoute.vibe,
          difficulty: tally.winningRoute.difficulty,
          distanceKm: tally.winningRoute.distanceKm,
          durationMinutes: tally.winningRoute.durationMinutes,
        }
      : null,
    winningDestination: tally.winningDestination,
    meetingPoint: tally.meetingPoint
      ? {
          id: tally.meetingPoint.meetingPoint.id,
          name: tally.meetingPoint.meetingPoint.name,
          address: tally.meetingPoint.meetingPoint.address,
          lat: tally.meetingPoint.meetingPoint.lat,
          lng: tally.meetingPoint.meetingPoint.lng,
          maxRiderDistanceKm: tally.meetingPoint.maxRiderDistanceKm,
          riderDistances: tally.meetingPoint.riderDistances,
        }
      : null,
    routeVoteCounts: tally.routeVoteCounts,
    destinationVoteCounts: tally.destinationVoteCounts,
    totalVotes: tally.totalVotes,
  });
}
