// Runs against the static export in `out/` (pnpm run build), which is why it
// lives apart from the unit tests.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const out = new URL("../../out/", import.meta.url);

test("exports the page as static HTML with the specimen shell already rendered", async () => {
  const html = await readFile(new URL("index.html", out), "utf8");
  assert.match(html, /<title>Ethereum Annual Rings<\/title>/);
  assert.match(html, /ETH_TREE_01/);
  assert.match(html, /Preparing specimen/);
  assert.match(html, /<link rel="preload" href="[^"]*\/market-data\.json" as="fetch"/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /localhost|\/api\//);
});

test("ships the market document as a static file the page can read offline", async () => {
  const data = JSON.parse(await readFile(new URL("market-data.json", out), "utf8"));
  assert.ok(Array.isArray(data.years) && data.years.length >= 9);
  assert.match(data.source.cutoff, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isFinite(Date.parse(data.cache.updatedAt)));
  assert.ok(data.milestones.length > 0);
});
