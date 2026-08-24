import type { CanvasSize } from './types';

export function resizeCanvas(canvas: HTMLCanvasElement): CanvasSize {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext('2d');
  context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height, pixelRatio };
}
