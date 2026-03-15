import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase();

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    where: {
      handle: { startsWith: q },
      id: { not: session.user.id },
    },
    select: {
      id: true,
      handle: true,
      displayName: true,
      profilePicUrl: true,
    },
    take: 10,
    orderBy: { handle: "asc" },
  });

  return NextResponse.json(users);
}
