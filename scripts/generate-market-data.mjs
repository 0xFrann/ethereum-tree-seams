import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMarketDataFromFile } from "../lib/market-data.mjs";

const sourcePath = resolve(process.cwd(), "work/bitstamp_ethusd_daily.csv");
const outputPath = resolve(process.cwd(), "data/eth-market.json");
if (process.argv.includes("--check")) {
  const checkedIn = JSON.parse(await readFile(outputPath, "utf8"));
  assert.deepEqual(checkedIn.years.map((year) => year.year), [2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  assert.ok(checkedIn.years.every((year) => year.months.length === 12 && year.priceShape.length === 48));
  try {
    await access(sourcePath);
    const output = `${JSON.stringify(await buildMarketDataFromFile(sourcePath), null, 2)}\n`;
    assert.equal(
      await readFile(outputPath, "utf8"),
      output,
      "data/eth-market.json is stale. Run `npm run data:generate`.",
    );
    console.log("Derived ETH market data is current and matches the local source CSV.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    console.log("Derived ETH market data is structurally valid; source CSV is not present in this clone.");
  }
} else {
  const output = `${JSON.stringify(await buildMarketDataFromFile(sourcePath), null, 2)}\n`;
  await writeFile(outputPath, output);
  console.log(`Wrote ${outputPath}`);
}
