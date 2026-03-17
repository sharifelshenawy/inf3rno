# Feedback Log

## From User Testing — March 17, 2026

### Address/Suburb Input (Priority — fix before forum post)
- [ ] **Address validation with dropdown** — when typing a suburb, show a dropdown of matching results from Nominatim (like Google Places autocomplete). Let user select from the list so we KNOW it's a valid location
- [ ] **Confirmation cue** — after selecting a suburb, show a clear visual confirmation (green checkmark, suburb name with coordinates displayed) so the user knows it was set correctly before proceeding to the next step
- [ ] This applies to: solo ride location input, guest ride location input, onboarding suburb field, profile suburb field

### Mobile App
- [ ] Multiple requests for native mobile app
- [ ] Current plan: stay PWA for now (zero friction, no app store), go native when we need background GPS for live tracking (Phase 5)
- [ ] Consider React Native / Expo when the time comes — can reuse most React component logic
- [ ] For now: make sure "Add to Home Screen" PWA experience is solid

### Route Accuracy (Pending Google API key)
- [ ] Random road detours in Valhalla polylines (Maurice Rd etc.)
- [ ] Waiting for Google Directions API key to regenerate polylines
- [ ] One-time cost ~$0.16 for 32 routes

### Previously Logged (from Day 1-2 testing)
- [x] Code entry spellcheck interference — fixed (8 individual boxes)
- [x] Login button showing when logged in — fixed (reactive header)
- [x] Solo rides asking for multiple riders — fixed (minRiders=1)
- [x] Meeting point label on solo rides — fixed ("Starting Area")
- [x] Fuel range 99% on Reefton Spur — fixed (actual road distance)
- [x] Emoji rendering — fixed
- [x] Ride card badge overlapping cancel — fixed (swipe-to-delete)
- [x] Destination not updating map — fixed (route engine refactor)
- [x] Waze/Apple Maps only showing one point — Waze greyed out, Apple Maps greyed out, Google Maps working
- [x] Nav section hidden behind expand — fixed (always visible)
- [x] Reverse route banner not showing — fixed (default forward, suggest reverse)
