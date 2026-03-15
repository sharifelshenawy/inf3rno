import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { make, model, year, tankLitres, consumptionPer100km, isManualRange, manualRangeKm } =
    body as {
      make?: string;
      model?: string;
      year?: number;
      tankLitres?: number;
      consumptionPer100km?: number;
      isManualRange?: boolean;
      manualRangeKm?: number;
    };

  if (!make || !model || !tankLitres || !consumptionPer100km) {
    return NextResponse.json(
      { error: "make, model, tankLitres, and consumptionPer100km are required" },
      { status: 400 }
    );
  }

  if (typeof tankLitres !== "number" || tankLitres <= 0) {
    return NextResponse.json(
      { error: "tankLitres must be a positive number" },
      { status: 400 }
    );
  }

  if (typeof consumptionPer100km !== "number" || consumptionPer100km <= 0) {
    return NextResponse.json(
      { error: "consumptionPer100km must be a positive number" },
      { status: 400 }
    );
  }

  const bike = await prisma.bike.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      make: make.trim(),
      model: model.trim(),
      year: year ?? null,
      tankLitres,
      consumptionPer100km,
      isManualRange: isManualRange ?? false,
      manualRangeKm: manualRangeKm ?? null,
    },
    update: {
      make: make.trim(),
      model: model.trim(),
      year: year ?? null,
      tankLitres,
      consumptionPer100km,
      isManualRange: isManualRange ?? false,
      manualRangeKm: manualRangeKm ?? null,
    },
  });

  return NextResponse.json(bike);
}
