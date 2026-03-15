"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface UserMenuProps {
  handle: string;
  displayName: string | null;
}

export default function UserMenu({ handle, displayName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2A2A2A] bg-[#141414] hover:border-[#FF6B2B]/50 transition-colors text-sm"
      >
        <span className="text-zinc-400">@</span>
        <span className="text-white font-medium truncate max-w-[120px]">
          {displayName || handle}
        </span>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[#2A2A2A] bg-[#141414] shadow-lg shadow-black/40 overflow-hidden z-50">
          <Link
            href="/rides"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#1F1F1F] hover:text-white transition-colors"
          >
            My Rides
          </Link>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#1F1F1F] hover:text-white transition-colors"
          >
            Profile
          </Link>
          <div className="border-t border-[#2A2A2A]" />
          <button
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="block w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:bg-[#1F1F1F] hover:text-red-400 transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
