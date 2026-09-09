"use client";

import { useEffect, useRef } from "react";
import { MONTHS } from "./model";
import { useReducedMotion } from "./use-motion";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A reel: a strip of cells behind a one-cell mask, and a position along it.
 *
 * `at` is where the strip is, in cells, and `to` where it is going. Both are
 * carried here rather than in React state, and the position is written
 * straight to the node: the entrance moves these sixty times a second, and a
 * render per frame would put the readout in the way of the drawing it is a
 * caption on.
 *
 * `lap` is the length of one turn for a reel whose tape comes back round —
 * months, digits — and zero for a strip with real ends, like the years. A
 * cyclic tape carries a duplicate of its first cell at the end, so a whole lap
 * can be taken off the position without anything appearing to move.
 *
 * `oneWay` is the digits: their tape only ever turns forward, where the tapes
 * that carry a reading turn whichever way the reading moved. See `aim`.
 */
type Reel = { node: HTMLElement; lap: number; oneWay: boolean; at: number; to: number; speed: number };

// One clock for every counter on the page, started when something has
// somewhere to go and stopped the moment everything has arrived. A rig of
// counters each running its own loop would be several animations about the
// same reading.
const reels = new Set<Reel>();
let frame = 0;
let last = 0;

/**
 * How the reels move: critically damped, the fastest approach that never
 * overshoots and the only one that can be re-aimed in flight without a seam.
 *
 * Every counter here used to run a fixed transition per change, which meant a
 * reading arriving before the last one had landed threw the strip back to a
 * new start. During the plate's closing rush the years come a few frames
 * apart, so each roll was cancelled before it had travelled and the reel
 * barely moved at all — the numbers stuttered where the drawing was fastest.
 *
 * A spring has no start to be thrown back to. It carries its speed into the
 * new reading, so a run of readings reads as one roll gathering pace, which is
 * exactly what the growth front underneath it is doing. `STIFFNESS` is in
 * radians a second: a settle of roughly four over it, so about a third of a
 * second from rest, and less when the reel is already moving that way.
 */
const STIFFNESS = 14;
// Integration is substepped so a long frame cannot make the spring diverge.
const MAX_STEP = 1 / 120;
const LANDED = 0.002;
// A gap this long means the page was not being drawn at all — a background tab
// issues no frames. Rolling through the interval would spend it showing
// numbers that are merely wrong rather than merely still, so the reels land.
const STALL_SECONDS = 0.25;

function place(reel: Reel) {
  reel.node.style.transform = `translate3d(0, calc(var(--odo-cell) * ${-reel.at}), 0)`;
}

/**
 * Round the cell to a whole device pixel.
 *
 * A cell is 1.32em, and 1.32 of a clamped font size is not a whole pixel — at
 * the readout's size it is 46.464. A strip is a stack of those, so cell n sits
 * at n × 46.464 and the cells land on offsets of 0, .46, .93, .39, .86 …: each
 * one is rastered against a different subpixel, and consecutive years sat a
 * fraction of a pixel apart from each other. Turning the strip carried that
 * unevenness past the window, which reads as the years bobbing up and down as
 * they pass rather than as one strip moving.
 *
 * Rounding the cell gives every cell on the strip the same offset and makes
 * the travel a whole number of them, so the only thing that moves is the
 * strip. It is measured rather than computed because the size is a clamp on
 * the viewport and the face has its own metrics; the em value in the
 * stylesheet is what this rounds, and what stands if there is no layout yet.
 */
function pinCells() {
  // Every counter on the page, not only the ones with a reel in them: the
  // words that stand in for a reading ride a cell too, and a cell rounded on
  // one line and left at its em value on the next puts the two a fifth of a
  // pixel apart, which is the readout changing height again.
  const found = [...document.querySelectorAll<HTMLElement>(".odo, .odo-month")];
  // Cleared in one pass and measured in the next, so the whole rig of counters
  // costs one reflow rather than one apiece.
  for (const counter of found) counter.style.removeProperty("--odo-cell");
  const natural = found.map((counter) => counter.querySelector<HTMLElement>(".odo-cell")?.getBoundingClientRect().height ?? 0);
  const device = Math.max(1, window.devicePixelRatio || 1);
  found.forEach((counter, index) => {
    if (natural[index] > 0) {
      counter.style.setProperty("--odo-cell", `${Math.round(natural[index] * device) / device}px`);
    }
  });
  for (const reel of reels) place(reel);
}

