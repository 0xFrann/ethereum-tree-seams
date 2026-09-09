"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "./eth-rings/use-motion";
import { readPlate, subscribePlate, type PlateMask } from "./paper-pattern/plate-mask";

// The paper's Turing pattern, kept moving on the GPU.
//
// A Gray-Scott reaction–diffusion runs across the whole sheet, one cell per
// CSS pixel, and only the crest of each stripe is drawn: a hairline, in the
// same weight as the grain on the plate, with paper between. The reaction is
// not grown here: it was settled once, offline (build/turing-seed.mjs), and
// the sheet seeds its field from that finished state, so the first frame is
// already a complete labyrinth and the reader never watches it fill. What
// moves is the finished pattern. The kill rate varies across the sheet in a
// slow, drifting field, so the lines are forever coming apart and re-forming
// a little differently. Under reduced motion the field stands still and the
// pattern is drawn once.
//
// The pattern stops at the plate's bark. The plate publishes its outline (see
// paper-pattern/plate-mask.ts) and the paper leaves the inside blank, so the
// rings sit on clean sheet rather than on more lines.

// Reaction constants. Feed and kill sit in the labyrinth regime; the diffusion
// rates set the stripe period, roughly nine cells here, so the lines run about
// nine CSS pixels apart. The kill rate wanders by DRIFT around KILL in a field
// DRIFT_WAVE pixels across whose phase advances DRIFT_RATE a step: enough to
// keep the labyrinth reworking itself, not enough to thin it into spots.
const FEED = 0.037;
const KILL = 0.06;
const DIFFUSE_U = 0.2;
const DIFFUSE_V = 0.1;
const DRIFT = 0.0015;
const DRIFT_WAVE = 220;
const DRIFT_RATE = 0.001;
// The settled state, tiled across the sheet: U in red, V doubled in green,
// six bits each. SETTLE_STEPS are run, unseen, before the first frame to
// take the quantisation out of it. The reaction is then stepped by wall-clock
// time rather than by frame, so it runs at the same pace on every refresh rate.
const SEED_URL = "/turing-seed.png";
const SEED_V_SCALE = 2;
const SETTLE_STEPS = 24;
const STEPS_PER_MS = 0.5;
const MAX_STEPS_PER_FRAME = 24;
// The finished pattern arrives as a fade, not a fill.
const ARRIVAL_MS = 900;
// The V field peaks near .38 in a stripe; drawing above LEVEL keeps the ink to
// the crest, a line about one CSS pixel wide.
const LEVEL = 0.3;
const OPACITY = 0.09;
// How far outside the bark the lines fade in, in CSS pixels.
const PLATE_FEATHER = [2, 14];
const SAMPLE_COUNT = 360;

const VERTEX = `#version 300 es
void main() {
  // One triangle over the whole viewport.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const SEED = `#version 300 es
precision highp float;
uniform sampler2D u_prev;
uniform vec2 u_prevSize;
uniform float u_hasPrev;
uniform sampler2D u_seed;
uniform ivec2 u_seedSize;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  // A resize carries the pattern already moving over; only new ground is seeded.
  if (u_hasPrev > 0.5 && p.x < int(u_prevSize.x) && p.y < int(u_prevSize.y)) {
    o = vec4(texelFetch(u_prev, p, 0).rg, 0.0, 1.0);
    return;
  }
  // The settled tile repeats seamlessly. Every other row of tiles is set half
  // a tile over, so the repeat is hard to find; the drift soon tells the
  // copies apart anyway.
  ivec2 q = p + ivec2(((p.y / u_seedSize.y) % 2) * (u_seedSize.x / 2), 0);
  vec4 s = texelFetch(u_seed, q % u_seedSize, 0);
  o = vec4(s.r, s.g / ${SEED_V_SCALE}.0, 0.0, 1.0);
}`;

const STEP = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_size;
uniform float u_feed;
uniform float u_kill;
uniform float u_phase;
out vec4 o;
vec2 at(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(u_size) - 1);
  return texelFetch(u_state, p, 0).rg;
}
// The slow field the kill rate wanders in: a few broad waves, drifting.
float drift(vec2 q, float t) {
  q *= 6.2831853 / ${DRIFT_WAVE}.0;
  return sin(q.x + t) * cos(q.y * 0.8 - t * 0.7) + 0.5 * sin((q.x + q.y) * 0.7 + t * 1.3);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float kill = u_kill + ${DRIFT} * drift(gl_FragCoord.xy, u_phase);
  vec2 c = at(p);
  vec2 lap = 0.2 * (at(p + ivec2(1, 0)) + at(p - ivec2(1, 0)) + at(p + ivec2(0, 1)) + at(p - ivec2(0, 1)))
    + 0.05 * (at(p + ivec2(1, 1)) + at(p + ivec2(1, -1)) + at(p + ivec2(-1, 1)) + at(p + ivec2(-1, -1)))
    - c;
  float uvv = c.x * c.y * c.y;
  float u = c.x + ${DIFFUSE_U} * lap.x - uvv + u_feed * (1.0 - c.x);
  float v = c.y + ${DIFFUSE_V} * lap.y + uvv - (u_feed + kill) * c.y;
  o = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
}`;

