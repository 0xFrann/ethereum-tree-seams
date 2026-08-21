"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { compactUsd, priceUsd, signedPercent } from "./eth-rings/format";
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

type TimelineEvent =
  | { kind: "milestone"; record: Milestone }
  | { kind: "scar"; record: Scar };

function ProjectIntro() {
  return (
    <header className="project-intro">
      <h1 id="page-title">Spec_ID · ETH_TREE_001</h1>
      <nav className="utility-nav" aria-label="Project links">
        <a className="utility-link" href="https://www.linkedin.com/in/franndalmasso" target="_blank" rel="noreferrer">LinkedIn ↗</a>
        <a className="utility-link" href="https://github.com/0xFrann/ethereum-tree-seams" target="_blank" rel="noreferrer">Code ↗</a>
      </nav>
      <p className="dek">ETH/USD growth, grain, and scars rendered as a living market archive.</p>
    </header>
  );
}

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

  if (loadState.status === "loading") {
    return (
      <section className="explorer" aria-busy="true">
        <div className="explorer-layout">
          <div ref={entryTargetRef as RefObject<HTMLDivElement | null>} id="rings-explorer-entry" className="visualization explorer-state" tabIndex={-1} onFocus={() => { pendingEntryFocus.current = true; }}>
            <p className="state-kicker">Preparing specimen</p>
            <p role="status">Loading the cached Bitstamp market history…</p>
          </div>
          <div className="instrument-column"><ProjectIntro /></div>
        </div>
      </section>
    );
  }

  if (loadState.status === "error") {
    return (
      <section className="explorer">
        <div className="explorer-layout">
          <div id="rings-explorer-entry" className="visualization explorer-state" role="alert" tabIndex={-1}>
            <p className="state-kicker">Market specimen unavailable</p>
            <p>{loadState.message}</p>
            <button
              ref={retryRef}
              type="button"
              className="retry-button"
              onClick={() => {
                pendingEntryFocus.current = true;
                marketDataRequest = null;
                setLoadState({ status: "loading" });
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
          <div className="instrument-column"><ProjectIntro /></div>
        </div>
      </section>
    );
  }

  return <EthRingsExplorer data={loadState.data} entryTargetRef={entryTargetRef} />;
}

function EthRingsExplorer({ data, entryTargetRef }: { data: MarketData; entryTargetRef: RefObject<HTMLElement | null> }) {
  const latestYearIndex = data.years.length - 1;
  const latestMonth = data.years[latestYearIndex].months.at(-1)?.month ?? 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geometryRef = useRef<Geometry | null>(null);
  const cacheRef = useRef<HTMLCanvasElement | null>(null);
  const idleSelection = useMemo<Selection>(
    () => ({ yearIndex: latestYearIndex, month: latestMonth }),
    [latestMonth, latestYearIndex],
  );
  const [selection, setSelection] = useState<Selection>(idleSelection);
  const [announceSelection, setAnnounceSelection] = useState(true);
  const selectionRef = useRef(selection);

  useEffect(() => { selectionRef.current = selection; }, [selection]);

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

  const eventSelectionsForMarket = useCallback(
    (next: Selection) => eventsForMarket(next)
      .map((item): Exclude<EventSelection, null> => ({ kind: item.kind, id: item.record.id })),
    [eventsForMarket],
  );

  const selectedEvents = eventsForMarket(selection);

  const selectMarket = useCallback((next: Selection, announce: boolean) => {
    setAnnounceSelection(announce);
    setSelection((current) =>
      current.yearIndex === next.yearIndex && current.month === next.month ? current : next,
    );
  }, []);

  const restoreIdleSelection = useCallback(() => {
    selectMarket(idleSelection, false);
  }, [idleSelection, selectMarket]);

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
    drawSelection(
      context,
      data,
      geometry,
      selectionRef.current,
      styles.getPropertyValue("--ring-accent").trim(),
      styles.getPropertyValue("--paper").trim(),
    );
    eventSelectionsForMarket(selectionRef.current).forEach((item) =>
      drawEventSelection(context, geometry, item, styles.getPropertyValue("--ring-event-accent").trim()),
    );
  }, [data, eventSelectionsForMarket]);

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
          ink: styles.getPropertyValue("--ring-ink").trim(),
          grain: styles.getPropertyValue("--ring-grain").trim(),
          muted: styles.getPropertyValue("--ring-muted").trim(),
          bark: styles.getPropertyValue("--ring-bark").trim(),
        });
        cacheRef.current = cache;
        context.clearRect(0, 0, size, size);
        context.drawImage(cache, 0, 0, size, size);
        drawSelection(
          context,
          data,
          geometry,
          selectionRef.current,
          styles.getPropertyValue("--ring-accent").trim(),
          styles.getPropertyValue("--paper").trim(),
        );
        eventSelectionsForMarket(selectionRef.current).forEach((item) =>
          drawEventSelection(context, geometry, item, styles.getPropertyValue("--ring-event-accent").trim()),
        );
      });
    };
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [data, eventSelectionsForMarket]);

  useEffect(paintSelection, [paintSelection, selection]);

  const marketAt = useCallback((clientX: number, clientY: number, pointer: "fine" | "coarse") => {
    const canvas = canvasRef.current;
    const geometry = geometryRef.current;
    if (!canvas || !geometry) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const event = hitTestEvent(geometry, x, y, pointer);
    if (event) {
      const item = timelineEvents.find((candidate) =>
        candidate.kind === event.kind && candidate.record.id === event.id,
      );
      if (item) {
        const [eventYear, eventMonth] = item.record.date.split("-").map(Number);
        const yearIndex = data.years.findIndex((candidate) => candidate.year === eventYear);
        if (yearIndex >= 0 && data.years[yearIndex].months.some((candidate) => candidate.month === eventMonth - 1)) {
          return { yearIndex, month: eventMonth - 1 };
        }
      }
    }
    return hitTest(geometry, x, y);
  }, [data.years, timelineEvents]);

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

  const annualRange = `${priceUsd(year.annual.low)}—${priceUsd(year.annual.high)}`;
  const currentOpen = year.year === data.years.at(-1)?.year && year.progress < 1;

  return (
    <section className="explorer" aria-label="Ethereum annual rings explorer">
      <div className="explorer-layout">
        <div className="visualization">
          <div className="canvas-shell">
            <canvas
              id="rings-explorer-entry"
              ref={(node) => {
                canvasRef.current = node;
                entryTargetRef.current = node;
              }}
              className="rings-canvas"
              role="group"
              aria-roledescription="interactive chart"
              tabIndex={0}
              aria-label={`Interactive Ethereum annual rings. Selected ${MONTHS[selection.month]} ${year.year}, monthly return ${signedPercent(month.returnPct)}. Month details include every knot and scar. Use left and right arrows for observed months, up and down arrows for years.`}
              aria-describedby="rings-instructions rings-readout"
              onKeyDown={handleCanvasKeyDown}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") restoreIdleSelection();
              }}
              onPointerMove={(event) => {
                if (event.pointerType !== "mouse") return;
                const market = marketAt(event.clientX, event.clientY, "fine");
                if (market) selectMarket(market, false);
                else restoreIdleSelection();
              }}
              onPointerDown={(event) => {
                const market = marketAt(
                  event.clientX,
                  event.clientY,
                  event.pointerType === "mouse" ? "fine" : "coarse",
                );
                if (market) selectMarket(market, true);
              }}
            >
              Ethereum annual-ring market chart. Equivalent year and month controls follow the chart.
            </canvas>
            <div className="canvas-center" aria-hidden="true">
              <span>Origin</span>
              <strong>{data.chronology.origin.replaceAll("-", "·")}</strong>
            </div>
            <div className="canvas-instrument selection-stamp" aria-hidden="true">
              <span>Observed</span>
              <strong>{MONTHS[selection.month]} {year.year}</strong>
              {currentOpen ? <em>Open</em> : null}
            </div>
            <div className="canvas-instrument return-stamp" aria-hidden="true">
              <span>Monthly return</span>
              <strong className={month.returnPct >= 0 ? "positive" : "negative"}>{signedPercent(month.returnPct)}</strong>
            </div>
            <div className="canvas-instrument graph-key" aria-label="Visual encoding legend">
              <span><i className="key-line" aria-hidden="true" /><b>Ring shape:</b> Price</span>
              <span><i className="key-weight" aria-hidden="true" /><b>Weight:</b> Volume</span>
              <span><i className="key-knot" aria-hidden="true" /><b>Knots:</b> Milestones</span>
              <span><i className="key-scar" aria-hidden="true" /><b>Scars:</b> Magnitude</span>
            </div>
            <div className="canvas-instrument source-note">
              <span>Sources</span>
              <p><a href={data.source.url} target="_blank" rel="noreferrer">Market data ↗</a> · <a href="#events">Events ↓</a> · <a href="#method">Method ↓</a></p>
              <small>* Price history starts {formatDate(data.chronology.marketDataFrom)}; the experiment origin is {formatDate(data.chronology.origin)}.</small>
            </div>
          </div>
          <p id="rings-instructions" className="sr-only">Trace the grain. Hover or tap to read a month.</p>
        </div>

        <div className="instrument-column">
          <ProjectIntro />

          <div className="specimen-meta" aria-label="Live specimen metadata">
            <div><span>Origin</span><strong>{formatDate(data.chronology.origin)}</strong></div>
            <div><span>First market data</span><strong>{formatDate(data.chronology.marketDataFrom)}</strong></div>
            <div><span>Updated</span><strong>{formatTimestamp(data.cache.updatedAt)}</strong></div>
          </div>

          <aside className="explorer-panel" aria-label="Market instrument panel">
          <div className="explorer-controls" aria-label="Choose a year and month">
            <div className="selector-block">
              <p className="selector-label">Market year</p>
              <div className="year-tabs" role="group" aria-label="Market year">
                {data.years.map((item, index) => (
                  <button key={item.year} type="button" className="year-button" aria-pressed={selection.yearIndex === index} onClick={() => selectYear(index)}>
                    {item.year}
                  </button>
                ))}
              </div>
            </div>
            <div className="selector-block">
              <p className="selector-label">Observed month</p>
              <div className="month-tabs" role="group" aria-label="Observed month">
                {MONTHS.map((name, index) => {
                  const available = year.months.some((item) => item.month === index);
                  return (
                    <button key={name} type="button" className="month-button" disabled={!available} aria-pressed={selection.month === index} onClick={() => selectMarket({ ...selection, month: index }, true)}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <section id="rings-readout" className="readout" aria-label={`${MONTHS[selection.month]} ${year.year} market details`}>
            <div className="price-movement" aria-label={`Opened at ${priceUsd(month.open)} and closed at ${priceUsd(month.close)}`}>
              <div><span>Open</span><strong>{priceUsd(month.open)}</strong></div><span className="price-arrow" aria-hidden="true">→</span><div><span>Close</span><strong>{priceUsd(month.close)}</strong></div>
            </div>
            <dl className="readout-grid">
              <div><dt>Volume</dt><dd>{compactUsd(month.volumeUsd)}</dd></div>
              <div><dt>Year return</dt><dd className={year.annual.returnPct >= 0 ? "positive" : "negative"}>{signedPercent(year.annual.returnPct)}</dd></div>
              <div><dt>Observed range</dt><dd>{annualRange}</dd></div>
            </dl>

            {selectedEvents.map((item) => (
              <div className="event-detail" key={`${item.kind}:${item.record.id}`}>
                <p className="event-type">{item.kind === "milestone" ? "Milestone" : "Scar"} · {formatDate(item.record.date)}</p>
                <h2>{item.record.name}</h2>
                <p>{item.record.summary}</p>
                {item.kind === "scar" ? <><p><strong>Affected layer:</strong> {item.record.affectedLayer}</p><p><strong>Reported impact:</strong> {item.record.reportedImpact}</p><p><strong>Outcome:</strong> {item.record.recoveryStatus}</p></> : <p><strong>Category:</strong> {item.record.category}{item.record.activation ? ` · ${item.record.activation}` : ""}</p>}
                <p><strong>Confidence:</strong> {item.record.confidence}</p>
                <a href={item.record.sourceUrl} target="_blank" rel="noreferrer">Primary source ↗</a>
              </div>
            ))}
          </section>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announceSelection
              ? `${MONTHS[selection.month]} ${year.year} selected. Monthly return ${signedPercent(month.returnPct)}.${selectedEvents.length ? ` Events: ${selectedEvents.map((item) => item.record.name).join(", ")}.` : ""}`
              : ""}
          </p>
          </aside>
        </div>
      </div>

      <section id="events" className="event-index" aria-labelledby="event-index-title">
        <div><p className="section-index">Event chronology</p><h2 id="event-index-title">Knots and scars</h2></div>
        {timelineEvents.length ? (
          <div className="event-list">
            {timelineEvents.map((item) => {
              const key = `${item.kind}:${item.record.id}`;
              return (
                <article key={key} className="event-card">
                  <span>{item.kind === "milestone" ? "Milestone" : "Scar"}</span><strong>{item.record.name}</strong><time dateTime={item.record.date}>{formatDate(item.record.date)}</time>
                </article>
              );
            })}
          </div>
        ) : <p>No protocol milestones or security scars are available for this view.</p>}
      </section>

      <section id="method" className="methodology" aria-labelledby="method-title">
        <div><p className="section-index">Methodology</p><h2 id="method-title">How the rings are built</h2></div>
        <div className="methodology-content">
          <div className="method-steps">
            <article>
              <b>01 / Price shape</b>
              <p>Four close-price samples per month → ln(price) → −1…+1 within each observed year → a smooth 360° contour.</p>
            </article>
            <article>
              <b>02 / Ring weight</b>
              <p>Monthly average daily USD volume → log<sub>10</sub>(volume) → 0…1 across the full observed period → line thickness.</p>
            </article>
            <article>
              <b>03 / Additive growth</b>
              <code>R<sub>y</sub>(θ) = R<sub>y−1</sub>(θ) + 0.9g + 0.39g · price<sub>y</sub>(θ)</code>
              <p>Each year grows outside the last. The clearance prevents collisions and favors a legible, organic form over a shared radial price scale.</p>
            </article>
          </div>
          <div className="source-boundary">
            <p>{data.methodology.caveat}</p>
            <p>Knot and scar details, including primary sources, appear with the month that contains them.</p>
            <p>Source boundary: {data.source.timezone}. {data.source.gaps.length ? `${data.source.gaps.length} missing source day${data.source.gaps.length === 1 ? "" : "s"}: ${data.source.gaps.join(", ")}.` : "No missing source days detected."}</p>
            <a href={data.source.url} target="_blank" rel="noreferrer">CryptoDataDownload Bitstamp source ↗</a>
          </div>
        </div>
      </section>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC", timeZoneName: "short" }).format(new Date(value));
}
