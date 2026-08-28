import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventAnchors,
  buildEventHitRegions,
  buildKnotGeometry,
  buildScarGeometry,
  dateToAngle,
  deformGrainPoint,
  hitTestEvents,
  interpolateRingAtFraction,
  nextEventId,
  normalizeScarMagnitude,
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

function scar(id, date, healingState = "closed", visualMagnitude = 75) {
  return {
    id,
    date,
    name: id,
    summary: "summary",
    affectedLayer: "bridge",
    grossUsdAtIncident: 250_000_000,
    reportedImpact: "$250M",
    recoveryStatus: "unrecovered",
    sourceUrl: "https://example.com",
    confidence: "high",
    visualMagnitude,
    healingState,
  };
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

test("normalizes magnitude using the fixed one-million to 1.5-billion scale", () => {
  assert.equal(normalizeScarMagnitude(1_000_000), 0);
  assert.equal(normalizeScarMagnitude(1_500_000_000), 100);
  assert.equal(normalizeScarMagnitude(1), 0);
  assert.equal(normalizeScarMagnitude(9_000_000_000), 100);
  assert.throws(() => normalizeScarMagnitude(Number.NaN), /finite/);
});

test("builds exact anchors and excludes pre-start or future events", () => {
  const start = parseIsoDateUtc("2017-11-09").fraction;
  const yearBand = band(2017, 90, { startFraction: start, activeFraction: 1 });
  const events = [
    { kind: "milestone", record: milestone("too-early", "2017-10-16") },
    { kind: "milestone", record: milestone("valid", "2017-11-09") },
    { kind: "scar", record: scar("future", "2027-01-01") },
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
  const event = milestone("merge", "2022-09-15");
  const anchor = anchorsFor([{ kind: "milestone", record: event }])[0];
  const first = buildKnotGeometry(event, anchor, 18);
  const second = buildKnotGeometry(event, anchor, 18);
  assert.deepEqual(first, second);
  assert.equal(first.path.length, 8);
  assert.ok(first.majorRadius >= 7 && first.majorRadius <= 12);
  const centerRadius = Math.hypot(first.center.x - anchor.center, first.center.y - anchor.center);
  assert.ok(Math.abs(centerRadius - anchor.ringRadius) <= 1.25);
});

test("scar states extend only outward and retain distinct closure behavior", () => {
  for (const state of ["healed", "closed", "open"]) {
    const event = scar(state, "2022-03-23", state, 88);
    const anchor = anchorsFor([{ kind: "scar", record: event }])[0];
    const geometry = buildScarGeometry(event, anchor, {
      localGap: 18,
      barkRadii: Array(360).fill(155),
    });
    for (const point of geometry.centerline) {
      const radius = Math.hypot(point.x - anchor.center, point.y - anchor.center);
      assert.ok(radius >= anchor.ringRadius - 1e-9);
    }
    assert.ok(geometry.maxHalfWidth >= 1.5 && geometry.maxHalfWidth <= 4.5);
    if (state === "open") {
      assert.ok(geometry.endRadius > 155);
      assert.equal(geometry.bridges.length, 0);
    } else {
      assert.ok(geometry.endRadius < 155);
      assert.ok(geometry.bridges.length > 0);
    }
  }
});

test("larger magnitudes cannot make scars shorter or narrower", () => {
  const anchor = anchorsFor([{ kind: "scar", record: scar("base", "2022-03-23") }])[0];
  const small = buildScarGeometry(scar("small", "2022-03-23", "closed", 0), anchor, {
    localGap: 18,
    barkRadii: Array(360).fill(180),
  });
  const large = buildScarGeometry(scar("large", "2022-03-23", "closed", 100), anchor, {
    localGap: 18,
    barkRadii: Array(360).fill(180),
  });
  assert.ok(large.endRadius >= small.endRadius);
  assert.ok(large.maxHalfWidth >= small.maxHalfWidth);
});

test("grain deformation leaves older radii unchanged", () => {
  const event = scar("nomad", "2022-08-01", "open", 71);
  const anchor = anchorsFor([{ kind: "scar", record: event }])[0];
  const geometry = buildScarGeometry(event, anchor, {
    localGap: 18,
    barkRadii: Array(360).fill(155),
  });
  const old = { radius: anchor.ringRadius - 1, angle: anchor.displayAngle };
  assert.deepEqual(deformGrainPoint(old, [geometry], []), old);
});

test("collision output is independent of input order", () => {
  const records = [
    { kind: "scar", record: scar("b", "2022-02-02") },
    { kind: "scar", record: scar("a", "2022-02-02") },
  ];
  const forward = resolveEventCollisions(anchorsFor(records), { pointer: "coarse", selectionHaloPx: 3 });
  const reverse = resolveEventCollisions(anchorsFor([...records].reverse()), { pointer: "coarse", selectionHaloPx: 3 });
  assert.deepEqual(forward, reverse);
  assert.ok(forward.some((item) => item.displayAngle !== item.trueAngle));
  assert.ok(forward.every((item) => Math.abs(item.displayAngle - item.trueAngle) <= Math.PI / 30 + 1e-9));

  const displaced = forward.find((item) => item.displayAngle !== item.trueAngle);
  const displacedEvent = scar(displaced.eventId, displaced.date);
  const wound = buildScarGeometry(displacedEvent, displaced, {
    localGap: 18,
    barkRadii: Array(360).fill(155),
  });
  const regions = buildEventHitRegions([], [wound], "coarse");
  assert.deepEqual(hitTestEvents(regions, displaced.truePoint), {
    kind: "scar",
    id: displaced.eventId,
  });
});

test("the accepted 2022 incidents retain exact angles when their envelopes clear", () => {
  const events = [
    { kind: "scar", record: scar("wormhole", "2022-02-02") },
    { kind: "scar", record: scar("ronin", "2022-03-23") },
    { kind: "scar", record: scar("nomad", "2022-08-01") },
  ];
  const resolved = resolveEventCollisions(anchorsFor(events, [band(2022, 120)], 320), {
    pointer: "coarse",
    selectionHaloPx: 3,
  });
  assert.deepEqual(resolved.map((item) => item.displayAngle - item.trueAngle), [0, 0, 0]);
});

test("hit regions keep visual size separate from pointer target size", () => {
  const knotEvent = milestone("pectra", "2022-05-07");
  const scarEvent = scar("ronin", "2022-03-23", "closed", 88);
  const anchors = anchorsFor([
    { kind: "milestone", record: knotEvent },
    { kind: "scar", record: scarEvent },
  ]);
  const knot = buildKnotGeometry(knotEvent, anchors.find((item) => item.eventId === "pectra"), 18);
  const wound = buildScarGeometry(scarEvent, anchors.find((item) => item.eventId === "ronin"), {
    localGap: 18,
    barkRadii: Array(360).fill(155),
  });
  const fine = buildEventHitRegions([knot], [wound], "fine");
  const coarse = buildEventHitRegions([knot], [wound], "coarse");
  assert.ok(fine.every((item) => item.radiusCssPx === 14));
  assert.ok(coarse.every((item) => item.radiusCssPx === 22));
  assert.deepEqual(hitTestEvents(coarse, knot.center), { kind: "milestone", id: "pectra" });
  assert.deepEqual(hitTestEvents(coarse, wound.centerline[3]), { kind: "scar", id: "ronin" });
  assert.equal(hitTestEvents(coarse, { x: 0, y: 0 }), null);
});

test("chronological keyboard helper clamps at the ends", () => {
  const events = [
    { kind: "scar", record: scar("late", "2022-08-01") },
    { kind: "milestone", record: milestone("early", "2021-01-01") },
  ];
  assert.equal(nextEventId(events, null, "first"), "early");
  assert.equal(nextEventId(events, null, "last"), "late");
  assert.equal(nextEventId(events, "early", 1), "late");
  assert.equal(nextEventId(events, "late", 1), "late");
  assert.equal(nextEventId(events, "early", -1), "early");
});
