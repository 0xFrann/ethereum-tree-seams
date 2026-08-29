"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import styles from "./NarrativeShell.module.css";
import { StageGateContext } from "./stage-gate";

export const NARRATIVE_SESSION_KEY = "ethereum-rings:introduction:v1";
const DISMISSED_VALUE = "dismissed";
const EXPLORER_ENTRY_ID = "rings-explorer-entry";

const INTRODUCTION = [
  "Trees keep a record of what they endure. This experiment imagines the ETH market the same way: price shapes each ring, volume gives it weight, protocol milestones form knots, and security incidents leave scars.",
  "The outer ring is unfinished. Each new day can change its shape.",
] as const;

type NarrativeMode = "checking-session" | "first-open" | "closed" | "reopened";
type PendingFocus = HTMLElement | "explorer" | null;

let memoryDismissed = false;

function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected) return false;
  if (element.matches(":disabled, [aria-disabled='true'], [hidden]")) return false;
  return true;
}

function focusExplorer(fallback: HTMLElement | null) {
  const entry = document.getElementById(EXPLORER_ENTRY_ID);
  if (entry instanceof HTMLElement) {
    entry.focus({ preventScroll: true });
    return;
  }
  fallback?.focus({ preventScroll: true });
}

function getFocusableElements(container: HTMLElement) {
  const selector = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );
}

export function NarrativeShell({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<NarrativeMode>("checking-session");
  const backgroundRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const pendingFocusRef = useRef<PendingFocus>(null);
  const headingId = useId();
  const descriptionId = useId();

  const open = mode === "first-open" || mode === "reopened";
  const blocked = mode !== "closed";

  useLayoutEffect(() => {
    let active = true;
    let dismissed = memoryDismissed;
    try {
      dismissed = window.sessionStorage.getItem(NARRATIVE_SESSION_KEY) === DISMISSED_VALUE;
    } catch {
      // A memory-only dismissal keeps the page usable when storage is unavailable.
    }
    queueMicrotask(() => {
      if (active) setMode(dismissed ? "closed" : "first-open");
    });
    return () => {
      active = false;
    };
  }, []);

  const storeDismissal = useCallback(() => {
    memoryDismissed = true;
    try {
      window.sessionStorage.setItem(NARRATIVE_SESSION_KEY, DISMISSED_VALUE);
    } catch {
      // The in-memory marker above remains authoritative for this page lifetime.
    }
  }, []);

  const closeNarrative = useCallback(() => {
    if (mode === "first-open") {
      storeDismissal();
      pendingFocusRef.current = "explorer";
    } else {
      pendingFocusRef.current = openerRef.current;
    }
    setMode("closed");
  }, [mode, storeDismissal]);

  const reopenNarrative = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    setMode("reopened");
  }, []);

  useLayoutEffect(() => {
    if (open) {
      headingRef.current?.focus({ preventScroll: true });
      return;
    }

    if (mode !== "closed") return;
    const pendingFocus = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (pendingFocus === "explorer") {
      focusExplorer(backgroundRef.current);
    } else if (canRestoreFocus(pendingFocus)) {
      pendingFocus.focus({ preventScroll: true });
    } else if (pendingFocus) {
      focusExplorer(backgroundRef.current);
    }
  }, [mode, open]);

  useLayoutEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `${-scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeNarrative();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        headingRef.current?.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1)!;
      const active = document.activeElement;
      if (!dialogRef.current.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [closeNarrative, open]);

  return (
    <div className={styles.shell} data-narrative-mode={mode}>
      <div
        ref={backgroundRef}
        className={`${styles.background} ${blocked ? styles.backgroundBlocked : ""}`}
        aria-hidden={blocked ? true : undefined}
        inert={blocked}
        tabIndex={-1}
      >
        {/* The plate reveals itself only once the introduction is out of the way;
            behind the overlay the stage is inert and the choreography would be
            spent unseen. */}
        <StageGateContext.Provider value={mode === "closed"}>{children}</StageGateContext.Provider>
        {/* Rendered last so the icon lands after the stage links in tab order; it is
            positioned bottom-right regardless. */}
        <div className={styles.reopenControl}>
          <button
            type="button"
            className={styles.reopenButton}
            aria-label="Read introduction"
            onClick={reopenNarrative}
          >
            <span aria-hidden="true">i</span>
          </button>
        </div>
      </div>

      {mode === "checking-session" ? (
        <div className={styles.checking} role="status" aria-busy="true" data-testid="narrative-checking">
          <span className="sr-only">Preparing introduction.</span>
        </div>
      ) : null}

      {open ? (
        <div className={styles.overlay}>
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            data-narrative-dialog={mode}
          >
            <div className={styles.identity} aria-hidden="true">
              <span>Experiment</span>
              <strong>Spec_ID · ETH_TREE_001</strong>
            </div>

            <div className={styles.narrative}>
              <h2 ref={headingRef} id={headingId} tabIndex={-1}>
                A living market archive
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close introduction"
                onClick={closeNarrative}
              >
                <span aria-hidden="true">×</span>
              </button>
              <div id={descriptionId} className={styles.copy}>
                <p>{INTRODUCTION[0]}</p>
                <p>{INTRODUCTION[1]}</p>
              </div>
              <button type="button" className={styles.enterButton} onClick={closeNarrative}>
                {mode === "first-open" ? "Enter the rings →" : "Return to the rings"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
