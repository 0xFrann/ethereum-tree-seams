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
  drawSelection,
  drawStaticArtwork,
  hitTest,
  type Geometry,
} from "./eth-rings/renderer";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: MarketData }
  | { status: "error"; message: string };
type DetailsDialog = "events" | "data" | "method" | "key" | null;
type TimelineEvent = { kind: "milestone"; record: Milestone };
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

function StageTitle({ data }: { data?: MarketData }) {
  return (
    <header className="stage-title">
      <p>Specimen</p>
      <h1>ETH_TREE_01</h1>
      {data ? <dl className="stage-provenance" aria-label="Specimen provenance">
        <div><dt>Origin</dt><dd>{formatDate(data.chronology.origin)}</dd></div>
        <div><dt>First market data</dt><dd>{formatDate(data.chronology.marketDataFrom)}</dd></div>
        <div><dt>Updated</dt><dd>{formatTimestamp(data.cache.updatedAt)}</dd></div>
      </dl> : null}
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
  const idleSelection = useMemo<Selection>(() => ({ year: data.years[latestYearIndex].year, month: latestMonth }), [data.years, latestMonth, latestYearIndex]);
  const [selection, setSelection] = useState<Selection>(idleSelection);
  const [eventSelection, setEventSelection] = useState<EventSelection>(null);
  const [announceSelection, setAnnounceSelection] = useState(true);
  const [dialog, setDialog] = useState<DetailsDialog>(null);
  const selectionRef = useRef(selection);
  const eventSelectionRef = useRef(eventSelection);

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
    setEventSelection(nextEvent);
    setSelection((current) => current.year === next.year && current.month === next.month ? current : next);
  }, []);
  const selectEvent = useCallback((nextEvent: Exclude<EventSelection, null>, announce: boolean) => {
    const market = marketForEvent(nextEvent);
    setAnnounceSelection(announce);
    setEventSelection(nextEvent);
    if (market) setSelection(market);
  }, [marketForEvent]);
  const restoreIdleSelection = useCallback(() => selectMarket(idleSelection, false), [idleSelection, selectMarket]);
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
    const paper = styles.getPropertyValue("--paper").trim();
    context.save();
    context.fillStyle = paper;
    context.globalAlpha = 0.3;
    context.fillRect(0, 0, geometry.size, geometry.size);
    context.restore();
    const ringAccent = styles.getPropertyValue("--ring-accent").trim();
    const ringInk = styles.getPropertyValue("--ring-ink").trim();
    drawSelection(context, data, geometry, selectionRef.current, ringAccent, cache, paper);
    if (eventSelectionRef.current) drawEventSelection(context, geometry, eventSelectionRef.current, ringInk);
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
          ink: styles.getPropertyValue("--ring-ink").trim(), grain: styles.getPropertyValue("--ring-grain").trim(), muted: styles.getPropertyValue("--ring-muted").trim(), mark: styles.getPropertyValue("--ring-mark").trim(), bark: styles.getPropertyValue("--ring-bark").trim(),
        });
        cacheRef.current = cache;
        paintSelection();
      });
    };
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    let disposed = false;
    document.fonts?.ready.then(() => {
      if (!disposed) render();
    });
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [data, paintSelection]);
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

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const currentYearIndex = marketYearIndex >= 0 ? marketYearIndex : latestYearIndex;
    const currentYear = data.years[currentYearIndex];
    const available = currentYear.months.map((item) => item.month);
    const currentIndex = Math.max(0, available.indexOf(selection.month));
    const next = { year: currentYear.year, month: selection.month };
    if (event.key === "ArrowRight") next.month = available[(currentIndex + 1) % available.length];
    else if (event.key === "ArrowLeft") next.month = available[(currentIndex + available.length - 1) % available.length];
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const nextYearIndex = Math.max(0, Math.min(data.years.length - 1, currentYearIndex + (event.key === "ArrowUp" ? 1 : -1)));
      next.year = data.years[nextYearIndex].year;
      const targetMonths = data.years[nextYearIndex].months.map((item) => item.month);
      next.month = targetMonths.includes(next.month) ? next.month : targetMonths.at(-1)!;
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

  return (
    <section className="explorer explorer-stage" aria-label="Ethereum annual rings explorer">
      <StageTitle data={data} />
      <section className="stage-price" aria-label={`${periodLabel}. ${priceSummary}`}>
        <p className="period-date">{periodLabel}</p>
        <p className="price-range">{priceLow === null || priceHigh === null ? "No market data" : <>{priceUsd(priceLow)}—{priceUsd(priceHigh)}</>}</p>
        {averagePrice === null ? null : <dl className="price-observations"><div><dt>Average</dt><dd>{priceUsd(averagePrice)}</dd></div><div><dt>Volatility</dt><dd>{volatilityLabel}</dd></div></dl>}
      </section>
      <div className="graph-stage">
        <canvas id="rings-explorer-entry" ref={(node) => { canvasRef.current = node; entryTargetRef.current = node; }} className="rings-canvas" role="group" aria-roledescription="interactive chart" tabIndex={0}
          aria-label={`Interactive Ethereum annual rings. Selected ${periodLabel}; ${priceSummary} Use left and right arrows for observed months, up and down arrows for years.`}
          aria-describedby="rings-instructions rings-readout" onKeyDown={handleCanvasKeyDown}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") restoreIdleSelection(); }}
          onPointerMove={(event) => { if (event.pointerType !== "mouse") return; const next = interactionAt(event.clientX, event.clientY); if (next) selectMarket(next, false); else restoreIdleSelection(); }}
          onPointerDown={(event) => { const next = interactionAt(event.clientX, event.clientY); if (next) selectMarket(next, true); }}>
          Ethereum annual-ring market chart. Equivalent period and event controls are available around the chart.
        </canvas>
        <p id="rings-instructions" className="sr-only">Trace the grain. Hover or tap to read a month. Select a knot for its note.</p>
      </div>
      <aside id="rings-readout" className="selected-mark" aria-label="Selected ring segment">
        {selectedEvent ? <EventNote item={selectedEvent} /> : selectedMonthEvents.length ? <><p className="edge-label">Selected ring segment</p><div className="month-event-list">{selectedMonthEvents.map((item) => <button key={`${item.kind}:${item.record.id}`} type="button" onClick={() => selectEvent({ kind: item.kind, id: item.record.id }, true)}><strong>{item.record.name}</strong><small>{item.record.summary}</small></button>)}</div></> : <><p className="edge-label">Selected ring segment</p><p>No recorded events this month.</p></>}
      </aside>
      <nav className="stage-more" aria-label="More about this archive"><button type="button" onClick={() => setDialog("key")}>How to read</button><button type="button" onClick={() => setDialog("events")}>All marks</button><button type="button" onClick={() => setDialog("data")}>Data & source</button><button type="button" onClick={() => setDialog("method")}>Method</button></nav>
      <footer className="stage-credit">By <a href="https://www.linkedin.com/in/franndalmasso" target="_blank" rel="noreferrer">Fran Dalmasso ↗</a><span aria-hidden="true">·</span><a href="https://github.com/0xFrann/ethereum-tree-seams" target="_blank" rel="noreferrer">Code ↗</a></footer>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announceSelection ? `${periodLabel} selected. ${priceSummary}${selectedEvent ? ` Milestone: ${selectedEvent.record.name}.` : ""}` : ""}</p>
      {dialog === "events" ? <StageDialog title="Knots" onClose={() => setDialog(null)}><div className="dialog-event-list">{timelineEvents.map((item) => <button key={`${item.kind}:${item.record.id}`} type="button" onClick={() => { selectEvent({ kind: item.kind, id: item.record.id }, true); setDialog(null); }}><span>{formatDate(item.record.date)}</span><strong>{item.record.name}</strong><small>{item.record.summary}</small></button>)}</div></StageDialog> : null}
      {dialog === "key" ? <StageDialog title="How to read the rings" onClose={() => setDialog(null)}><ul className="dialog-key"><li><i className="key-line" aria-hidden="true" />Ring shape — price</li><li><i className="key-weight" aria-hidden="true" />Ring weight — volume</li><li><i className="key-knot" aria-hidden="true" />Knots — protocol milestones</li></ul></StageDialog> : null}
      {dialog === "data" ? <StageDialog title="Data and source" onClose={() => setDialog(null)}><dl className="dialog-data"><div><dt>Market</dt><dd>{data.source.market}</dd></div><div><dt>Provider</dt><dd>{data.source.provider}</dd></div><div><dt>Source cutoff</dt><dd>{formatDate(data.source.cutoff)}</dd></div><div><dt>Observed days</dt><dd>{data.source.observedRows.toLocaleString("en-US")}</dd></div></dl><p>{data.methodology.caveat}</p><p>{data.source.gaps.length ? `${data.source.gaps.length} source day${data.source.gaps.length === 1 ? " is" : "s are"} missing; none are filled.` : "No missing source days detected."}</p><a href={data.source.url} target="_blank" rel="noreferrer">Open the Bitstamp source ↗</a></StageDialog> : null}
      {dialog === "method" ? <StageDialog title="How the rings are built" onClose={() => setDialog(null)}><div className="dialog-method"><p><b>Price shape</b>{data.methodology.price}</p><p><b>Ring weight</b>{data.methodology.volume}</p><p><b>Additive growth</b>Each year grows outside the last, preserving enough clearance for the grain to remain legible.</p></div></StageDialog> : null}
    </section>
  );
}

function EventNote({ item }: { item: TimelineEvent }) {
  return <><p className="edge-label">{formatDate(item.record.date)}</p><h2>{item.record.name}</h2><p>{item.record.summary}</p><a className="event-source" href={item.record.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Read the primary source for ${item.record.name}`}>↗</a></>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
