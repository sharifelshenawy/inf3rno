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
      bikes: {
        where: { isPrimary: true },
        take: 1,
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

  const primaryBike = user.bikes[0] ?? null;
  const rangeKm = primaryBike ? computeRangeKm(primaryBike) : null;

  return NextResponse.json({
    displayName: user.displayName,
    handle: user.handle,
    profilePicUrl: user.profilePicUrl,
    suburb: user.suburb,
    bike: primaryBike
      ? {
          make: primaryBike.make,
          model: primaryBike.model,
          year: primaryBike.year,
          rangeKm,
        }
      : null,
  });
}
