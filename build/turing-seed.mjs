// Settles the paper's Turing pattern once, so the sheet never has to.
//
//   pnpm run pattern          (node build/turing-seed.mjs [out] [size] [steps])
//
// The reaction that moves on the page (app/components/PaperPattern.tsx) is a
// Gray-Scott reaction–diffusion. Growing it from nothing to a finished
// labyrinth costs the reader's GPU several hundred steps over the whole
// viewport before anything can be shown. This script runs that growth here
// instead, on a periodic grid so the result tiles without a seam, and writes
// the settled state — U in the red channel, V doubled in the green, each kept
// to QUANT_BITS so the file stays small — to a PNG. The page seeds its own
// field from that tile, laid in a brick offset so the repeat is hard to find,
// and only has to keep it moving. A PNG is used purely as a compact, natively
// decoded carrier for the two channels; nothing in it is drawn to the screen
// as it is.
//
// The reaction constants must match PaperPattern.tsx, or the seed would keep
// re-settling on the page.

import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

const [, , outPath = "public/turing-seed.png", sizeArg = "256", stepsArg = "3000"] = process.argv;
const size = Number(sizeArg);
const steps = Number(stepsArg);

const FEED = 0.037;
const KILL = 0.06;
const DIFFUSE_U = 0.2;
const DIFFUSE_V = 0.1;
const SEED_FRACTION = 0.25;
const V_SCALE = 2;
const QUANT_BITS = 6;
const SEED = 0x7e7e;

// A small deterministic generator (mulberry32) so the tile is reproducible.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate() {
  const count = size * size;
  let u = new Float32Array(count).fill(1);
  let v = new Float32Array(count).fill(0);
  let nextU = new Float32Array(count);
  let nextV = new Float32Array(count);
  const rand = random(SEED);
  for (let i = 0; i < count; i += 1) {
    if (rand() < SEED_FRACTION) {
      u[i] = 0.5;
      v[i] = 0.25;
    }
  }
  for (let step = 0; step < steps; step += 1) {
    for (let y = 0; y < size; y += 1) {
      const up = ((y + size - 1) % size) * size;
      const row = y * size;
      const down = ((y + 1) % size) * size;
      for (let x = 0; x < size; x += 1) {
        const left = (x + size - 1) % size;
        const right = (x + 1) % size;
        const i = row + x;
        // Nine-point Laplacian on the torus.
        const lapU =
          0.05 * (u[up + left] + u[up + right] + u[down + left] + u[down + right]) +
          0.2 * (u[up + x] + u[down + x] + u[row + left] + u[row + right]) -
          u[i];
        const lapV =
          0.05 * (v[up + left] + v[up + right] + v[down + left] + v[down + right]) +
          0.2 * (v[up + x] + v[down + x] + v[row + left] + v[row + right]) -
          v[i];
        const uvv = u[i] * v[i] * v[i];
        nextU[i] = u[i] + DIFFUSE_U * lapU - uvv + FEED * (1 - u[i]);
        nextV[i] = v[i] + DIFFUSE_V * lapV + uvv - (FEED + KILL) * v[i];
      }
    }
    [u, nextU] = [nextU, u];
    [v, nextV] = [nextV, v];
  }
  return { u, v };
}

function toBytes({ u, v }) {
  const bytes = new Uint8Array(size * size * 3);
  const mask = (0xff << (8 - QUANT_BITS)) & 0xff;
  const quantise = (value) => Math.round(255 * Math.min(1, Math.max(0, value))) & mask;
  let peak = 0;
  for (let i = 0; i < u.length; i += 1) {
    peak = Math.max(peak, v[i]);
    bytes[i * 3] = quantise(u[i]);
    bytes[i * 3 + 1] = quantise(v[i] * V_SCALE);
  }
  if (peak * V_SCALE > 1) throw new Error(`V peaks at ${peak}; V_SCALE ${V_SCALE} would clip it`);
  return { bytes, peak };
}

// --- Minimal PNG writer: 8-bit RGB, Paeth-filtered rows. ---------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function encodePng(bytes) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 4;
    for (let x = 0; x < stride; x += 1) {
      const here = bytes[y * stride + x];
      const a = x >= 3 ? bytes[y * stride + x - 3] : 0;
      const b = y > 0 ? bytes[(y - 1) * stride + x] : 0;
      const c = x >= 3 && y > 0 ? bytes[(y - 1) * stride + x - 3] : 0;
      raw[y * (stride + 1) + 1 + x] = (here - paeth(a, b, c)) & 0xff;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const started = performance.now();
const { bytes, peak } = toBytes(simulate());
const png = encodePng(bytes);
await writeFile(outPath, png);
console.log(`${outPath}: ${size}×${size}, ${steps} steps, V peaks at ${peak.toFixed(3)}, ${png.length} bytes, ${Math.round(performance.now() - started)}ms`);
