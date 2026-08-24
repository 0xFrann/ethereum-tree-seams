'use client';

import { useEffect, type RefObject } from 'react';
import { renderAnnualRings } from '../rendering/render';
import { resizeCanvas } from '../rendering/canvas';
import type { RenderState } from '../rendering/types';

export function useRingCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  state: RenderState,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => renderAnnualRings(canvas, resizeCanvas(canvas), state);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [canvasRef, state]);
}
