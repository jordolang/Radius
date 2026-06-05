import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the native iOS shell around the "In The Mood" (Radius)
 * Next.js app.
 *
 * The app's value lives in its API routes + in-memory store, so the native
 * WKWebView loads the running Next.js server rather than a static export.
 * On the iOS Simulator, `localhost` resolves to the Mac host's loopback, so
 * the simulator reaches `next start`/`next dev` on port 3000 directly.
 */
const config: CapacitorConfig = {
  appId: "com.radius.inthemood",
  appName: "Radius",
  webDir: "www",
  server: {
    url: "http://localhost:3000",
    cleartext: true,
    // Keep Clerk's hosted auth (sign-in/up, phone verification, bot challenge)
    // INSIDE the WKWebView. Without this, navigations to these off-origin hosts
    // punt to Safari and the whole session continues in the system browser.
    allowNavigation: [
      "*.clerk.accounts.dev",
      "*.accounts.dev",
      "*.clerk.com",
      "challenges.cloudflare.com",
    ],
  },
};

export default config;
