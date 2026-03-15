"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface UserMenuProps {
  handle: string | null;
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
        {/* Profile icon */}
        <svg className="w-5 h-5 text-[#FF6B2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-white font-medium truncate max-w-[120px]">
          {displayName || handle || "Account"}
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
