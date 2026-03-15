import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ADMIN_EMAIL = "sharif@in10se.com.au";

export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email;

    if (!email || email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Total events
    const totalEvents = await prisma.analyticsEvent.count();

    // Top events (event name counts)
    const topEventsRaw = await prisma.analyticsEvent.groupBy({
      by: ["event"],
      _count: { event: true },
      orderBy: { _count: { event: "desc" } },
      take: 20,
    });
    const topEvents = topEventsRaw.map((e) => ({
      event: e.event,
      count: e._count.event,
    }));

    // Top routes (route_selected events, top 10 by count)
    const routeEvents = await prisma.analyticsEvent.findMany({
      where: { event: "route_selected", data: { not: null } },
      select: { data: true },
    });
    const routeCounts: Record<string, number> = {};
    for (const re of routeEvents) {
      if (!re.data) continue;
      try {
        const parsed = JSON.parse(re.data) as Record<string, unknown>;
        const routeId = parsed.routeId;
        if (typeof routeId === "string") {
          routeCounts[routeId] = (routeCounts[routeId] || 0) + 1;
        }
      } catch {
        // Skip malformed data
      }
    }
    const topRoutes = Object.entries(routeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([routeId, count]) => ({ routeId, count }));

    // Daily active users (last 7 days)
    const dailyEventsRaw = await prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        userId: { not: null },
      },
      select: { userId: true, createdAt: true },
    });
    const dailyMap: Record<string, Set<string>> = {};
    for (const ev of dailyEventsRaw) {
      if (!ev.userId) continue;
      const day = ev.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = new Set();
      dailyMap[day].add(ev.userId);
    }
    const dailyActiveUsers = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, users]) => ({ date, count: users.size }));

    // Average session events (approximate: events per unique userId)
    const usersWithEvents = await prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: { userId: { not: null } },
      _count: { id: true },
    });
    const averageSessionEvents =
      usersWithEvents.length > 0
        ? Math.round(
            usersWithEvents.reduce((sum, u) => sum + u._count.id, 0) /
              usersWithEvents.length
          )
        : 0;

    return NextResponse.json({
      totalEvents,
      topRoutes,
      topEvents,
      dailyActiveUsers,
      averageSessionEvents,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
