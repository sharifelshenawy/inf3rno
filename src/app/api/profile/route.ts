import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { geocodeSuburb } from "@/lib/geocode";

const HANDLE_REGEX = /^[a-zA-Z0-9_]+$/;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { bike: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { handle, displayName, suburb } = body as {
    handle?: string;
    displayName?: string;
    suburb?: string;
  };

  const updateData: Record<string, unknown> = {};

  // Validate and set handle
  if (handle !== undefined) {
    const trimmed = handle.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
      return NextResponse.json(
        { error: "Handle must be 3-20 characters" },
        { status: 400 }
      );
    }

    if (!HANDLE_REGEX.test(trimmed)) {
      return NextResponse.json(
        { error: "Handle can only contain letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    const lower = trimmed.toLowerCase();

    // Check uniqueness (excluding current user)
    const existing = await prisma.user.findUnique({
      where: { handle: lower },
    });

    if (existing && existing.id !== session.user.id) {
      return NextResponse.json(
        { error: "Handle is already taken" },
        { status: 409 }
      );
    }

    updateData.handle = lower;
  }

  // Set display name
  if (displayName !== undefined) {
    updateData.displayName = displayName.trim();
  }

  // Geocode suburb if provided
  if (suburb !== undefined) {
    updateData.suburb = suburb.trim() || null;

    if (suburb.trim()) {
      const geo = await geocodeSuburb(suburb.trim());
      if (geo) {
        updateData.suburbLat = geo.lat;
        updateData.suburbLng = geo.lng;
      }
    } else {
      updateData.suburbLat = null;
      updateData.suburbLng = null;
    }
  }

  // Determine if onboarding should be marked complete
  // We need to check what the final state will be after the update
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  const finalHandle =
    updateData.handle !== undefined
      ? (updateData.handle as string)
      : currentUser?.handle;
  const finalDisplayName =
    updateData.displayName !== undefined
      ? (updateData.displayName as string)
      : currentUser?.displayName;

  if (finalHandle && finalDisplayName) {
    updateData.onboardingCompleted = true;
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    include: { bike: true },
  });

  return NextResponse.json(updated);
}
