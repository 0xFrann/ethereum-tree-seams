import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rendererUrl = new URL("../app/components/eth-rings/renderer.ts", import.meta.url);

test("locks the recovered additive annual-ring construction and volume scale", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const inner = size \* 0\.0975/);
  assert.match(source, /const outer = size \* 0\.39/);
  assert.match(source, /let baseline = Array\(SAMPLE_COUNT\)\.fill\(inner\)/);
  assert.match(source, /baseline\[index\] \+ shape \* gap \* 0\.39/);
  assert.match(source, /baseline = radii\.map\(\(radius\) => radius \+ gap \* 0\.9\)/);
  assert.match(source, /Math\.sin\(Math\.PI \* \(monthPosition - Math\.floor\(monthPosition\)\)\) \*\* 1\.35/);
  assert.match(source, /monthRecord\.volumeWeight \* gap \* 0\.16/);
});

test("retains the recovered year-end ease, closed bark, wedge, and labels", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const eased = t \* t \* \(3 - 2 \* t\)/);
  assert.match(source, /const endWeight = -2 \* t3 \+ 3 \* t2/);
  assert.match(source, /\[0\.17, 0\.34, 0\.52, 0\.7, 0\.84\]\.forEach/);
  assert.doesNotMatch(source, /deformGrainPoint/);
  assert.match(source, /drawBark\(context, rings\.at\(-1\)!\.radii, bark, center, colors\.bark\)/);
  assert.match(source, /context\.fill\("evenodd"\)/);
  assert.match(source, /return radius \+ gap \* \(0\.69 \+ coarse \+ chip \+ spike \+ notch\)/);
  assert.match(source, /context\.createRadialGradient\(center, center, innerRadius, center, center, outerRadius\)/);
  assert.match(source, /context\.globalCompositeOperation = "destination-over"/);
  assert.match(source, /const labelRadius = indexRadius \+ labelClearance \+ textExtent/);
  assert.match(source, /geometry\.events\.scars\.forEach/);
  assert.match(source, /geometry\.events\.knots\.forEach/);
});

test("a partial first year cannot propagate a radial seam into later rings", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const incomingBaseline = baseline/);
  assert.match(source, /if \(startSample > 0\)/);
  assert.match(source, /const observedGrowth = radii/);
  assert.match(source, /baseline = incomingBaseline\.map\(\(radius\) => radius \+ observedGrowth \+ gap \* 0\.9\)/);
});

test("keeps data-bearing year rings stronger than decorative ghost grain", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const rest = Math\.max\(0\.9, gap \* 0\.032\)/);
  assert.match(source, /context\.lineWidth = 0\.78/);
  assert.match(source, /context\.globalAlpha = 0\.44/);
  assert.match(source, /fillVariableContour\(context, ring, center, colors\.ink, ring\.startSample, end, 0\.82\)/);
});

test("highlights knots and scars with a dark fill instead of an outline", async () => {
  const source = await readFile(rendererUrl, "utf8");
  const selection = source.slice(source.indexOf("export function drawEventSelection"), source.indexOf("export function hitTestEvent"));
  assert.match(selection, /context\.fillStyle = color/);
  assert.match(selection, /context\.globalAlpha = 1/);
  assert.doesNotMatch(selection, /strokeStyle|lineWidth|context\.stroke\(\)|context\.arc\(/);
});

test("renders knots and scars with the same lighter neutral treatment", async () => {
  const source = await readFile(rendererUrl, "utf8");
  const scar = source.slice(source.indexOf("function drawScar"), source.indexOf("function drawKnot"));
  const knot = source.slice(source.indexOf("function drawKnot"), source.indexOf("export function drawStaticArtwork"));
  assert.match(scar, /context\.globalAlpha = 0\.58/);
  assert.match(knot, /context\.globalAlpha = 0\.58/);
  assert.match(source, /drawScar\(context, scar, colors\.muted\)/);
  assert.match(source, /drawKnot\(context, knot, colors\.muted\)/);
});

test("extends ghost grain through unobserved years and unfinished months", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /function strokeGhostContour/);
  assert.match(source, /band\.marketYearIndex === null/);
  assert.match(source, /strokeGhostContour\(context, radii, center, colors\.grain\)/);
  assert.match(source, /if \(ring\.startSample > 0\)/);
  assert.match(source, /if \(ring\.activeSamples < SAMPLE_COUNT\)/);
  assert.doesNotMatch(source, /strokeFutureContour/);
});
