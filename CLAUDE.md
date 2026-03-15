# inf3rno — Motorcycle Ride Planner PWA

## What is this?
A PWA that solves the #1 pain point for group motorcycle rides: planning a fair meeting point, choosing a route that matches the group's vibe, and having a destination worth riding to. Supports both solo planning (no account needed) and collaborative group rides with voting.

## Core Philosophy
- **Ship fast, validate later.** Blitz MVP — functional over perfect.
- **Mobile-first.** This is used by riders on phones. PWA with Add to Home Screen.
- **Guest mode stays zero-friction.** The guest ride planner (`/plan/guest`) requires no login, no API keys, no backend.
- **Authenticated features are opt-in.** Login only needed for profiles, group rides, and enhanced solo rides.

## Tech Stack
- **Next.js 16** (App Router) with React 19
- **TypeScript**
- **Tailwind CSS**
- **Leaflet** (map display via react-leaflet)
- **Nominatim API** (free geocoding, no key needed, 1 req/sec rate limit)
- **Valhalla** (free motorcycle routing via FOSSGIS, no key needed)
- **NextAuth v5** (email code auth with Credentials provider)
- **Prisma 7** + PostgreSQL on Neon
- **Resend** (transactional emails)
- **Local JSON** for curated routes, meeting points, POIs, bike specs

## Project Structure
```
src/
  app/
    page.tsx              # Landing page (Solo Ride / Group Ride / Guest)
    layout.tsx            # Root layout with auth-aware header
    manifest.ts           # PWA manifest
    login/page.tsx        # Email code login
    onboarding/page.tsx   # First-time setup (handle, name, bike)
    plan/
      page.tsx            # Authenticated solo planner (profile pre-fill)
      guest/page.tsx      # Guest planner (no auth, original flow)
    profile/
      page.tsx            # Edit own profile
      [handle]/page.tsx   # Public profile
    rides/
      page.tsx            # List my rides
      new/page.tsx        # Create group ride
      [id]/page.tsx       # Ride detail (voting/locked/complete)
      [id]/vote/page.tsx  # Vote on route + destination
      join/[code]/page.tsx # Join via invite link
    api/
      auth/[...nextauth]/ # NextAuth handlers
      auth/send-code/     # Send email code
      profile/            # Profile CRUD
      profile/bike/       # Bike CRUD
      rides/              # Ride CRUD
      rides/[id]/members/ # Member management
      rides/[id]/vote/    # Vote submission
      rides/[id]/results/ # Vote tally + meeting point
      rides/join/[code]/  # Join by invite
      users/search/       # Handle autocomplete
      users/[handle]/     # Public profile
  components/
    Map.tsx, MeetingPoint.tsx, NavLinks.tsx, PointsOfInterest.tsx,
    RiderInput.tsx, RouteGallery.tsx, RouteResult.tsx, RouteSelector.tsx,
    VibePicker.tsx, HandleSearch.tsx, RideCard.tsx
  lib/
    auth.ts, auth.config.ts, auth-code.ts, db.ts, email.ts,
    geocode.ts, images.ts, midpoint.ts, navLinks.ts, poi.ts,
    ride-helpers.ts, routeMatcher.ts, routing.ts, shareUrl.ts,
    types.ts, vote-tally.ts, constants.ts
  data/
    routes.json, meetingPoints.json, poi.json, bikeSpecs.json
  generated/
    prisma/               # Prisma generated client
prisma/
  schema.prisma           # Database schema
```

## Design Direction
- **Dark theme** — riders use this outdoors, often early morning or evening
- **Bold, utilitarian aesthetic** — think motorcycle instrument cluster meets trail map
- **Accent colour**: Electric orange (#FF6B2B) on near-black (#0A0A0A)
- **Font**: Outfit from Google Fonts (weights 400, 600, 700)
- **Cards with subtle borders** (`border-[#2A2A2A]`, `bg-[#141414]`), not heavy shadows
- **Mobile-first**: big tap targets (min 44x44px), swipeable steps, minimal text

## Rules
- Guest mode (`/plan/guest`) remains fully client-side. No database, no auth, no API keys for guest flows.
- Authenticated features (`/plan`, `/rides/*`, `/profile/*`) use PostgreSQL (Neon) + Prisma + NextAuth v5 + Resend.
- Do NOT add features not in the design spec. Log ideas to BACKLOG.md.
- Keep components small and focused. One file per component.
- Use TypeScript strictly — no `any` types.
- Nominatim rate limit: max 1 request per second. Add delays between batch geocoding calls.
- All curated data lives in `src/data/`. No hardcoded routes in components.
- API routes must validate `routeId` against loaded routes.json at request time.
- All `/api/rides/[id]/*` routes must verify the user is a ride member. Write ops check LEADER role.

## Deep Link Formats
```
Google Maps: https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&waypoints=LAT,LNG|LAT,LNG&travelmode=driving
Waze:        https://waze.com/ul?ll=LAT,LNG&navigate=yes
Apple Maps:  https://maps.apple.com/?daddr=LAT,LNG&dirflg=d
```

## BACKLOG.md
Any new ideas or feature requests go here. Do NOT implement unless planned.
