"use client";

import { Suspense, useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

type Phase = "email" | "code";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-zinc-500">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  const sendCode = useCallback(
    async (targetEmail: string) => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Failed to send code");
          return false;
        }

        return true;
      } catch {
        setError("Network error. Please try again.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address");
      return;
    }

    trackEvent("login_started");
    const success = await sendCode(trimmed);
    if (success) {
      setEmail(trimmed);
      setPhase("code");
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter the code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("email-code", {
        email,
        code: code.trim(),
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid or expired code. Please try again.");
      } else {
        trackEvent("login_completed");
        router.push(callbackUrl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown) return;
    setResendCooldown(true);
    await sendCode(email);
    setTimeout(() => setResendCooldown(false), 30000);
  };

  const handleBackToEmail = () => {
    setPhase("email");
    setCode("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-wider text-[#FF6B2B]">
            inf3rno
          </h1>
          <p className="mt-2 text-sm text-[#999999]">
            Sign in to plan your next ride
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6">
          {phase === "email" ? (
            <form onSubmit={handleEmailSubmit}>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#999999] mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="rider@example.com"
                autoComplete="email"
                autoFocus
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-base focus:outline-none focus:border-[#FF6B2B] transition-colors"
              />

              {error && (
                <p className="mt-3 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Sending..." : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit}>
              <button
                type="button"
                onClick={handleBackToEmail}
                className="mb-4 text-sm text-[#999999] hover:text-white transition-colors"
              >
                &larr; Change email
              </button>

              <p className="text-sm text-[#999999] mb-1">
                Code sent to
              </p>
              <p className="text-white font-medium mb-4 truncate">{email}</p>

              <label
                htmlFor="code"
                className="block text-sm font-medium text-[#999999] mb-2"
              >
                Enter code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                autoFocus
                maxLength={9}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-white placeholder-[#555555] text-center text-xl font-mono tracking-widest focus:outline-none focus:border-[#FF6B2B] transition-colors"
              />

              {error && (
                <p className="mt-3 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full py-3.5 bg-[#FF6B2B] text-black font-bold text-base rounded-lg hover:bg-[#FF8B5B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown || loading}
                  className="text-sm text-[#FF6B2B] hover:text-[#FF8B5B] disabled:text-[#555555] disabled:cursor-not-allowed transition-colors"
                >
                  {resendCooldown ? "Code sent — wait 30s" : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
