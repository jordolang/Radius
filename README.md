# In The Mood — full app

Anonymous, consent-first, proximity introductions for adults. Built so the
safety and privacy properties are enforced by the architecture, not just policy.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind ·
`sharp` for image de-identification · designed for Vercel + managed Postgres.

Status: production build passes (18 routes), strict typecheck clean,
**103 unit tests passing** across the core logic.

## Run it
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
```
Auth is stubbed (a per-browser demo id). The in-memory `lib/store.ts` must be
replaced with Postgres before real use.

## Map
**Pages** — `/` availability + beacon · `/onboarding` alias + profile + avatar ·
`/discover` anonymous nearby → interest · `/plan` plan-ahead · `/match/[id]`
consent gate → chat → pre-meet call.

**Libraries (all unit-tested)**
- `geo` coarse ~5mi cells; proximity from fuzzed centers; raw coords never stored
- `presence` available-now, auto-expiry, anonymous proximity alert
- `match` mutual-consent reveal ladder; real media needs second mutual consent
- `identity` pseudonyms from a pool; no real-name field exists
- `pii-guard` keeps emails/phones/handles/addresses out of chat
- `ephemeral` one-time, self-destructing media; gated by consent + age-verify
- `safety` private structured reports; graduated enforcement; severe fast-track
- `planahead` future availability; coarse regional-presence anti-abuse (not attendance)
- `beacon` real-time mutual proximity alerts; consent bright line; no crossed-paths log
- `profile` required descriptors; private/optional health; non-deception attestation
- `avatarize` non-AI photo → masked cartoon avatar; strips EXIF/GPS
- `premeet-signaling` live call state machine; never records

**Routes** under `app/api/*` wire those libraries; `app/api/signaling` is a dev
polling relay (swap for a realtime provider in production).

## Invariants held throughout
- Coarse location only; raw lat/lng never leaves the device or is stored.
- Nothing reveals between two users until BOTH opt in.
- No real names; no public health/disease field; no public partner "ratings".
- The pre-meet call is live and NEVER recorded — only booleans + timestamps persist.
- Backing out of any meet is always free; penalties target abuse (scraping,
  plan-spam, regional no-shows), never declining.

## Known limits (honest)
- Screenshot prevention can be deterred/detected, never guaranteed (see ephemeral-viewer).
- Coarse-cell location can be spoofed; needs server-side anti-spoof signals later.
- Avatar masking deters but doesn't guarantee anonymity, especially combined with
  detailed attributes — keep attributes coarse.
- Eye-region for the mask comes from a detector or manual placement (not built-in).
