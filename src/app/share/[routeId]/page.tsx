import { notFound } from "next/navigation";
import type { Metadata } from "next";
import routesData from "@/data/routes.json";
import meetingPointsData from "@/data/meetingPoints.json";
import type { Route } from "@/lib/routeMatcher";
import RideStatsCard from "@/components/RideStatsCard";
import Link from "next/link";

interface SharePageProps {
  params: Promise<{ routeId: string }>;
}

const routes = routesData as Route[];

function findRoute(routeId: string): Route | undefined {
  return routes.find((r) => r.id === routeId);
}

function findMeetingPointName(route: Route): string {
  const mpId = route.meetingPointIds[0];
  const mp = (meetingPointsData as { id: string; name: string }[]).find(
    (m) => m.id === mpId
  );
  return mp?.name ?? "TBD";
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { routeId } = await params;
  const route = findRoute(routeId);

  if (!route) {
    return { title: "Route not found — inf3rno" };
  }

  const durationText = `${Math.floor(route.durationMinutes / 60)}h ${route.durationMinutes % 60}m`;
  const description = `${route.name} — ${route.distanceKm}km, ${durationText}. ${route.difficulty} difficulty. Planned with inf3rno.`;

  return {
    title: `${route.name} — inf3rno`,
    description,
    openGraph: {
      title: `${route.name} — inf3rno Ride Plan`,
      description,
      siteName: "inf3rno",
      type: "website",
      url: `https://inf3rno.vercel.app/share/${routeId}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${route.name} — inf3rno Ride Plan`,
      description,
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { routeId } = await params;
  const route = findRoute(routeId);

  if (!route) {
    notFound();
  }

  const meetingPointName = findMeetingPointName(route);
  const destination = route.destinations[0];
  const primaryVibe = route.vibe[0] ?? "mix";

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-8 space-y-6">
      <RideStatsCard
        routeName={route.name}
        distanceKm={route.distanceKm}
        durationMinutes={route.durationMinutes}
        difficulty={route.difficulty}
        vibe={primaryVibe}
        meetingPointName={meetingPointName}
        destinationName={destination.name}
      />

      <div className="w-full max-w-[375px] space-y-3">
        <Link
          href="/plan/guest"
          className="block w-full h-12 rounded-lg bg-[#FF6B2B] text-white font-semibold text-center leading-[48px] hover:bg-[#FF8B5B] transition-colors"
        >
          Plan this route
        </Link>

        <p className="text-center text-xs text-zinc-500">
          Open in inf3rno to customize meeting points, vibes, and more.
        </p>
      </div>
    </div>
  );
}
