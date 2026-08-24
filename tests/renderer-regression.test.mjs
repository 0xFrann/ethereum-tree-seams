import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rendererUrl = new URL("../app/components/eth-rings/renderer.ts", import.meta.url);

test("locks the recovered additive annual-ring construction and continuous volume scale", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const inner = size \* 0\.0975/);
  assert.match(source, /const outer = size \* 0\.39/);
  assert.match(source, /let baseline = Array\(SAMPLE_COUNT\)\.fill\(inner\)/);
  assert.match(source, /const PRICE_RELIEF = 0\.52/);
  assert.match(source, /baseline\[index\] \+ shape \* gap \* PRICE_RELIEF/);
  assert.match(source, /baseline = radii\.map\(\(radius\) => radius \+ gap \* 0\.9\)/);
  assert.match(source, /const volumeWeightAt = \(month: number\)/);
  assert.match(source, /function interpolateVolumeBand/);
  assert.match(source, /year\.volumeShape\?\.length/);
  assert.match(source, /interpolateVolumeBand\(year\.volumeShape, shapePosition, cyclic\)/);
  assert.match(source, /const VOLUME_WIDTH_RANGE = 0\.28/);
  assert.match(source, /const VOLUME_TRANSITION_FRACTION = 0\.22/);
  assert.match(source, /const VOLUME_YEAR_BASELINE_MIN = 0\.08/);
  assert.match(source, /const VOLUME_YEAR_BASELINE_RANGE = 0\.78/);
  assert.match(source, /const VOLUME_LOCAL_CONTRAST = 0\.42/);
  assert.match(source, /visualVolumeWeight\(volumeWeight\) \* gap \* VOLUME_WIDTH_RANGE/);
});

test("retains the recovered year-end ease, closed bark, wedge, and labels", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const eased = t \* t \* \(3 - 2 \* t\)/);
  assert.match(source, /const endWeight = -2 \* t3 \+ 3 \* t2/);
  assert.match(source, /const INTERSTITIAL_GHOST_FRACTIONS = \[0\.17, 0\.34, 0\.52, 0\.7, 0\.84\]/);
  assert.match(source, /INTERSTITIAL_GHOST_FRACTIONS\.forEach/);
  assert.doesNotMatch(source, /deformGrainPoint/);
  assert.match(source, /drawBark\(context, rings\.at\(-1\)!\.radii, bark, center, colors\.bark\)/);
  assert.match(source, /context\.fill\("evenodd"\)/);
  assert.match(source, /return radius \+ gap \* \(0\.69 \+ coarse \+ chip \+ spike \+ notch\)/);
  assert.match(source, /context\.createRadialGradient\(center, center, innerRadius, center, center, outerRadius\)/);
  assert.match(source, /const transparentPaperColor = transparentVersion\(paperColor\)/);
  assert.match(source, /gradient\.addColorStop\(0, transparentPaperColor\)/);
  assert.match(source, /gradient\.addColorStop\(selectedStop, paperColor\)/);
  assert.match(source, /gradient\.addColorStop\(1, transparentPaperColor\)/);
  assert.match(source, /context\.fillStyle = gradient/);
  assert.match(source, /context\.globalAlpha = 0\.72/);
  assert.doesNotMatch(source, /context\.globalCompositeOperation = "destination-over"/);
  assert.doesNotMatch(source, /gradient\.addColorStop\([^,]+, "transparent"\)/);
  assert.match(source, /const labelRadius = indexRadius \+ labelClearance \+ textExtent/);
  assert.match(source, /geometry\.events\.scars\.forEach/);
  assert.match(source, /geometry\.events\.knots\.forEach/);
});

test("a partial first year carries its full contour outward without colliding with the next ring", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /baseline = radii\.map\(\(radius\) => radius \+ gap \* 0\.9\)/);
  assert.match(source, /partial 2017/);
  assert.match(source, /const lastObservedRadius = radii\[activeSamples - 1\]/);
  assert.match(source, /radii\[index\] = lastObservedRadius \+ \(firstObservedRadius - lastObservedRadius\) \* t/);
});

