"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRouteImages, ROUTE_IMAGE_QUERIES } from "@/lib/images";
import type { RouteImage } from "@/lib/images";

interface RouteGalleryProps {
  routeId: string;
}

export default function RouteGallery({ routeId }: RouteGalleryProps) {
  const [images, setImages] = useState<RouteImage[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const query = ROUTE_IMAGE_QUERIES[routeId];
    if (!query) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setCurrent(0);
    fetchRouteImages(query, 8).then((imgs) => {
      setImages(imgs);
      setLoading(false);
    });
  }, [routeId]);

  const next = useCallback(() => {
    if (images.length > 0) setCurrent((c) => (c + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    if (images.length > 0) setCurrent((c) => (c - 1 + images.length) % images.length);
  }, [images.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    touchStart.current = null;
  };

  if (loading) {
    return (
      <div className="h-48 rounded-lg bg-[#141414] border border-[#2A2A2A] flex items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading photos...
        </div>
      </div>
    );
  }

  if (images.length === 0) return null;

  const img = images[current];

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
        Route Photos
      </p>

      {/* Main image */}
      <div
        className="relative rounded-lg overflow-hidden bg-[#141414] border border-[#2A2A2A] cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={img.thumbUrl}
          alt={img.title}
          className={`w-full object-cover transition-all duration-300 ${
            expanded ? "h-80" : "h-48"
          }`}
          loading="lazy"
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              &lsaquo;
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              &rsaquo;
            </button>
          </>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === current
                    ? "bg-[#FF6B2B] w-3"
                    : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Counter */}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-xs text-white">
          {current + 1}/{images.length}
        </span>
      </div>

      {/* Attribution */}
      <p className="text-xs text-zinc-600 text-center">
        {img.attribution !== "Unknown" && (
          <span>{img.attribution} / </span>
        )}
        <a
          href={img.descriptionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-zinc-400 underline"
          onClick={(e) => e.stopPropagation()}
        >
          {img.license}
        </a>
      </p>
    </div>
  );
}
