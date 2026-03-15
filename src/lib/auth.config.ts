import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Edge-compatible auth config used by middleware.
 * Does NOT import Prisma or any Node.js-only modules.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;

      // --- Public paths: always allowed ---
      if (
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/plan/guest" ||
        pathname.startsWith("/api/auth") ||
        // Public profile pages: /profile/[handle]
        (pathname.startsWith("/profile/") && pathname !== "/profile")
      ) {
        return true;
      }

      // --- Protected paths ---
      const protectedPrefixes = [
        "/plan",
        "/rides",
        "/profile",
        "/onboarding",
        "/api/rides",
        "/api/profile",
      ];

      const isProtected = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
      );

      // Exclude /plan/guest from protection (already handled above)
      if (!isProtected) {
        return true;
      }

      const isLoggedIn = !!auth?.user;

      if (!isLoggedIn) {
        // Redirect to login with callback URL
        const loginUrl = new URL("/login", request.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }

      // If logged in but onboarding not completed, redirect to /onboarding
      // (skip if already on /onboarding or /api/ routes)
      const user = auth.user as { onboardingCompleted?: boolean };
      if (
        user.onboardingCompleted === false &&
        !pathname.startsWith("/onboarding") &&
        !pathname.startsWith("/api/")
      ) {
        return NextResponse.redirect(
          new URL("/onboarding", request.nextUrl.origin)
        );
      }

      return true;
    },
  },
  providers: [], // Providers are defined in the full auth.ts config
} satisfies NextAuthConfig;
