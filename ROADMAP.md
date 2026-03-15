# inf3rno Product Roadmap

## Current State: MVP (March 2026)

**What's built:**
- Solo ride planner with bike selection, fuel range, route matching
- Group ride planner with voting, meeting point calculation, invite links
- 16 curated Melbourne/Victoria routes with photos, POIs, fuel stops
- User accounts with email code auth, onboarding, multi-bike profiles
- 10,489-bike specs database
- Tesla-style fuel stop planning
- Valhalla motorcycle routing with road-following map lines
- PWA (installable on mobile)

---

## Phase 1: MVP Polish & Forum Launch (April 2026)

**Goal:** Get the MVP tight enough to post on Netrider and r/melbourneriders

- [ ] Fix remaining UX bugs from user testing
- [ ] Add ride duration filter to group rides (already on solo)
- [ ] Improve route result page — clearer navigation flow from plan → start riding
- [ ] Add "Start navigation" prominent CTA that opens Google Maps with full route
- [ ] ATGATT safety banner — "Prepare for the slide, not the ride" on all ride plans
- [ ] Basic ride history on profile (completed rides, favourite routes)
- [ ] Desktop responsive layout (riders plan on desktop, ride on mobile)
- [ ] SEO basics — meta tags, Open Graph for shared ride links
- [ ] Launch on Netrider forum, r/melbourneriders, Melbourne motorcycle Facebook groups

---

## Phase 2: Community & Engagement (May–June 2026)

**Goal:** Turn inf3rno from a tool into a community people come back to

- [ ] **Public ride events** — anyone can create open rides with date, time, route, meeting point, max riders. RSVP system. This is the #1 feature that will differentiate inf3rno
- [ ] **Event calendar** — browse upcoming community rides by week/month, filter by region/vibe/difficulty
- [ ] **Event timing breakdown** — meeting time, departure time, pitstop ETAs
- [ ] **Smart pitstop suggestions** — fuel, cafes, rest stops on-route or within 5 min detour
- [ ] **Post-ride stats cards** — distance, time, route, shareable to Instagram/Facebook. Free viral marketing every time someone shares
- [ ] **Route ratings & reviews** — 1-5 stars + comment after completing a ride. Builds community-validated route database
- [ ] **Road condition reports** — crowdsourced hazard reporting (gravel, roadworks, oil, wildlife). Auto-expire after 24-72 hours
- [ ] **Weather analysis per suburb** — BOM API for suburb-level forecasts along route. Weather icons on map overlay. Gear preparation suggestions

---

## Phase 3: Growth & NSW Expansion (July–August 2026)

**Goal:** Expand beyond Melbourne, start generating revenue

- [ ] **Expand to NSW** — 10 curated routes (Putty Road, Oxley Highway, Macquarie Pass, Thunderbolts Way, etc.) + 5 meeting points
- [ ] **Launch Pro subscription** ($4.99/mo or $39.99/yr AUD):
  - Unlimited riders per ride
  - Ride history & statistics
  - Post-ride sharable stats cards
  - Create unlimited public ride events
  - Advanced fuel planning
  - Hazard alerts
  - Weather overlay
  - No ads
- [ ] **Onboard cafe sponsors** — Melbourne motorcycle-friendly cafes pay $20-50/month to be suggested as meeting points. Start with 2-3 venues
- [ ] **Route sponsorship** — gear shops / dealerships sponsor route cards
- [ ] **Buy me a coffee / Ko-fi** integration
- [ ] **Merch store** — inf3rno stickers, patches (low cost, high margin, riders love stickers)
- [ ] **Ride streaks & achievements** — subtle badges ("5 rides this month", "First Alpine ride", "All Great Ocean Road routes")

---

## Phase 4: National & Social (September–December 2026)

**Goal:** Cover 75% of Australian riders, build social stickiness

- [ ] **Expand to QLD** — Gillies Highway, Mt Glorious, Springbrook, Tamborine Mountain
- [ ] **Expand to TAS** — Entire state as touring destination, 3-5 day loop routes
- [ ] **Expand to SA** — Adelaide Hills, Fleurieu Peninsula, Barossa Valley
- [ ] **Custom route builder** — set waypoints on map, system generates road-following route, drag to adjust
- [ ] **Rider profiles v2** — riding stats, regions explored, riding preferences, "find riders like me"
- [ ] **Clubs/Crews** — persistent riding groups with regular scheduling, crew stats, private routes
- [ ] **Mentor matching** — experienced riders flag "happy to lead new riders"
- [ ] **Seasonal route recommendations** — best autumn rides, summer coastal, winter escapes
- [ ] **Rider heat maps** — show where the community rides most, discover popular roads

