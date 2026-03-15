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
- [ ] My Rides should show solo ride history alongside group rides

## Phase 3 — Community Rides
- [ ] **Community ride events** — a third ride type alongside solo and group. Open for anyone to join. One owner/organiser per event (future: delegate access / co-admin)
- [ ] **Event calendar widget** — shows upcoming community rides with date, time, route, and member count. Browsable by week/month
- [ ] **Event timing breakdown** — organiser sets: meeting time, departure time, pitstop ETAs (first pitstop, second pitstop, etc.). Show timeline view
- [ ] **Smart pitstop suggestions** — show service stations, cafes, rest stops that are on-route or within 5 min detour. Allow people to join at pitstop locations instead of meeting point
- [ ] **Social features on rides:**
  - Comment threads on ride events
  - "I'm in" / RSVP button with attendee count
  - Subscribe to updates (get notified of changes)
  - Post photos to the ride (during or after)
  - Rate the ride (1-5 stars) after completion
- [ ] **Ride ratings data** — aggregate ratings to identify which routes are most popular and highest rated. Feed this into route recommendations
- [ ] Community-submitted routes (moderated)
- [ ] Leaderboard: most routes ridden, most km, highest-rated ride organiser

## Phase 4 — Custom Route Builder
- [ ] **Create your own route** — start by setting waypoints on the map, have the system generate a road-following route between them
- [ ] **Edit route** — drag waypoints to adjust, add/remove stops
- [ ] **Save custom routes** — to your profile for reuse
- [ ] **Share custom routes** — with the community or specific riders

## Phase 5 — In-Ride Features
- [ ] **Circuit mode** — option to make a ride a circuit (return via the same roads). During the ride, riders can choose to loop back on the same route or get an alternative return route
- [ ] **Ride check-ins** — if a rider stops for 4-5 minutes (based on location or time interval), send a notification: "Still heading to [destination]?" / "Heading back?" — their response triggers re-routing options
- [ ] **Alternative return routes** — when heading back, suggest different roads to keep things fresh
- [ ] **Live location tracking** — riders can see each other on the map during the ride. Auto-expires after 12 hours or when ride ends. MUST include privacy safeguards (see design spec for requirements: opt-in only, kill switch, location fuzzing near start/end, no tracking during commute home)
- [ ] **Built-in navigation** — our own nav tool using Valhalla routing, with hazard overlays. Reduces dependency on Google Maps/Waze/Apple Maps
- [ ] **Waze hazard data integration** — research: does Waze have an API/feed for police, roadworks, accidents? If so, overlay on our map. (Note: Waze Community Partners program may provide data access, or we can crowdsource our own hazard reports)
- [ ] **Weather analysis per suburb** — fetch weather forecasts for each suburb/waypoint along the route (not just one city forecast). Riders experience micro-climates (e.g., sunny in CBD, raining in Clyde). Show weather icons/regions on the map overlay for each zone. Use BOM (Bureau of Meteorology) API or OpenWeatherMap for suburb-level forecasts. Tell riders what to prepare for: "Pack rain gear for the Dandenongs section, clear skies on the coast"
- [ ] **Ride preparation checklist** — based on weather + route: suggest gear (rain jacket, heated grips, sunscreen), warn about conditions (wet roads, fog, wind). Always show the safety message: "Prepare for the slide, not the ride. Wear all your gear, all the time."
- [ ] **ATGATT safety banner** — persistent but dismissible safety reminder encouraging full gear. Link to gear guides and crash statistics
- [ ] Traffic-aware meeting point suggestions
- [ ] Dynamic route adjustment based on group size
- [ ] Post-ride summary with stats (distance, time, average speed, route completed)
- [ ] Hazard reporting on routes (gravel, roadworks, police) — crowdsourced from riders

## Phase 6 — Smart Features
- [ ] Integration with ride tracking (record GPS trace)
- [ ] Server-side route matching for larger route datasets
- [ ] AI-powered route suggestions based on riding history
- [ ] Voting reminder email — sent 24hrs after invite if no vote (needs Vercel Cron)

## Phase 7 — Monetisation & Partnerships
- [ ] **Buy me a coffee** — integration with buymeacoffee.com or ko-fi for community support
- [ ] **Support this app / Merch store** — button linking to a shopping page for inf3rno branded merch (stickers, patches, tees)
- [ ] **Sponsor section** — dedicated area for app sponsors. Sponsors get: logo placement, affiliate link to their web store, link to their merch. Kick-back tracking for affiliate sales
- [ ] **Sponsor tiers** — different visibility levels (banner sponsor, route sponsor, meeting point sponsor)
- [ ] Featured meeting venues (cafes pay to be suggested)
- [ ] Premium route packs (curated by region)
- [ ] Pro tier: unlimited rides, AI route generation, ride history
- [ ] Partnerships with motorcycle gear shops / dealerships
- [ ] Event sponsorship for community rides

## Technical Debt
- [x] ~~Add database (NeonDB) when accounts are needed~~ (implemented)
- [x] ~~Fix Waze/Apple Maps only showing one point~~ (implemented — Apple Maps now multi-stop, Waze navigates to first waypoint)
- [ ] Proper service worker with offline route caching
- [ ] Desktop responsive layout
- [ ] Accessibility audit
- [ ] Analytics (New Relic Browser or simple event tracking)
- [ ] Quarterly bike specs database refresh (BikeSpecs.org API)

## Research Needed
- [ ] **Waze API for hazard data** — Waze Live Map has police/accident/road closure data. Research: Waze Community Partners program, CCP API, or whether we need to build our own hazard reporting. Waze's public data feeds may be available for community apps.
- [ ] **Nav tool comparison** — test deep link behavior across Google Maps, Waze, Apple Maps on iOS and Android. Document which supports multi-stop, waypoints, route preferences. Consider building our own turn-by-turn using Valhalla.
