'use client';

import { useRef } from 'react';
import { monthAtPoint } from '../geometry/month-target';
import { useRingCanvas } from '../hooks/use-ring-canvas';
import type { RenderState } from '../rendering/types';
import type { MonthSelection } from '../domain/types';

type RingCanvasProps = {
  state: RenderState;
  onSelect: (selection: MonthSelection) => void;
  onMove: (offset: number) => void;
};

export function RingCanvas({ state, onSelect, onMove }: RingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useRingCanvas(canvasRef, state);

  return (
    <canvas
      ref={canvasRef}
      className="rings-canvas"
      tabIndex={0}
      aria-label="Annual rings graph. Use left and right arrow keys to move between observed months."
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') onMove(-1);
        if (event.key === 'ArrowRight') onMove(1);
      }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const selection = monthAtPoint(
          state.data,
          { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
          { x: bounds.width / 2, y: bounds.height / 2 },
        );
        if (selection) onSelect(selection);
      }}
    />
  );
}
