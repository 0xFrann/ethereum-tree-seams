import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the visualization directly at the root route", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Ethereum Annual Rings<\/title>/i);
  assert.match(html, /A market/);
  assert.match(html, /remembered/);
  assert.match(html, /Interactive Ethereum annual rings/);
  assert.doesNotMatch(html, /Seven annual lives|Methodology &amp; data notes|<footer/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|annual-eth-rings\.html/i);
});

test("server-renders both approved selection surfaces and the fixed readout", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /Choose a year and month/);
  assert.match(html, /Selected segment/);
  assert.match(html, /Year return/);
  assert.match(html, /Year range/);
  assert.match(html, /2019/);
  assert.match(html, /2025/);
  assert.match(html, /Hover or tap a ring/);
});
