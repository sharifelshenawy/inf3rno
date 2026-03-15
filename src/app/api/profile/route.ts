import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { geocodeSuburb } from "@/lib/geocode";
import {
  isHandleBlocked,
  isHandleAvailable,
  canChangeHandle,
  daysUntilHandleChange,
} from "@/lib/handle-generator";

const HANDLE_REGEX = /^[a-zA-Z0-9_]+$/;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { bikes: true },
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
  const { handle, displayName, phone, ridingLevel, suburb } = body as {
    handle?: string;
    displayName?: string;
    phone?: string;
    ridingLevel?: string;
    suburb?: string;
  };

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  // Handle validation + change restrictions
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

    if (isHandleBlocked(trimmed)) {
      return NextResponse.json(
        { error: "That handle contains inappropriate content" },
        { status: 400 }
      );
    }

    const lower = trimmed.toLowerCase();

    // Only check change cooldown if user already has a handle and is changing it
    if (currentUser.handle && currentUser.handle !== lower) {
      if (!canChangeHandle(currentUser.handleLastChangedAt)) {
        const days = daysUntilHandleChange(currentUser.handleLastChangedAt);
        return NextResponse.json(
          { error: `You can change your handle again in ${days} days` },
          { status: 429 }
        );
      }

      // Check availability (including retired handles)
      if (!(await isHandleAvailable(lower))) {
        return NextResponse.json(
          { error: "Handle is not available" },
          { status: 409 }
        );
      }

      // Retire the old handle
      await prisma.retiredHandle.create({
        data: {
          handle: currentUser.handle,
          userId: session.user.id,
        },
      });

      updateData.handle = lower;
      updateData.handleLastChangedAt = new Date();
    } else if (!currentUser.handle) {
      // First time setting handle — just check availability
      if (!(await isHandleAvailable(lower))) {
        return NextResponse.json(
          { error: "Handle is not available" },
          { status: 409 }
        );
      }
      updateData.handle = lower;
      updateData.handleLastChangedAt = new Date();
    }
  }

  if (displayName !== undefined) {
    updateData.displayName = displayName.trim();
  }

  if (phone !== undefined) {
    updateData.phone = phone.trim() || null;
  }

  if (ridingLevel !== undefined) {
    if (!["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(ridingLevel)) {
      return NextResponse.json(
        { error: "Invalid riding level" },
        { status: 400 }
      );
    }
    updateData.ridingLevel = ridingLevel;
  }

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

  // Mark onboarding complete when handle + displayName are set
  const finalHandle =
    updateData.handle !== undefined
      ? (updateData.handle as string)
      : currentUser.handle;
  const finalDisplayName =
    updateData.displayName !== undefined
      ? (updateData.displayName as string)
      : currentUser.displayName;

  if (finalHandle && finalDisplayName) {
    updateData.onboardingCompleted = true;
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    include: { bikes: true },
  });

  return NextResponse.json(updated);
}
