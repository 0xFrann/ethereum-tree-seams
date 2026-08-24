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
  type Scar,
  type Selection,
} from "./eth-rings/model";
import {
  buildGeometry,
  drawEventSelection,
  drawSelection,
  drawStaticArtwork,
  hitTest,
  hitTestEvent,
  type Geometry,
} from "./eth-rings/renderer";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: MarketData }
  | { status: "error"; message: string };
type DetailsDialog = "period" | "events" | "data" | "method" | "key" | null;
type TimelineEvent =
  | { kind: "milestone"; record: Milestone }
  | { kind: "scar"; record: Scar };
type InteractiveSelection = { market: Selection | null; event: EventSelection };

let marketDataRequest: Promise<MarketData> | null = null;

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

function StageTitle() {
  return (
    <header className="stage-title">
      <p>Computational dendrochronology</p>
      <h1>Ethereum Annual Rings</h1>
      <span>ETH/USD · daily market archive</span>
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
  const cacheRef = useRef<HTMLCanvasElement | null>(null);
  const idleSelection = useMemo<Selection>(() => ({ yearIndex: latestYearIndex, month: latestMonth }), [latestMonth, latestYearIndex]);
  const [selection, setSelection] = useState<Selection>(idleSelection);
  const [eventSelection, setEventSelection] = useState<EventSelection>(null);
  const [announceSelection, setAnnounceSelection] = useState(true);
  const [dialog, setDialog] = useState<DetailsDialog>(null);
  const selectionRef = useRef(selection);
  const eventSelectionRef = useRef(eventSelection);

  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { eventSelectionRef.current = eventSelection; }, [eventSelection]);

  const year = data.years[selection.yearIndex];
  const month = year.months.find((item) => item.month === selection.month) ?? year.months.at(-1)!;
  const timelineEvents = useMemo<TimelineEvent[]>(() => [
    ...data.milestones.map((record) => ({ kind: "milestone" as const, record })),
    ...data.scars.map((record) => ({ kind: "scar" as const, record })),
  ].sort((left, right) => left.record.date.localeCompare(right.record.date) || left.record.id.localeCompare(right.record.id)), [data]);
  const eventsForMarket = useCallback((next: Selection) => {
    const selectedYear = data.years[next.yearIndex]?.year;
    const prefix = `${selectedYear}-${String(next.month + 1).padStart(2, "0")}-`;
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
    const yearIndex = data.years.findIndex((candidate) => candidate.year === eventYear);
    return yearIndex >= 0 && data.years[yearIndex].months.some((candidate) => candidate.month === eventMonth - 1)
      ? { yearIndex, month: eventMonth - 1 }
      : null;
  }, [data.years, timelineEvents]);

  const selectMarket = useCallback((next: Selection, announce: boolean, nextEvent: EventSelection = null) => {
    setAnnounceSelection(announce);
    setEventSelection(nextEvent);
    setSelection((current) => current.yearIndex === next.yearIndex && current.month === next.month ? current : next);
  }, []);
  const selectEvent = useCallback((nextEvent: Exclude<EventSelection, null>, announce: boolean) => {
    const market = marketForEvent(nextEvent);
    setAnnounceSelection(announce);
    setEventSelection(nextEvent);
    if (market) setSelection(market);
  }, [marketForEvent]);
  const restoreIdleSelection = useCallback(() => selectMarket(idleSelection, false), [idleSelection, selectMarket]);
  const selectYear = useCallback((yearIndex: number) => {
    const available = data.years[yearIndex].months.map((item) => item.month);
    const nextMonth = available.includes(selection.month)
      ? selection.month
      : available.reduce((best, candidate) => Math.abs(candidate - selection.month) < Math.abs(best - selection.month) ? candidate : best, available[0]);
    selectMarket({ yearIndex, month: nextMonth }, true);
  }, [data.years, selectMarket, selection.month]);

  const paintSelection = useCallback(() => {
    const canvas = canvasRef.current;
    const geometry = geometryRef.current;
    const cache = cacheRef.current;
    if (!canvas || !geometry || !cache) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, geometry.size, geometry.size);
    context.drawImage(cache, 0, 0, geometry.size, geometry.size);
    const styles = getComputedStyle(canvas);
    drawSelection(context, data, geometry, selectionRef.current, styles.getPropertyValue("--ring-accent").trim(), styles.getPropertyValue("--paper").trim());
    if (eventSelectionRef.current) drawEventSelection(context, geometry, eventSelectionRef.current, styles.getPropertyValue("--ring-event-accent").trim());
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const render = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const size = Math.max(1, Math.floor(canvas.getBoundingClientRect().width));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
        const context = canvas.getContext("2d");
        if (!context) return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cache = document.createElement("canvas");
        cache.width = Math.floor(size * dpr);
        cache.height = Math.floor(size * dpr);
        const cacheContext = cache.getContext("2d");
        if (!cacheContext) return;
        cacheContext.setTransform(dpr, 0, 0, dpr, 0, 0);
        const styles = getComputedStyle(canvas);
        const geometry = buildGeometry(data, size);
        geometryRef.current = geometry;
        drawStaticArtwork(cacheContext, data, geometry, {
          ink: styles.getPropertyValue("--ring-ink").trim(), grain: styles.getPropertyValue("--ring-grain").trim(), muted: styles.getPropertyValue("--ring-muted").trim(), bark: styles.getPropertyValue("--ring-bark").trim(),
        });
        cacheRef.current = cache;
        paintSelection();
      });
    };
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [data, paintSelection]);
  useEffect(paintSelection, [paintSelection, selection, eventSelection]);

  const interactionAt = useCallback((clientX: number, clientY: number, pointer: "fine" | "coarse"): InteractiveSelection => {
    const canvas = canvasRef.current;
    const geometry = geometryRef.current;
    if (!canvas || !geometry) return { market: null, event: null };
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const event = hitTestEvent(geometry, x, y, pointer);
    if (event) return { market: marketForEvent(event), event };
    return { market: hitTest(geometry, x, y), event: null };
  }, [marketForEvent]);

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const available = year.months.map((item) => item.month);
    const currentIndex = Math.max(0, available.indexOf(selection.month));
    const next = { ...selection };
    if (event.key === "ArrowRight") next.month = available[(currentIndex + 1) % available.length];
    else if (event.key === "ArrowLeft") next.month = available[(currentIndex + available.length - 1) % available.length];
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      next.yearIndex = Math.max(0, Math.min(data.years.length - 1, next.yearIndex + (event.key === "ArrowUp" ? 1 : -1)));
      const targetMonths = data.years[next.yearIndex].months.map((item) => item.month);
      next.month = targetMonths.includes(next.month) ? next.month : targetMonths.at(-1)!;
    } else if (event.key === "Home") next.month = available[0];
    else if (event.key === "End") next.month = available.at(-1)!;
    else return;
    event.preventDefault();
    selectMarket(next, true);
  };

  const currentOpen = year.year === data.years.at(-1)?.year && year.progress < 1;
  const periodLabel = `${MONTHS[selection.month]} ${year.year}${currentOpen ? " · open" : ""}`;
  const hasDetailedPriceStats = Number.isFinite(month.averageClose) && Number.isFinite(month.low) && Number.isFinite(month.high);
  const priceLow = hasDetailedPriceStats ? month.low! : Math.min(month.open, month.close);
  const priceHigh = hasDetailedPriceStats ? month.high! : Math.max(month.open, month.close);
  const averagePrice = hasDetailedPriceStats ? month.averageClose! : (month.open + month.close) / 2;
  const volatilityPercent = ((priceHigh - priceLow) / averagePrice) * 100;
  const volatilityLabel = `${volatilityPercent.toFixed(1)}%`;
  const priceSummary = `Observed price range ${priceUsd(priceLow)} to ${priceUsd(priceHigh)}. Range volatility is ${volatilityLabel} of the average price.`;

  return (
    <section className="explorer explorer-stage" aria-label="Ethereum annual rings explorer">
      <StageTitle />
      <dl className="stage-provenance" aria-label="Specimen provenance">
        <div><dt>Origin</dt><dd>{formatDate(data.chronology.origin)}</dd></div>
        <div><dt>First market data</dt><dd>{formatDate(data.chronology.marketDataFrom)}</dd></div>
        <div><dt>Updated</dt><dd>{formatTimestamp(data.cache.updatedAt)}</dd></div>
      </dl>
      <section className="stage-price" aria-label={`${periodLabel} price observations`}>
        <button type="button" className="period-button" onClick={() => setDialog("period")} aria-haspopup="dialog"><span>Selected period</span><strong>{periodLabel}</strong><i aria-hidden="true">⌄</i></button>
        <div className="price-movement" aria-label={priceSummary}><span>Observed price range</span><strong>{priceUsd(priceLow)}—{priceUsd(priceHigh)}</strong></div>
        <dl className="price-observations"><div><dt>Range volatility</dt><dd>{volatilityLabel}</dd></div><div><dt>Average price</dt><dd>{priceUsd(averagePrice)}</dd></div></dl>
      </section>
      <div className="graph-stage">
        <canvas id="rings-explorer-entry" ref={(node) => { canvasRef.current = node; entryTargetRef.current = node; }} className="rings-canvas" role="group" aria-roledescription="interactive chart" tabIndex={0}
          aria-label={`Interactive Ethereum annual rings. Selected ${periodLabel}; ${priceSummary} Use left and right arrows for observed months, up and down arrows for years.`}
          aria-describedby="rings-instructions rings-readout" onKeyDown={handleCanvasKeyDown}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") restoreIdleSelection(); }}
          onPointerMove={(event) => { if (event.pointerType !== "mouse") return; const next = interactionAt(event.clientX, event.clientY, "fine"); if (next.event) selectEvent(next.event, false); else if (next.market) selectMarket(next.market, false); else restoreIdleSelection(); }}
          onPointerDown={(event) => { const next = interactionAt(event.clientX, event.clientY, event.pointerType === "mouse" ? "fine" : "coarse"); if (next.event) selectEvent(next.event, true); else if (next.market) selectMarket(next.market, true); }}>
          Ethereum annual-ring market chart. Equivalent period and event controls are available around the chart.
        </canvas>
        <div className="canvas-center" aria-hidden="true"><span>Origin</span><strong>{data.chronology.origin.replaceAll("-", "·")}</strong></div>
        <p id="rings-instructions" className="sr-only">Trace the grain. Hover or tap to read a month. Select a knot or scar for its note.</p>
      </div>
      <aside id="rings-readout" className="selected-mark" aria-label="Selected knot or scar">
        {selectedEvent ? <EventNote item={selectedEvent} /> : selectedMonthEvents.length ? <><p className="edge-label">Marks this month</p><div className="month-event-list">{selectedMonthEvents.map((item) => <button key={`${item.kind}:${item.record.id}`} type="button" onClick={() => selectEvent({ kind: item.kind, id: item.record.id }, true)}>{item.record.name}</button>)}</div></> : <><p className="edge-label">Selected mark</p><p>No knots or scars in this month.</p></>}
      </aside>
      <nav className="stage-more" aria-label="More about this archive"><button type="button" onClick={() => setDialog("key")}>How to read</button><button type="button" onClick={() => setDialog("events")}>All marks</button><button type="button" onClick={() => setDialog("data")}>Data & source</button><button type="button" onClick={() => setDialog("method")}>Method</button></nav>
      <footer className="stage-credit">By <a href="https://www.linkedin.com/in/franndalmasso" target="_blank" rel="noreferrer">Fran Dalmasso ↗</a><span aria-hidden="true">·</span><a href="https://github.com/0xFrann/ethereum-tree-seams" target="_blank" rel="noreferrer">Code ↗</a></footer>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announceSelection ? `${periodLabel} selected. ${priceSummary}${selectedEvent ? ` ${selectedEvent.kind === "milestone" ? "Milestone" : "Scar"}: ${selectedEvent.record.name}.` : ""}` : ""}</p>
      {dialog === "period" ? <StageDialog title="Choose an observed period" onClose={() => setDialog(null)}><div className="dialog-selector"><p>Market year</p><div className="year-tabs" role="group" aria-label="Market year">{data.years.map((item, index) => <button key={item.year} type="button" className="year-button" aria-pressed={selection.yearIndex === index} onClick={() => selectYear(index)}>{item.year}</button>)}</div><p>Observed month</p><div className="month-tabs" role="group" aria-label="Observed month">{MONTHS.map((name, index) => { const available = year.months.some((item) => item.month === index); return <button key={name} type="button" className="month-button" disabled={!available} aria-pressed={selection.month === index} onClick={() => selectMarket({ ...selection, month: index }, true)}>{name}</button>; })}</div></div></StageDialog> : null}
      {dialog === "events" ? <StageDialog title="Knots and scars" onClose={() => setDialog(null)}><div className="dialog-event-list">{timelineEvents.map((item) => <button key={`${item.kind}:${item.record.id}`} type="button" onClick={() => { selectEvent({ kind: item.kind, id: item.record.id }, true); setDialog(null); }}><span>{item.kind === "milestone" ? "Knot · milestone" : "Scar"} · {formatDate(item.record.date)}</span><strong>{item.record.name}</strong><small>{item.record.summary}</small></button>)}</div></StageDialog> : null}
      {dialog === "key" ? <StageDialog title="How to read the rings" onClose={() => setDialog(null)}><ul className="dialog-key"><li><i className="key-line" aria-hidden="true" />Ring shape — price</li><li><i className="key-weight" aria-hidden="true" />Ring weight — volume</li><li><i className="key-knot" aria-hidden="true" />Knots — protocol milestones</li><li><i className="key-scar" aria-hidden="true" />Scar size — reported incident magnitude</li></ul></StageDialog> : null}
      {dialog === "data" ? <StageDialog title="Data and source" onClose={() => setDialog(null)}><dl className="dialog-data"><div><dt>Market</dt><dd>{data.source.market}</dd></div><div><dt>Provider</dt><dd>{data.source.provider}</dd></div><div><dt>Source cutoff</dt><dd>{formatDate(data.source.cutoff)}</dd></div><div><dt>Observed days</dt><dd>{data.source.observedRows.toLocaleString("en-US")}</dd></div></dl><p>{data.methodology.caveat}</p><p>{data.source.gaps.length ? `${data.source.gaps.length} source day${data.source.gaps.length === 1 ? " is" : "s are"} missing; none are filled.` : "No missing source days detected."}</p><a href={data.source.url} target="_blank" rel="noreferrer">Open the Bitstamp source ↗</a></StageDialog> : null}
      {dialog === "method" ? <StageDialog title="How the rings are built" onClose={() => setDialog(null)}><div className="dialog-method"><p><b>Price shape</b>{data.methodology.price}</p><p><b>Ring weight</b>{data.methodology.volume}</p><p><b>Additive growth</b>Each year grows outside the last, preserving enough clearance for the grain to remain legible.</p></div></StageDialog> : null}
    </section>
  );
}

function EventNote({ item }: { item: TimelineEvent }) {
  return <><p className="edge-label">{item.kind === "milestone" ? "Knot · milestone" : "Scar"} · {formatDate(item.record.date)}</p><h2>{item.record.name}</h2><p>{item.record.summary}</p>{item.kind === "scar" ? <p className="event-detail-line">{item.record.affectedLayer}</p> : null}<a className="event-source" href={item.record.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Read the primary source for ${item.record.name}`}>↗</a></>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC", timeZoneName: "short" }).format(new Date(value));
}
