# Pre-Launch Checklist — Radius / "In The Mood"

Things that must be done **before deploying a production version**. This is a
living list; check items off as they land. Nothing here blocks local development.

> Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## 1. Verification (explicitly deferred — do before launch)

- [ ] **Age verification.** Wire a real age/ID-verification provider (e.g. Persona,
      Stripe Identity, Veriff). On success, set `users.age_verified = true` and
      **discard** the verification media (never retain an identity document).
      Gates that depend on it today:
      - `ephemeral` intimate-media sharing is already hard-gated on
        `users.age_verified` (currently always false → sharing is OFF until this exists).
      - Consider gating broadcasting availability / matching on age-verified too.
- [ ] **User verification** (anti-fake / anti-bot / liveness). Decide the bar:
      photo-liveness check, device attestation, or similar, to keep out bots and
      catfish accounts. Tie into the trust/safety model in `lib/safety.ts`.

## 2. Security & secrets (blockers)

- [ ] **Rotate the Supabase `service_role` secret** — it was shared in plaintext
      during dev. Rotate before any real data exists.
- [ ] Move all secrets to managed env (Vercel project env / a secret manager);
      confirm `.env.local` is never committed (it's gitignored).
- [ ] **Rate limiting** on API routes (anti-enumeration / anti-scraping), especially
      `match` (teaser), `beacon`, `alert`, `identity`.
- [ ] Re-confirm RLS posture: all tables are deny-all + service-role-only today.
      Document it, and verify no client ever gets the service key.
- [ ] Server-side **anti-spoofing** for the coarse location cell (clients currently
      send the cell; add corroborating signals before trusting it for safety).

## 3. Realtime & notifications

- [ ] Replace the **dev signaling relay** (`signaling_messages` DB polling) with a
      realtime provider (Ably / Pusher / Supabase Realtime) for the pre-meet call.
- [ ] **Push notifications** (APNs / web push) so beacon alerts fire when the app is
      backgrounded — today alerts only surface while the app is open and polling.

## 4. Media / privacy hardening

- [ ] Avatar eye-mask uses a **hardcoded center band** (`profile-form.tsx`); wire a
      real face/eye detector or a drag-to-place mask so masks land correctly.
- [ ] Ephemeral viewer: native **screenshot detection** (iOS) / `FLAG_SECURE`
      (Android) where available. Keep the honest "can't fully prevent capture" copy.
- [ ] Object storage for avatars + ephemeral blobs (e.g. Supabase Storage / S3),
      with short-lived signed URLs and guaranteed deletion on view/expiry.

## 5. Production config

- [ ] Mapbox: production **URL-restricted** `NEXT_PUBLIC_MAPBOX_TOKEN` (or confirm the
      Leaflet fallback is the intended prod experience).
- [ ] Capacitor/iOS: verify Clerk auth + the WKWebView flow on a real device build,
      and replace the dev `http://localhost:3000` server URL with the deployed origin.

## 6. Quality gates

- [ ] **First real end-to-end runtime walkthrough** (sign in → onboard → available →
      match → chat → pre-meet). The app has been verified by typecheck/build, **not**
      yet exercised against the live DB + Clerk.
- [ ] Test harness + unit tests for the pure logic (`lib/preferences`, `lib/geo`,
      `lib/match`, `lib/beacon`) — there is currently no test runner in `package.json`.
- [ ] Error monitoring (e.g. Sentry) + structured server logging.
- [ ] Migrate off `next lint` (deprecated in Next 16) to the ESLint CLI.
