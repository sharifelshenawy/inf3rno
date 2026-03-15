# Auth, Profiles & Group Rides Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user accounts with email code auth, rider profiles with bike specs, and collaborative group rides with a voting system to inf3rno.

**Architecture:** NextAuth v5 with email code credentials provider + Prisma ORM on Neon PostgreSQL. Existing guest ride planner moves to `/plan/guest` unchanged. New authenticated flows at `/plan`, `/rides/*`, `/profile/*`. Resend for transactional emails.

**Tech Stack:** Next.js 16.1.6, NextAuth v5, Prisma, PostgreSQL (Neon), Resend, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-15-auth-profiles-group-rides-design.md`

---

## Chunk 1: Foundation — Prisma, DB, Shared Types, Env

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Prisma, NextAuth, Resend, and adapter packages**

```bash
npm install next-auth@5 @auth/prisma-adapter @prisma/client resend
npm install -D prisma
```

- [ ] **Step 2: Init Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and `.env`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json prisma/ .env
git commit -m "chore: install prisma, next-auth, resend dependencies"
```

---

### Task 2: Write Prisma schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Write the full Prisma schema**

Copy the schema exactly from the design spec (`docs/superpowers/specs/2026-03-15-auth-profiles-group-rides-design.md`, lines 27-169). This includes:
- NextAuth models: `Account`, `Session`, `VerificationToken`
- App models: `User`, `Bike`, `Ride`, `RideMember`, `RideVote`, `RideLocation`
- Enums: `RideStatus`, `MemberRole`

The datasource and generator blocks should be:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Set up .env with placeholder**

Add to `.env`:
```
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
NEXTAUTH_SECRET="generate-a-secret-here"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY="re_placeholder"
```

Add `.env` to `.gitignore` if not already there.

- [ ] **Step 3: Create .env.example for reference**

```
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY=""
```

- [ ] **Step 4: Push schema to database**

```bash
npx prisma db push
```

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma .env.example .gitignore
git commit -m "feat: add prisma schema with auth and ride models"
```

---

### Task 3: Create Prisma client singleton and shared types

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create Prisma client singleton**

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: Create shared types file**

```typescript
// src/lib/types.ts
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Compute bike fuel range in km.
 * Uses manual override if set, otherwise calculates from tank + consumption.
 */
export function computeRangeKm(bike: {
  tankLitres: number;
  consumptionPer100km: number;
  isManualRange: boolean;
  manualRangeKm: number | null;
}): number {
  if (bike.isManualRange && bike.manualRangeKm !== null) {
    return bike.manualRangeKm;
  }
  return (bike.tankLitres / bike.consumptionPer100km) * 100;
}

/**
 * Generate Gravatar URL from email address.
 */
export async function gravatarUrl(email: string): Promise<string> {
  const trimmed = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(trimmed);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
}
```

Note: `crypto.subtle.digest("MD5")` is not supported in all environments. Fallback approach: use a simple hash or skip gravatar for MVP and use initials-based avatars instead. The implementing agent should check compatibility and use an alternative if needed (e.g., generate initials-based SVG data URIs).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat: add prisma client singleton and shared types"
```

---

### Task 4: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update rules to reflect new backend features**

Update the Rules section. Replace the "No database", "No backend", "No auth", "No API keys" rules with:

```markdown
## Rules
- Guest mode (`/plan/guest`) remains fully client-side. No database, no auth, no API keys for guest flows.
- Authenticated features (`/plan`, `/rides/*`, `/profile/*`) use PostgreSQL (Neon) + Prisma + NextAuth v5 + Resend.
- Do NOT add features not listed in the design spec. Log ideas to BACKLOG.md.
- Keep components small and focused. One file per component.
- Use TypeScript strictly — no `any` types.
- Nominatim rate limit: max 1 request per second. Add delays between batch geocoding calls.
- All curated data lives in `src/data/`. No hardcoded routes in components.
- API routes must validate `routeId` against loaded routes.json at request time.
- All `/api/rides/[id]/*` routes must verify the user is a ride member. Write ops check LEADER role.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md rules for authenticated features"
```

---

## Chunk 2: Auth — NextAuth, Email Codes, Login Page, Middleware

### Task 5: Create auth code utilities

**Files:**
- Create: `src/lib/auth-code.ts`

- [ ] **Step 1: Create auth code generation, hashing, and validation utilities**

```typescript
// src/lib/auth-code.ts
import crypto from "crypto";
import { prisma } from "./db";

const CODE_LENGTH = 8;
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// In-memory rate limiting (TODO: move to Redis for production)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

/**
 * Generate an 8-character uppercase code formatted as XXXX-XXXX.
 */
