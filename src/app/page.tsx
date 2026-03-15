"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleAuthRoute = (path: string) => {
    if (session?.user) {
      router.push(path);
    } else {
      router.push(`/login?callbackUrl=${encodeURIComponent(path)}`);
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Hero */}
      <div className="text-center space-y-2 pb-4">
        <h2 className="text-2xl font-bold text-white">Plan your ride</h2>
        <p className="text-sm text-zinc-400">
          Pick a vibe, match a route, meet your crew.
        </p>
      </div>

      {/* Solo Ride card */}
      <button onClick={() => handleAuthRoute("/plan")} className="block w-full text-left group">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5 space-y-3 hover:border-[#FF6B2B]/50 transition-colors">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#FF6B2B]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#FF6B2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white">Solo Ride</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Plan your ride with saved profile, bike range &amp; favourites
              </p>
            </div>
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF6B2B] group-hover:gap-2.5 transition-all">
              Start riding
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </div>
        </div>
      </button>

      {/* Group Ride card */}
      <button onClick={() => handleAuthRoute("/rides/new")} className="block w-full text-left group">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5 space-y-3 hover:border-[#FF6B2B]/50 transition-colors">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#FF6B2B]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#FF6B2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white">Group Ride</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Create a ride, invite your crew, vote on the plan
              </p>
            </div>
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF6B2B] group-hover:gap-2.5 transition-all">
              Get started
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </div>
        </div>
      </button>

      {/* Guest card */}
      <div className="rounded-xl border border-[#2A2A2A]/60 bg-[#0F0F0F] p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-zinc-400">Quick Ride (Guest)</p>
            <p className="text-xs text-zinc-600">No account needed</p>
          </div>
          <Link
            href="/plan/guest"
            className="text-sm font-medium text-zinc-400 hover:text-[#FF6B2B] transition-colors"
          >
            Plan as guest &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