let pinFrame = 0;
function schedulePin() {
  if (pinFrame) return;
  // A frame's wait lets the whole rig mount before any of it is measured.
  pinFrame = requestAnimationFrame(() => {
    pinFrame = 0;
    pinCells();
  });
}

// The cell follows the font size, which follows the viewport, and it cannot be
// measured before the face it is set in has loaded.
let watching = false;
function watchLayout() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("resize", schedulePin);
  document.fonts?.ready.then(schedulePin);
}

function rebase(reel: Reel) {
  if (!reel.lap) return;
  const laps = Math.floor(reel.at / reel.lap);
  if (!laps) return;
  reel.at -= laps * reel.lap;
  reel.to -= laps * reel.lap;
}

function land(reel: Reel) {
  reel.at = reel.to;
  reel.speed = 0;
  rebase(reel);
  place(reel);
}

function advance(reel: Reel, seconds: number) {
  for (let left = seconds; left > 0; left -= MAX_STEP) {
    const step = Math.min(MAX_STEP, left);
    const pull = STIFFNESS * STIFFNESS * (reel.to - reel.at) - 2 * STIFFNESS * reel.speed;
    reel.speed += pull * step;
    reel.at += reel.speed * step;
  }
  if (Math.abs(reel.to - reel.at) < LANDED && Math.abs(reel.speed) < LANDED) {
    reel.at = reel.to;
    reel.speed = 0;
  }
  rebase(reel);
  place(reel);
}

function run(now: number) {
  const seconds = (now - last) / 1000;
  last = now;
  let moving = false;
  for (const reel of reels) {
    if (seconds > STALL_SECONDS) land(reel);
    else advance(reel, seconds);
    if (reel.at !== reel.to) moving = true;
  }
  frame = moving ? requestAnimationFrame(run) : 0;
}

function wake() {
  if (frame) return;
  last = performance.now();
  frame = requestAnimationFrame(run);
}

/**
 * Aim a reel at a cell.
 *
 * The month and the year are positions in the record, and they take the short
 * way round: a reading a month earlier turns the tape back a month, because
 * that is the direction the reading moved. December to January is still one
 * cell forward rather than eleven back — the short way round a cyclic tape is
 * the way the record actually ran.
 *
 * The figures are not a position in anything. A price tape that turned back
 * for a lower reading and forward for a higher one read as several mechanisms
 * disagreeing across one line, so the digits only ever turn forward, like a
 * flap board: 4 to 3 is nine cells on, not one back.
 *
 * Either way the step is taken off the current target rather than the current
 * position, so a run of readings accumulates in the direction it is actually
 * travelling instead of restarting.
 */
function aim(reel: Reel, value: number, still: boolean) {
  if (reel.lap) {
    let step = (((value - reel.to) % reel.lap) + reel.lap) % reel.lap;
    if (!reel.oneWay && step > reel.lap / 2) step -= reel.lap;
    reel.to += step;
  } else {
    reel.to = value;
  }
  if (still) land(reel);
  else wake();
}

/**
 * Hang a reel on a node and keep it aimed at `value`.
 *
 * `from` is the cell it is hung at, read once: a counter that starts at zero
 * and winds up to its first reading rhymes with the rings accumulating
 * outward, and with a spring that wind-up is the same motion as every roll
 * after it rather than a separate opening trick.
 *
 * `still` is the tier gate. Scrubbing the plate changes the reading many times
 * a second, and a counter that never settles is a counter nobody can read, so
 * a scrub lands the reels instead of rolling them.
 */
/** A counter with no reel in it still carries a cell, and the cell is pinned. */
function usePinnedCell() {
  useEffect(() => {
    watchLayout();
    schedulePin();
  }, []);
}

function useReel(value: number, lap: number, still: boolean, from: number, oneWay = false) {
  const node = useRef<HTMLSpanElement>(null);
  const reel = useRef<Reel | null>(null);
  const hung = useRef(from);

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const hanging: Reel = { node: element, lap, oneWay, at: hung.current, to: hung.current, speed: 0 };
    reel.current = hanging;
    place(hanging);
    reels.add(hanging);
    watchLayout();
    schedulePin();
    return () => {
      reels.delete(hanging);
      reel.current = null;
    };
  }, [lap, oneWay]);

  useEffect(() => {
    if (reel.current) aim(reel.current, value, still);
  }, [still, value]);

  return node;
}