export function generateAuthCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Format code as XXXX-XXXX for display.
 */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normalize user input: strip dashes/spaces, uppercase.
 */
export function normalizeCode(input: string): string {
  return input.replace(/[-\s]/g, "").toUpperCase();
}

/**
 * SHA-256 hash a code string.
 */
export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Store a hashed auth code in the VerificationToken table.
 */
export async function storeAuthCode(email: string, code: string): Promise<void> {
  const hashed = hashCode(code);
  const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Delete any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashed,
      expires,
    },
  });
}

/**
 * Validate an auth code. Returns true if valid, false if not.
 * Deletes the token on success. Tracks failed attempts.
 */
export async function validateAuthCode(
  email: string,
  inputCode: string
): Promise<boolean> {
  // Check rate limit
  const attempts = failedAttempts.get(email);
  if (attempts) {
    if (Date.now() - attempts.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      failedAttempts.delete(email);
    } else if (attempts.count >= MAX_ATTEMPTS) {
      // Wipe all tokens for this email
      await prisma.verificationToken.deleteMany({
        where: { identifier: email },
      });
      return false;
    }
  }

  const normalized = normalizeCode(inputCode);
  const hashed = hashCode(normalized);

  const token = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: email,
        token: hashed,
      },
    },
  });

  if (!token || token.expires < new Date()) {
    // Track failed attempt
    const current = failedAttempts.get(email) || {
      count: 0,
      firstAttempt: Date.now(),
    };
    current.count++;
    failedAttempts.set(email, current);
    return false;
  }

  // Valid — delete token (one-time use)
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: email,
        token: hashed,
      },
    },
  });

  // Clear failed attempts
  failedAttempts.delete(email);
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth-code.ts
git commit -m "feat: add auth code generation, hashing, and validation"
```

---

### Task 6: Create email sending utility

**Files:**
- Create: `src/lib/email.ts`

- [ ] **Step 1: Create Resend email helper**

```typescript
// src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "inf3rno <noreply@yourdomain.com>";

export async function sendAuthCodeEmail(
  email: string,
  code: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your inf3rno sign-in code",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#0A0A0A;color:#fff;border-radius:12px;">
        <h1 style="font-size:20px;margin:0 0 8px;">
          <span style="color:#FF6B2B;">inf</span><span>3</span><span style="color:#FF6B2B;">rno</span>
        </h1>
        <p style="color:#999;font-size:14px;margin:0 0 24px;">Your sign-in code</p>
        <div style="background:#141414;border:1px solid #2A2A2A;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
          <span style="font-size:32px;font-weight:bold;letter-spacing:4px;color:#FF6B2B;">${code}</span>
        </div>
        <p style="color:#666;font-size:12px;margin:0;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendRideInviteEmail(
  email: string,
  rideTitle: string,
  inviterName: string,
  voteUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `You've been added to ${rideTitle}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#0A0A0A;color:#fff;border-radius:12px;">
        <h1 style="font-size:20px;margin:0 0 8px;">
          <span style="color:#FF6B2B;">inf</span><span>3</span><span style="color:#FF6B2B;">rno</span>
        </h1>
        <p style="color:#ccc;font-size:16px;margin:0 0 4px;">${inviterName} invited you to a ride</p>
        <h2 style="font-size:22px;color:#fff;margin:0 0 24px;">${rideTitle}</h2>
        <a href="${voteUrl}" style="display:block;background:#FF6B2B;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:bold;font-size:16px;">Vote on the ride</a>
        <p style="color:#666;font-size:12px;margin:24px 0 0;">Open this link to choose your preferred route and destination.</p>
      </div>
    `,
  });
}

