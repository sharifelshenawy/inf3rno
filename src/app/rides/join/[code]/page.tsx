"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type JoinState = "loading" | "success" | "error";

export default function JoinRidePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [state, setState] = useState<JoinState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [rideId, setRideId] = useState<string | null>(null);

  useEffect(() => {
    async function join() {
      try {
        const res = await fetch(`/api/rides/join/${encodeURIComponent(code)}`, {
          method: "POST",
        });

        const data = await res.json();

        if (res.ok) {
          setRideId(data.rideId);
          setState("success");
          // Redirect after a brief moment
          setTimeout(() => {
            router.push(`/rides/${data.rideId}`);
          }, 1000);
          return;
        }

        // Handle "already a member" — redirect to ride
        if (res.status === 409 && data.rideId) {
          setRideId(data.rideId);
          setState("success");
          setTimeout(() => {
            router.push(`/rides/${data.rideId}`);
          }, 1000);
          return;
        }

        // Handle 401 — redirect to login
        if (res.status === 401) {
          router.push(
            `/login?callbackUrl=${encodeURIComponent(`/rides/join/${code}`)}`
          );
          return;
        }

        setErrorMessage(data.error ?? "Failed to join ride");
        setState("error");
      } catch {
        setErrorMessage("Network error. Please try again.");
        setState("error");
      }
    }
    join();
  }, [code, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm text-center space-y-6">
        {state === "loading" && (
          <>
            <div className="flex items-center justify-center gap-2 text-zinc-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-lg font-semibold">Joining ride...</span>
            </div>
          </>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <span className="text-2xl text-green-400">&#10003;</span>
            </div>
            <p className="text-lg font-semibold text-white">
              You&apos;re in!
            </p>
            <p className="text-sm text-zinc-400">
              Redirecting to the ride...
            </p>
            {rideId && (
              <Link
                href={`/rides/${rideId}`}
                className="inline-block text-sm text-[#FF6B2B] hover:underline"
              >
                Go to ride now
              </Link>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <span className="text-2xl text-red-400">&#10007;</span>
            </div>
            <p className="text-lg font-semibold text-white">
              Couldn&apos;t join
            </p>
            <p className="text-sm text-zinc-400">{errorMessage}</p>
            <div className="space-y-2 pt-2">
              <Link
                href="/rides"
                className="block w-full py-3 bg-[#FF6B2B] text-black font-bold rounded-lg hover:bg-[#FF8B5B] transition-colors"
              >
                Go to my rides
              </Link>
              <Link
                href="/"
                className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Back to home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
