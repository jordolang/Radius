"use client";

/**
 * TabBar — the app's persistent bottom navigation.
 *
 * Fixed across the bottom of the display (inside the same max-w-md column the
 * rest of the app uses), with five primary destinations. It only renders for a
 * signed-in user — signed-out screens (sign-in/up, the AuthGate CTA) show no
 * chrome. Active state is derived from the current path; styling pulls from the
 * design tokens in globals.css. Honors the iOS home-indicator safe area.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn } from "@clerk/nextjs";
import type { ReactNode } from "react";

interface Tab {
  href: string;
  label: string;
  icon: ReactNode;
}

/** Minimal line icons (no icon dependency); inherit currentColor. */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke} width="22" height="22" aria-hidden>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "Discover",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke} width="22" height="22" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke} width="22" height="22" aria-hidden>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9h17M8 3v3M16 3v3" />
      </svg>
    ),
  },
  {
    href: "/preferences",
    label: "Absolutes",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke} width="22" height="22" aria-hidden>
        <path d="M5 6h14M5 12h14M5 18h14" />
        <circle cx="9" cy="6" r="2" fill="var(--bg)" />
        <circle cx="15" cy="12" r="2" fill="var(--bg)" />
        <circle cx="8" cy="18" r="2" fill="var(--bg)" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke} width="22" height="22" aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" />
      </svg>
    ),
  },
];

/** True when `tab` is the active destination for `pathname`. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <SignedIn>
      <nav className="tab-bar" aria-label="Primary">
        <div className="tab-bar-inner">
          {TABS.map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`tab-item ${active ? "tab-item-on" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="tab-icon">{t.icon}</span>
                <span className="tab-label">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </SignedIn>
  );
}
