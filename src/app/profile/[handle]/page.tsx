import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeRangeKm } from "@/lib/types";

interface PublicProfilePageProps {
  params: Promise<{ handle: string }>;
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
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
    notFound();
  }

  const rangeKm = user.bike ? computeRangeKm(user.bike) : null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="max-w-sm mx-auto">
        {/* Profile card */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6">
          {/* Avatar / initials */}
          <div className="flex items-center gap-4 mb-6">
            {user.profilePicUrl ? (
              <img
                src={user.profilePicUrl}
                alt={user.displayName ?? user.handle ?? "Profile"}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#2A2A2A]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#FF6B2B]/20 border-2 border-[#2A2A2A] flex items-center justify-center">
                <span className="text-2xl font-bold text-[#FF6B2B]">
                  {(user.displayName ?? user.handle ?? "?")[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">
                {user.displayName}
              </h1>
              <p className="text-sm text-[#999999]">@{user.handle}</p>
            </div>
          </div>

          {/* Suburb */}
          {user.suburb && (
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-4 h-4 text-[#555555]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm text-[#999999]">{user.suburb}</span>
            </div>
          )}

          {/* Bike info */}
          {user.bike && (
            <div className="border-t border-[#2A2A2A] pt-4 mt-4">
              <h2 className="text-xs text-[#555555] uppercase tracking-wide mb-3">
                Ride
              </h2>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">
                    {user.bike.make} {user.bike.model}
                  </p>
                  {user.bike.year && (
                    <p className="text-sm text-[#555555]">{user.bike.year}</p>
                  )}
                </div>

                {rangeKm !== null && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#FF6B2B]">
                      {Math.round(rangeKm)}
                    </p>
                    <p className="text-xs text-[#555555]">km range</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