test("connects four observed volume nodes per month without a boundary trough", async () => {
  const source = await readFile(rendererUrl, "utf8");

  assert.match(source, /const current = volumeWeightAt\(monthlyIndex\)/);
  assert.match(source, /const next = volumeWeightAt\(nextMonth\)/);
  assert.match(source, /const shapePosition = cyclic/);
  assert.match(source, /New cache records provide four daily-volume nodes per month/);
  assert.match(source, /Keep each sampled observation legible as a short band/);
  assert.match(source, /high-volume years stay visibly heavier/);
  assert.match(source, /return rest \+ visualVolumeWeight\(volumeWeight\) \* gap \* VOLUME_WIDTH_RANGE/);
  assert.doesNotMatch(source, /Math\.sin\(Math\.PI \* \(monthPosition/);
});

test("does not fade observed price contours into the baseline at data boundaries", async () => {
  const source = await readFile(rendererUrl, "utf8");

  assert.match(source, /const radii = rawRadii/);
  assert.doesNotMatch(source, /partialYearEaseAt/);
  assert.doesNotMatch(source, /ENTRY_EASE_SAMPLES|EXIT_EASE_SAMPLES/);
});

test("keeps data-bearing year rings stronger than decorative ghost grain", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const MINIMUM_RING_WEIGHT = 0\.65/);
  assert.match(source, /const rest = Math\.max\(MINIMUM_RING_WEIGHT, gap \* 0\.024\)/);
  assert.match(source, /context\.lineWidth = 0\.78/);
  assert.match(source, /const GHOST_ALPHA = 0\.5/);
  assert.match(source, /context\.globalAlpha = alpha/);
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
  assert.match(source, /const EMPTY_YEAR_GHOST_FRACTIONS = \[0\.1, 0\.3, 0\.5, 0\.7, 0\.9\]/);
  assert.match(source, /EMPTY_YEAR_GHOST_FRACTIONS\.forEach/);
  assert.match(source, /if \(ring\.startSample > 0\)/);
  assert.match(source, /if \(ring\.activeSamples < SAMPLE_COUNT\)/);
  assert.doesNotMatch(source, /strokeFutureContour/);
});

test("interpolates ghost rings from the central circle to the first market contour", async () => {
  const source = await readFile(rendererUrl, "utf8");
  const preMarketStart = source.indexOf("const preMarketContours");
  const preMarketEnd = source.indexOf("const yearBands", preMarketStart);
  const preMarketBlock = source.slice(preMarketStart, preMarketEnd);

  assert.match(source, /const firstMarketRing = rings\[0\]/);
  assert.match(preMarketBlock, /const shapeBlend = index \/ Math\.max\(1, firstMarketYear - originYear\)/);
  assert.match(preMarketBlock, /firstMarketRing\.radii\.map\(\(firstRadius\) => radius \+ \(firstRadius - inner\) \* shapeBlend\)/);
  assert.match(preMarketBlock, /const sharedBoundary = \(neighbor: number\[\]\) => radii\.map\(\(radius, sample\) => \(radius \+ neighbor\[sample\]\) \/ 2\)/);
  assert.match(preMarketBlock, /\{ \.\.\.band, innerBoundary: preMarketBands\.at\(-1\)!\.outerBoundary \}/);
});

test("fades empty-year ghost grain outward from the origin", async () => {
  const source = await readFile(rendererUrl, "utf8");

  assert.match(source, /const EMPTY_GHOST_ALPHA_MIN = 0\.2/);
  assert.match(source, /const EMPTY_GHOST_ALPHA_MAX = 0\.48/);
  assert.match(source, /const emptyGhostAlphaAt = \(radius: number\)/);
  assert.match(source, /radius - emptyGhostInnerRadius/);
  assert.match(source, /emptyGhostAlphaAt\(radii\[0\]\)/);
});

test("continues the center-to-market shape transition through ghost grain", async () => {
  const source = await readFile(rendererUrl, "utf8");

  assert.match(source, /const lastEmptyBand = emptyYearBands\.at\(-1\)/);
  assert.match(source, /const EMPTY_TO_MARKET_GHOST_FRACTIONS = \[0\.2, 0\.4, 0\.6, 0\.8\]/);
  assert.match(source, /EMPTY_TO_MARKET_GHOST_FRACTIONS\.forEach/);
  assert.match(source, /lastEmptyBand\.outerBoundary\.map\(\(radius, sample\) =>/);
  assert.match(source, /radius \+ \(firstMarketRing\.radii\[sample\] - radius\) \* fraction/);
});