export async function sendRideLockedEmail(
  email: string,
  rideTitle: string,
  routeName: string,
  meetingPointName: string,
  destinationName: string,
  scheduledAt: string | null,
  rideUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your ride is locked in — ${rideTitle}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#0A0A0A;color:#fff;border-radius:12px;">
        <h1 style="font-size:20px;margin:0 0 8px;">
          <span style="color:#FF6B2B;">inf</span><span>3</span><span style="color:#FF6B2B;">rno</span>
        </h1>
        <p style="color:#ccc;font-size:14px;margin:0 0 16px;">Ride locked in</p>
        <h2 style="font-size:22px;color:#fff;margin:0 0 16px;">${rideTitle}</h2>
        <div style="background:#141414;border:1px solid #2A2A2A;border-radius:8px;padding:16px;margin:0 0 16px;">
          <p style="color:#FF6B2B;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Route</p>
          <p style="color:#fff;font-size:16px;margin:0 0 12px;">${routeName}</p>
          <p style="color:#FF6B2B;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Meeting Point</p>
          <p style="color:#fff;font-size:16px;margin:0 0 12px;">${meetingPointName}</p>
          <p style="color:#FF6B2B;font-size:12px;text-transform:uppercase;margin:0 0 4px;">Destination</p>
          <p style="color:#fff;font-size:16px;margin:0;">${destinationName}</p>
          ${scheduledAt ? `<p style="color:#999;font-size:14px;margin:12px 0 0;">${scheduledAt}</p>` : ""}
        </div>
        <a href="${rideUrl}" style="display:block;background:#FF6B2B;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:bold;font-size:16px;">View ride plan</a>
      </div>
    `,
  });
}

export async function sendRideChangedEmail(
  email: string,
  rideTitle: string,
  leaderName: string,
  rideUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${leaderName} updated the ride plan`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#0A0A0A;color:#fff;border-radius:12px;">
        <h1 style="font-size:20px;margin:0 0 8px;">
          <span style="color:#FF6B2B;">inf</span><span>3</span><span style="color:#FF6B2B;">rno</span>
        </h1>
        <p style="color:#ccc;font-size:16px;margin:0 0 4px;">${leaderName} updated</p>
        <h2 style="font-size:22px;color:#fff;margin:0 0 24px;">${rideTitle}</h2>
        <a href="${rideUrl}" style="display:block;background:#FF6B2B;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:bold;font-size:16px;">View updated plan</a>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add resend email templates for auth and ride notifications"
```

---

### Task 7: Configure NextAuth

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth.config.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create edge-compatible auth config**

```typescript
// src/lib/auth.config.ts
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPaths = ["/plan", "/rides", "/profile", "/onboarding"];
      const isProtected = protectedPaths.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + "/")
      );

      // Allow public profile pages
      if (nextUrl.pathname.match(/^\/profile\/[^/]+$/)) return true;
      // Allow guest plan
      if (nextUrl.pathname.startsWith("/plan/guest")) return true;

      if (isProtected && !isLoggedIn) {
        return Response.redirect(
          new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl)
        );
      }

      // Redirect to onboarding if not completed
      if (
        isLoggedIn &&
        auth?.user &&
        !(auth.user as Record<string, unknown>).onboardingCompleted &&
        !nextUrl.pathname.startsWith("/onboarding") &&
        !nextUrl.pathname.startsWith("/api/")
      ) {
        return Response.redirect(new URL("/onboarding", nextUrl));
      }

      return true;
    },
  },
  providers: [], // Added in auth.ts (not edge-compatible)
};
```

- [ ] **Step 2: Create full auth config with Prisma adapter and credentials provider**

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";
import { authConfig } from "./auth.config";
import { validateAuthCode } from "./auth-code";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "email-code",
      name: "Email Code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const code = credentials?.code as string;
        if (!email || !code) return null;

        const valid = await validateAuthCode(email, code);
        if (!valid) return null;

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.lastRefreshed = Date.now();
      }

      // Refresh from DB every 5 minutes
      if (
        token.id &&
        (!token.lastRefreshed ||
          Date.now() - (token.lastRefreshed as number) > 5 * 60 * 1000)
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (dbUser) {
          token.email = dbUser.email;
          token.handle = dbUser.handle;
          token.displayName = dbUser.displayName;
          token.onboardingCompleted = dbUser.onboardingCompleted;
        }
        token.lastRefreshed = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as Record<string, unknown>).handle = token.handle;
        (session.user as Record<string, unknown>).displayName = token.displayName;
        (session.user as Record<string, unknown>).onboardingCompleted = token.onboardingCompleted;
      }
      return session;
    },
  },
});
```

- [ ] **Step 3: Create the NextAuth API route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create middleware**

```typescript
// src/middleware.ts (project root, not src/app/)
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.svg|manifest\\.webmanifest|api/auth).*)",
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.config.ts src/app/api/auth/[...nextauth]/route.ts src/middleware.ts
git commit -m "feat: configure nextauth with email code credentials provider"
```

---

### Task 8: Build login page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create the login page with email input and code entry**

