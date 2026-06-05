import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk middleware makes the session available to every route + page. Routes are
 * public by default here; each API handler enforces auth itself (returns 401 when
 * getUserId() is null), and pages gate their UI with Clerk's <SignedIn>/<SignedOut>.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets…
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // …and always on API routes.
    "/(api|trpc)(.*)",
  ],
};
