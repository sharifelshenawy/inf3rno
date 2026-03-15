import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeRangeKm } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const lower = handle.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { handle: lower },
    select: {
      displayName: true,
      handle: true,
      profilePicUrl: true,
      suburb: true,
      bike: {
        select: {
          make: true,
          model: true,
          year: true,
          tankLitres: true,
          consumptionPer100km: true,
          isManualRange: true,
          manualRangeKm: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rangeKm = user.bike ? computeRangeKm(user.bike) : null;

  return NextResponse.json({
    displayName: user.displayName,
    handle: user.handle,
    profilePicUrl: user.profilePicUrl,
    suburb: user.suburb,
    bike: user.bike
      ? {
          make: user.bike.make,
          model: user.bike.model,
          year: user.bike.year,
          rangeKm,
        }
      : null,
  });
}
