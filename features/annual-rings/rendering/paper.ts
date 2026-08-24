import type { CanvasSize } from './types';

export function drawPaper(context: CanvasRenderingContext2D, size: CanvasSize): void {
  context.clearRect(0, 0, size.width, size.height);
  context.fillStyle = '#f2eee5';
  context.fillRect(0, 0, size.width, size.height);

  context.strokeStyle = 'rgba(31, 26, 21, 0.06)';
  context.lineWidth = 1;
  for (let radius = 38; radius < Math.min(size.width, size.height) / 2; radius += 32) {
    context.beginPath();
    context.arc(size.width / 2, size.height / 2, radius, 0, Math.PI * 2);
    context.stroke();
  }
}
