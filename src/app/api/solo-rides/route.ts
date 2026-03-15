import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateRouteId } from "@/lib/ride-helpers";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    routeId,
    destinationName,
    meetingPointId,
    vibe,
    difficulty,
    riderLat,
    riderLng,
    riderSuburb,
    bikeMake,
    bikeModel,
    rangeKm,
  } = body;

  if (!routeId || !vibe || !difficulty || riderLat === undefined || riderLng === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!validateRouteId(routeId)) {
    return NextResponse.json({ error: "Invalid route" }, { status: 400 });
  }

  const soloRide = await prisma.soloRide.create({
    data: {
      userId: session.user.id,
      routeId,
      destinationName: destinationName || null,
      meetingPointId: meetingPointId || null,
      vibe,
      difficulty,
      riderLat,
      riderLng,
      riderSuburb: riderSuburb || null,
      bikeMake: bikeMake || null,
      bikeModel: bikeModel || null,
      rangeKm: rangeKm || null,
    },
  });

  return NextResponse.json(soloRide);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  const soloRides = await prisma.soloRide.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(soloRides);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Ride ID required" }, { status: 400 });
  }

  const existing = await prisma.soloRide.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  await prisma.soloRide.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
