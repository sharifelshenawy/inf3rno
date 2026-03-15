# inf3rno — Auth, Profiles & Group Rides Design Spec

## Overview

Add user accounts, rider profiles, and collaborative group rides with a voting system to inf3rno. The existing solo ride planner stays fully functional without login (guest mode).

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router) with React 19
- **Auth:** Auth.js / NextAuth v5 (`next-auth@5`) with Prisma adapter + email code credentials provider (XXXX-XXXX format). Confirmed compatible with Next.js 16 via the `@auth/prisma-adapter` package.
- **Database:** PostgreSQL on Neon + Prisma ORM
- **Email:** Resend API (personal account)
- **Pattern source:** in10se_support project (SHA-256 hashed codes, rate limiting)

## Home Screen

Three entry points on the landing page at `/`:

1. **Solo Ride** — requires login. Launches the same planner flow but pre-fills start location from profile suburb and shows fuel range warnings from bike specs. Lives at `/plan` (authenticated).
2. **Group Ride** — requires login. Creates a collaborative ride with invites and voting. Goes to `/rides/new`.
3. **Quick Ride (Guest)** — no login. Existing planner flow at `/plan/guest`, zero friction, no changes to current code. The current `page.tsx` multi-step flow moves here.

## Data Model

### Prisma Schema

```prisma
// NextAuth required models (Prisma adapter expects all three even with JWT strategy)
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String   // email address
  token      String   // SHA-256 hashed code
  expires    DateTime
  @@unique([identifier, token])
}

// Application models
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  handle        String?  @unique  // null until onboarding complete
  displayName   String?
  suburb        String?
  suburbLat     Float?
  suburbLng     Float?
  profilePicUrl String?           // Gravatar URL derived from email hash (MVP)
  onboardingCompleted Boolean @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  accounts      Account[]
  sessions      Session[]
  bike          Bike?
  ridesCreated  Ride[]      @relation("RideCreator")
  rideMembers   RideMember[]
  rideVotes     RideVote[]
}

model Bike {
  id                   String  @id @default(cuid())
  userId               String  @unique
  make                 String
  model                String
  year                 Int?
  tankLitres           Float
  consumptionPer100km  Float
  isManualRange        Boolean @default(false)
  manualRangeKm        Float?  // only used when isManualRange is true
  user                 User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Ride {
  id             String     @id @default(cuid())
  creatorId      String
  title          String
  status         RideStatus @default(DRAFT)
  scheduledAt    DateTime?
  routeId        String?    // reference to curated routes.json id
  destinationName String?   // stable destination name (not array index)
  meetingPointId String?    // reference to curated meetingPoints.json id
  vibe           String?
  difficulty     String?
  inviteCode     String     @unique // 12-char hex string via crypto.randomBytes
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  creator        User         @relation("RideCreator", fields: [creatorId], references: [id])
  members        RideMember[]
  votes          RideVote[]
}

model RideMember {
  id          String     @id @default(cuid())
  rideId      String
  userId      String
  role        MemberRole @default(RIDER)
  startLat    Float?
  startLng    Float?
  startSuburb String?
  joinedAt    DateTime   @default(now())

  ride        Ride       @relation(fields: [rideId], references: [id], onDelete: Cascade)
  user        User       @relation(fields: [userId], references: [id])
  @@unique([rideId, userId])
}

model RideVote {
  id              String   @id @default(cuid())
  rideId          String
  userId          String
  routeId         String   // curated route id — validated against routes.json at request time
  destinationName String?  // stable destination name within route
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  ride            Ride     @relation(fields: [rideId], references: [id], onDelete: Cascade)
  user            User     @relation(fields: [userId], references: [id])
  @@unique([rideId, userId])
}

// Future — schema only, not implemented
model RideLocation {
  id        String   @id @default(cuid())
  rideId    String
  userId    String
  lat       Float
  lng       Float
  timestamp DateTime @default(now())
  expiresAt DateTime
  @@index([rideId, userId, timestamp])
}

enum RideStatus {
  DRAFT
  VOTING
  LOCKED
  COMPLETED
  CANCELLED
}

enum MemberRole {
  LEADER
  RIDER
}
```

### Key Design Decisions

