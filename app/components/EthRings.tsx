"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { priceUsd } from "./eth-rings/format";
import {
  MONTHS,
  type EventSelection,
  type MarketData,
  type Milestone,
  type Selection,
} from "./eth-rings/model";
import {
  buildGeometry,
  drawEventSelection,
  bakeGrain,
  drawBarkLayer,
  drawRevealFrame,
  drawSelection,
  drawStaticArtwork,
  growthFrontier,
  hitTest,
  radiusAtStop,
  revealStops,
  settledGrainCount,
  strokeMonthWedge,
  yearAtRadius,
  yearReach,
  type Geometry,
} from "./eth-rings/renderer";
import {
  KEY_KNOT,
  KEY_MARK_BOX,
  KEY_RING_SHAPE,
  KEY_RING_WEIGHT,
} from "./eth-rings/key-marks";
import {
  DETAIL_HOLD_MS,
  DETAIL_SPEED_MS,
  FRONT_FEATHER_GAPS,
  DRAW_END,
  PLATE_END,
  SCORE,
  SELECTION_WASH,
  TITLE_HOLD_MS,
  TITLE_SPEED_MS,
  chainDelays,
  buildRamp,
  easeInOutCubic,
  easeOutCubic,
  indexSchedule,
  monthAtIndex,
  PLATE_RAMP,
  phase,
  READOUT_STEP_MS,
  type ChainLink,
} from "./eth-rings/motion";
import { Odometer, MonthRoll, YearRoll } from "./eth-rings/Odometer";
import { TypeOn, WipeIn } from "./eth-rings/TypeOn";
import { useReducedMotion } from "./eth-rings/use-motion";
import { useStageOpen } from "./stage-gate";

type RevealPlan = {
  feather: number;
  stops: number[];
  schedule: (t: number) => number;
  years: { year: number; reach: number }[];
};

/**
 * How the plate will be drawn: one stop per line of the drawing, opening
 * slowly and gathering pace. The line count comes from the geometry, so the
 * schedule follows whatever the record has grown to.
 *
 * The plan also carries the year each radius belongs to, because the readout
 * captions the front while it travels and must not recompute that per frame.
 */
function planReveal(geometry: Geometry): RevealPlan {
  const feather = geometry.gap * FRONT_FEATHER_GAPS;
  const stops = revealStops(geometry, feather);
  const schedule = buildRamp(stops.length, PLATE_RAMP.ramp, PLATE_RAMP.range, PLATE_RAMP.curve, PLATE_RAMP.hold, PLATE_RAMP.finale);
  return { feather, stops, schedule, years: yearReach(geometry) };
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: MarketData }
  | { status: "error"; message: string };
type DetailsDialog = "events" | "data" | "method" | "key" | null;
type TimelineEvent = { kind: "milestone"; record: Milestone };
let marketDataRequest: Promise<MarketData> | null = null;

/**
 * Where a readout line falls in the chain. The step is the score's, not the
 * stylesheet's: every beat on the page reads its timing from the one table,
 * and a delay written in CSS is how the readout came to be a separate
 * animation that merely happened to overlap the rest.
 */
const readoutStep = (line: number) => ({ animationDelay: `${line * READOUT_STEP_MS}ms` });

function loadMarketData() {
  if (!marketDataRequest) {
    marketDataRequest = fetch("/api/market-data", { headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load the market specimen.");
        return body as MarketData;
      })
      .catch((error) => {
        marketDataRequest = null;
        throw error;
      });
  }
  return marketDataRequest;
}

