"use client";

import { useSyncExternalStore } from "react";
import { prefersReducedMotion, watchReducedMotion } from "./motion";

/**
 * The stylesheet's `prefers-reduced-motion` rule only reaches CSS durations.
 * Canvas frames and typing timers have to consult the preference directly, and
 * they have to keep consulting it: a reader can change it mid-session.
 *
 * The server snapshot reports "reduced" so the first client render matches it
 * and nothing animates before hydration settles.
 */
export function useReducedMotion() {
  return useSyncExternalStore(watchReducedMotion, prefersReducedMotion, () => true);
}
