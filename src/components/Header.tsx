"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import UserMenu from "./UserMenu";

export default function Header() {
  const { data: session, status } = useSession();

  const user = session?.user as
    | { handle?: string | null; displayName?: string | null }
    | undefined;

  return (
    <header className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#2A2A2A]">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-[#FF6B2B]">inf</span>
            <span className="text-white">3</span>
            <span className="text-[#FF6B2B]">rno</span>
          </h1>
        </Link>

        <nav>
          {status === "loading" ? (
            <div className="w-20 h-8" />
          ) : session?.user ? (
            <UserMenu
              handle={user?.handle ?? null}
              displayName={user?.displayName ?? null}
            />
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] text-sm text-zinc-300 hover:border-[#FF6B2B]/50 hover:text-white transition-colors"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
