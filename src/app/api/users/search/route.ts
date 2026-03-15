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
    return NextResponse.json([]);
  }

  // Search by handle, display name, email, or phone
  const isEmail = q.includes("@");
  const isPhone = /^\+?\d[\d\s-]{5,}$/.test(q);

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      onboardingCompleted: true,
      OR: [
        { handle: { startsWith: q } },
        { displayName: { contains: q, mode: "insensitive" } },
        ...(isEmail ? [{ email: { startsWith: q } }] : []),
        ...(isPhone ? [{ phone: { contains: q.replace(/[\s-]/g, "") } }] : []),
      ],
    },
    select: {
      id: true,
      handle: true,
      displayName: true,
      profilePicUrl: true,
      email: true,
      suburb: true,
    },
    take: 10,
    orderBy: { handle: "asc" },
  });

  // Mask email for privacy (show first 3 chars + domain)
  const masked = users.map((u) => ({
    ...u,
    email: u.email
      ? u.email.slice(0, 3) + "***@" + u.email.split("@")[1]
      : null,
  }));

  return NextResponse.json(masked);
}