- **Routes stay in curated JSON** (not DB). `routeId` is a string reference like `"reefton-spur"`. API routes validate `routeId` against loaded JSON at request time. If a curated route is removed, UI shows "Route no longer available" rather than crashing.
- **Destination stored by name, not array index.** `destinationName` (e.g., "Apollo Bay Bakery") is stable even if the destinations array is reordered. Matched by name at render time.
- **`rangeKm` computed on the fly**, not stored. Calculated as `(tankLitres / consumptionPer100km) * 100` unless `isManualRange` is true, in which case `manualRangeKm` is used. This avoids stale derived data.
- **Invite codes:** 12-character alphanumeric string generated via `crypto.randomBytes(6).toString('hex')` — produces 12 hex characters (a-f, 0-9), purely alphanumeric and URL-safe. Unguessable.
- **One vote per rider per ride** (upsert on `[rideId, userId]`). Updatable until LOCKED.
- **Meeting point for group rides:** Calculated using minimax algorithm, filtered to the winning route's `meetingPointIds` (not all meeting points globally). Uses all members' start locations + winning route's start waypoint.
- **Profile pictures (MVP):** Gravatar URLs derived from email MD5 hash. No upload endpoint needed. Custom uploads deferred to a future iteration.

### Privacy (RideLocation — future)

- Opt-in per ride (never default on)
- Rider-controlled kill switch (instant stop sharing)
- Auto-stop on timer expiry, ride end, or leaving route corridor
- Location fuzzing near ride start/end to avoid exposing home addresses
- Risk scenario: rider heads home after ride, group still tracking — must prevent this

## Authentication Flow

Following in10se_support pattern (most secure version):

1. User enters email at `/login`
2. Server generates 8 random uppercase letters, formats as XXXX-XXXX
3. Code is SHA-256 hashed before storing in `VerificationToken` table (10 min expiry)
4. Plain code sent via Resend with inf3rno branding
5. User enters code → server hashes input, compares against stored hash
6. Match → NextAuth creates JWT session, deletes token
7. No match → increment fail counter (5 attempts per 15 min, then all tokens for that email wiped)

**First-time users:** After first auth, check `onboardingCompleted`. If false, redirect to `/onboarding`.

**Onboarding fields:**
- Required: handle, display name
- Optional: suburb (with geocode), bike selection
- User can skip optional fields and add them later via `/profile`

**Handle validation:** Unique, 3-20 characters, alphanumeric + underscores only.

**JWT strategy:** JWT stored in HTTP-only cookie. Contains: `id`, `email`, `handle`, `displayName`, `onboardingCompleted`. Refreshed from DB via custom `jwt` callback with a `lastRefreshed` timestamp — if `Date.now() - lastRefreshed > 5 * 60 * 1000`, re-fetch user from Prisma and update token fields.

**Route protection middleware:** Protects `/plan` (authenticated solo), `/rides/*`, `/profile/*`, `/api/rides/*`, `/api/profile/*`. Public pages: `/`, `/plan/guest`, `/login`, `/profile/[handle]`, `/api/auth/*`.

## Collaborative Ride Flow

### Creating a ride

1. Logged-in user hits "Group Ride" → `/rides/new`
2. Enters title, optional date/time
3. Ride created with status `DRAFT`, creator is `LEADER`
4. Creator's home suburb auto-fills as their start location
5. Creator adds riders by handle search (autocomplete, min 2 chars) → they become `RideMember` with role `RIDER`
6. Creator also gets a shareable invite link: `/rides/join/[inviteCode]`
7. Creator picks a vibe + difficulty to narrow the route pool
8. Creator transitions ride to `VOTING`

### Voting phase

1. All members receive Resend email: "You've been invited to [title] — tap to vote"
2. Link-joined riders also land on the voting page
3. Each rider sees filtered route list (same RouteSelector UI with gallery) and votes on:
   - **Route** — which route they want to ride
   - **Destination** — which destination on that route (by name)
4. Riders can update their vote until the ride is LOCKED

### Vote tallying

- Routes scored by vote count. Highest wins.
- Destinations scored by vote count within the winning route.
- **Ties:** System picks the route with the higher vibe/difficulty match score from `filterRoutes()`. If still tied, creator's vote is the tiebreaker.
- **Meeting point:** Recalculated using minimax algorithm with all members' start locations + winning route's start waypoint. Filtered to winning route's `meetingPointIds`.

### Locking the ride

1. Creator hits "Lock Ride" → status becomes `LOCKED`
2. Final plan calculated: winning route, best meeting point, winning destination
3. All members notified via email: "Your ride is locked in — here's the plan"
4. Email includes full plan + deep links to Google Maps / Waze / Apple Maps

### Creator overrides

- While in `VOTING` or `LOCKED`, leader can override any choice (route, destination)
- Override recalculates meeting point automatically
- Members notified of changes

### Ride lifecycle & status transitions

| From | To | Who | Condition |
|------|----|-----|-----------|
| DRAFT | VOTING | LEADER | At least 2 members, vibe + difficulty set |
| VOTING | LOCKED | LEADER | At least 1 vote submitted |
| LOCKED | COMPLETED | LEADER | Manual — ride is done |
| DRAFT/VOTING/LOCKED | CANCELLED | LEADER | Any time |

No backwards transitions (LOCKED cannot go back to VOTING). Leader must cancel and create a new ride if major changes needed after lock.

### Member authorization rules