Build a two-phase login page:
1. Phase 1: Email input → calls `POST /api/auth/send-code` → sends email
2. Phase 2: Code input → calls `signIn("email-code", { email, code })` via NextAuth

UI follows the existing dark theme: `bg-[#0A0A0A]`, `border-[#2A2A2A]`, `bg-[#141414]` cards, `#FF6B2B` accent.

The page should be a `"use client"` component with:
- `email` state, `code` state, `phase` state ("email" | "code"), `loading`, `error`
- Email phase: input + "Send code" button
- Code phase: input (placeholder "XXXX-XXXX") + "Verify" button + "Resend code" link
- After successful sign-in, redirect to `callbackUrl` from search params or `/`

- [ ] **Step 2: Create the send-code API route**

```typescript
// src/app/api/auth/send-code/route.ts
import { NextResponse } from "next/server";
import { generateAuthCode, formatCode, storeAuthCode } from "@/lib/auth-code";
import { sendAuthCodeEmail } from "@/lib/email";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const code = generateAuthCode();
  await storeAuthCode(email.toLowerCase().trim(), code);
  await sendAuthCodeEmail(email, formatCode(code));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/ src/app/api/auth/send-code/
git commit -m "feat: add login page with email code flow"
```

---

## Chunk 3: Onboarding, Profiles & Bike Specs

### Task 9: Create bike specs data file

**Files:**
- Create: `src/data/bikeSpecs.json`

- [ ] **Step 1: Create bike specs JSON with top Australian market bikes**

Create `src/data/bikeSpecs.json` with ~60 bikes covering common makes. Each entry:

```json
{
  "make": "Yamaha",
  "model": "MT-07",
  "tankLitres": 14.0,
  "consumptionPer100km": 4.5
}
```

Include popular bikes: Honda CB300R/CB500F/CB650R/CBR600RR/CBR1000RR/Africa Twin, Yamaha MT-03/MT-07/MT-09/R1/Tenere 700, Kawasaki Z400/Z650/Z900/Ninja 400/650/ZX-6R/ZX-10R, Suzuki SV650/GSX-R600/GSX-R1000/V-Strom 650/1050, BMW R1250GS/S1000RR/F900R, Ducati Monster/Panigale V4/Multistrada, KTM Duke 390/790/890/1290, Triumph Street Triple/Speed Triple/Tiger, Harley-Davidson Sportster/Street Bob/Road Glide, Royal Enfield Himalayan/Classic 350/Meteor, Husqvarna Svartpilen/Vitpilen.

Use conservative consumption estimates (hard riding = higher consumption).

- [ ] **Step 2: Commit**

```bash
git add src/data/bikeSpecs.json
git commit -m "feat: add bike specs database for common AU market bikes"
```

---

### Task 10: Build onboarding page

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/api/profile/route.ts`
- Create: `src/app/api/profile/bike/route.ts`

- [ ] **Step 1: Create the profile update API route**

```typescript
// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { geocodeSuburb } from "@/lib/geocode";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { handle, displayName, suburb } = body;

  // Validate handle if provided
  if (handle !== undefined) {
    if (!handle || !/^[a-zA-Z0-9_]{3,20}$/.test(handle)) {
      return NextResponse.json(
        { error: "Handle must be 3-20 alphanumeric characters or underscores" },
        { status: 400 }
      );
    }
    const existing = await prisma.user.findUnique({
      where: { handle: handle.toLowerCase() },
    });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
    }
  }

  // Geocode suburb if provided
  let suburbLat: number | undefined;
  let suburbLng: number | undefined;
  if (suburb) {
    const geo = await geocodeSuburb(suburb);
    if (geo) {
      suburbLat = geo.lat;
      suburbLng = geo.lng;
    }
  }

  const updateData: Record<string, unknown> = {};
  if (handle !== undefined) updateData.handle = handle.toLowerCase();
  if (displayName !== undefined) updateData.displayName = displayName;
  if (suburb !== undefined) {
    updateData.suburb = suburb;
    if (suburbLat !== undefined) updateData.suburbLat = suburbLat;
    if (suburbLng !== undefined) updateData.suburbLng = suburbLng;
  }

  // If handle and displayName are set, mark onboarding complete
  if (handle && displayName) {
    updateData.onboardingCompleted = true;
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json(user);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { bike: true },
  });

  return NextResponse.json(user);
}
```

- [ ] **Step 2: Create the bike update API route**

```typescript
// src/app/api/profile/bike/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { make, model, year, tankLitres, consumptionPer100km, isManualRange, manualRangeKm } = body;

  if (!make || !model || !tankLitres || !consumptionPer100km) {
    return NextResponse.json({ error: "Missing required bike fields" }, { status: 400 });
  }

  const bike = await prisma.bike.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      make,
      model,
      year: year || null,
      tankLitres,
      consumptionPer100km,
      isManualRange: isManualRange || false,
      manualRangeKm: manualRangeKm || null,
    },
    update: {
      make,
      model,
      year: year || null,
      tankLitres,
      consumptionPer100km,
      isManualRange: isManualRange || false,
      manualRangeKm: manualRangeKm || null,
    },
  });

  return NextResponse.json(bike);
}
```

- [ ] **Step 3: Create the onboarding page**

Build a multi-step onboarding page:
1. Step 1: Handle + display name (required)
2. Step 2: Home suburb (optional, with geocode preview)
3. Step 3: Bike selection (optional — searchable dropdown from bikeSpecs.json with manual override)
4. "Skip" button on optional steps, "Done" completes onboarding

Same dark theme styling. On completion, redirect to `/`.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding/ src/app/api/profile/
git commit -m "feat: add onboarding page with profile and bike setup"
```

