# Market data

`eth-market.json` is the deterministic, portfolio-safe dataset consumed by the
visualization. Regenerate it with:

```bash
npm run data:generate
```

The generator expects the CryptoDataDownload Bitstamp ETH/USD daily CSV at
`work/bitstamp_ethusd_daily.csv`. The raw download is intentionally ignored so
the repository does not redistribute a third-party dataset without its license.

## Encoding

- **Angle:** calendar time, January at twelve o'clock and months clockwise.
- **Ring:** one calendar year, ordered from 2019 at the center to 2025 outside.
- **Radial shape:** four close-price samples per month, log-transformed and
  normalized to that year's observed range. This preserves each year's rhythm,
  not comparable absolute price magnitude.
- **Stroke weight:** monthly average daily USD volume, log10-transformed and
  normalized across 2019–2025.
- **Knots:** selected, documented market shocks. They are contextual editorial
  annotations, not a complete incident dataset or a claim of causation.

Annual and monthly dollar values remain unnormalized in the generated file for
the accessible detail view and summary table. Dates are interpreted as the UTC
calendar dates provided by the source. The generator rejects incomplete years.

Source: [CryptoDataDownload — Bitstamp](https://www.cryptodatadownload.com/data/bitstamp/).