- LEADER can remove any RIDER
- Any member can remove themselves (leave the ride)
- LEADER cannot be removed — ride must be cancelled instead
- Only LEADER can change ride status, override choices

## Pages

| Path | Auth | Purpose |
|------|------|---------|
| `/` | No | Landing page — Solo Ride, Group Ride, Quick Ride (Guest) |
| `/login` | No | Email input + code entry |
| `/onboarding` | Yes | First-time setup: handle, name, suburb, bike |
| `/plan` | Yes | Solo ride planner with profile pre-fill |
| `/plan/guest` | No | Guest ride planner (existing flow, moved here) |
| `/profile` | Yes | View/edit own profile + bike |
| `/profile/[handle]` | No | Public profile (name, bike, fuel range) |
| `/rides` | Yes | List of rides (created + joined) |
| `/rides/new` | Yes | Create a new group ride |
| `/rides/[id]` | Yes | Ride detail (voting, results, locked plan) |
| `/rides/[id]/vote` | Yes | Voting page for members |
| `/rides/join/[code]` | Yes | Invite link → join ride + redirect |

## API Routes

| Method | Path | Auth | Purpose | Rate Limit |
|--------|------|------|---------|------------|
| `*` | `/api/auth/[...nextauth]` | No | NextAuth handlers | NextAuth built-in |
| `GET` | `/api/users/search?q=` | Yes | Search users by handle (min 2 chars) | 10 req/min/session |
| `GET` | `/api/users/[handle]` | No | Public profile | — |
| `PUT` | `/api/profile` | Yes | Update own profile | — |
| `PUT` | `/api/profile/bike` | Yes | Update bike details | — |
| `POST` | `/api/rides` | Yes | Create ride | — |
| `GET` | `/api/rides` | Yes | List my rides | — |
| `GET` | `/api/rides/[id]` | Yes | Ride detail + members + votes | — |
| `PUT` | `/api/rides/[id]` | Yes | Update ride (leader only) | — |
| `DELETE` | `/api/rides/[id]` | Yes | Cancel ride (leader only) | — |
| `POST` | `/api/rides/[id]/members` | Yes | Add member by handle (leader only) | — |
| `DELETE` | `/api/rides/[id]/members/[userId]` | Yes | Remove member (see auth rules) | — |
| `POST` | `/api/rides/[id]/vote` | Yes | Submit/update vote (member only) | — |
| `GET` | `/api/rides/[id]/results` | Yes | Tallied results + meeting point | — |
| `POST` | `/api/rides/join/[code]` | Yes | Join via invite code | 5 req/15min/IP |

All `/api/rides/[id]/*` routes validate that the authenticated user is a member of the ride. Write operations check LEADER role where specified.

All routes accepting `routeId` validate it exists in the loaded `routes.json` at request time.

## Email Notifications (Resend)

| Trigger | Subject | Content |
|---------|---------|---------|
| Auth code | "Your inf3rno sign-in code" | XXXX-XXXX code, 10 min expiry |
| Ride invite | "You've been added to [title]" | Ride details + link to vote |
| Ride locked | "Your ride is locked in" | Full plan, route, meeting point, nav links |
| Ride changed | "[leader] updated the ride plan" | Updated details |

Voting reminder email deferred from MVP — requires a cron/job queue mechanism (Vercel Cron or similar). Logged in BACKLOG.md.

## Header / Navigation

**Logged out:**
```
[inf3rno logo]                    [Log in]
```

**Logged in:**
```
[inf3rno logo]                    [avatar + handle ▾]
                                    → My Rides
                                    → Profile
                                    → Log out
```

## Bike Specs Database

Searchable dropdown of ~50-100 common Australian market bikes with pre-loaded:
- Make, model
- Tank capacity (litres)
- Conservative fuel consumption (L/100km)

Stored as a static JSON file (`src/data/bikeSpecs.json`), not in the database. The user's selected/overridden values are saved to the `Bike` table. Range is always computed on the fly: `(tankLitres / consumptionPer100km) * 100`, unless `isManualRange` is true.

## Shared Types Strategy

Prisma generates DB types. A `src/lib/types.ts` file holds shared domain types (e.g., `LatLng`) used across components and lib files, replacing the current per-file duplicates. Component props remain co-located with their components.

## CLAUDE.md Updates Required

The current CLAUDE.md rules ("No backend", "No auth", "No database", "No API keys") must be updated upon implementation to carve out the new authenticated features while preserving the guest-mode philosophy. The guest planner remains client-side only.

## What Stays Unchanged

- Guest ride planner flow (riders → vibe → route → result) — moves to `/plan/guest` but code is untouched
- All curated route/meeting point/POI data stays in JSON files
- Valhalla routing, Wikimedia images, Leaflet map — all unchanged
- No backend needed for guest mode