function StageTitle({ data, annotate = true }: { data?: MarketData; annotate?: boolean }) {
  // The header is struck as a chain rather than on fixed delays: each line
  // begins where the one before it ends, so the rhythm survives whatever the
  // dates happen to say.
  //
  // The two identity lines are the project introducing itself and are set at a
  // presenting pace, each holding before the next. The provenance rows are a
  // detail and rattle past — labels included, which used to appear with no
  // animation at all while their values typed beneath them.
  const provenance: [string, string | null][] = [
    ["Origin", data ? formatDate(data.chronology.origin) : null],
    ["First market data", data ? formatDate(data.chronology.marketDataFrom) : null],
    ["Updated", data ? formatTimestamp(data.cache.updatedAt) : null],
  ];
  const title = (text: string, hold = TITLE_HOLD_MS): ChainLink => ({ text, speed: TITLE_SPEED_MS, hold });
  const detail = (text: string): ChainLink => ({ text, speed: DETAIL_SPEED_MS, hold: DETAIL_HOLD_MS });
  const links: ChainLink[] = [
    title("Specimen"),
    title("ETH_TREE_01", TITLE_HOLD_MS * 1.4),
    ...provenance.flatMap(([label, value]) => [detail(label), detail(value ?? "")]),
  ];
  const at = chainDelays(links);

  return (
    <header className="stage-title">
      <p><TypeOn text="Specimen" start={annotate} delay={at[0]} speed={TITLE_SPEED_MS} /></p>
      <h1><TypeOn text="ETH_TREE_01" start={annotate} delay={at[1]} speed={TITLE_SPEED_MS} /></h1>
      <dl className="stage-provenance" aria-label="Specimen provenance">
        {provenance.map(([label, value], index) => (
          <div key={label}>
            <dt><TypeOn text={label} start={annotate} delay={at[2 + index * 2]} speed={DETAIL_SPEED_MS} /></dt>
            <dd>{value === null ? null : <TypeOn text={value} start={annotate} delay={at[3 + index * 2]} speed={DETAIL_SPEED_MS} />}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function StageDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".explorer-stage");
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stage?.setAttribute("inert", "");
    queueMicrotask(() => dialogRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus());

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      stage?.removeAttribute("inert");
      openerRef.current?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="stage-dialog-backdrop" role="presentation">
      <div ref={dialogRef} className="stage-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="stage-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label={`Close ${title}`}>×</button>
        </div>
        <div className="stage-dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * One of the plate's marks, set beside the line of the key that names it.
 *
 * The plate strokes a contour and fills everything else, and the key follows
 * it: the ring line is stroked at the weight rings are drawn at, the volume
 * band is a filled outline at the strength the plate lays a ring's body down
 * with, and the knot is filled solid, as knots are.
 */
function KeyMark({ path, kind }: { path: string; kind: "line" | "band" | "knot" }) {
  return (
    <svg className="key-mark" viewBox={`0 0 ${KEY_MARK_BOX.width} ${KEY_MARK_BOX.height}`} aria-hidden="true">
      {kind === "line"
        ? <path d={path} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        : <path d={path} fill="currentColor" fillOpacity={kind === "band" ? 0.78 : 1} />}
    </svg>
  );
}

export function EthRings() {
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const entryTargetRef = useRef<HTMLElement | null>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const pendingEntryFocus = useRef(false);

  useEffect(() => {
    let active = true;
    void loadMarketData()
      .then((data) => active && setLoadState({ status: "ready", data }))
      .catch((error: Error) => active && setLoadState({ status: "error", message: error.message }));
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!pendingEntryFocus.current || loadState.status === "loading") return;
    const target = loadState.status === "ready" ? entryTargetRef.current : retryRef.current;
    target?.focus();
    pendingEntryFocus.current = false;
  }, [loadState.status]);

  if (loadState.status === "ready") return <EthRingsExplorer data={loadState.data} entryTargetRef={entryTargetRef} />;

  return (
    <section className="explorer explorer-stage" aria-busy={loadState.status === "loading"}>
      <StageTitle />
      <div id="rings-explorer-entry" ref={entryTargetRef as RefObject<HTMLDivElement | null>} className="explorer-state" tabIndex={-1} role={loadState.status === "error" ? "alert" : undefined}>
        <p className="state-kicker">{loadState.status === "loading" ? "Preparing specimen" : "Market specimen unavailable"}</p>
        <p>{loadState.status === "loading" ? "Loading the cached Bitstamp market history…" : loadState.message}</p>
        {loadState.status === "error" ? (
          <button ref={retryRef} type="button" className="retry-button" onClick={() => {
            pendingEntryFocus.current = true;
            marketDataRequest = null;
            setLoadState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}>Try again</button>
        ) : null}
      </div>
    </section>
  );
}

function EthRingsExplorer({ data, entryTargetRef }: { data: MarketData; entryTargetRef: RefObject<HTMLElement | null> }) {
  const latestYearIndex = data.years.length - 1;
  const latestMonth = data.years[latestYearIndex].months.at(-1)?.month ?? 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geometryRef = useRef<Geometry | null>(null);
  // The stops the front steps between and the schedule that paces them, both
  // a function of the geometry: rebuilt with it, never per frame.
  const revealPlanRef = useRef<RevealPlan | null>(null);
  const cacheRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<{ paper: string; ink: string; accent: string } | null>(null);
  const idleSelection = useMemo<Selection>(() => ({ year: data.years[latestYearIndex].year, month: latestMonth }), [data.years, latestMonth, latestYearIndex]);
  // The year strip is the record itself, one cell a year. It starts at the
  // chronology origin rather than at the first market year: a knot in the
  // unpriced interval is selectable, and a strip that began in 2017 would
  // carry no cell to show such a reading on. It is also where the growth roll
  // begins, on the pith.
  const firstArchiveYear = Number(data.chronology.origin.slice(0, 4));
  const archiveYears = useMemo(
    () => Array.from({ length: data.years.at(-1)!.year - firstArchiveYear + 1 }, (_, index) => firstArchiveYear + index),
    [data.years, firstArchiveYear],
  );
  // The reading opens on the pith, where the front opens, and January is the
  // label the growing year carries until there is a calendar to move it.
  const [selection, setSelection] = useState<Selection>({ year: firstArchiveYear, month: 0 });
  const [eventSelection, setEventSelection] = useState<EventSelection>(null);
  const [announceSelection, setAnnounceSelection] = useState(false);
  const [dialog, setDialog] = useState<DetailsDialog>(null);
  const selectionRef = useRef(selection);
  const eventSelectionRef = useRef(eventSelection);

  const stageOpen = useStageOpen();
  const reduced = useReducedMotion();
  // Which beats of the score have been reached. One clock fires all of them,
  // so the page arrives as a composition rather than as separate animations.
  const cueRef = useRef({ header: false, plate: false, grown: false, readout: false, note: false });
  const [cues, setCues] = useState({ header: false, plate: false, grown: false, readout: false, note: false });
  const fireCue = useCallback((name: keyof typeof cueRef.current) => {
    if (cueRef.current[name]) return;
    cueRef.current = { ...cueRef.current, [name]: true };
    setCues(cueRef.current);
  }, []);
  const allCues = useCallback(() => {
    if (cueRef.current.header && cueRef.current.plate && cueRef.current.grown && cueRef.current.readout && cueRef.current.note) return;
    cueRef.current = { header: true, plate: true, grown: true, readout: true, note: true };
    setCues(cueRef.current);
  }, []);
  const [noteSettled, setNoteSettled] = useState(false);
  // Tier 2 is every deliberate change. `announceSelection` already separates a
  // committed selection from a hover, so it doubles as the motion gate.
  const [commitSeq, setCommitSeq] = useState(0);
  // The wash that dims everything but the selected month. It eases in over the
  // wash beat so the finished plate does not change colour in a step.
  const washRef = useRef(0);
  // Baked reveal layers: the bark band, and the grain contours the front has
  // already fully uncovered. Only the feathered edge is drawn live.
  const barkLayerRef = useRef<HTMLCanvasElement | null>(null);
  const grainLayerRef = useRef<{ surface: HTMLCanvasElement; context: CanvasRenderingContext2D } | null>(null);
  const settledGrainRef = useRef(0);
  // True for the whole entrance: the counters roll rather than swap, and the
  // plate takes no pointer input. A reader who runs the mouse over a specimen
  // that is still being drawn is not taking a reading, and until this change
  // an idle cursor crossing the canvas cancelled the rest of the score.
  const [rolling, setRolling] = useState(false);
  // A deliberate act during the entrance still wins: an animation must never
  // pull the reading back off what the reader just chose. With the pointer
  // held off, only the keyboard and the dialogs can reach this.
  const interruptedRef = useRef(false);
  const frontierRef = useRef<HTMLSpanElement>(null);
  const revealElapsedRef = useRef(0);
  const revealPlayedRef = useRef(false);
  const revealActiveRef = useRef(false);

  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { eventSelectionRef.current = eventSelection; }, [eventSelection]);

  const marketYearIndex = data.years.findIndex((candidate) => candidate.year === selection.year);
  const marketYear = marketYearIndex >= 0 ? data.years[marketYearIndex] : null;
  const month = marketYear?.months.find((item) => item.month === selection.month) ?? null;
  const timelineEvents = useMemo<TimelineEvent[]>(() => [
    ...data.milestones.map((record) => ({ kind: "milestone" as const, record })),
  ].sort((left, right) => left.record.date.localeCompare(right.record.date) || left.record.id.localeCompare(right.record.id)), [data]);
  const eventsForMarket = useCallback((next: Selection) => {
    const prefix = `${next.year}-${String(next.month + 1).padStart(2, "0")}-`;
    return timelineEvents.filter((item) => item.record.date.startsWith(prefix));
  }, [data.years, timelineEvents]);
  const selectedMonthEvents = eventsForMarket(selection);
  const selectedEvent = eventSelection
    ? timelineEvents.find((item) => item.kind === eventSelection.kind && item.record.id === eventSelection.id) ?? null
    : null;

  const marketForEvent = useCallback((nextEvent: EventSelection) => {
    if (!nextEvent) return null;
    const item = timelineEvents.find((candidate) => candidate.kind === nextEvent.kind && candidate.record.id === nextEvent.id);
    if (!item) return null;
    const [eventYear, eventMonth] = item.record.date.split("-").map(Number);
    return { year: eventYear, month: eventMonth - 1 };
  }, [timelineEvents]);

  const selectMarket = useCallback((next: Selection, announce: boolean, nextEvent: EventSelection = null) => {
    setAnnounceSelection(announce);
    interruptedRef.current = true;
    // Only a committed selection advances the sequence; scrubbing the plate
    // with the pointer must leave the readout perfectly still.
    if (announce) setCommitSeq((value) => value + 1);
    setEventSelection(nextEvent);
    setSelection((current) => current.year === next.year && current.month === next.month ? current : next);
  }, []);
  const selectEvent = useCallback((nextEvent: Exclude<EventSelection, null>, announce: boolean) => {
    const market = marketForEvent(nextEvent);
    setAnnounceSelection(announce);
    interruptedRef.current = true;
    if (announce) setCommitSeq((value) => value + 1);
    setEventSelection(nextEvent);
    if (market) setSelection(market);
  }, [marketForEvent]);
  const restoreIdleSelection = useCallback(() => selectMarket(idleSelection, false), [idleSelection, selectMarket]);
  /**
   * The wash and the selected month, laid over the artwork already on the
   * canvas.
   *
   * `arrival` is how far the reading has come in: 1 for every ordinary paint,
   * and a ramp only on the entrance's last step, where the wash and everything
   * that counterweights it come up together.
   */
  const paintReading = useCallback((
    context: CanvasRenderingContext2D,
    geometry: Geometry,
    cache: HTMLCanvasElement,
    selected: Selection,
    arrival: number,
  ) => {
    // The palette is read once with the geometry rather than per paint. Asking
    // for a computed style is a style recalc, and this runs on every frame of
    // the entrance and every frame of a scrub, immediately after React has
    // touched the readout — exactly where a forced recalc costs most.
    const colors = paletteRef.current;
    if (!colors) return;
    context.save();
    context.fillStyle = colors.paper;
    context.globalAlpha = washRef.current;
    context.fillRect(0, 0, geometry.size, geometry.size);
    context.restore();
    drawSelection(context, data, geometry, selected, colors.accent, cache, colors.paper, arrival);
    if (eventSelectionRef.current) drawEventSelection(context, geometry, eventSelectionRef.current, colors.ink);
  }, [data]);

  const paintSelection = useCallback((arrival = 1) => {
    const canvas = canvasRef.current;
    const geometry = geometryRef.current;
    const cache = cacheRef.current;
    if (!canvas || !geometry || !cache) return;
    // While the plate is still being drawn the reveal owns the canvas. A
    // selection change must not paint the finished artwork over it.
    if (revealActiveRef.current) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, geometry.size, geometry.size);
    // Blit the artwork at its native device resolution. Drawing it through the
    // device-pixel transform resamples it, softening every hairline — and the
    // reveal composites its own layers 1:1, so a resampled settle would land as
    // a visible loss of crispness the moment the plate handed over.
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(cache, 0, 0);
    context.restore();
    paintReading(context, geometry, cache, selectionRef.current, arrival);
  }, [paintReading]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let revealFrame = 0;
    let disposed = false;

    const build = () => {
      const size = Math.max(1, Math.floor(canvas.getBoundingClientRect().width));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layer = () => {
        const surface = document.createElement("canvas");
        surface.width = Math.floor(size * dpr);
        surface.height = Math.floor(size * dpr);
        const surfaceContext = surface.getContext("2d");
        surfaceContext?.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { surface, surfaceContext };
      };
      const styles = getComputedStyle(canvas);
      const colors = {
        ink: styles.getPropertyValue("--ring-ink").trim(), grain: styles.getPropertyValue("--ring-grain").trim(), muted: styles.getPropertyValue("--ring-muted").trim(), mark: styles.getPropertyValue("--ring-mark").trim(), bark: styles.getPropertyValue("--ring-bark").trim(),
      };
      paletteRef.current = {
        paper: styles.getPropertyValue("--paper").trim(),
        ink: colors.ink,
        accent: styles.getPropertyValue("--ring-accent").trim(),
      };
      const geometry = buildGeometry(data, size);
      geometryRef.current = geometry;

      const cache = layer();
      if (!cache.surfaceContext) return null;
      drawStaticArtwork(cache.surfaceContext, data, geometry, colors);
      cacheRef.current = cache.surface;

      const barkLayer = layer();
      if (!barkLayer.surfaceContext) return null;
      drawBarkLayer(barkLayer.surfaceContext, geometry, colors);
      barkLayerRef.current = barkLayer.surface;

      const grainLayer = layer();
      if (!grainLayer.surfaceContext) return null;
      grainLayerRef.current = { surface: grainLayer.surface, context: grainLayer.surfaceContext };
      // Geometry changed, so anything baked against the old one is void.
      settledGrainRef.current = 0;
      revealPlanRef.current = planReveal(geometry);

      const frontier = growthFrontier(geometry);
      if (frontier && frontierRef.current) {
        frontierRef.current.style.left = `${(frontier.x / size) * 100}%`;
        frontierRef.current.style.top = `${(frontier.y / size) * 100}%`;
      }
      return { context, geometry, colors };
    };

    const settle = () => {
      revealActiveRef.current = false;
      revealPlayedRef.current = true;
      washRef.current = SELECTION_WASH;
      setRolling(false);
      allCues();
      setSelection(idleSelection);
      setAnnounceSelection(true);
      paintSelection();
    };

    const runReveal = (built: NonNullable<ReturnType<typeof build>>) => {
      // Elapsed time is accumulated frame to frame rather than measured from a
      // start timestamp. A background tab stops issuing frames, so a wall clock
      // would spend the whole choreography unseen and the reader would come
      // back to a plate that had already drawn itself. Accumulating pauses with
      // the tab, and the per-frame clamp keeps the resumed step from jumping.
      let last = performance.now();
      let interruptionPainted = false;
      // The plate is inert for the whole entrance, and the counters roll with
      // it rather than swapping in place.
      setRolling(true);
      const step = (now: number) => {
        if (disposed) return;
        const geometry = geometryRef.current;
        if (!geometry) return;
        revealElapsedRef.current += Math.min(now - last, 64);
        last = now;
        const elapsed = revealElapsedRef.current;

        // Beats, in score order. Firing them from the same clock that draws the
        // plate is what makes the page one composition.
        if (elapsed >= SCORE.header.start) fireCue("header");
        if (elapsed >= SCORE.plate.start) fireCue("plate");
        if (elapsed >= PLATE_END) fireCue("grown");
        if (elapsed >= SCORE.readout.start) fireCue("readout");
        if (elapsed >= SCORE.note.start) fireCue("note");

        if (elapsed < DRAW_END) {
          const plan = revealPlanRef.current ?? (revealPlanRef.current = planReveal(geometry));
          const { stops, schedule, feather } = plan;
          const state = {
            // One front. Grain, ink and ring weight all ride it. It travels a
            // feather past the outermost mark so everything reaches full
            // strength before the handoff, rather than arriving part-drawn.
            // Steps line by line rather than washing outward: the first lines
            // land and hold, and the ones after gather pace until they are
            // coming one a frame.
            radius: radiusAtStop(stops, schedule(phase(elapsed, SCORE.plate.start, SCORE.plate.duration)) * stops.length),
            feather,
            // The calendar does the same over its twelve months.
            index: indexSchedule(phase(elapsed, SCORE.index.start, SCORE.index.duration)),
          };
          const grainLayer = grainLayerRef.current;
          if (grainLayer) {
            const settled = settledGrainCount(geometry, state, settledGrainRef.current);
            if (settled > settledGrainRef.current) {
              bakeGrain(grainLayer.context, geometry, built.colors, settledGrainRef.current, settled);
              settledGrainRef.current = settled;
            }
          }
          drawRevealFrame(built.context, geometry, built.colors, state, {
            bark: barkLayerRef.current,
            grain: grainLayer?.surface ?? null,
            settled: settledGrainRef.current,
          });

          // The reading is a caption on the drawing, not a separate animation
          // about it. While the front travels it names the year being laid
          // down and holds that year's January; once the calendar is under
          // way it follows the pen round to the month the record reaches and
          // stops there, where the record does, while the pen carries on to
          // December.
          //
          // A reader who has taken the plate over owns the reading from then
          // on, so the caption stops writing itself.
          const reading: Selection = interruptedRef.current
            ? selectionRef.current
            : elapsed < SCORE.index.start
              ? { year: yearAtRadius(plan.years, state.radius), month: 0 }
              : { year: idleSelection.year, month: Math.min(idleSelection.month, monthAtIndex(state.index)) };

          // Nothing but the calendar and this wedge moves here. The reading
          // proper waits for the circle to close: brought up alongside it, it
          // reads as three animations at once, and restoring a segment out of
          // the wash costs several clipped blits of the whole plate a frame —
          // which is what makes the sweep it was meant to accompany stutter.
          //
          // The wedge is turned from `reading` rather than from the committed
          // selection, which React has not applied yet: taking it off state
          // would leave the drawn month a frame behind the drawn calendar.
          const accent = paletteRef.current?.accent;
          if (state.index > 0 && accent) strokeMonthWedge(built.context, geometry, reading.month, accent);

          const current = selectionRef.current;
          if (reading.year !== current.year || reading.month !== current.month) setSelection(reading);
          revealFrame = requestAnimationFrame(step);
          return;
        }

        // The drawing is finished. Hand the canvas back to the ordinary paint
        // path, so everything below is the real selected-segment rendering.
        if (!revealPlayedRef.current) {
          revealActiveRef.current = false;
          revealPlayedRef.current = true;
        }

        const finish = () => {
          washRef.current = SELECTION_WASH;
          setRolling(false);
          setAnnounceSelection(true);
          setSelection(idleSelection);
          allCues();
        };

        // The circle has closed. The reading lands on that last step, in one
        // movement: the wedge's month comes up and the rest of the specimen
        // dims away from it, around the outline that has been turning with the
        // pen since January.
        //
        // A reader who acts here wins outright: the reading stays where they
        // put it, and the plate takes its wash at once rather than resolving
        // around a segment they did not choose. The score still plays on — the
        // note is cued by the clock, not by the reading landing — or the rest
        // of the sheet would never arrive.
        if (interruptedRef.current) {
          if (!interruptionPainted) {
            interruptionPainted = true;
            washRef.current = SELECTION_WASH;
            setRolling(false);
            paintSelection();
          }
        } else {
          const arrival = phase(elapsed, SCORE.wash.start, SCORE.wash.duration, easeInOutCubic);
          washRef.current = SELECTION_WASH * arrival;
          paintSelection(arrival);
        }

        if (elapsed >= SCORE.note.start) {
          if (interruptedRef.current) allCues(); else finish();
          return;
        }
        revealFrame = requestAnimationFrame(step);
      };
      cancelAnimationFrame(revealFrame);
      last = performance.now();
      revealFrame = requestAnimationFrame(step);
    };

    const render = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const built = build();
        if (!built) return;
        if (reduced || revealPlayedRef.current) {
          settle();
          return;
        }
        // Behind the introduction the stage is inert and covered by opaque
        // paper. Leaving the sheet blank means the drawing starts when the
        // reader can actually see it.
        revealActiveRef.current = true;
        if (!stageOpen) return;
        runReveal(built);
      });
    };

    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    document.fonts?.ready.then(() => {
      if (!disposed) render();
    });
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
    };
  }, [allCues, data, fireCue, idleSelection, paintReading, paintSelection, reduced, stageOpen]);
  useEffect(paintSelection, [paintSelection, selection, eventSelection]);

  const interactionAt = useCallback((clientX: number, clientY: number): Selection | null => {
    const canvas = canvasRef.current;
    const geometry = geometryRef.current;
    if (!canvas || !geometry) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return hitTest(geometry, x, y);
  }, []);

  /**
   * A pointer position taken as a reading, at most once a frame.
   *
   * Pointer moves arrive faster than frames — a 1000Hz mouse fires a dozen or
   * more between two paints — and each one used to hit-test the plate, run the
   * whole readout through React and repaint the canvas underneath it. The
   * reading can only change as fast as it can be drawn, so only the last
   * position of a frame is worth answering; the rest are positions the cursor
   * has already left.
   */
  const scrubPointRef = useRef<{ x: number; y: number } | null>(null);
  const scrubFrameRef = useRef(0);
  const scrub = useCallback((clientX: number, clientY: number) => {
    scrubPointRef.current = { x: clientX, y: clientY };
    if (scrubFrameRef.current) return;
    scrubFrameRef.current = requestAnimationFrame(() => {
      scrubFrameRef.current = 0;
      const point = scrubPointRef.current;
      if (!point) return;
      const next = interactionAt(point.x, point.y);
      if (next) selectMarket(next, false);
      else restoreIdleSelection();
    });
  }, [interactionAt, restoreIdleSelection, selectMarket]);
  // Leaving the plate and committing a selection both settle the reading
  // themselves, and a queued move would land on top of them a frame later.
  const endScrub = useCallback(() => {
    cancelAnimationFrame(scrubFrameRef.current);
    scrubFrameRef.current = 0;
    scrubPointRef.current = null;
  }, []);
  useEffect(() => endScrub, [endScrub]);

  // Keyboard travel follows the same segments the pointer can reach: observed
  // months plus the unpriced months that carry a mark.
  const selectableYears = useCallback(() => {
    const segments = geometryRef.current?.selectableMonths
      ?? data.years.flatMap((year) => year.months.map((item) => ({ year: year.year, month: item.month })));
    const byYear = new Map<number, number[]>();
    for (const segment of segments) {
      const months = byYear.get(segment.year);
      if (months) months.push(segment.month);
      else byYear.set(segment.year, [segment.month]);
    }
    return [...byYear]
      .map(([year, months]) => ({ year, months: [...months].sort((left, right) => left - right) }))
      .sort((left, right) => left.year - right.year);
  }, [data.years]);

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const years = selectableYears();
    if (!years.length) return;
    const currentYearIndex = Math.max(0, years.findIndex((entry) => entry.year === selection.year));
    const available = years[currentYearIndex].months;
    const currentIndex = Math.max(0, available.indexOf(selection.month));
    const next = { year: years[currentYearIndex].year, month: selection.month };
    if (event.key === "ArrowRight") next.month = available[(currentIndex + 1) % available.length];
    else if (event.key === "ArrowLeft") next.month = available[(currentIndex + available.length - 1) % available.length];
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const nextYearIndex = Math.max(0, Math.min(years.length - 1, currentYearIndex + (event.key === "ArrowUp" ? 1 : -1)));
      const targetMonths = years[nextYearIndex].months;
      next.year = years[nextYearIndex].year;
      // A ghost year may carry a single mark; land on its closest month so the
      // reading stays on the same side of the ring.
      next.month = targetMonths.includes(next.month)
        ? next.month
        : targetMonths.reduce((best, month) =>
          Math.abs(month - next.month) < Math.abs(best - next.month) ? month : best, targetMonths[0]);
    } else if (event.key === "Home") next.month = available[0];
    else if (event.key === "End") next.month = available.at(-1)!;
    else return;
    event.preventDefault();
    selectMarket(next, true);
  };

  const periodLabel = `${MONTHS[selection.month]} ${selection.year}`;
  const hasDetailedPriceStats = month && Number.isFinite(month.averageClose) && Number.isFinite(month.low) && Number.isFinite(month.high);
  const priceLow = month ? (hasDetailedPriceStats ? month.low! : Math.min(month.open, month.close)) : null;
  const priceHigh = month ? (hasDetailedPriceStats ? month.high! : Math.max(month.open, month.close)) : null;
  const averagePrice = month ? (hasDetailedPriceStats ? month.averageClose! : (month.open + month.close) / 2) : null;
  const volatilityPercent = averagePrice && priceLow !== null && priceHigh !== null ? ((priceHigh - priceLow) / averagePrice) * 100 : null;
  const volatilityLabel = volatilityPercent === null ? null : `${volatilityPercent.toFixed(1)}%`;
  const priceSummary = averagePrice === null ? "No market observation for this month." : `Average price ${priceUsd(averagePrice)}. Volatility ${volatilityLabel}.`;
  // Tier 2 and Tier 1 only. During a hover scrub the numbers swap in place:
  // a counter that never settles is a counter nobody can read. The entrance
  // rolls throughout — that is the reading being taken, not a scrub.
  const rollNumbers = !reduced && cues.readout && (announceSelection || rolling);
  return (
    <section className={`explorer explorer-stage${rolling ? " is-drawing" : ""}${cues.plate ? " is-plate" : ""}${cues.grown ? " is-grown" : ""}${cues.readout ? " is-readout" : ""}${cues.note ? " is-note" : ""}`} aria-label="Ethereum annual rings explorer">
      <StageTitle data={data} annotate={cues.header} />
      {/* The reading first, then the figures taken from it — the same order
          the label opposite states its identity and then its provenance. */}
      <section className="stage-price" aria-label={`${periodLabel}. ${priceSummary}`}>
        <p className="period-date readout-line" style={readoutStep(0)}><MonthRoll month={selection.month} active={rollNumbers} /> <YearRoll years={archiveYears} year={selection.year} active={rollNumbers} /></p>
        <p className="price-range readout-line" style={readoutStep(1)}>{priceLow === null || priceHigh === null ? "No market data" : <><Odometer value={priceUsd(priceLow)} active={rollNumbers} />—<Odometer value={priceUsd(priceHigh)} active={rollNumbers} /></>}</p>
        <dl className="price-observations"><div className="readout-line" style={readoutStep(2)}><dt>Average</dt><dd>{averagePrice === null ? "—" : <Odometer value={priceUsd(averagePrice)} active={rollNumbers} />}</dd></div><div className="readout-line" style={readoutStep(3)}><dt>Volatility</dt><dd>{volatilityLabel === null ? "—" : <Odometer value={volatilityLabel} active={rollNumbers} />}</dd></div></dl>
      </section>
      {/* The plate takes no pointer input while it is being drawn. Running a
          cursor over a specimen that is still growing is not a reading being
          taken, and treating it as one used to cancel the rest of the score.
          The keyboard is left live: a keypress is deliberate. */}
      <div className="graph-stage">
        <canvas id="rings-explorer-entry" ref={(node) => { canvasRef.current = node; entryTargetRef.current = node; }} className="rings-canvas" role="group" aria-roledescription="interactive chart" tabIndex={0}
          aria-label={`Interactive Ethereum annual rings. Selected ${periodLabel}; ${priceSummary} Use left and right arrows for months on this ring, up and down arrows for years.`}
          aria-describedby="rings-instructions rings-readout" onKeyDown={handleCanvasKeyDown}
          onPointerLeave={(event) => { if (rolling || event.pointerType !== "mouse") return; endScrub(); restoreIdleSelection(); }}
          onPointerMove={(event) => { if (rolling || event.pointerType !== "mouse") return; scrub(event.clientX, event.clientY); }}
          onPointerDown={(event) => { if (rolling) return; endScrub(); const next = interactionAt(event.clientX, event.clientY); if (next) selectMarket(next, true); }}>
          Ethereum annual-ring market chart. Equivalent period and event controls are available around the chart.
        </canvas>
        <p id="rings-instructions" className="sr-only">Trace the grain. Hover or tap to read a month. Select a knot for its note.</p>
        {/* The outer ring is unfinished; the introduction says so, and until now
            nothing on the plate showed it. One slow breath at the growing edge. */}
        <span ref={frontierRef} className="growth-frontier" aria-hidden="true" />
      </div>
      <aside id="rings-readout" className="selected-mark" aria-label="Selected ring segment">
        <WipeIn wipeKey={String(commitSeq)}>
          {selectedEvent ? <EventNote item={selectedEvent} /> : selectedMonthEvents.length ? <><p className="edge-label">Selected ring segment</p><div className="month-event-list">{selectedMonthEvents.map((item) => <button key={`${item.kind}:${item.record.id}`} type="button" onClick={() => selectEvent({ kind: item.kind, id: item.record.id }, true)}><strong>{item.record.name}</strong><small>{item.record.summary}</small></button>)}</div></> : <><p className="edge-label">Selected ring segment</p><p><NoteLine text="No recorded events this month." annotate={cues.note} firstPass={!noteSettled} onTyped={() => setNoteSettled(true)} /></p></>}
        </WipeIn>
      </aside>
      <nav className="stage-more" aria-label="More about this archive"><button type="button" onClick={() => setDialog("key")}>How to read</button><button type="button" onClick={() => setDialog("events")}>All marks</button><button type="button" onClick={() => setDialog("data")}>Data & source</button><button type="button" onClick={() => setDialog("method")}>Method</button></nav>
      <footer className="stage-credit">By <a href="https://www.linkedin.com/in/franndalmasso" target="_blank" rel="noreferrer">Fran Dalmasso ↗</a><span aria-hidden="true">·</span><a href="https://github.com/0xFrann/ethereum-tree-seams" target="_blank" rel="noreferrer">Code ↗</a></footer>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announceSelection ? `${periodLabel} selected. ${priceSummary}${selectedEvent ? ` Milestone: ${selectedEvent.record.name}.` : ""}` : ""}</p>
      {dialog === "events" ? <StageDialog title="Knots" onClose={() => setDialog(null)}><div className="dialog-event-list">{timelineEvents.map((item) => <button key={`${item.kind}:${item.record.id}`} type="button" onClick={() => { selectEvent({ kind: item.kind, id: item.record.id }, true); setDialog(null); }}><span>{formatDate(item.record.date)}</span><strong>{item.record.name}</strong><small>{item.record.summary}</small></button>)}</div></StageDialog> : null}
      {dialog === "key" ? <StageDialog title="How to read the rings" onClose={() => setDialog(null)}><ul className="dialog-key">
        <li><KeyMark path={KEY_RING_SHAPE} kind="line" />Ring shape — price</li>
        <li><KeyMark path={KEY_RING_WEIGHT} kind="band" />Ring weight — volume</li>
        <li><KeyMark path={KEY_KNOT} kind="knot" />Knots — protocol milestones</li>
      </ul></StageDialog> : null}
      {dialog === "data" ? <StageDialog title="Data and source" onClose={() => setDialog(null)}><dl className="dialog-data"><div><dt>Market</dt><dd>{data.source.market}</dd></div><div><dt>Provider</dt><dd>{data.source.provider}</dd></div><div><dt>Source cutoff</dt><dd>{formatDate(data.source.cutoff)}</dd></div><div><dt>Observed days</dt><dd>{data.source.observedRows.toLocaleString("en-US")}</dd></div></dl><p>{data.methodology.caveat}</p><p>{data.source.gaps.length ? `${data.source.gaps.length} source day${data.source.gaps.length === 1 ? " is" : "s are"} missing; none are filled.` : "No missing source days detected."}</p><a href={data.source.url} target="_blank" rel="noreferrer">Open the Bitstamp source ↗</a></StageDialog> : null}
      {dialog === "method" ? <StageDialog title="How the rings are built" onClose={() => setDialog(null)}><div className="dialog-method"><p><b>Price shape</b>{data.methodology.price}</p><p><b>Ring weight</b>{data.methodology.volume}</p><p><b>Additive growth</b>Each year grows outside the last, preserving enough clearance for the grain to remain legible.</p></div></StageDialog> : null}
    </section>
  );
}

/**
 * A knot's note. Selecting a knot is always a deliberate act — hovering the
 * plate never sets one — so its name is struck fresh each time. The summary
 * only wipes: at typing speed a two-line paragraph would keep the reader
 * waiting for the very thing they just asked to read.
 */
function EventNote({ item }: { item: TimelineEvent }) {
  return <><p className="edge-label">{formatDate(item.record.date)}</p><h2><TypeOn key={item.record.id} text={item.record.name} start /></h2><p>{item.record.summary}</p><a className="event-source" href={item.record.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Read the primary source for ${item.record.name}`}>↗</a></>;
}

/**
 * The month note types itself once, when the sheet is first annotated, and is
 * plain text from then on. Hovering the plate walks through a dozen segments a
 * second and most of them carry this same sentence; re-striking it every time
 * would be the loudest thing on the page.
 */
function NoteLine({ text, annotate, firstPass, onTyped }: { text: string; annotate: boolean; firstPass: boolean; onTyped: () => void }) {
  if (!annotate) return <span className="typed" style={{ visibility: "hidden" }}>{text}</span>;
  if (firstPass) return <TypeOn text={text} start onDone={onTyped} />;
  return <>{text}</>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
