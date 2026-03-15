"use client";

import { useState, useEffect, useRef } from "react";

interface SearchUser {
  id: string;
  handle: string;
  displayName: string | null;
  email?: string | null;
  suburb?: string | null;
}

interface HandleSearchProps {
  onSelect: (user: SearchUser) => void;
}

export default function HandleSearch({ onSelect }: HandleSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data: SearchUser[] = await res.json();
          setResults(data);
          setOpen(data.length > 0);
        } else {
          setResults([]);
          setOpen(false);
        }
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (user: SearchUser) => {
    onSelect(user);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Search by handle, name, or email..."
          className="w-full pl-10 pr-10 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] text-xs">
            ...
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg max-h-60 overflow-y-auto">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user)}
              className="w-full text-left px-4 py-3 hover:bg-[#2A2A2A] transition-colors border-b border-[#2A2A2A] last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-semibold text-sm">
                    @{user.handle}
                  </span>
                  {user.displayName && (
                    <span className="text-zinc-400 text-sm ml-2">
                      {user.displayName}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {user.email && (
                  <span className="text-xs text-zinc-600">{user.email}</span>
                )}
                {user.suburb && (
                  <span className="text-xs text-zinc-600">{user.suburb}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !loading && results.length === 0 && open === false && (
        <p className="mt-2 text-xs text-zinc-500">
          No riders found. Try their handle, name, or email.
        </p>
      )}
    </div>
  );
}
