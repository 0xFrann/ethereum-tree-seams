// The plate tells the paper where its bark is.
//
// The Turing pattern is grown across the whole sheet, but it must stop at the
// bark so that nothing but paper sits under the rings. The plate knows its own
// outline and the paper does not, so the plate publishes it here whenever the
// geometry is rebuilt, and the paper reads it back in viewport terms when it
// draws. A plain module store keeps the two components from having to know
// about each other beyond this one shape.

export type PlateMask = {
  /** The plate's canvas, measured by the paper when it draws. */
  element: HTMLElement;
  /** The CSS-pixel size the radii were built against. */
  size: number;
  /** The bark's outer radius, in CSS pixels, at each of the renderer's samples
   *  from twelve o'clock clockwise. */
  radii: readonly number[];
};

type Listener = (mask: PlateMask | null) => void;

let current: PlateMask | null = null;
const listeners = new Set<Listener>();

export function publishPlate(mask: PlateMask | null) {
  current = mask;
  listeners.forEach((listener) => listener(mask));
}

export function readPlate() {
  return current;
}

export function subscribePlate(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
