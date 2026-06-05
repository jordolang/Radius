# CLAUDE.md — Radius / "In The Mood"

This file is the **single source of truth** for building this project. Read it
before doing anything. Every change must serve the vision and obey the doctrine
below.

---

## 0. PRIME DIRECTIVE — how we build (non-negotiable)

> **We build onto. We increase. Bigger, better, faster. We never lose content.**

1. **Additive only.** Extend and improve; never delete, stub-out, or regress
   working features, copy, data, or UI. If a change would remove capability,
   stop and find the additive path instead.
2. **No silent downgrades.** Never replace real functionality with a placeholder,
   a "coming soon", or a TODO to make something compile. If something must be
   deferred, it is deferred *in addition to* what already works, and it is
   written down in §11 Roadmap — never by quietly dropping the existing behavior.
3. **Preserve on refactor.** When restructuring a file, carry over every field,
   branch, comment of value, and edge case. Diff against the original in your
   head: did anything get lost? If yes, restore it.
4. **Professional and complete.** Ship components fully built — wired to data,
   validated, error-handled, styled with the design tokens, typechecked. No
   half-finished surfaces.
5. **Verify before claiming done.** `npm run typecheck` clean, routes compile,
   and where it matters, run it in the simulator and look (see §10).
6. **The vision in this file is the basis for all building.** If a request is
   ambiguous, resolve it toward the vision and invariants here.

---

## 1. The product

**In The Mood** (codename **Radius**) — anonymous, consent-first, proximity
introductions for adults. The safety and privacy properties are enforced by the
**architecture**, not just policy. It helps people who are *available right now*
(or planning to be) discover mutually-compatible people *nearby* and connect on
**mutual, explicit opt-in** — with real identity revealed slowly and only by
choice.

**Core loop:** set up profile + absolutes → go available (drop on the map as a
coarse area) → beacon alerts when a compatible person is also available nearby →
both tap interested → avatar + chat unlock → live (un-recorded) pre-meet safety
call → both confirm → meet. Backing out is always free at every step.

**Tone & aesthetic:** intimate, premium, discreet. Dark "ember" palette, serif
display type. Never crude, never clinical. See §9.

---

## 2. Non-negotiable invariants (privacy & safety)

These are architectural guarantees. Do not weaken them for convenience.

- **No exact location, ever.** Raw `{lat,lng}` is quantized to a ~5-mile coarse
  cell in `lib/geo.ts` immediately and never stored, logged, or returned. All
  matching/alerts work on opaque cell ids and cell-center distances.
- **No exact addresses, ever — PERIOD.** Plan Ahead takes a **ZIP code** and
  broadcasts from that ZIP's city/coarse cell, never a street or pin.
- **No real names.** Identity is an app-given **pseudonym** (`lib/identity.ts`).
  There is no real-name field anywhere; the Clerk user id is the only key.
- **No real photos in public.** The profile's **main photo is cartoonized +
  de-identified** (`lib/avatarize.ts`, `sharp`) and is the only image shown on
  the map. Up to 4 optional private photos stay **blurred** until a match is made
  AND both opt into content sharing — then they reveal in focus.
- **Mutual opt-in before any reveal.** A single user can never unilaterally pull
  another's avatar, profile, chat, or photos. Every reveal rung needs BOTH users
  (`lib/match.ts`).
- **Absolutes are a hard, mutual filter.** If either party falls outside the
  other's absolutes, no candidate forms, no beacon fires, neither sees the other
  (`lib/preferences.ts`).
- **Safety call is LIVE and NEVER recorded.** We persist only booleans +
  timestamps that steps happened — never audio/video/transcript/consent media.
- **Safety reports are private** moderation signal, never shown on a profile.
- **Server enforces identity from the session**, never from the request body.
  Supabase tables are RLS-locked with no policies; only the service-role server
  client reaches data (`lib/db/client.ts`). Never import that client into a
  `"use client"` file.

When in doubt, the more private / more consent-gated option wins.

---

## 3. Feature map (what exists and how it works)

Primary navigation is the persistent bottom **TabBar** (`components/nav/tab-bar.tsx`):
**Home · Discover · Plan · Absolutes · Profile** (signed-in only).

