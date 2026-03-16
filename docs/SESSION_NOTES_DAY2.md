# Session Notes — March 17, 2026 (Day 2)

## What Was Built Today

### Route Engine Refactor (major)
- **32 CDN-cached route polylines** in `public/routes/` (forward + reverse for all 16 routes)
- **Server-side route plan API** (`POST /api/route-plan`) — no more client-side Valhalla
- **Multi-leg map rendering** — commute (dashed blue), route (solid orange), destination (dashed orange)
- **Direction detection** — suggests reverse when rider is closer to route end
- **Nav URL builder** — samples 23 waypoints from dense polyline for Google Maps accuracy
- **Route engine** (`src/lib/route-engine.ts`) — core routing logic with leg-by-leg breakdown

### Route Data Improvements
- **131 rider-verified POIs** from Netrider forums, Shannons Club, motorcycle blogs
- **Real destinations** — Marysville Country Bakery, Black Spur Inn, Pie in the Sky, etc.
- **Starting fuel stations** for every route
- **Marysville waypoint coordinate fixed** (-37.78 was wrong, corrected to -37.51)

### UX Fixes
- ATGATT banner made permanent (not dismissible)
- Code entry: 8 individual character boxes, spellcheck disabled, auto-advance
- Solo ride: "Starting Area" label, GPS support
- Nav section: Google Maps visible, Waze/Apple Maps greyed with "Soon" badge
- Swipe-to-delete on ride cards (mobile)
- Fuel planner uses actual road distance (not haversine)
- Shareable ride stats card + share page with OG tags

### Bugs Fixed
- Emoji rendering (\u26FD)
- Logout hang
- Header reactive (useSession)
- Solo rides don't ask for multiple riders
- Destination change updates timing/fuel/map

---

## What To Do Tomorrow Morning

### 1. Google Directions API Setup (5 minutes)

This fixes the random road detours in the route polylines. Valhalla is inaccurate on Australian roads — Google is much better.

**Steps:**
1. Go to https://console.cloud.google.com
2. Create a new project (or use existing) — call it "inf3rno"
3. Go to APIs & Services → Enable APIs → search "Directions API" → Enable it
4. Go to APIs & Services → Credentials → Create Credentials → API Key
5. Copy the API key
6. (Optional) Restrict the key to Directions API only for security

**Cost:** $0.16 for 32 API calls. Google gives $200/month free credit on new projects.

**Give me the API key and I'll:**
- Write a script to regenerate all 32 route polylines using Google Directions
- Save them to `public/routes/` replacing the Valhalla ones
- The map lines will follow the exact roads Google Maps would take
- Run once, cache forever (re-run quarterly when routes change)

### 2. Test the Route Engine

After the Google polylines are generated, test these scenarios:
- [ ] Solo ride from Clyde → Reefton Spur — should show commute line + smooth route + destination leg
- [ ] Solo ride from Buxton → Reefton Spur — should show "Ride in reverse?" banner
- [ ] Switch destinations — map should update, timing should change
- [ ] Google Maps deep link — should follow the correct roads (not random detours)

### 3. Deploy to Production

Once staging looks good:
```bash
git checkout prod && git merge main && git push origin prod && git checkout main
```

### 4. Remaining Polish Before Forum Post
- [ ] Test invite flow end-to-end (share link → new user → join → vote)
- [ ] Write the Netrider forum post
- [ ] Consider: add a "Beta" badge somewhere to set expectations

---

## Architecture Summary (Current State)

```
User opens app
  → Picks location + bike + vibe + route + destination
  → Calls POST /api/route-plan (server-side)
    → Valhalla: user → route start (commute polyline)
    → Valhalla: route end → destination (last leg polyline)
    → Returns: leg breakdown, timing, nav URLs
  → Fetches /routes/reefton-spur.json (CDN-cached, ~3000 points)
  → Map renders 3 legs:
    1. Dashed blue: commute (user → start)
    2. Solid orange: the ride (CDN polyline)
    3. Dashed orange: last leg (route end → cafe/pub)
  → Google Maps button: 23 sampled waypoints from polyline
```

## Known Issues
- Route polylines from Valhalla have random road detours (Maurice Rd etc.) — fix with Google Directions API
- Waze/Apple Maps deep links greyed out (need proper multi-stop support)
- Screenshot/debugging tool for route troubleshooting not yet built
- Some route waypoint coordinates may still be slightly off

## Files Changed Today (Key)
- `public/routes/*.json` — 32 CDN-cached polyline files
- `src/lib/route-engine.ts` — core routing logic
- `src/lib/nav-url-builder.ts` — nav URL builder
- `src/app/api/route-plan/route.ts` — server-side API
- `src/components/Map.tsx` — multi-leg renderer
- `src/components/RouteResult.tsx` — major rewrite to use new engine
- `src/data/routes.json` — updated destinations, POIs, routeShape
- `src/data/poi.json` — rider-verified pitstops and fuel stations
- `src/data/routeDestinations.json` — research reference data
