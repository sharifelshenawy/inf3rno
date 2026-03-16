"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";

interface SwipeableCardProps {
  children: ReactNode;
  /** Label for the action button (default: "Delete") */
  actionLabel?: string;
  /** Called when the user confirms the swipe action */
  onAction: () => void;
  /** Confirmation message shown before executing action */
  confirmMessage?: string;
  /** Whether the action is currently in progress */
  isLoading?: boolean;
  /** Desktop action label shown on hover (if different from actionLabel) */
  desktopLabel?: string;
}

const SWIPE_THRESHOLD = 80;

export default function SwipeableCard({
  children,
  actionLabel = "Delete",
  onAction,
  confirmMessage = "Are you sure?",
  isLoading = false,
  desktopLabel,
}: SwipeableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isLoading) return;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isHorizontalSwipe.current = null;
      setIsSwiping(true);
    },
    [isLoading]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping || isLoading) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStartX.current;
      const diffY = currentY - touchStartY.current;

      // Determine swipe direction on first significant movement
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
          isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
        }
        return;
      }

      // Not a horizontal swipe — bail
      if (!isHorizontalSwipe.current) return;

      if (isRevealed) {
        // Already revealed — allow swiping back right
        const newX = Math.min(0, -SWIPE_THRESHOLD + (currentX - touchStartX.current));
        setTranslateX(newX);
      } else {
        // Only allow left swipe (negative direction)
        const newX = Math.min(0, diffX);
        setTranslateX(newX);
      }
    },
    [isSwiping, isLoading, isRevealed]
  );

  const handleTouchEnd = useCallback(() => {
    setIsSwiping(false);
    isHorizontalSwipe.current = null;

    if (isLoading) return;

    if (isRevealed) {
      // If swiped back past halfway, close
      if (translateX > -SWIPE_THRESHOLD / 2) {
        setTranslateX(0);
        setIsRevealed(false);
      } else {
        setTranslateX(-SWIPE_THRESHOLD);
      }
    } else {
      // If swiped past threshold, reveal
      if (translateX < -SWIPE_THRESHOLD) {
        setTranslateX(-SWIPE_THRESHOLD);
        setIsRevealed(true);
      } else {
        setTranslateX(0);
      }
    }
  }, [isLoading, isRevealed, translateX]);

  const handleAction = useCallback(() => {
    if (isLoading) return;
    if (confirm(confirmMessage)) {
      onAction();
      // Reset swipe state after action
      setTranslateX(0);
      setIsRevealed(false);
    }
  }, [isLoading, confirmMessage, onAction]);

  const handleDesktopAction = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isLoading) return;
      if (confirm(confirmMessage)) {
        onAction();
      }
    },
    [isLoading, confirmMessage, onAction]
  );

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* Red delete background — sits behind the card */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={handleAction}
          disabled={isLoading}
          className="h-full w-20 bg-[#EF4444] flex items-center justify-center text-white hover:bg-red-600 transition-colors"
          aria-label={actionLabel}
        >
          {isLoading ? (
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Swipeable card content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10 group"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? "none" : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        {children}

        {/* Desktop-only action link — shown on hover at bottom-right */}
        <button
          onClick={handleDesktopAction}
          disabled={isLoading}
          className="hidden md:block absolute bottom-3 right-3 text-xs text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 z-20"
        >
          {isLoading ? "..." : desktopLabel || actionLabel}
        </button>
      </div>
    </div>
  );
}