---

### Task 11: Build profile pages

**Files:**
- Create: `src/app/profile/page.tsx`
- Create: `src/app/profile/[handle]/page.tsx`
- Create: `src/app/api/users/search/route.ts`
- Create: `src/app/api/users/[handle]/route.ts`

- [ ] **Step 1: Create user search API route**

```typescript
// src/app/api/users/search/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      handle: { startsWith: q.toLowerCase(), not: null },
      onboardingCompleted: true,
      id: { not: session.user.id },
    },
    select: { id: true, handle: true, displayName: true, profilePicUrl: true },
    take: 10,
  });

  return NextResponse.json(users);
}
```

- [ ] **Step 2: Create public profile API route**

```typescript
// src/app/api/users/[handle]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeRangeKm } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const user = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      handle: true,
      displayName: true,
      profilePicUrl: true,
      suburb: true,
      bike: {
        select: {
          make: true,
          model: true,
          year: true,
          tankLitres: true,
          consumptionPer100km: true,
          isManualRange: true,
          manualRangeKm: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rangeKm = user.bike ? computeRangeKm(user.bike) : null;

  return NextResponse.json({ ...user, rangeKm });
}
```

- [ ] **Step 3: Build the own-profile edit page (`/profile`)**

`"use client"` page that loads current user data from `GET /api/profile` and allows editing handle, display name, suburb, bike. Same form components as onboarding but pre-filled. Save via `PUT /api/profile` and `PUT /api/profile/bike`.

- [ ] **Step 4: Build the public profile page (`/profile/[handle]`)**

Server component that fetches from `GET /api/users/[handle]` and displays: display name, handle, suburb, bike make/model/year, fuel range. Dark theme card layout.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile/ src/app/api/users/
git commit -m "feat: add profile pages and user search API"
```

---

## Chunk 4: Landing Page & Navigation Refactor

### Task 12: Restructure routes — move guest planner

**Files:**
- Create: `src/app/plan/guest/page.tsx`
- Create: `src/app/plan/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Move existing planner to `/plan/guest`**

Copy the entire content of current `src/app/page.tsx` (the `HomeContent` component with Suspense wrapper) to `src/app/plan/guest/page.tsx`. This is an exact copy — no changes to the planner logic.

- [ ] **Step 2: Create authenticated planner at `/plan`**

Create `src/app/plan/page.tsx` — same as guest but:
- Fetches user profile on mount (`GET /api/profile`)
- If user has a suburb, auto-adds it as the first rider location
- If user has a bike, passes fuel range to the RouteResult component for range warnings
- Otherwise identical to guest flow

- [ ] **Step 3: Rewrite landing page at `/`**

Replace `src/app/page.tsx` with the three-card landing page:

```tsx
// Three cards: Solo Ride (→ /plan), Group Ride (→ /rides/new), Quick Ride (→ /plan/guest)
```

Each card follows the existing dark theme card style. Solo Ride and Group Ride cards check auth — if not logged in, redirect to `/login?callbackUrl=...`.

- [ ] **Step 4: Update layout.tsx header with auth-aware navigation**

