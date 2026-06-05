"use client";

/**
 * Shared UI primitives. Every screen composes these so titles, spacing,
 * buttons, and color all stay consistent. Visual styling lives in the design
 * tokens + component classes in app/globals.css.
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Consistent page heading: serif title + optional muted intro line. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="page-title">{title}</h1>
      {children ? <p className="page-subtitle">{children}</p> : null}
    </header>
  );
}

/** Bordered surface used for grouped content. */
export function Card({
  children,
  ember = false,
  className = "",
}: {
  children: ReactNode;
  ember?: boolean;
  className?: string;
}) {
  return <div className={`card ${ember ? "card-ember" : ""} ${className}`}>{children}</div>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { block?: boolean };

export function PrimaryButton({ block, className = "", ...props }: BtnProps) {
  return <button className={`btn-primary ${block ? "w-full" : ""} ${className}`} {...props} />;
}

export function SecondaryButton({ block, className = "", ...props }: BtnProps) {
  return <button className={`btn-secondary ${block ? "w-full" : ""} ${className}`} {...props} />;
}

/** Primary action styled as a link (for navigation CTAs). */
export function PrimaryLink({
  href,
  children,
  block = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  block?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={`btn-primary inline-block text-center ${block ? "w-full" : ""} ${className}`}>
      {children}
    </Link>
  );
}

/** Centered confirmation / empty-state screen with a consistent layout. */
export function StatusScreen({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-full text-xl"
        style={{ background: "var(--ember-tint)", border: "1px solid var(--ember-line)", color: "var(--ember)" }}
      >
        ✓
      </div>
      <h1 className="page-title">{title}</h1>
      {children ? <p className="page-subtitle max-w-xs">{children}</p> : null}
      {action ? <div className="mt-7 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}
