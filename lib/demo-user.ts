"use client";
// DEV ONLY: a stable per-browser id stands in for real auth.
export function demoUserId(): string {
  if (typeof window === "undefined") return "anon";
  let id = window.localStorage.getItem("itm_uid");
  if (!id) { id = "u_" + Math.random().toString(36).slice(2, 10); window.localStorage.setItem("itm_uid", id); }
  return id;
}