---

## Phase 5: Safety & Live Features (2027 Q1)

**Goal:** Build the features that could save lives and generate media coverage

- [ ] **Live location sharing** — riders see each other on map during ride. Privacy-first: opt-in only, kill switch, location fuzzing near home, auto-expire after 12 hours
- [ ] **Ride check-ins** — if a rider stops for 5+ minutes, prompt "Still heading to [destination]?" Triggers re-routing options
- [ ] **Circuit mode** — ride the same roads back, or get alternative return route
- [ ] **Emergency SOS** — crash detection or manual SOS button. Alert nearby inf3rno riders + emergency services with GPS coords
- [ ] **Motorcycle theft alerts** — stolen bike alert to all users in region with description
- [ ] **Built-in navigation** — our own turn-by-turn using Valhalla, with hazard overlays. Reduces dependency on Google Maps

---

## Phase 6: Scale & Monetisation (2027 Q2+)

**Goal:** Sustainable business covering costs and generating income

- [ ] **Crew subscription** ($7.99/mo or $59.99/yr AUD) — live tracking, SOS, crew management, route creation, early access
- [ ] **Expand to WA, NT** — Perth Hills, South West Forests, outback adventure routes
- [ ] **Affiliate marketing** — gear recommendations (rain gear when rain forecast), insurance comparison, accommodation for multi-day rides
- [ ] **Sponsor tiers** — banner sponsors, route sponsors, meeting point sponsors, event sponsors
- [ ] **API for third parties** — let motorcycle clubs integrate inf3rno ride planning into their websites
- [ ] **Road condition AI** — aggregate GPS/accelerometer data to detect road quality changes automatically

---

## Revenue Targets

| Milestone | Active Users | Paying (5%) | Monthly Revenue |
|-----------|-------------|-------------|-----------------|
| Month 6 | 200 | 10 | $83 (subs + 1 sponsor) |
| Month 12 | 1,000 | 50 | $267 (subs + 2 sponsors) |
| Month 24 | 5,000 | 250 | $1,083 (subs + 5 sponsors) |
| Month 36 | 15,000 | 750 | $3,000 (subs + 10 sponsors) |

Platform costs at 10K users: ~$55-70/month. Self-sustaining at ~500 active users.

---

## Platform Decision: PWA vs Native App

**Recommendation: Stay PWA, don't go native (yet).**

**Why PWA wins for now:**
- Zero app store friction — share a URL, user is on the app in seconds. Critical for the invite flow (rider gets a link, opens it, joins the ride). With a native app they'd need to download from the store first, losing most of them
- One codebase — you're a solo dev. Maintaining iOS + Android + web triples your work
- Instant updates — push code, everyone gets it. No app store review delays
- Already installable — "Add to Home Screen" on both iOS and Android gives app-like experience
- No app store fees — Apple takes 30% of subscriptions. On PWA, you keep 100%
- Good enough for everything except: push notifications (limited on iOS PWA), background location (needs native for live tracking), offline maps (possible but complex with PWA)

**When to go native:**
- When you build live location tracking (Phase 5) — background GPS requires native
- When you have 5,000+ users and the PWA limitations are losing you users
- When push notifications on iOS become critical for engagement
- Consider React Native or Expo at that point — reuse most of your React component logic

**For the forum launch:** PWA is perfect. "Just open the link" is the lowest-friction onboarding possible. Riders on Netrider will try it immediately without a download. That's your advantage over Calimoto and Scenic which require app store downloads.

---

## What NOT to Build

Based on competitor research:
- **Turn-by-turn navigation** — Scenic does this well. Use deep links to Google Maps/Waze
- **Chat/messaging** — everyone has WhatsApp. Link to it, don't rebuild it
- **Generic social feed** — focus on ride-specific content (routes, events, ride reports)
- **Lean angle tracking** — niche, Calimoto owns it
- **Bike marketplace** — Bikesales.com.au and Facebook Marketplace dominate

---

## The Positioning

> **inf3rno is the only motorcycle ride planning app built for group rides in Australia.**
>
> Every other app helps you ride alone. inf3rno helps you ride together — from finding where to meet, to picking the route everyone agrees on, to making sure nobody runs out of fuel along the way.
