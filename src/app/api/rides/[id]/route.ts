import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isRideMember,
  isRideLeader,
  validateRouteId,
  validateDestinationName,
  findRouteById,
} from "@/lib/ride-helpers";
import { tallyVotes } from "@/lib/vote-tally";
import {
  sendRideLockedEmail,
  sendRideChangedEmail,
} from "@/lib/email";
import type { RideStatus } from "@/generated/prisma/client";

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
    return NextResponse.json({ error: "Not a member of this ride" }, { status: 403 });
  }

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, handle: true, displayName: true },
          },
        },
      },
      votes: true,
      creator: {
        select: { id: true, handle: true, displayName: true },
      },
    },
  });

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  return NextResponse.json(ride);
}

export async function PUT(
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
    return NextResponse.json({ error: "Only the ride leader can update this ride" }, { status: 403 });
  }

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, handle: true, displayName: true },
          },
        },
      },
      votes: true,
    },
  });

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  const body = await request.json();
  const {
    title,
    scheduledAt,
    status,
    vibe,
    difficulty,
    routeId,
    destinationName,
  } = body as {
    title?: string;
    scheduledAt?: string | null;
    status?: RideStatus;
    vibe?: string;
    difficulty?: string;
    routeId?: string;
    destinationName?: string;
  };

  const updateData: Record<string, unknown> = {};

  // Basic updates
  if (title !== undefined) {
    if (title.trim().length === 0 || title.trim().length > 100) {
      return NextResponse.json(
        { error: "Title must be 1-100 characters" },
        { status: 400 }
      );
    }
    updateData.title = title.trim();
  }

  if (scheduledAt !== undefined) {
    updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  }

  if (vibe !== undefined) {
    updateData.vibe = vibe;
  }

  if (difficulty !== undefined) {
    updateData.difficulty = difficulty;
  }

  // Route/destination overrides
  if (routeId !== undefined) {
    if (!validateRouteId(routeId)) {
      return NextResponse.json(
        { error: "Invalid route ID" },
        { status: 400 }
      );
    }
    updateData.routeId = routeId;

    // If a destination is also provided, validate it against this route
    if (destinationName !== undefined) {
      if (!validateDestinationName(routeId, destinationName)) {
        return NextResponse.json(
          { error: "Invalid destination for this route" },
          { status: 400 }
        );
      }
      updateData.destinationName = destinationName;
    }

    // Recalculate meeting point
    const route = findRouteById(routeId);
    if (route) {
      const memberLocations = ride.members
        .filter((m) => m.startLat !== null && m.startLng !== null)
        .map((m) => ({
          lat: m.startLat as number,
          lng: m.startLng as number,
          displayName: m.user.displayName || m.user.handle || "Rider",
        }));

      if (memberLocations.length > 0) {
        const { findOptimalMeetingPoint } = await import("@/lib/midpoint");
        const routeStart = {
          lat: route.waypoints[0].lat,
          lng: route.waypoints[0].lng,
        };
        const result = findOptimalMeetingPoint(memberLocations, routeStart);
        updateData.meetingPointId = result.meetingPoint.id;
      }
    }
  } else if (destinationName !== undefined) {
    // Destination change without route change — validate against current route
    if (ride.routeId) {
      if (!validateDestinationName(ride.routeId, destinationName)) {
        return NextResponse.json(
          { error: "Invalid destination for the current route" },
          { status: 400 }
        );
      }
    }
    updateData.destinationName = destinationName;
  }

  // Status transitions
  if (status !== undefined && status !== ride.status) {
    const currentStatus = ride.status;

    // DRAFT -> VOTING: need >=2 members and vibe set
    if (status === "VOTING") {
      if (currentStatus !== "DRAFT") {
        return NextResponse.json(
          { error: "Can only start voting from DRAFT status" },
          { status: 400 }
        );
      }
      if (ride.members.length < 2) {
        return NextResponse.json(
          { error: "Need at least 2 members to start voting" },
          { status: 400 }
        );
      }
      const effectiveVibe = (updateData.vibe as string) || ride.vibe;
      if (!effectiveVibe) {
        return NextResponse.json(
          { error: "Vibe must be set before starting voting" },
          { status: 400 }
        );
      }
    }

    // VOTING -> LOCKED: need >=1 vote, run tally
    if (status === "LOCKED") {
      if (currentStatus !== "VOTING") {
        return NextResponse.json(
          { error: "Can only lock from VOTING status" },
          { status: 400 }
        );
      }
      if (ride.votes.length < 1) {
        return NextResponse.json(
          { error: "Need at least 1 vote to lock the ride" },
          { status: 400 }
        );
      }

      // Run vote tally
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

      if (tally.winningRouteId) {
        updateData.routeId = tally.winningRouteId;
      }
      if (tally.winningDestination) {
        updateData.destinationName = tally.winningDestination;
      }
      if (tally.meetingPoint) {
        updateData.meetingPointId = tally.meetingPoint.meetingPoint.id;
      }

      // Send locked email to all members after update
      const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const rideUrl = `${appUrl}/rides/${id}`;
      const routeName = tally.winningRoute?.name || "TBD";
      const meetingPointName = tally.meetingPoint?.meetingPoint.name || "TBD";
      const destName = tally.winningDestination || "TBD";
      const schedDate = ride.scheduledAt || new Date();

      for (const member of ride.members) {
        try {
          await sendRideLockedEmail(
            member.user.email,
            ride.title,
            routeName,
            meetingPointName,
            destName,
            schedDate,
            rideUrl
          );
        } catch {
          // Don't fail the request if email fails
        }
      }
    }

    // Any -> CANCELLED
    if (status === "CANCELLED") {
      // Always allowed
    }

    // Reject invalid transitions
    if (
      status !== "VOTING" &&
      status !== "LOCKED" &&
      status !== "CANCELLED"
    ) {
      return NextResponse.json(
        { error: "Invalid status transition" },
        { status: 400 }
      );
    }

    updateData.status = status;
  }

  // Notify members of route/destination changes on a LOCKED ride
  if (
    ride.status === "LOCKED" &&
    (routeId !== undefined || destinationName !== undefined) &&
    status === undefined
  ) {
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const rideUrl = `${appUrl}/rides/${id}`;
    const leaderMember = ride.members.find((m) => m.role === "LEADER");
    const leaderName =
      leaderMember?.user.displayName || leaderMember?.user.handle || "Leader";

    for (const member of ride.members) {
      if (member.userId === session.user.id) continue; // Don't email the leader
      try {
        await sendRideChangedEmail(
          member.user.email,
          ride.title,
          leaderName,
          rideUrl
        );
      } catch {
        // Don't fail the request if email fails
      }
    }
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: updateData,
    include: {
      members: {
        include: {
          user: { select: { id: true, handle: true, displayName: true } },
        },
      },
      votes: true,
      creator: {
        select: { id: true, handle: true, displayName: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
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
      { error: "Only the ride leader can cancel this ride" },
      { status: 403 }
    );
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json(updated);
}