Modify `src/app/layout.tsx`:
- Import `auth` from `@/lib/auth`
- If session exists: show avatar + handle dropdown (My Rides, Profile, Log out)
- If no session: show "Log in" button
- Keep the existing `inf3rno` logo/wordmark

The header should be a server component that reads the session. The dropdown menu can be a small client component for toggle state.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/plan/ src/app/layout.tsx
git commit -m "feat: restructure routes with landing page and auth-aware header"
```

---

## Chunk 5: Ride CRUD & Member Management

### Task 13: Create ride API routes

**Files:**
- Create: `src/app/api/rides/route.ts`
- Create: `src/app/api/rides/[id]/route.ts`
- Create: `src/app/api/rides/[id]/members/route.ts`
- Create: `src/app/api/rides/[id]/members/[userId]/route.ts`
- Create: `src/app/api/rides/join/[code]/route.ts`
- Create: `src/lib/ride-helpers.ts`

- [ ] **Step 1: Create ride helper utilities**

```typescript
// src/lib/ride-helpers.ts
import crypto from "crypto";
import { prisma } from "./db";
import routesData from "@/data/routes.json";
import type { Route } from "./routeMatcher";

export function generateInviteCode(): string {
  return crypto.randomBytes(6).toString("hex");
}

export function findRouteById(routeId: string): Route | undefined {
  return (routesData as Route[]).find((r) => r.id === routeId);
}

export async function isRideMember(rideId: string, userId: string): Promise<boolean> {
  const member = await prisma.rideMember.findUnique({
    where: { rideId_userId: { rideId, userId } },
  });
  return !!member;
}

export async function isRideLeader(rideId: string, userId: string): Promise<boolean> {
  const member = await prisma.rideMember.findUnique({
    where: { rideId_userId: { rideId, userId } },
  });
  return member?.role === "LEADER";
}
```

- [ ] **Step 2: Create ride CRUD routes**

`POST /api/rides` — Create ride. Generates invite code, creates ride + leader member.
`GET /api/rides` — List rides where user is a member.
`GET /api/rides/[id]` — Ride detail with members and votes. Validates membership.
`PUT /api/rides/[id]` — Update ride (title, date, status, overrides). Leader only. Enforces status transition rules from spec.
`DELETE /api/rides/[id]` — Sets status to CANCELLED. Leader only.

- [ ] **Step 3: Create member management routes**

`POST /api/rides/[id]/members` — Add member by handle. Leader only. Sends invite email.
`DELETE /api/rides/[id]/members/[userId]` — Remove member. Leader can remove any rider. Riders can remove themselves. Leader cannot be removed.

- [ ] **Step 4: Create join-by-invite route**

`POST /api/rides/join/[code]` — Find ride by invite code, add authenticated user as RIDER member. Rate limited to 5 req/15min/IP.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ride-helpers.ts src/app/api/rides/
git commit -m "feat: add ride CRUD and member management API routes"
```

---

### Task 14: Build ride pages

**Files:**
- Create: `src/app/rides/page.tsx`
- Create: `src/app/rides/new/page.tsx`
- Create: `src/app/rides/[id]/page.tsx`
- Create: `src/app/rides/[id]/vote/page.tsx`
- Create: `src/app/rides/join/[code]/page.tsx`
- Create: `src/components/HandleSearch.tsx`
- Create: `src/components/RideCard.tsx`

- [ ] **Step 1: Create HandleSearch component**

Autocomplete input that searches `GET /api/users/search?q=` with debounce (300ms). Shows matching users as a dropdown. On select, fires `onSelect(user)` callback. Minimum 2 characters to search.

- [ ] **Step 2: Create RideCard component**

Card showing ride title, status badge, date (if set), member count, route name (if chosen). Used in the rides list. Tap navigates to `/rides/[id]`.

- [ ] **Step 3: Build rides list page (`/rides`)**

Fetches `GET /api/rides`, renders as a list of RideCards grouped by status (active rides first, completed/cancelled at bottom). "New Group Ride" button at top.

- [ ] **Step 4: Build create ride page (`/rides/new`)**

Form with:
- Title input
- Optional date/time picker
- HandleSearch to add members (shows added members as removable chips)
- Vibe picker (reuse existing VibePicker component)
- "Create Ride" button → `POST /api/rides` + adds members + transitions to VOTING
- Shows shareable invite link after creation

- [ ] **Step 5: Build ride detail page (`/rides/[id]`)**

