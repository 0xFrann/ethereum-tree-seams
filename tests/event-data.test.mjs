import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_DATA,
  MILESTONES,
  ORIGIN,
  SCARS,
  validateEventData,
  validateMilestones,
  validateScars,
} from "../lib/event-data.mjs";

const MILESTONE_FIELDS = [
  "activation",
  "category",
  "confidence",
  "date",
  "id",
  "name",
  "sourceUrl",
  "summary",
];

const SCAR_FIELDS = [
  "affectedLayer",
  "confidence",
  "date",
  "grossUsdAtIncident",
  "healingState",
  "id",
  "name",
  "recoveryStatus",
  "reportedImpact",
  "sourceUrl",
  "summary",
  "visualMagnitude",
];

function copy(value) {
  return structuredClone(value);
}

test("exports the accepted chronology and keeps Frontier separate", () => {
  assert.equal(ORIGIN.id, "frontier-genesis");
  assert.equal(ORIGIN.date, "2015-07-30");
  assert.equal(MILESTONES.length, 11);
  assert.deepEqual(MILESTONES.map(({ id }) => id), [
    "homestead",
    "dao-fork",
    "byzantium",
    "constantinople-st-petersburg",
    "beacon-chain-genesis",
    "london-eip-1559",
    "the-merge",
    "shapella",
    "dencun",
    "pectra",
    "fusaka",
  ]);
  assert.ok(!MILESTONES.some(({ id }) => id === ORIGIN.id));
  assert.ok(MILESTONES.every((item, index, records) => index === 0 || records[index - 1].date < item.date));
});

test("exports exactly the nine Gate 1 scars in date order", () => {
  assert.equal(SCARS.length, 9);
  assert.deepEqual(SCARS.map(({ id }) => id), [
    "the-dao-2016",
    "parity-freeze-2017",
    "poly-network-2021",
    "wormhole-2022",
    "ronin-2022",
    "nomad-2022",
    "euler-2023",
    "bybit-2025",
    "kelpdao-2026",
  ]);
  assert.ok(!SCARS.some(({ id }) => id === "wazirx-2024"));
  assert.ok(SCARS.every((item, index, records) => index === 0 || records[index - 1].date < item.date));
});

test("records match the application model fields and preserve sources", () => {
  assert.deepEqual(Object.keys(ORIGIN).sort(), MILESTONE_FIELDS);
  for (const milestone of MILESTONES) {
    assert.deepEqual(Object.keys(milestone).sort(), MILESTONE_FIELDS);
    assert.match(milestone.sourceUrl, /^https?:\/\//);
    assert.equal(milestone.confidence, "high");
  }
  for (const scar of SCARS) {
    assert.deepEqual(Object.keys(scar).sort(), SCAR_FIELDS);
    assert.match(scar.sourceUrl, /^https?:\/\//);
    assert.equal(scar.confidence, "high");
    assert.equal("ethereumProtocolCompromised" in scar, false);
  }
});

test("validates the canonical event bundle", () => {
  assert.equal(validateMilestones(MILESTONES), MILESTONES);
  assert.equal(validateScars(SCARS), SCARS);
  assert.equal(validateEventData(EVENT_DATA), EVENT_DATA);
  assert.ok(Object.isFrozen(EVENT_DATA));
  assert.ok(Object.isFrozen(MILESTONES[0]));
  assert.ok(Object.isFrozen(SCARS[0]));
});

test("rejects malformed and impossible dates", () => {
  const malformed = copy(MILESTONES);
  malformed[0].date = "14-03-2016";
  assert.throws(() => validateMilestones(malformed), /ISO YYYY-MM-DD/);

  const impossible = copy(SCARS);
  impossible[0].date = "2016-02-30";
  assert.throws(() => validateScars(impossible), /real calendar date/);
});

test("rejects missing and duplicate ids, including cross-kind collisions", () => {
  const missing = copy(MILESTONES);
  missing[0].id = "";
  assert.throws(() => validateMilestones(missing), /non-empty string/);

  const duplicate = copy(SCARS);
  duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateScars(duplicate), /Duplicate event id/);

  const crossKind = copy(EVENT_DATA);
  crossKind.scars[0].id = crossKind.milestones[0].id;
  assert.throws(() => validateEventData(crossKind), /Duplicate event id/);
});

test("rejects missing or non-web sources", () => {
  const missing = copy(SCARS);
  missing[0].sourceUrl = "";
  assert.throws(() => validateScars(missing), /non-empty string/);

  const invalid = copy(MILESTONES);
  invalid[0].sourceUrl = "file:///tmp/source";
  assert.throws(() => validateMilestones(invalid), /HTTP or HTTPS/);
});

test("rejects invalid or incorrectly normalized scar magnitudes", () => {
  const outOfRange = copy(SCARS);
  outOfRange[0].visualMagnitude = 101;
  assert.throws(() => validateScars(outOfRange), /integer from 0 through 100/);

  const wrongForImpact = copy(SCARS);
  wrongForImpact[0].visualMagnitude = 55;
  assert.throws(() => validateScars(wrongForImpact), /must equal 56/);

  const invalidGross = copy(SCARS);
  invalidGross[0].grossUsdAtIncident = Number.NaN;
  assert.throws(() => validateScars(invalidGross), /positive finite number/);
});

test("rejects invalid healing states and protocol-compromise claims", () => {
  const invalidHealing = copy(SCARS);
  invalidHealing[0].healingState = "recovering";
  assert.throws(() => validateScars(invalidHealing), /healed, closed, or open/);

  const falseClaim = copy(SCARS);
  falseClaim[0].ethereumProtocolCompromised = true;
  assert.throws(() => validateScars(falseClaim), /must not claim/);
});

test("healing states preserve the accepted recovery distinctions", () => {
  const byId = new Map(SCARS.map((scar) => [scar.id, scar.healingState]));
  assert.equal(byId.get("the-dao-2016"), "healed");
  assert.equal(byId.get("parity-freeze-2017"), "closed");
  assert.equal(byId.get("poly-network-2021"), "healed");
  assert.equal(byId.get("wormhole-2022"), "healed");
  assert.equal(byId.get("ronin-2022"), "closed");
  assert.equal(byId.get("nomad-2022"), "closed");
  assert.equal(byId.get("euler-2023"), "healed");
  assert.equal(byId.get("bybit-2025"), "open");
  assert.equal(byId.get("kelpdao-2026"), "open");
});
