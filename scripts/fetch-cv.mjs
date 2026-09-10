// Fetches the CV from its own repository and writes it into public/, where the
// byline links to it. The CV is kept in a private repository, so the request
// carries a token that can read that repository's contents and nothing else: a
// fine-grained personal access token scoped to the one repository, held as the
// deploy workflow's CV_TOKEN secret. Like the market data, the file is fetched
// at build time rather than committed here, and a failed fetch fails the
// build, which leaves the previously published site (its last CV) untouched.
//
//   CV_TOKEN=... node scripts/fetch-cv.mjs [--if-missing] [--out public/cv.pdf]
//
// --if-missing skips the network when the file already exists. Without the
// token the file is simply absent and the link on a local build has nothing
// behind it, which is fine for working on the sheet.

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const CV_REPOSITORY = "0xFrann/cv";
export const CV_PATH = "silver-dev-cv/Franco-Dalmasso-Frontend-Engineer.pdf";
export const DEFAULT_OUTPUT = "public/cv.pdf";
const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * Fetches the PDF through the GitHub contents API, which hands back the raw
 * file when asked for it, and checks that what came back is a PDF. Exported so
 * it can be tested with an injected fetch.
 * @param {{ token: string, fetchImpl?: typeof globalThis.fetch, timeoutMs?: number }} options
 */
export async function fetchCv({ token, fetchImpl = globalThis.fetch, timeoutMs = UPSTREAM_TIMEOUT_MS }) {
  if (!token) throw new Error("CV_TOKEN is not set; the CV repository is private and needs a token that can read its contents.");
  const response = await fetchImpl(`https://api.github.com/repos/${CV_REPOSITORY}/contents/${CV_PATH}`, {
    headers: {
      accept: "application/vnd.github.raw+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`CV source returned ${response.status} for ${CV_REPOSITORY}/${CV_PATH}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new Error("CV source did not return a PDF.");
  return bytes;
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const output = outIndex === -1 ? DEFAULT_OUTPUT : args[outIndex + 1];
  if (args.includes("--if-missing") && (await access(output).then(() => true, () => false))) {
    console.log(`Keeping ${output}.`);
    return;
  }
  const bytes = await fetchCv({ token: process.env.CV_TOKEN });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  console.log(`Wrote ${output} (${bytes.length} bytes).`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
