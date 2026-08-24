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

test("renders the viewport specimen shell and cache-loading boundary at the root route", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Ethereum Annual Rings<\/title>/i);
  assert.match(html, /Computational dendrochronology/i);
  assert.match(html, /Ethereum Annual Rings/i);
  assert.match(html, /ETH\/USD · daily market archive/i);
  assert.match(html, /Loading the cached Bitstamp market history/);
  assert.match(html, /explorer-stage/);
  assert.doesNotMatch(html, /site-header|wordmark|eth-diamond\.svg|Monthly return|Year return/);
  assert.doesNotMatch(html, /eth-market\.json|codex-preview|annual-eth-rings\.html/i);
});
