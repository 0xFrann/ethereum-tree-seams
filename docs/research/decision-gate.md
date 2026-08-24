# Gate 1 — accepted research contract

Accepted **2026-08-21** after review of the protocol, security, and market-source reports.

## Market-series boundary

The implementation will retain the single-market **CryptoDataDownload Bitstamp ETH/USD** series for this release. Kraken reaches much closer to genesis, but adopting it requires a full-archive audit and a market-data usage permission decision that cannot be completed from repository evidence alone. The application will not silently treat public API access as redistribution permission.

The accepted boundary is therefore:

- Ethereum chronology begins at mainnet genesis, **2015-07-30**.
- The interval from genesis through **2017-11-08** is an explicitly unpriced pre-series interval.
- The first market ring begins on the first observed Bitstamp candle, **2017-11-09**; 2017 is partial and must never be presented as a complete year.
- No exchange histories are stitched and no price is backfilled across the pre-series interval.
- The early CDD volume-column anomaly through **2018-02-27** is corrected through a documented, tested source-normalization rule.
- The missing **2026-05-22** candle remains disclosed in payload metadata rather than silently forward-filled.
- The source timezone is described as the CSV's observed UTC day boundary; the provider's conflicting New York wording remains a documented source caveat.

## Canonical event model

Protocol milestones and security scars are separate collections. All dates are ISO `YYYY-MM-DD`; descriptions are factual and contain no price-causation claim.

Milestone fields: `id`, `date`, `name`, `summary`, `category`, `sourceUrl`, `confidence`, and optional `activation` metadata. Frontier genesis is an origin marker, not a knot.

Scar fields: `id`, `date`, `name`, `summary`, `affectedLayer`, `grossUsdAtIncident`, `reportedImpact`, `recoveryStatus`, `sourceUrl`, `confidence`, `visualMagnitude`, and `healingState`. `ethereumProtocolCompromised` is always false for the accepted set and must be reflected in language.

## Accepted visible milestones

Homestead; DAO fork; Byzantium; Constantinople/St. Petersburg; Beacon Chain genesis; London/EIP-1559; The Merge; Shapella; Dencun; Pectra; Fusaka.

This is a restrained protocol chronology, not a complete fork log. Exclusions remain documented in `protocol-milestones.md` and its JSON companion.

## Accepted visible scars

The DAO exploit; Parity multisig freeze; Poly Network; Wormhole; Ronin; Nomad; Euler; Bybit; KelpDAO.

WazirX is excluded from the default view because a second centralized-exchange custody incident does not add enough distinct narrative value at overview density. Bybit remains because its scale and Ethereum/Safe signing path make it a singular historical incident, but the interface must label it explicitly as an exchange custody compromise—not an Ethereum protocol hack. Other researched exclusions remain in `security-scars.md` and its JSON companion.

## Magnitude and healing rules

Use contemporaneous gross reported USD impact, with recoveries/frozen funds disclosed separately. Normalize on a logarithmic `$1M` floor to `$1.5B` cap:

```text
score = round(100 * log10(clamp(usd, 1M, 1.5B) / 1M) / log10(1.5B / 1M))
```

`visualMagnitude` controls a capped wound reach and modest width. Healing state is editorial metadata derived from the researched outcome: `healed` for materially returned/restored incidents, `closed` for historical incidents with lasting loss or lock, and `open` for recent or unresolved incidents. The accessible readout always exposes the uncapped impact and recovery caveat.

## Integration constraints

- Event placement uses exact day-of-year angle, not only a month bucket.
- Multiple events in one year use deterministic angular collision offsets while preserving their true date in data and text.
- The DAO fork knot and DAO exploit scar remain separate semantic records.
- Every displayed event retains one primary source URL and confidence assessment in the shipped dataset.
- The Kraken recommendation remains a documented future upgrade path; this release does not erase it.