const SHOW = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_size;
uniform vec2 u_canvas;
uniform float u_dpr;
uniform vec3 u_ink;
uniform float u_opacity;
uniform float u_level;
uniform sampler2D u_plate;
uniform vec2 u_plateCenter;
uniform float u_plateOn;
uniform vec2 u_feather;
out vec4 o;
float vAt(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(u_size) - 1);
  return texelFetch(u_state, p, 0).g;
}
void main() {
  // CSS pixel under this device pixel, y down.
  vec2 css = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y) / u_dpr;
  vec2 q = css - 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 f = q - vec2(i);
  float v = mix(mix(vAt(i), vAt(i + ivec2(1, 0)), f.x), mix(vAt(i + ivec2(0, 1)), vAt(i + ivec2(1, 1)), f.x), f.y);
  float aa = max(fwidth(v) * 0.75, 0.002);
  float ink = smoothstep(u_level - aa, u_level + aa, v);
  float mask = 1.0;
  if (u_plateOn > 0.5) {
    vec2 d = css - u_plateCenter;
    float turn = fract((atan(d.y, d.x) + 1.5707963) / 6.2831853) * ${SAMPLE_COUNT}.0;
    int s = int(floor(turn));
    float t = turn - float(s);
    float r = mix(texelFetch(u_plate, ivec2(s % ${SAMPLE_COUNT}, 0), 0).r, texelFetch(u_plate, ivec2((s + 1) % ${SAMPLE_COUNT}, 0), 0).r, t);
    mask = smoothstep(r + u_feather.x, r + u_feather.y, length(d));
  }
  float a = ink * mask * u_opacity;
  o = vec4(u_ink * a, a);
}`;

function compile(gl: WebGL2RenderingContext, fragment: string) {
  const program = gl.createProgram();
  const attach = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return false;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return false;
    }
    gl.attachShader(program, shader);
    return true;
  };
  if (!program || !attach(gl.VERTEX_SHADER, VERTEX) || !attach(gl.FRAGMENT_SHADER, fragment)) return null;
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function inkColor(element: HTMLElement): [number, number, number] {
  const value = getComputedStyle(element).getPropertyValue("--ink").trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (!hex) return [0.118, 0.106, 0.086];
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
}

export function PaperPattern() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    // Without float render targets the reaction cannot run; the sheet stays plain paper.
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return;

    const seed = compile(gl, SEED);
    const step = compile(gl, STEP);
    const show = compile(gl, SHOW);
    if (!seed || !step || !show) return;
    const uniform = (program: WebGLProgram, name: string) => gl.getUniformLocation(program, name);

    let disposed = false;
    let frame = 0;
    let last = 0;
    let settled = 0;
    let phase = 0;
    let shownAt = 0;
    let simWidth = 0;
    let simHeight = 0;
    let dpr = 1;
    let states: [WebGLTexture, WebGLTexture] | null = null;
    let targets: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
    let front = 0;
    const ink = inkColor(canvas);
    const plateTexture = gl.createTexture();
    const seedTexture = gl.createTexture();
    let seedSize: [number, number] | null = null;
    let plate: { center: [number, number]; on: boolean } = { center: [0, 0], on: false };

    const stateTexture = (width: number, height: number) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, null);
      const target = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture, target };
    };

    const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Size the reaction to the viewport, carrying over whatever is already
    // moving and seeding the rest from the settled tile.
    const resize = () => {
      if (!seedSize) return;
      const width = Math.max(1, Math.ceil(window.innerWidth));
      const height = Math.max(1, Math.ceil(window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const previous = states;
      const previousFront = front;
      const previousTargets = targets;
      const previousSize: [number, number] = [simWidth, simHeight];
      const a = stateTexture(width, height);
      const b = stateTexture(width, height);
      simWidth = width;
      simHeight = height;
      states = [a.texture, b.texture];
      targets = [a.target, b.target];
      front = 0;

      gl.viewport(0, 0, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0]);
      gl.useProgram(seed);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, previous ? previous[previousFront] : null);
      gl.uniform1i(uniform(seed, "u_prev"), 0);
      gl.uniform2f(uniform(seed, "u_prevSize"), previousSize[0], previousSize[1]);
      gl.uniform1f(uniform(seed, "u_hasPrev"), previous ? 1 : 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, seedTexture);
      gl.uniform1i(uniform(seed, "u_seed"), 1);
      gl.uniform2i(uniform(seed, "u_seedSize"), seedSize[0], seedSize[1]);
      draw();
      previous?.forEach((texture) => gl.deleteTexture(texture));
      previousTargets?.forEach((target) => gl.deleteFramebuffer(target));
      measurePlate();
    };

    // Where the bark is, in the sheet's own CSS pixels.
    const measurePlate = (mask: PlateMask | null = readPlate()) => {
      if (!mask) {
        plate = { center: [0, 0], on: false };
        return;
      }
      const rect = mask.element.getBoundingClientRect();
      const scale = rect.width / mask.size;
      const radii = new Float32Array(SAMPLE_COUNT);
      for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) radii[sample] = (mask.radii[sample] ?? 0) * scale;
      gl.bindTexture(gl.TEXTURE_2D, plateTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, SAMPLE_COUNT, 1, 0, gl.RED, gl.FLOAT, radii);
      plate = { center: [rect.left + rect.width / 2, rect.top + rect.height / 2], on: true };
    };

    // Advance the reaction. The field drifts with the steps, so it stands
    // still whenever the reaction does.
    const react = (steps: number, drifting: boolean) => {
      if (!states || !targets) return;
      gl.viewport(0, 0, simWidth, simHeight);
      gl.useProgram(step);
      gl.uniform2f(uniform(step, "u_size"), simWidth, simHeight);
      gl.uniform1f(uniform(step, "u_feed"), FEED);
      gl.uniform1f(uniform(step, "u_kill"), KILL);
      gl.uniform1i(uniform(step, "u_state"), 0);
      const phaseAt = uniform(step, "u_phase");
      gl.activeTexture(gl.TEXTURE0);
      for (let index = 0; index < steps; index += 1) {
        if (drifting) phase += DRIFT_RATE;
        gl.uniform1f(phaseAt, phase);
        const back = 1 - front;
        gl.bindFramebuffer(gl.FRAMEBUFFER, targets[back]);
        gl.bindTexture(gl.TEXTURE_2D, states[front]);
        draw();
        front = back;
      }
    };

    const present = (arrival = 1) => {
      if (!states) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(show);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, states[front]);
      gl.uniform1i(uniform(show, "u_state"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, plateTexture);
      gl.uniform1i(uniform(show, "u_plate"), 1);
      gl.uniform2f(uniform(show, "u_size"), simWidth, simHeight);
      gl.uniform2f(uniform(show, "u_canvas"), canvas.width, canvas.height);
      gl.uniform1f(uniform(show, "u_dpr"), dpr);
      gl.uniform3f(uniform(show, "u_ink"), ink[0], ink[1], ink[2]);
      gl.uniform1f(uniform(show, "u_opacity"), OPACITY * arrival);
      gl.uniform1f(uniform(show, "u_level"), LEVEL);
      gl.uniform2f(uniform(show, "u_plateCenter"), plate.center[0], plate.center[1]);
      gl.uniform1f(uniform(show, "u_plateOn"), plate.on ? 1 : 0);
      gl.uniform2f(uniform(show, "u_feather"), PLATE_FEATHER[0], PLATE_FEATHER[1]);
      draw();
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed) return;
      // Take the quantisation out of the seed before showing any of it: one
      // unseen frame, so the sheet never shows the pattern half-made.
      if (settled < SETTLE_STEPS) {
        react(SETTLE_STEPS - settled, false);
        settled = SETTLE_STEPS;
        shownAt = now;
        last = now;
        frame = requestAnimationFrame(tick);
        return;
      }
      if (reduced) {
        // The still pattern, drawn once. Only the plate's outline can change
        // after this, and that wakes a single repaint.
        present();
        return;
      }
      const elapsed = last ? now - last : 1000 / 60;
      last = now;
      react(Math.min(MAX_STEPS_PER_FRAME, Math.round(elapsed * STEPS_PER_MS)), true);
      present(Math.min(1, (now - shownAt) / ARRIVAL_MS));
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (disposed || frame || document.hidden) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const onResize = () => {
      resize();
      settled = 0;
      wake();
    };
    const onPlate = (mask: PlateMask | null) => {
      measurePlate(mask);
      wake();
    };

    // Nothing runs until the settled state has arrived.
    const image = new Image();
    image.src = SEED_URL;
    image.decode().then(() => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, seedTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      seedSize = [image.naturalWidth, image.naturalHeight];
      resize();
      wake();
    }, () => {
      // Without the seed the sheet stays plain paper.
    });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", wake);
    const unsubscribe = subscribePlate(onPlate);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", wake);
      unsubscribe();
      states?.forEach((texture) => gl.deleteTexture(texture));
      targets?.forEach((target) => gl.deleteFramebuffer(target));
      gl.deleteTexture(plateTexture);
      gl.deleteTexture(seedTexture);
      [seed, step, show].forEach((program) => gl.deleteProgram(program));
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="paper-pattern" aria-hidden="true" />;
}