Conditional rendering based on ride status:
- **DRAFT:** Show setup form (add members, set vibe)
- **VOTING:** Show vote counts, member status (voted/not voted), "Lock Ride" button (leader only)
- **LOCKED:** Show final plan — reuse RouteResult component with meeting point, map, nav links, POIs
- **COMPLETED/CANCELLED:** Show final plan (read-only)

Leader sees override controls on VOTING/LOCKED.

- [ ] **Step 6: Build vote page (`/rides/[id]/vote`)**

Shows filtered routes (from ride's vibe + difficulty). Reuses RouteSelector with gallery. On route selection, shows destination picker. Submit → `POST /api/rides/[id]/vote`. Shows current vote if already voted (can update).

- [ ] **Step 7: Build join page (`/rides/join/[code]`)**

On mount, calls `POST /api/rides/join/[code]`. On success, redirects to `/rides/[id]/vote`. On error (already member, ride cancelled, etc.), shows appropriate message.

- [ ] **Step 8: Commit**

```bash
git add src/app/rides/ src/components/HandleSearch.tsx src/components/RideCard.tsx
git commit -m "feat: add ride pages — list, create, detail, vote, join"
```

---

## Chunk 6: Voting, Results & Notifications

### Task 15: Create vote and results API routes

**Files:**
- Create: `src/app/api/rides/[id]/vote/route.ts`
- Create: `src/app/api/rides/[id]/results/route.ts`
- Create: `src/lib/vote-tally.ts`

- [ ] **Step 1: Create vote tallying logic**

```typescript
// src/lib/vote-tally.ts
import type { RideVote } from "@prisma/client";
import { filterRoutes } from "./routeMatcher";
import type { Route, Vibe, Difficulty } from "./routeMatcher";
import { findOptimalMeetingPoint } from "./midpoint";
import type { ScoredMeetingPoint } from "./midpoint";
import { findRouteById } from "./ride-helpers";
import meetingPointsData from "@/data/meetingPoints.json";
import type { MeetingPoint } from "./midpoint";

interface TallyResult {
  winningRouteId: string;
  winningRoute: Route | null;
  winningDestination: string | null;
  routeVoteCounts: Record<string, number>;
  destinationVoteCounts: Record<string, number>;
  meetingPoint: ScoredMeetingPoint | null;
  totalVotes: number;
}

export function tallyVotes(
  votes: RideVote[],
  vibe: string | null,
  difficulty: string | null,
  creatorId: string,
  memberLocations: { lat: number; lng: number; displayName: string }[]
): TallyResult {
  if (votes.length === 0) {
    return {
      winningRouteId: "",
      winningRoute: null,
      winningDestination: null,
      routeVoteCounts: {},
      destinationVoteCounts: {},
      meetingPoint: null,
      totalVotes: 0,
    };
  }

  // Count route votes
  const routeCounts: Record<string, number> = {};
  for (const vote of votes) {
    routeCounts[vote.routeId] = (routeCounts[vote.routeId] || 0) + 1;
  }

  // Find winning route — highest votes, break ties with filterRoutes score, then creator vote
  const maxVotes = Math.max(...Object.values(routeCounts));
  const tiedRouteIds = Object.entries(routeCounts)
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);

  let winningRouteId: string;
  if (tiedRouteIds.length === 1) {
    winningRouteId = tiedRouteIds[0];
  } else {
    // Break tie with filterRoutes score
    const scored = filterRoutes(
      (vibe as Vibe) || "mix",
      (difficulty as Difficulty) || "any"
    );
    const scoredIds = scored.map((r) => r.id);
    const bestByScore = tiedRouteIds.sort(
      (a, b) => scoredIds.indexOf(a) - scoredIds.indexOf(b)
    );

    // If still tied, use creator's vote
    const creatorVote = votes.find((v) => v.userId === creatorId);
    if (creatorVote && tiedRouteIds.includes(creatorVote.routeId)) {
      winningRouteId = creatorVote.routeId;
    } else {
      winningRouteId = bestByScore[0];
    }
  }

  const winningRoute = findRouteById(winningRouteId) || null;

  // Count destination votes for the winning route
  const destCounts: Record<string, number> = {};
  const winningRouteVotes = votes.filter((v) => v.routeId === winningRouteId);
  for (const vote of winningRouteVotes) {
    if (vote.destinationName) {
      destCounts[vote.destinationName] =
        (destCounts[vote.destinationName] || 0) + 1;
    }
  }

  // Pick winning destination
  let winningDestination: string | null = null;
  if (Object.keys(destCounts).length > 0) {
    const maxDestVotes = Math.max(...Object.values(destCounts));
    const tiedDests = Object.entries(destCounts)
      .filter(([, count]) => count === maxDestVotes)
      .map(([name]) => name);
    winningDestination = tiedDests[0]; // First alphabetically for ties
  }

  // Calculate meeting point filtered to winning route's meetingPointIds
  let meetingPoint: ScoredMeetingPoint | null = null;
  if (winningRoute && memberLocations.length > 0) {
    const routeStart = {
      lat: winningRoute.waypoints[0].lat,
      lng: winningRoute.waypoints[0].lng,
    };

    // Filter meeting points to those in the route's meetingPointIds
    const allMeetingPoints = meetingPointsData as MeetingPoint[];
    const routeMeetingPoints = allMeetingPoints.filter((mp) =>
      winningRoute.meetingPointIds.includes(mp.id)
    );

    // If no route-specific meeting points, fall back to all
    const candidates =
      routeMeetingPoints.length > 0 ? routeMeetingPoints : allMeetingPoints;

    meetingPoint = findOptimalMeetingPoint(
      memberLocations,
      routeStart,
      0.4,
      candidates
    );
  }

  return {
    winningRouteId,
    winningRoute,
    winningDestination,
    routeVoteCounts: routeCounts,
    destinationVoteCounts: destCounts,
    meetingPoint,
    totalVotes: votes.length,
  };
}
```

Note: This requires updating `findOptimalMeetingPoint` in `src/lib/midpoint.ts` to accept an optional `candidates` parameter instead of always using the full meetingPointsData. Add an optional 4th parameter:

```typescript
export function findOptimalMeetingPoint(
  riders: { lat: number; lng: number; displayName: string }[],
  routeStart: LatLng,
  detourWeight: number = 0.4,
  candidates?: MeetingPoint[]  // NEW — defaults to meetingPointsData
): ScoredMeetingPoint {
  const points = candidates || (meetingPointsData as MeetingPoint[]);
  // ... rest unchanged, just use `points` instead of `candidates`
}
```

- [ ] **Step 2: Create vote API route**

```typescript
// src/app/api/rides/[id]/vote/route.ts
```

`POST` — Upserts a vote for the authenticated user on the ride. Validates: user is a member, ride status is VOTING, routeId exists in routes.json, destinationName exists in the route's destinations.

- [ ] **Step 3: Create results API route**

```typescript
// src/app/api/rides/[id]/results/route.ts
```

`GET` — Fetches all votes for the ride, runs `tallyVotes()`, returns the winning route, destination, meeting point, and vote counts. Used by the ride detail page.

- [ ] **Step 4: Commit**

```bash
git add src/lib/vote-tally.ts src/app/api/rides/[id]/vote/ src/app/api/rides/[id]/results/ src/lib/midpoint.ts
git commit -m "feat: add voting system with tallying and results API"
```

---

### Task 16: Wire up ride locking and email notifications

**Files:**
- Modify: `src/app/api/rides/[id]/route.ts`

- [ ] **Step 1: Add locking logic to ride update route**

When `PUT /api/rides/[id]` receives `status: "LOCKED"`:

1. Validate at least 1 vote exists
2. Run `tallyVotes()` to get winning route, destination, meeting point
3. Update ride with `routeId`, `destinationName`, `meetingPointId`
4. Send `sendRideLockedEmail()` to all members with the plan details
5. Return updated ride

When `PUT /api/rides/[id]` receives override fields (routeId, destinationName) while VOTING or LOCKED:

1. Validate routeId exists in routes.json
2. Update ride fields
3. Recalculate meeting point
4. Send `sendRideChangedEmail()` to all members

- [ ] **Step 2: Commit**

```bash
git add src/app/api/rides/[id]/route.ts
git commit -m "feat: add ride locking with vote tallying and email notifications"
```

---

### Task 17: Final integration and build verification

**Files:**
- Various

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 3: Manual smoke test**

1. Start dev server: `npm run dev`
2. Visit `/` — see three cards (Solo Ride, Group Ride, Quick Ride)
3. Click "Quick Ride" → existing planner works at `/plan/guest`
4. Click "Log in" → enter email → receive code → enter code → logged in
5. Complete onboarding → set handle, name, suburb, bike
6. Visit `/profile` → see and edit profile
7. Create a group ride → add members by handle → set vibe → start voting
8. Vote on a route → see results → lock ride → check email

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from smoke testing"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push origin master
```