function cyclicCells(labels: readonly string[]) {
  // The duplicate first cell is what a lap is taken off against.
  return [...labels, labels[0]];
}

function Digit({ digit, still }: { digit: number; still: boolean }) {
  const node = useReel(digit, DIGITS.length, still, 0, true);
  return (
    <span className="odo-slot">
      <span ref={node} className="odo-strip">
        {cyclicCells(DIGITS).map((cell, index) => <span key={index} className="odo-cell">{cell}</span>)}
      </span>
    </span>
  );
}

/**
 * A mechanical counter coming to rest.
 *
 * Every character is a slot, digit or not. A currency sign sitting in a plain
 * span would have a text baseline while a masked strip has a bottom-edge one,
 * and the two drift apart at every font size. Giving them the same box makes
 * them align by construction.
 */
export function Odometer({ value, active }: { value: string; active: boolean }) {
  const reduced = useReducedMotion();
  if (reduced) return <span className="odo">{value}</span>;

  return (
    <span className="odo">
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="odo-track">
        {[...value].map((character, index) => (
          /\d/.test(character)
            ? <Digit key={index} digit={Number(character)} still={!active} />
            : (
              <span key={index} className="odo-slot odo-slot-fixed">
                <span className="odo-strip"><span className="odo-cell">{character}</span></span>
              </span>
            )
        ))}
      </span>
    </span>
  );
}

/**
 * A reading that is not there, set in a counter's box.
 *
 * The readout says "No market data" until the front crosses into the priced
 * years, and an em dash where an observation has none. A counter is a cell
 * tall and carries the line's whole descent below it, so a sentence in its
 * place made a shorter line box and the block rose by six pixels at the moment
 * the figures arrived — the strut on those lines reserves the cell but cannot
 * reserve the descent, which belongs to the counter's own line box.
 *
 * So the words ride the slot the figures ride. Nothing here turns: it is one
 * fixed cell, the same one a currency sign sits in, and the block holds its
 * height by construction rather than by a reserve kept in step with a box it
 * is not part of. Under reduced motion no line carries a counter at all, and
 * the strut is what holds those.
 */
export function ReadoutBlank({ text }: { text: string }) {
  const reduced = useReducedMotion();
  usePinnedCell();
  if (reduced) return <span className="odo">{text}</span>;

  return (
    <span className="odo">
      <span className="odo-track">
        <span className="odo-slot odo-slot-fixed">
          <span className="odo-strip"><span className="odo-cell">{text}</span></span>
        </span>
      </span>
    </span>
  );
}

/**
 * The year rides a strip of the years themselves rather than four digit reels.
 *
 * A year is a position in a record, not four independent columns: rolling 2019
 * to 2020 as digits turns three of them at once in different directions, which
 * reads as noise where the plate is laying down one more ring. One cell per
 * year turns the reading into the same movement the specimen is making, and
 * the strip has real ends because the record does.
 */
export function YearRoll({ years, year, active }: { years: readonly number[]; year: number; active: boolean }) {
  const reduced = useReducedMotion();
  const index = Math.max(0, years.indexOf(year));
  const node = useReel(index, 0, reduced || !active, 0);
  if (reduced) return <span className="odo">{year}</span>;

  return (
    <span className="odo">
      <span className="sr-only">{year}</span>
      <span aria-hidden="true" className="odo-slot odo-slot-year">
        <span ref={node} className="odo-strip">
          {years.map((cell) => <span key={cell} className="odo-cell">{cell}</span>)}
        </span>
      </span>
    </span>
  );
}

/**
 * The month rides its own twelve-cell tape, so a step from December to January
 * turns forward by one rather than backward by eleven. The year it belongs to
 * is the strip beside it, and the two moving together are the reading crossing
 * a year boundary.
 */
export function MonthRoll({ month, active }: { month: number; active: boolean }) {
  const reduced = useReducedMotion();
  const node = useReel(month, MONTHS.length, reduced || !active, 0);
  const label = MONTHS[month];
  if (reduced) return <span className="odo-month">{label}</span>;

  return (
    <span className="odo-month">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="odo-slot odo-slot-month">
        <span ref={node} className="odo-strip">
          {cyclicCells(MONTHS).map((cell, index) => <span key={index} className="odo-cell">{cell}</span>)}
        </span>
      </span>
    </span>
  );
}
