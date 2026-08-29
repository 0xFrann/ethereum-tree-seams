"use client";

import { useEffect, useRef, useState } from "react";
import { TYPE_SPEED_MS } from "./motion";
import { useReducedMotion } from "./use-motion";

/**
 * Text struck onto the sheet a character at a time. Courier Prime is a
 * typewriter face, so this is the plate's own voice rather than an effect
 * borrowed from somewhere else.
 *
 * Only annotations type. The specimen number is set, not typed: a display line
 * typing itself reads as a landing page, and the contrast between the fixed
 * title and the typed notes around it is what makes these read as annotation.
 *
 * Screen readers get the finished string immediately; the animating span is
 * hidden from them until it settles, so nobody hears a stutter.
 */
function typedClass(className?: string) {
  return className ? `typed ${className}` : "typed";
}

export function TypeOn({
  text,
  start,
  delay = 0,
  speed = TYPE_SPEED_MS,
  className,
  onDone,
}: {
  text: string;
  start: boolean;
  delay?: number;
  speed?: number;
  className?: string;
  onDone?: () => void;
}) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  // Types once per mount. A caller that wants a fresh strike changes the
  // element's `key`; nothing here re-runs on a changed `text`, which is what
  // keeps a hover-driven readout from stuttering its way through a sentence.
  useEffect(() => {
    if (!start || reduced) return;
    let timer = 0;
    let index = 0;
    const tick = () => {
      index += 1;
      setCount(index);
      if (index < text.length) timer = window.setTimeout(tick, speed);
      else doneRef.current?.();
    };
    const begin = window.setTimeout(tick, delay);
    return () => {
      window.clearTimeout(begin);
      window.clearTimeout(timer);
    };
  }, [delay, reduced, speed, start, text]);

  if (reduced) return <span className={typedClass(className)}>{text}</span>;
  // Before the cue, the text still occupies its line so nothing on the sheet
  // shifts when the striking begins.
  if (!start) return <span className={typedClass(className)} style={{ visibility: "hidden" }}>{text}</span>;

  const settled = count >= text.length;
  return (
    <>
      <span className={typedClass(className)} aria-hidden={settled ? undefined : "true"}>
        {settled ? text : text.slice(0, count)}
      </span>
      {settled ? null : <span className="sr-only">{text}</span>}
    </>
  );
}

/**
 * Tier 2. A committed change to the note wipes rather than retypes: the
 * pointer can cross a dozen segments in a second, and re-striking the same
 * sentence each time is noise. A knot chosen deliberately is the one case that
 * earns a full retype, and callers ask for that by changing `typeKey`.
 */
export function WipeIn({
  children,
  wipeKey,
  className,
}: {
  children: React.ReactNode;
  wipeKey: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  // Remounting on the key restarts the CSS animation; no timers, and the
  // stylesheet's reduced-motion rule covers it too.
  return (
    <div key={wipeKey} className={`${className ?? ""} wipe-in`.trim()}>
      {children}
    </div>
  );
}
