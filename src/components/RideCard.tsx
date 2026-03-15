import Link from "next/link";

interface RideCardProps {
  ride: {
    id: string;
    title: string;
    status: string;
    scheduledAt: string | null;
    memberCount?: number;
    _count?: { members: number };
  };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  VOTING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LOCKED: "bg-[#FF6B2B]/20 text-[#FF6B2B] border-[#FF6B2B]/30",
  COMPLETED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RideCard({ ride }: RideCardProps) {
  const memberCount = ride.memberCount ?? ride._count?.members ?? 0;
  const statusColor =
    STATUS_COLORS[ride.status] || "bg-zinc-500/20 text-zinc-400";

  return (
    <Link href={`/rides/${ride.id}`} className="block group">
      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 space-y-2 hover:border-[#FF6B2B]/50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-white font-bold truncate">{ride.title}</h3>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
          >
            {ride.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
            {memberCount} rider{memberCount !== 1 ? "s" : ""}
          </span>
          {ride.scheduledAt && (
            <>
              <span>&middot;</span>
              <span>{formatDate(ride.scheduledAt)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
