"use client";

import { useEffect, useState } from "react";
import { MONTHS, type Selection } from "./model";
import { useReducedMotion } from "./use-motion";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A mechanical counter coming to rest.
 *
 * The strips are never torn down and rebuilt, so a change always rolls from
 * whatever is currently showing toward the new reading: the direction of the
 * roll is itself information. Digits settle left to right, the order they are
 * read in.
 *
 * `active` is the tier gate, not a switch between two renderings. Hovering the
 * plate changes the reading many times a second, so scrubbing turns the
 * transition off and the digits swap in place — a counter that never settles
 * is a counter nobody can read.
 */
export function Odometer({ value, active }: { value: string; active: boolean }) {
  const reduced = useReducedMotion();
  const [wound, setWound] = useState(false);

  useEffect(() => {
    if (reduced) return;
    // The first reading winds up from zero, which rhymes with the rings
    // accumulating outward. Deferring a frame gives the strips a start
    // position to travel from.
    const frame = requestAnimationFrame(() => setWound(true));
    // A background tab issues no frames, and an un-wound counter shows zeros —
    // wrong numbers, not merely still ones. The backstop guarantees the real
    // reading lands whether or not the wind-up ever gets to run.
    const backstop = window.setTimeout(() => setWound(true), 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(backstop);
    };
  }, [reduced]);

  if (reduced) return <span className="odo">{value}</span>;

  return (
    <span className={`odo${active ? "" : " odo-still"}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="odo-track">
        {/* Every character is a slot, digit or not. A currency sign sitting in a
            plain span would have a text baseline while a masked strip has a
            bottom-edge one, and the two drift apart at every font size. Giving
            them the same box makes them align by construction. */}
        {[...value].map((character, index) => {
          const digit = /\d/.test(character);
          return (
            <span key={index} className="odo-slot">
              <span
                className="odo-strip"
                style={digit ? {
                  transform: `translateY(calc(var(--odo-cell) * ${-(wound ? Number(character) : 0)}))`,
                  transitionDelay: `${index * 22}ms`,
                } : undefined}
              >
                {digit
                  ? DIGITS.map((cell) => <span key={cell} className="odo-cell">{cell}</span>)
                  : <span className="odo-cell">{character}</span>}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/**
 * The month name rides a tape of every month in the archive, so a step from
 * December to January turns forward by one rather than backward by eleven, and
 * a jump across the plate visibly covers the ground between. The tape is the
 * whole record, which is the same thing the plate is.
 */
export function MonthRoll({
  selection,
  firstYear,
  yearCount,
  active,
}: {
  selection: Selection;
  firstYear: number;
  yearCount: number;
  active: boolean;
}) {
  const reduced = useReducedMotion();
  const label = MONTHS[selection.month];
  if (reduced) return <span className="odo-month">{label}</span>;

  const offset = (selection.year - firstYear) * 12 + selection.month;
  return (
    <span className={`odo-month${active ? "" : " odo-still"}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="odo-slot odo-slot-month">
        <span className="odo-strip" style={{ transform: `translateY(calc(var(--odo-cell) * ${-offset}))` }}>
          {Array.from({ length: yearCount * 12 }, (_, index) => (
            <span key={index} className="odo-cell">{MONTHS[index % 12]}</span>
          ))}
        </span>
      </span>
    </span>
  );
}
