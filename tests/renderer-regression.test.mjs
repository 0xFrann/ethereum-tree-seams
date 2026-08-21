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
