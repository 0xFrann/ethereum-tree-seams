# Data decisions

The rules below fix what the rings are allowed to say. They are the reasoning behind the constants and checks in `lib/market-data.mjs` and `lib/event-data.mjs`; the tests under `tests/` hold the code to them.

## The market series

The rings are drawn from one market: the CryptoDataDownload copy of **Bitstamp ETH/USD daily candles**. Kraken reaches much closer to genesis, but adopting it needs a full-archive audit and an answer on redistribution rights that cannot be settled from repository evidence, and public API access is not treated as permission to republish. The comparison is in [market-data-sources.md](./market-data-sources.md).

The boundary that follows from that choice:

- The chronology begins at Ethereum mainnet genesis, **2015-07-30**.
- The first market ring begins on the first observed Bitstamp candle, **2017-11-09**. The aggregator refuses a file that starts anywhere else, so a silently truncated or extended source cannot ship.
- 2017 is a partial year and is never presented as a complete one. Its ring starts at the true day-of-year angle of its first candle; the arc before it is left as ghost grain.
- No exchange histories are stitched together, and no price is backfilled across the unpriced interval.
- The early volume-column reversal in the source, from 2017-11-09 through **2018-02-27**, is corrected by one documented, tested normalisation rule rather than by hand-editing the file.
- The missing candle on **2026-05-22** stays a disclosed gap in `source.gaps`; nothing is forward-filled.
- The source's dates sit on 00:00 UTC, so the payload describes the series as an observed UTC day boundary. The provider's conflicting New York wording is a documented caveat, not something the code compensates for.

## The unpriced interval

Between genesis and the first candle there is chronology but no price. The interval from **2015-07-30 through 2017-11-08** is labelled as such in the payload (`chronology.preSeriesLabel`) and drawn as a quiet interval at the centre of the plate: no contour shaped like price, no interpolation, no zeroes. 2015 and 2016 are never called market years and never receive price contours. A protocol milestone that falls inside the interval is still drawn at its true date on a neutral chronology band, and selecting it does not manufacture a market reading.

## Events

The only events drawn on the plate are protocol milestones, rendered as knots. Frontier genesis is the origin at the pith and is not a knot.

The eleven milestones are Homestead, the DAO fork, Byzantium, Constantinople/St. Petersburg, Beacon Chain genesis, London/EIP-1559, The Merge, Shapella, Dencun, Pectra, and Fusaka. The rubric, the exclusions, and the sources are in [protocol-milestones.md](./protocol-milestones.md).

Every record carries `id`, `date`, `name`, `summary`, `category`, `sourceUrl`, `confidence`, and optional `activation` metadata. Dates are ISO `YYYY-MM-DD` and are validated as real calendar dates; ids are kebab-case and unique; every source URL must parse as HTTP or HTTPS. The validator runs at build time, so a malformed record fails the build rather than reaching the page.

Summaries are factual and make no claim that a protocol event caused a market movement. The DAO fork knot marks the July 2016 protocol intervention; it is not a record of the June exploit, and its text does not describe the exploit as a protocol failure.

Milestones are equal in rank. Every knot is drawn at the same scale; nothing about a knot's size encodes importance.

## Normalisation and caps

Two normalisations shape the rings, and both are documented in the payload's `methodology` block:

- **Price.** Each observed month contributes four close-price samples. Within a year the samples are log-transformed and scaled to that year's own observed range, so `priceShape` runs from −1 to 1 per ring. A ring's contour therefore shows the shape of its year, not its level relative to other years.
- **Volume.** Each observed month contributes four sampled daily USD-volume observations. These are log10-transformed and scaled across the whole observed period, so `volumeShape` and each month's `volumeWeight` keep the global scale while still showing within-year variation.

Placement is capped rather than fudged. Ring progress for the current year is clamped to the real data cutoff, so the outer ring ends where the data ends and stays open at the bark. When two knots in one year would overlap, the later one is nudged along its ring by whole steps of one to two degrees, never more than six degrees in total, and a hairline leader points back to its true position; the stored date and the text never change.

## Disclosure

The "Data & source" sheet on the page shows the market, the provider, the cutoff, the number of observed days, the gap count and the timezone caveat, all read from the payload rather than hard-coded. It names both Bitstamp and CryptoDataDownload, because the file is distributed by the latter. The `updatedAt` timestamp is the moment the payload was built, not a live feed. Every visible milestone retains its primary source URL and confidence in the shipped data, and the note for a selected knot links to that source.

CryptoDataDownload's free data is non-commercial and provided as-is. This is a non-commercial project; a different use would need different rights.

The Kraken series remains the documented upgrade path. Nothing in the current data model prevents adopting it, and doing so would move the first market ring to 2015 without changing any of the rules above.
