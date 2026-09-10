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
  assert.doesNotMatch(html, /localhost|\/api\//);
});

test("names the share image by one absolute URL that the export actually serves", async () => {
  const html = await readFile(new URL("index.html", out), "utf8");
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(image, "an og:image tag");
  // Absolute, so a crawler never has to resolve it, and the same for Twitter.
  assert.match(image, /^https:\/\/[^"]+\/og\.jpg$/);
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  // The site URL already carries the base path; the published page used to
  // repeat it, as /ethereum-tree-seams/ethereum-tree-seams/og.jpg.
  const segments = new URL(image).pathname.split("/").filter(Boolean);
  assert.equal(new Set(segments).size, segments.length, `no repeated path segment in ${image}`);
  // And the file is in the export under that name.
  await readFile(new URL("og.jpg", out));
});

test("links the byline's CV to the file the deploy fetches, under the base path", async () => {
  const html = await readFile(new URL("index.html", out), "utf8");
  const preload = html.match(/<link rel="preload" href="([^"]*)\/market-data\.json"/)[1];
  // The CV lives beside the market document, so it takes the same prefix; the
  // file itself is only in the export when CV_TOKEN was set for the build.
  assert.match(html, new RegExp(`<a href="${preload}/cv\\.pdf" target="_blank" rel="noreferrer">`));
});

test("leaves a note in the source for whoever reads it", async () => {
  const html = await readFile(new URL("index.html", out), "utf8");
  // First thing in the file after the doctype, above <html>: the first line
  // of view-source and of the inspector's tree, not folded away in a div.
  assert.match(html, /^<!DOCTYPE html>\n<!--[\s\S]*?open for opportunities[\s\S]*?francomdalmasso@gmail\.com[\s\S]*?-->\n<html/);
  const note = html.match(/^<!DOCTYPE html>\n<!--([\s\S]*?)-->/)[1];
  assert.match(note, /Frann Dalmasso/);
  // A double hyphen inside a comment is malformed HTML; the drawing avoids it.
  assert.doesNotMatch(note, /--/);
  // And printed to the console on load, for whoever opens the inspector there.
  assert.match(html, /<script>console\.log\("[^<]*open for opportunities[^<]*francomdalmasso@gmail\.com[^<]*"\);<\/script>/);
});

test("ships the market document as a static file the page can read offline", async () => {
  const data = JSON.parse(await readFile(new URL("market-data.json", out), "utf8"));
  assert.ok(Array.isArray(data.years) && data.years.length >= 9);
  assert.match(data.source.cutoff, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isFinite(Date.parse(data.cache.updatedAt)));
  assert.ok(data.milestones.length > 0);
});
