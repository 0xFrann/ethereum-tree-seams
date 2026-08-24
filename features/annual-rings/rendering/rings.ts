import { annualRingSamples, type RingSample } from '../geometry/rings';
import type { RenderState } from './types';

export function drawAnnualRings(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState,
): RingSample[][] {
  const center = { x: width / 2, y: height / 2 };
  return state.data.years.map((year, index) => {
    const samples = annualRingSamples(center, year, index);
    if (samples.length === 0) return samples;
    context.beginPath();
    samples.forEach((sample, sampleIndex) => {
      if (sampleIndex === 0) context.moveTo(sample.x, sample.y);
      else context.lineTo(sample.x, sample.y);
    });
    context.strokeStyle = '#1f1a15';
    context.lineWidth = 1.2;
    context.globalAlpha = 0.78;
    context.stroke();
    drawSelectedMonth(
      context,
      samples,
      year.year === state.selection.year ? state.selection.month : null,
    );
    return samples;
  });
}

function drawSelectedMonth(
  context: CanvasRenderingContext2D,
  samples: RingSample[],
  month: number | null,
): void {
  const selected = samples.find((sample) => sample.month === month);
  if (!selected) return;
  context.globalAlpha = 1;
  context.fillStyle = '#8f422c';
  context.beginPath();
  context.arc(selected.x, selected.y, 4, 0, Math.PI * 2);
  context.fill();
}
