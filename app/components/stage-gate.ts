"use client";

import { createContext, useContext } from "react";

/**
 * Whether the plate is actually on screen and interactive.
 *
 * The introduction overlay covers the stage and marks it `inert` on a first
 * visit, so a reveal keyed to mount would play out its whole choreography
 * behind a modal and be over before anyone saw it. The shell publishes this
 * instead, and the explorer waits for it.
 *
 * The default is `true` so the explorer still reveals when it is rendered
 * without the shell around it.
 */
export const StageGateContext = createContext(true);

export function useStageOpen() {
  return useContext(StageGateContext);
}
