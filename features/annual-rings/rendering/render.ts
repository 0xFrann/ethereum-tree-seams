import { drawEvents } from './events';
import { drawPaper } from './paper';
import { drawAnnualRings } from './rings';
import type { CanvasSize, RenderState } from './types';

export function renderAnnualRings(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  state: RenderState,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  drawPaper(context, size);
  drawAnnualRings(context, size.width, size.height, state);
  drawEvents(context, size.width, size.height, state);
}
