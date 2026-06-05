"use client";

/**
 * AuthGate — renders children only for a signed-in user, passing the Clerk user
 * id down. While Clerk loads it shows nothing; signed-out users get a sign-in CTA.
 * Replaces the old demoUserId() stub as the single source of "who am I" on the client.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuthUserId } from "@/lib/use-auth-user";
import { PageHeader, PrimaryLink } from "@/components/ui";

export function AuthGate({ children }: { children: (userId: string) => ReactNode }) {
  const { userId, loaded, signedIn } = useAuthUserId();

  if (!loaded) return null;

  if (!signedIn || !userId) {
    return (
      <div>
        <PageHeader title="Sign in to continue">
          Your matches, location, and absolutes are tied to your account. Nothing is shared
          until you both opt in — and no real name is ever stored.
        </PageHeader>
        <div className="space-y-2">
          <PrimaryLink href="/sign-in" block>Sign in</PrimaryLink>
          <Link href="/sign-up" className="btn-secondary block w-full text-center">Create an account</Link>
        </div>
      </div>
    );
  }

  return <>{children(userId)}</>;
}
