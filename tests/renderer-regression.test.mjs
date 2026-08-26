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
  assert.match(source, /const VOLUME_TRANSITION_FRACTION = 0\.12/);
  assert.match(source, /const VOLUME_YEAR_BASELINE_MIN = 0\.08/);
  assert.match(source, /const VOLUME_YEAR_BASELINE_RANGE = 0\.78/);
  assert.match(source, /const VOLUME_LOCAL_CONTRAST = 0\.7/);
  assert.match(source, /visualVolumeWeight\(volumeWeight\) \* gap \* VOLUME_WIDTH_RANGE/);
});

test("retains the recovered year-end ease, closed bark, outlined month guide, and labels", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /const eased = t \* t \* \(3 - 2 \* t\)/);
  assert.match(source, /const endWeight = -2 \* t3 \+ 3 \* t2/);
  assert.match(source, /const INTERSTITIAL_GHOST_FRACTIONS = \[0\.17, 0\.34, 0\.52, 0\.7, 0\.84\]/);
  assert.match(source, /INTERSTITIAL_GHOST_FRACTIONS\.forEach/);
  assert.doesNotMatch(source, /deformGrainPoint/);
  assert.match(source, /drawBark\(context, rings\.at\(-1\)!\.radii, bark, center, colors\.bark\)/);
  assert.match(source, /function drawMonthTicks/);
  assert.match(source, /const VOLUME_SAMPLES_PER_MONTH = 4/);
  assert.match(source, /segment < VOLUME_SAMPLES_PER_MONTH/);
  assert.match(source, /SAMPLE_COUNT \/ \(MONTHS\.length \* VOLUME_SAMPLES_PER_MONTH\)/);
  assert.match(source, /drawMonthTicks\(context, center, indexRadius, size, colors\.muted\)/);
  assert.match(source, /context\.fill\("evenodd"\)/);
  assert.match(source, /return radius \+ gap \* \(0\.69 \+ coarse \+ chip \+ spike \+ notch\)/);
  assert.match(source, /function strokeMonthWedge/);
  assert.match(source, /const innerBoundary = geometry\.yearBands\[0\]\?\.innerBoundary \?\? band\.innerBoundary/);
  assert.match(source, /traceMonthWedge\(context, innerBoundary, geometry\.bark, selection\.month, geometry\.center\)/);
  assert.match(source, /context\.globalAlpha = 0\.22/);
  assert.match(source, /traceVariableContour\(context, selectedRing, geometry\.center, start, end\);/);
  assert.match(source, /context\.clip\(\)/);
  assert.match(source, /context\.drawImage\(source, 0, 0, geometry\.size, geometry\.size\)/);
  assert.doesNotMatch(source, /context\.globalCompositeOperation = "destination-over"/);
  assert.match(source, /const labelRadius = indexRadius \+ labelClearance \+ textExtent/);
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

test("highlights knots with a dark fill instead of an outline", async () => {
  const source = await readFile(rendererUrl, "utf8");
  const selection = source.slice(source.indexOf("export function drawEventSelection"), source.indexOf("export function hitTestEvent"));
  assert.match(selection, /context\.fillStyle = color/);
  assert.match(selection, /context\.globalAlpha = 1/);
  assert.doesNotMatch(selection, /strokeStyle|lineWidth|context\.stroke\(\)|context\.arc\(/);
});

test("gives marks the same contrast as their selected month segment", async () => {
  const source = await readFile(rendererUrl, "utf8");
  const selection = source.slice(source.indexOf("export function drawSelection"), source.indexOf("export function drawEventSelection"));

  assert.match(selection, /Marks inherit their host segment's hover state/);
  assert.match(selection, /knot\.anchor\.year === selection\.year/);
  assert.match(selection, /context\.fillStyle = color/);
});

test("renders knots with a solid neutral treatment", async () => {
  const source = await readFile(rendererUrl, "utf8");
  const knot = source.slice(source.indexOf("function drawKnot"), source.indexOf("export function drawStaticArtwork"));
  assert.match(knot, /context\.globalAlpha = 1/);
  assert.match(source, /drawKnot\(context, knot, colors\.mark\)/);
  assert.doesNotMatch(source, /data\.scars|drawScar|events\.scars/);
});

test("extends ghost grain through unobserved years and unfinished months", async () => {
  const source = await readFile(rendererUrl, "utf8");
  assert.match(source, /function strokeGhostContour/);
  assert.match(source, /band\.marketYearIndex === null/);
  assert.match(source, /const PRE_MARKET_GHOST_COUNT = 14/);
  assert.match(source, /Array\.from\(\{ length: PRE_MARKET_GHOST_COUNT \}/);
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

test("fades pre-market ghost grain outward from the center", async () => {
  const source = await readFile(rendererUrl, "utf8");

  assert.match(source, /const EMPTY_GHOST_ALPHA_MIN = 0\.2/);
  assert.match(source, /const EMPTY_GHOST_ALPHA_MAX = 0\.48/);
  assert.match(source, /const emptyGhostAlphaAt = \(progress: number\)/);
  assert.match(source, /emptyGhostAlphaAt\(progress\)/);
});

test("distributes pre-market ghost grain evenly from the center to 2017", async () => {
  const source = await readFile(rendererUrl, "utf8");

  assert.match(source, /const preMarketStart = emptyYearBands\[0\]\?\.innerBoundary/);
  assert.match(source, /\(index \+ 1\) \/ \(PRE_MARKET_GHOST_COUNT \+ 1\)/);
  assert.match(source, /startRadius \+ \(firstMarketRing\.radii\[sample\] - startRadius\) \* progress/);
  assert.match(source, /compressed cluster\s+\/\/ beside the partial 2017 ring/);
});
