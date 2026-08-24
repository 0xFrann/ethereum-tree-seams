import { eventAnchors } from '../geometry/events';
import type { RenderState } from './types';

export function drawEvents(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState,
): void {
  const anchors = eventAnchors(
    { x: width / 2, y: height / 2 },
    state.data.years,
    state.data.milestones,
    state.data.scars,
  );
  for (const anchor of anchors) {
    const selected = state.eventSelection?.id === anchor.id;
    context.fillStyle = anchor.kind === 'scar' ? '#8f422c' : '#2f7048';
    context.globalAlpha = selected ? 1 : 0.75;
    context.beginPath();
    context.arc(anchor.x, anchor.y, selected ? 5 : 3, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}
