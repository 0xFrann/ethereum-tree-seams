import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_DATA,
  MILESTONES,
  ORIGIN,
  validateEventData,
  validateMilestones,
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

function copy(value) {
  return structuredClone(value);
}

test("exports the eleven milestones in date order and keeps Frontier separate", () => {
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

test("records match the application model fields and preserve sources", () => {
  assert.deepEqual(Object.keys(ORIGIN).sort(), MILESTONE_FIELDS);
  for (const milestone of MILESTONES) {
    assert.deepEqual(Object.keys(milestone).sort(), MILESTONE_FIELDS);
    assert.match(milestone.sourceUrl, /^https?:\/\//);
    assert.equal(milestone.confidence, "high");
  }
});

test("validates the canonical event bundle", () => {
  assert.equal(validateMilestones(MILESTONES), MILESTONES);
  assert.equal(validateEventData(EVENT_DATA), EVENT_DATA);
  assert.ok(Object.isFrozen(EVENT_DATA));
  assert.ok(Object.isFrozen(MILESTONES[0]));
});

test("rejects malformed and impossible dates", () => {
  const malformed = copy(MILESTONES);
  malformed[0].date = "14-03-2016";
  assert.throws(() => validateMilestones(malformed), /ISO YYYY-MM-DD/);

  const impossible = copy(MILESTONES);
  impossible[0].date = "2016-02-30";
  assert.throws(() => validateMilestones(impossible), /real calendar date/);
});

test("rejects missing and duplicate ids, including collisions with the origin", () => {
  const missing = copy(MILESTONES);
  missing[0].id = "";
  assert.throws(() => validateMilestones(missing), /non-empty string/);

  const duplicate = copy(MILESTONES);
  duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateMilestones(duplicate), /Duplicate event id/);

  const originClash = copy(EVENT_DATA);
  originClash.milestones[0].id = originClash.origin.id;
  assert.throws(() => validateEventData(originClash), /Duplicate event id/);
});

test("rejects missing or non-web sources", () => {
  const missing = copy(MILESTONES);
  missing[0].sourceUrl = "";
  assert.throws(() => validateMilestones(missing), /non-empty string/);

  const invalid = copy(MILESTONES);
  invalid[0].sourceUrl = "file:///tmp/source";
  assert.throws(() => validateMilestones(invalid), /HTTP or HTTPS/);
});

/**
 * The note in the sheet's bottom-left corner is 19rem at its narrowest and sets
 * its summary in Courier at 14px, whose advance is 0.6em — 36 characters to the
 * line. Two of those lines is the whole reading, and the note reserves exactly
 * two whether or not a knot is under it, so a summary that runs to a third is
 * one the reader never sees the end of. The text is written to the measure;
 * this is the measure.
 */
function noteLines(text, columns = 36) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= columns) line = `${line} ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

test("writes every milestone summary to the two lines the note holds", () => {
  for (const record of [ORIGIN, ...MILESTONES]) {
    const lines = noteLines(record.summary);
    assert.ok(
      lines.length <= 2,
      `${record.id} sets in ${lines.length} lines: ${lines.join(" / ")}`,
    );
  }
});
