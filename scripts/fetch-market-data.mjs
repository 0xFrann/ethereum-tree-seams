// Fetches the Bitstamp ETH/USD daily history once and writes the aggregated
// specimen document that the page reads. It runs before every build, so the
// site is a static export whose data is refreshed by rebuilding it: the deploy
// workflow runs on a schedule, and a failed fetch fails the build, which leaves
// the previously published site (its last known good data) untouched.
//
//   node scripts/fetch-market-data.mjs [--if-missing] [--out public/market-data.json]
//
// --if-missing skips the network when the file already exists, which keeps
// `pnpm dev` and local builds offline after the first run.

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { aggregateMarketData, parseCryptoDataDownloadCsv } from "../lib/market-data.mjs";

export const MARKET_SOURCE_URL = "https://www.cryptodatadownload.com/cdd/Bitstamp_ETHUSD_d.csv";
export const DEFAULT_OUTPUT = "public/market-data.json";
const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * Fetches, parses, validates and aggregates the upstream CSV. Exported so the
 * pipeline can be tested with an injected fetch and clock.
 * @param {{ fetchImpl?: typeof globalThis.fetch, now?: () => Date, timeoutMs?: number }} [options]
 */
export async function buildMarketDocument({ fetchImpl = globalThis.fetch, now = () => new Date(), timeoutMs = UPSTREAM_TIMEOUT_MS } = {}) {
  const response = await fetchImpl(MARKET_SOURCE_URL, {
    headers: { accept: "text/csv" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Market source returned ${response.status}.`);
  const rows = parseCryptoDataDownloadCsv(await response.text());
  return aggregateMarketData(rows, { updatedAt: now().toISOString() });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(argv) {
  const ifMissing = argv.includes("--if-missing");
  const outIndex = argv.indexOf("--out");
  const outPath = outIndex === -1 ? DEFAULT_OUTPUT : argv[outIndex + 1];

  if (ifMissing && (await exists(outPath))) {
    console.log(`${outPath}: already present, skipping fetch (run \`pnpm run data\` to refresh).`);
    return;
  }

  const started = performance.now();
  const document = await buildMarketDocument();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(document));
  const years = document.years.length;
  console.log(`${outPath}: ${years} years through ${document.source.cutoff}, ${Math.round(performance.now() - started)}ms`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error("Market data fetch failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
