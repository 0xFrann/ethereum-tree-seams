import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventAnchors,
  buildEventHitRegions,
  buildKnotGeometry,
  dateToAngle,
  hitTestEvents,
  interpolateRingAtFraction,
  nextEventId,
  parseIsoDateUtc,
  resolveEventCollisions,
  smoothCircularSeries,
} from "../app/components/eth-rings/event-geometry.ts";

const widths = Array(360).fill(1);

function band(year, radius = 100, overrides = {}) {
  const ring = Array(360).fill(radius);
  return {
    year,
    radii: ring,
    widths,
    startFraction: 0,
    activeFraction: 1,
    innerBoundary: Array(360).fill(radius - 5),
    outerBoundary: Array(360).fill(radius + 5),
    marketYearIndex: 0,
    ...overrides,
  };
}

function milestone(id, date) {
  return {
    id,
    date,
    name: id,
    summary: "summary",
    category: "upgrade",
    sourceUrl: "https://example.com",
    confidence: "high",
  };
}

function event(id, date) {
  return { kind: "milestone", record: milestone(id, date) };
}

function anchorsFor(events, yearBands = [band(2022, 120)], size = 320) {
  return buildEventAnchors(events, yearBands, {
    center: size / 2,
    size,
    gap: 18,
    lastDate: "2026-08-21",
  });
}

test("places dates at UTC day centers and accounts for leap years", () => {
  assert.deepEqual(parseIsoDateUtc("2019-01-01"), {
    year: 2019,
    dayIndex: 0,
    daysInYear: 365,
    fraction: 0.5 / 365,
  });
  const leap = parseIsoDateUtc("2020-02-29");
  assert.equal(leap.dayIndex, 59);
  assert.equal(leap.daysInYear, 366);
  assert.equal(leap.fraction, 59.5 / 366);
  assert.equal(parseIsoDateUtc("2021-12-31").fraction, 364.5 / 365);
  assert.ok(dateToAngle("2021-12-31") < Math.PI * 1.5);
});

test("rejects malformed and impossible calendar dates", () => {
  for (const value of ["2022-02-29", "2020-13-01", "2020-01-00", "not-a-date"]) {
    assert.throws(() => parseIsoDateUtc(value), /Invalid ISO date/);
  }
});

test("interpolates continuously and wraps the sampled ring", () => {
  assert.ok(Math.abs(interpolateRingAtFraction(Array.from({ length: 360 }, (_, index) => index), 10.25 / 360) - 10.25) < 1e-12);
  const wrapped = interpolateRingAtFraction(Array.from({ length: 360 }, (_, index) => index), 359.5 / 360);
  assert.equal(wrapped, 179.5);
  assert.throws(() => interpolateRingAtFraction([], 0.5), /requires radii/);
});

test("circular smoothing eases the December-to-January seam", () => {
  const values = Array(360).fill(0);
  values[359] = 12;
  const smoothed = smoothCircularSeries(values, 6);
  assert.equal(smoothed.length, values.length);
  assert.ok(Math.abs(smoothed[359] - smoothed[0]) < Math.abs(values[359] - values[0]));
  assert.ok(smoothed[0] > 0);
});

test("builds exact anchors and excludes pre-start or future events", () => {
  const start = parseIsoDateUtc("2017-11-09").fraction;
  const yearBand = band(2017, 90, { startFraction: start, activeFraction: 1 });
  const events = [
    event("too-early", "2017-10-16"),
    event("valid", "2017-11-09"),
    event("future", "2027-01-01"),
  ];
  const result = buildEventAnchors(events, [yearBand, band(2027)], {
    center: 160,
    size: 320,
    gap: 18,
    lastDate: "2026-08-21",
  });
  assert.deepEqual(result.map((item) => item.eventId), ["valid"]);
  assert.equal(result[0].trueAngle, dateToAngle("2017-11-09"));
});

test("knot geometry is deterministic, asymmetric, and remains on its host grain", () => {
  const record = milestone("merge", "2022-09-15");
  const anchor = anchorsFor([{ kind: "milestone", record }])[0];
  const first = buildKnotGeometry(record, anchor, 18);
  const second = buildKnotGeometry(record, anchor, 18);
  assert.deepEqual(first, second);
  assert.equal(first.path.length, 8);
  assert.ok(first.majorRadius >= 7 && first.majorRadius <= 12);
  const centerRadius = Math.hypot(first.center.x - anchor.center, first.center.y - anchor.center);
  assert.ok(Math.abs(centerRadius - anchor.ringRadius) <= 1.25);
});

test("collision output is independent of input order", () => {
  const records = [event("b", "2022-02-02"), event("a", "2022-02-02")];
  const forward = resolveEventCollisions(anchorsFor(records), { pointer: "coarse", selectionHaloPx: 3 });
  const reverse = resolveEventCollisions(anchorsFor([...records].reverse()), { pointer: "coarse", selectionHaloPx: 3 });
  assert.deepEqual(forward, reverse);
  assert.ok(forward.some((item) => item.displayAngle !== item.trueAngle));
  assert.ok(forward.every((item) => Math.abs(item.displayAngle - item.trueAngle) <= Math.PI / 30 + 1e-9));

  const displaced = forward.find((item) => item.displayAngle !== item.trueAngle);
  const knot = buildKnotGeometry(milestone(displaced.eventId, displaced.date), displaced, 18);
  const regions = buildEventHitRegions([knot], "coarse");
  assert.deepEqual(hitTestEvents(regions, displaced.truePoint), {
    kind: "milestone",
    id: displaced.eventId,
  });
});

test("events whose envelopes clear keep their exact angles", () => {
  const events = [
    event("wormhole", "2022-02-02"),
    event("ronin", "2022-03-23"),
    event("nomad", "2022-08-01"),
  ];
  const resolved = resolveEventCollisions(anchorsFor(events, [band(2022, 120)], 320), {
    pointer: "coarse",
    selectionHaloPx: 3,
  });
  assert.deepEqual(resolved.map((item) => item.displayAngle - item.trueAngle), [0, 0, 0]);
});

test("hit regions keep visual size separate from pointer target size", () => {
  const pectra = milestone("pectra", "2022-05-07");
  const merge = milestone("merge", "2022-09-15");
  const anchors = anchorsFor([
    { kind: "milestone", record: pectra },
    { kind: "milestone", record: merge },
  ]);
  const knots = [
    buildKnotGeometry(pectra, anchors.find((item) => item.eventId === "pectra"), 18),
    buildKnotGeometry(merge, anchors.find((item) => item.eventId === "merge"), 18),
  ];
  const fine = buildEventHitRegions(knots, "fine");
  const coarse = buildEventHitRegions(knots, "coarse");
  assert.ok(fine.every((item) => item.radiusCssPx === 14));
  assert.ok(coarse.every((item) => item.radiusCssPx === 22));
  assert.deepEqual(hitTestEvents(coarse, knots[0].center), { kind: "milestone", id: "pectra" });
  assert.deepEqual(hitTestEvents(coarse, knots[1].center), { kind: "milestone", id: "merge" });
  assert.equal(hitTestEvents(coarse, { x: 0, y: 0 }), null);
});

test("chronological keyboard helper clamps at the ends", () => {
  const events = [event("late", "2022-08-01"), event("early", "2021-01-01")];
  assert.equal(nextEventId(events, null, "first"), "early");
  assert.equal(nextEventId(events, null, "last"), "late");
  assert.equal(nextEventId(events, "early", 1), "late");
  assert.equal(nextEventId(events, "late", 1), "late");
  assert.equal(nextEventId(events, "early", -1), "early");
});