- **Home / Map** (`app/page.tsx`, `components/radius-map.tsx`, `components/map/*`)
  — live dark map centered on you; pulsing dot (on-device only), your coarse
  ~5-mile cell, a proximity ring, an anonymous "someone nearby" halo. Beacon-mode
  toggle. **No on-screen zoom buttons** — native pinch-zoom only. Mapbox GL when
  `NEXT_PUBLIC_MAPBOX_TOKEN` is set, else Leaflet + Carto dark tiles.
- **Profile** (`app/profile/page.tsx`, `components/profile/*`) — 5 photos (1 main
  cartoonized for the map; 4 optional reveal-on-match, blurred in the editor with
  a "Show me" preview), app-given pseudonym (read-only), age/height/weight,
  hair/eye/skin, up to 3 bio lines capped at 50 chars, large Save. Matching-
  critical fields (gender, seeking, build, body type, lifestyle, relationship,
  non-deception attestation) live in a collapsible "More for matching" section so
  the absolutes filter + safety keep working. Persists via `POST /api/profile`.
- **Absolutes** (`app/preferences/page.tsx`, `components/preferences-form.tsx`) —
  hard mutual filter. Age/height/weight as **sliders**; hair color, eye color,
  skin tone as **toggle allow-lists** (all-on = no limit; turn one off to
  exclude; keep one to restrict). Enforced in `lib/preferences.ts`.
- **Discover** (`app/discover/page.tsx`) — the hub for every interaction with
  potential matches. Top half: overview + quick links (Chats, Updates, Past
  matches, Archive, Go Pro). Bottom half: live "in your radius now" list +
  search-area slider + meetup-preference chips (Your place / Their place / Hotel
  required / Public meetup first / Daytime-public only). Pro is deferred (§11).
- **Plan Ahead** (`app/plan/page.tsx`) — enter a **ZIP** + a lead time via radio
  (2/4/8/12/24h, ≤24h). Resolves ZIP → city + coarse cell (`lib/zip.ts`,
  keyless) and broadcasts a tentative future presence. Public phrasing by lead
  time (`leadPhrase` in `lib/planahead.ts`): 2h "in the next few hours", 4h "in
  the next several hours", 8h "in the upcoming hours", 12h "sometime today", 24h
  "within the next day". Backing out is free.
- **Match / Chat / Pre-meet** (`app/match/[id]/page.tsx`, `components/chat.tsx`,
  `components/match/*`, `components/premeet-call.tsx`, `lib/match.ts`,
  `lib/premeet-signaling.ts`) — the reveal ladder + the live safety call.
- **Onboarding** (`app/onboarding/page.tsx`) — alias → profile → absolutes.
- **Safety** (`lib/safety.ts`, `components/safety-report.tsx`) — trust state,
  blocks, private reports.
- **Ephemeral media** (`lib/ephemeral.ts`) — view-capped intimate media,
  hard-gated on `users.age_verified` (off until verification ships, §11).

---

## 4. Architecture & stack

- **Next.js 15 App Router**, **React 19**, **TypeScript (strict)**, **Tailwind**.
- **Native shell: Capacitor 8 iOS** — a WKWebView that loads the running Next.js
  server at `http://localhost:3000` (the iOS Simulator shares the macOS loopback).
  The app's value is in its API routes, so we load the live server, not a static
  export. `capacitor.config.ts` keeps Clerk auth domains in-WebView via
  `allowNavigation`.
- **Auth: Clerk.** `middleware.ts` + `<ClerkProvider>`; client identity via
  `lib/use-auth-user.ts` + `components/auth/auth-gate.tsx`; server via
  `lib/auth.ts` (`getUserId` / `getUserIdEnsured`).
- **Data: Supabase Postgres** (project `qpqftkkucsbsacqkbwlf`), server-only
  service-role client, repository pattern in `lib/db/repo.ts`. Schema changes go
  through Supabase migrations (snake_case columns; mappers in `repo.ts` translate
  to/from the camelCase domain types).
- **Image de-identification:** `sharp` in `lib/avatarize.ts`.

---

## 5. Data model

