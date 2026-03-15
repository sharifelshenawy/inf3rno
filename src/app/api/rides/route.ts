import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateInviteCode } from "@/lib/ride-helpers";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, scheduledAt, vibe, difficulty } = body as {
    title?: string;
    scheduledAt?: string;
    vibe?: string;
    difficulty?: string;
  };

  if (!title || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  if (title.trim().length > 100) {
    return NextResponse.json(
      { error: "Title must be 100 characters or fewer" },
      { status: 400 }
    );
  }

  // Fetch creator's suburb for start location
  const creator = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  const ride = await prisma.ride.create({
    data: {
      title: title.trim(),
      creatorId: session.user.id,
      inviteCode: generateInviteCode(),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      vibe: vibe || null,
      difficulty: difficulty || null,
      members: {
        create: {
          userId: session.user.id,
          role: "LEADER",
          startSuburb: creator?.suburb || null,
          startLat: creator?.suburbLat || null,
          startLng: creator?.suburbLng || null,
        },
      },
    },
    include: {
      members: {
        include: { user: { select: { handle: true, displayName: true } } },
      },
    },
  });

  return NextResponse.json(ride, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rides = await prisma.ride.findMany({
    where: {
      members: {
        some: { userId: session.user.id },
      },
    },
    include: {
      _count: {
        select: { members: true },
      },
      creator: {
        select: { handle: true, displayName: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = rides.map((ride) => ({
    id: ride.id,
    title: ride.title,
    status: ride.status,
    scheduledAt: ride.scheduledAt,
    vibe: ride.vibe,
    difficulty: ride.difficulty,
    inviteCode: ride.inviteCode,
    creatorId: ride.creatorId,
    creator: ride.creator,
    memberCount: ride._count.members,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
  }));

  return NextResponse.json(result);
}
