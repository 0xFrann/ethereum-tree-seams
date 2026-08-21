"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { compactUsd, priceUsd, signedPercent } from "./eth-rings/format";
import { MONTHS, type MarketData, type Selection } from "./eth-rings/model";
import {
  buildGeometry,
  drawSelection,
  drawStaticArtwork,
  hitTest,
  type Geometry,
} from "./eth-rings/renderer";

export type { MarketData } from "./eth-rings/model";

export function EthRings({ data }: { data: MarketData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geometryRef = useRef<Geometry | null>(null);
  const cacheRef = useRef<HTMLCanvasElement | null>(null);
  const [selection, setSelection] = useState<Selection>({ yearIndex: data.years.length - 1, month: 11 });
  const selectionRef = useRef(selection);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const year = data.years[selection.yearIndex];
  const month = year.months[selection.month];
  const event = data.events.find((item) => item.year === year.year && item.month === selection.month);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const geometry = geometryRef.current;
    const cache = cacheRef.current;
    if (!canvas || !geometry || !cache) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, geometry.size, geometry.size);
    context.drawImage(cache, 0, 0, geometry.size, geometry.size);
    const accent = getComputedStyle(canvas).getPropertyValue("--ring-accent").trim();
    drawSelection(context, data, geometry, selection, accent);
  }, [data, selection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;

    const render = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = canvas.getBoundingClientRect();
        const size = Math.max(1, Math.floor(rect.width));
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
        });
        cacheRef.current = cache;
        context.clearRect(0, 0, size, size);
        context.drawImage(cache, 0, 0, size, size);
        drawSelection(context, data, geometry, selectionRef.current, styles.getPropertyValue("--ring-accent").trim());
      });
    };

    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [data]);

  useEffect(redraw, [redraw]);

  const selectFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const geometry = geometryRef.current;
    if (!canvas || !geometry) return;
    const rect = canvas.getBoundingClientRect();
    const nextSelection = hitTest(geometry, clientX - rect.left, clientY - rect.top);
    if (nextSelection) setSelection(nextSelection);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const next = { ...selection };
    if (event.key === "ArrowRight") next.month = (next.month + 1) % 12;
    else if (event.key === "ArrowLeft") next.month = (next.month + 11) % 12;
    else if (event.key === "ArrowUp") next.yearIndex = Math.min(data.years.length - 1, next.yearIndex + 1);
    else if (event.key === "ArrowDown") next.yearIndex = Math.max(0, next.yearIndex - 1);
    else if (event.key === "Home") next.month = 0;
    else if (event.key === "End") next.month = 11;
    else return;
    event.preventDefault();
    setSelection(next);
  };

  const annualRange = useMemo(() => `${priceUsd(year.annual.low)}—${priceUsd(year.annual.high)}`, [year]);

  return (
    <div className="explorer">
      <div className="canvas-shell">
        <canvas
          ref={canvasRef}
          className="rings-canvas"
          role="img"
          tabIndex={0}
          aria-label={`Interactive Ethereum annual rings. Selected ${MONTHS[selection.month]} ${year.year}. Use left and right arrows for months, up and down arrows for years.`}
          aria-describedby="rings-instructions rings-readout"
          onKeyDown={handleKeyDown}
          onPointerMove={(event) => event.pointerType === "mouse" && selectFromPointer(event.clientX, event.clientY)}
          onPointerDown={(event) => selectFromPointer(event.clientX, event.clientY)}
        />
        <div className="canvas-center" aria-hidden="true">
          <span className="eth-gem">◆</span>
          <strong>ETH</strong>
          <span>{data.period}</span>
        </div>
      </div>

      <p id="rings-instructions" className="interaction-hint">
        Hover or tap a ring. Keyboard: ← → month · ↑ ↓ year
      </p>

      <div className="explorer-controls" aria-label="Choose a year and month">
        <div className="year-tabs" role="group" aria-label="Year">
          {data.years.map((item, index) => (
            <button
              key={item.year}
              type="button"
              className="year-button"
              aria-pressed={selection.yearIndex === index}
              onClick={() => setSelection((current) => ({ ...current, yearIndex: index }))}
            >
              {item.year}
            </button>
          ))}
        </div>
        <div className="month-tabs" role="group" aria-label="Month">
          {MONTHS.map((name, index) => (
            <button
              key={name}
              type="button"
              className="month-button"
              aria-pressed={selection.month === index}
              onClick={() => setSelection((current) => ({ ...current, month: index }))}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <section id="rings-readout" className="readout" aria-live="polite" aria-atomic="true">
        <div className="readout-heading">
          <div>
            <p className="eyebrow">Selected segment</p>
            <h2>{MONTHS[selection.month]} {year.year}</h2>
          </div>
          <span className={month.returnPct >= 0 ? "positive return-pill" : "negative return-pill"}>
            {signedPercent(month.returnPct)}
          </span>
        </div>
        <dl className="readout-grid">
          <div><dt>Month</dt><dd>{priceUsd(month.open)} → {priceUsd(month.close)}</dd></div>
          <div><dt>Volume</dt><dd>{compactUsd(month.volumeUsd)}</dd></div>
          <div><dt>Year return</dt><dd>{signedPercent(year.annual.returnPct)}</dd></div>
          <div><dt>Year range</dt><dd>{annualRange}</dd></div>
        </dl>
        {event && (
          <p className="event-note">
            <span aria-hidden="true" className="knot-mark" />
            Knot: {event.name}, reported loss {event.loss}.{" "}
            <a href={event.sourceUrl} target="_blank" rel="noreferrer">Incident source ↗</a>
          </p>
        )}
      </section>
    </div>
  );
}