Domain types: `lib/types.ts`, `lib/profile.ts`, `lib/preferences.ts`,
`lib/planahead.ts`. Supabase tables (snake_case): `users`, `profiles`,
`profile_health`, `preferences`, `presence`, `presence_mode`, `matches`,
`premeet_calls`, `blocks`, `trust`, `reports`, `beacon_log`, `plans`,
`planner_reliability`, `ephemeral_items`, `signaling_messages`.

When adding a field: update the domain type → add the column via Supabase
migration → update the `repo.ts` mapper (both directions) → sanitize/validate at
the API boundary. Keep optional/new fields non-breaking for existing flows.

---

## 6. Design system

All color/type/shape are **design tokens** in `app/globals.css` (`:root` vars +
`@layer components`). Never hardcode hex/rgba in components — add or reuse a
token. Shared primitives in `components/ui.tsx` (`PageHeader`, `Card`,
`PrimaryButton`, `SecondaryButton`, `PrimaryLink`, `StatusScreen`). Reusable
classes: `.card`, `.btn-primary/secondary`, `.chip/.chip-on`, `.input/.select/
.textarea`, `.field-label`, `.abs-range` (slider), `.tab-*` (tab bar), the spark/
reveal animations. Match the existing intimate, premium, ember aesthetic.

---

## 7. Running the app (read `radius-ios-run` memory too)

1. **Dev server first:** `npm run dev` (or `nohup npm run dev &`) on `:3000`.
2. **iOS:** `RADIUS_SIM_UDID=<udid> bash scripts/run-ios.sh` — the verified path.
   - **Build with `-target App`, NOT `-scheme App`.** A scheme build fails on this
     toolchain (Xcode 26.5 / sim 26.4) with "Supported platforms … is empty".
     Clearing caches does NOT fix it; the target build does. `run-ios.sh` handles it.
   - **First paint is often blank/black** even though the page loaded (check the
     dev log for `GET / 200`). Relaunch / focus the Simulator; it then paints.
3. Web changes are live without rebuilding (the WebView loads the live server).
   Only native config changes (`capacitor.config.ts`) need `npx cap sync ios` +
   rebuild.

`.env.local` (gitignored) holds Supabase + Clerk keys. See `.env.example`.

---

## 8. Build conventions

- **Immutability:** never mutate; return new objects (spread). Pure libs in
  `lib/*` stay framework-free and unit-testable.
- **Many small, focused files** over large ones; organize by feature/domain.
- **Validate at boundaries:** sanitize/validate all request bodies; identity from
  the session, never the body. Fail with clear messages.
- **Error handling:** handle explicitly; user-friendly messages in UI, detail on
  the server; never swallow silently.
- **No `console.log`** in committed code. Avoid `any` (use `unknown` + narrow).
- **Explicit types on exported/public APIs**; let locals infer.
- Follow the global rules in `~/.claude/CLAUDE.md` and `~/.claude/rules/*`.

---

## 9. Definition of done (every change)

- [ ] Serves the vision; obeys every invariant in §2.
- [ ] Additive — nothing existing was lost or downgraded (§0).
- [ ] `npm run typecheck` clean; affected routes compile (200).
- [ ] Wired to real data + validated + error-handled + tokenized styling.
- [ ] Ran in the simulator and looked at it when UI/behavior changed.
- [ ] Roadmap/§11 updated if anything was intentionally deferred.

---

## 10. Memory & references

Project memory lives in
`~/.claude/projects/-Users-jordanlang-Repos-Radius/memory/` — `radius-db-auth-stack`
(DB/auth) and `radius-ios-run` (build/run procedure). `LAUNCH_CHECKLIST.md` in the
repo tracks pre-production blockers. `README.md` has setup details.

---

## 11. Roadmap & explicitly-deferred (build onto these — never instead-of)

- **Pro / paid packages** — deferred until the app launches successfully, then
  rolled out (wider search, priority beacons, etc.). The Discover "Go Pro" tile is
  the entry point.
- **Wire meetup prefs + search radius into matching** — currently saved on-device
  (`lib/use-discovery-settings.ts`); make the engine consume them.
- **Chats / Past matches / Updates / Archive data** behind the Discover tiles —
  back them with a real "my matches" query + chat list.
- **Age + user verification** (provider integration), **rate limiting**, **secret
  rotation**, and the rest of `LAUNCH_CHECKLIST.md` — pre-launch.
