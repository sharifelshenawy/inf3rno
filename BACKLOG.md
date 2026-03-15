# BACKLOG

Features and ideas for future sessions.

## Phase 2 — Near Term
- [x] ~~User accounts + friend lists~~ (implemented)
- [x] ~~Rider profiles with default vibe/difficulty preferences~~ (implemented)
- [x] ~~"Invite to ride" flow — send link, rider adds their location, plan auto-updates~~ (implemented)
- [x] ~~Estimated fuel stop suggestions based on bike range~~ (implemented)
- [ ] AI route generation using OpenStreetMap road curvature data
- [ ] More curated routes (Gippsland, Alpine region, Murray River)
- [ ] Reverse routes (ride the same road in the other direction)

## Phase 3 — Community
- [ ] Public ride events (create open rides, anyone can join)
- [ ] Route ratings and reviews
- [ ] Community-submitted routes (moderated)
- [ ] Ride photos attached to routes
- [ ] Route comments / tips
- [ ] Leaderboard: most routes ridden, most km

## Phase 4 — In-Ride Features
- [ ] **Circuit mode** — option to make a ride a circuit (return via the same roads). During the ride, riders can choose to loop back on the same route or get an alternative return route
- [ ] **Ride check-ins** — if a rider stops for 4-5 minutes (based on location or time interval), send a notification: "Still heading to [destination]?" / "Heading back?" — their response triggers re-routing options
- [ ] **Alternative return routes** — when heading back, suggest different roads to keep things fresh
- [ ] **Live location tracking** — riders can see each other on the map during the ride. Auto-expires after 12 hours or when ride ends. MUST include privacy safeguards (see design spec for requirements: opt-in only, kill switch, location fuzzing near start/end, no tracking during commute home)
- [ ] Weather integration (warn if rain expected on route)
- [ ] Traffic-aware meeting point suggestions
- [ ] Dynamic route adjustment based on group size
- [ ] Post-ride summary with stats (distance, time, average speed, route completed)
- [ ] Hazard reporting on routes (gravel, roadworks, police)
- [ ] Voting reminder email — sent 24hrs after invite if no vote (needs Vercel Cron)

## Phase 5 — Smart Features
- [ ] Integration with ride tracking (record GPS trace)
- [ ] Server-side route matching for larger route datasets
- [ ] AI-powered route suggestions based on riding history

## Phase 6 — Monetisation & Partnerships
- [ ] **Buy me a coffee** — integration with buymeacoffee.com or ko-fi for community support
- [ ] **Support this app / Merch store** — button linking to a shopping page for inf3rno branded merch (stickers, patches, tees)
- [ ] **Sponsor section** — dedicated area for app sponsors. Sponsors get: logo placement, affiliate link to their web store, link to their merch. Kick-back tracking for affiliate sales
- [ ] **Sponsor tiers** — different visibility levels (banner sponsor, route sponsor, meeting point sponsor)
- [ ] Featured meeting venues (cafes pay to be suggested)
- [ ] Premium route packs (curated by region)
- [ ] Pro tier: unlimited rides, AI route generation, ride history
- [ ] Partnerships with motorcycle gear shops / dealerships
- [ ] Event sponsorship for public rides

## Technical Debt
- [x] ~~Add database (NeonDB) when accounts are needed~~ (implemented)
- [ ] Proper service worker with offline route caching
- [ ] Desktop responsive layout
- [ ] Accessibility audit
- [ ] Analytics (New Relic Browser or simple event tracking)
