import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { make, model, year, tankLitres, consumptionPer100km, isManualRange, manualRangeKm } = body;

  if (!make || !model || !tankLitres || !consumptionPer100km) {
    return NextResponse.json({ error: "Missing required bike fields" }, { status: 400 });
  }

  const count = await prisma.bike.count({ where: { userId: session.user.id } });
  if (count >= 5) {
    return NextResponse.json({ error: "Maximum 5 bikes allowed" }, { status: 400 });
  }

  const bike = await prisma.bike.create({
    data: {
      userId: session.user.id,
      make: make.trim(),
      model: model.trim(),
      year: year || null,
      tankLitres,
      consumptionPer100km,
      isManualRange: isManualRange || false,
      manualRangeKm: manualRangeKm || null,
      isPrimary: count === 0,
    },
  });

  return NextResponse.json(bike);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, make, model, year, tankLitres, consumptionPer100km, isManualRange, manualRangeKm, isPrimary } = body;

  if (!id) {
    return NextResponse.json({ error: "Bike ID required" }, { status: 400 });
  }

  const existing = await prisma.bike.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bike not found" }, { status: 404 });
  }

  if (isPrimary) {
    await prisma.bike.updateMany({
      where: { userId: session.user.id },
      data: { isPrimary: false },
    });
  }

  const bike = await prisma.bike.update({
    where: { id },
    data: {
      ...(make !== undefined && { make: make.trim() }),
      ...(model !== undefined && { model: model.trim() }),
      ...(year !== undefined && { year: year || null }),
      ...(tankLitres !== undefined && { tankLitres }),
      ...(consumptionPer100km !== undefined && { consumptionPer100km }),
      ...(isManualRange !== undefined && { isManualRange }),
      ...(manualRangeKm !== undefined && { manualRangeKm }),
      ...(isPrimary && { isPrimary: true }),
    },
  });

  return NextResponse.json(bike);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Bike ID required" }, { status: 400 });
  }

  const existing = await prisma.bike.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bike not found" }, { status: 404 });
  }

  await prisma.bike.delete({ where: { id } });

  if (existing.isPrimary) {
    const first = await prisma.bike.findFirst({ where: { userId: session.user.id } });
    if (first) {
      await prisma.bike.update({ where: { id: first.id }, data: { isPrimary: true } });
    }
  }

  return NextResponse.json({ success: true });
}
