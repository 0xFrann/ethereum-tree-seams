# Ethereum security scars — research handoff

Checked **2026-08-21**. This is a candidate chronology, not a claim that Ethereum's base protocol was hacked. Every recommended event below compromised an application, wallet, bridge, sidechain validator set, exchange, or cross-chain verification layer. The DAO is the only listed application incident that prompted an Ethereum protocol intervention; the vulnerable code was still The DAO's contract, not Ethereum consensus.

The normalized source of truth is [`security-scars.json`](./security-scars.json). It preserves original units, valuation basis, recoveries, confidence, source types, and rejection reasons that cannot fit comfortably in the table.

## Recommended visible set

| Date | Incident | Affected layer | Gross incident value | Recovery / loss caveat | Visual magnitude | Why visible |
|---|---|---|---:|---|---:|---|
| 2016-06-17 | The DAO | application smart contract | $60M; 3.6M ETH | Ethereum's 2016 fork enabled withdrawal through a recovery contract; do not present $60M as permanent ETH-chain loss | 56 | Foundational contract-security event and cause of an exceptional protocol intervention |
| 2017-11-06 | Parity multisig freeze | wallet smart-contract library | $150M; 513,774.16 ETH | Funds were frozen, not stolen; no generally available recovery as checked | 69 | Canonical irreversible-code-loss event; use a visually distinct “locked” scar |
| 2021-08-10 | Poly Network | cross-chain bridge/application | $612M; mixed assets | All affected assets were returned/restored within 15 days | 88 | Landmark gross exploit and unusually complete recovery; the tooltip must make both facts inseparable |
| 2022-02-02 | Wormhole | Solana-side bridge contract | $320M; 120,000 weETH | Jump replenished 120,000 ETH; recapitalization protected backing but was not recovery from the attacker | 79 | Major bridge-verification failure with Ethereum-backed assets |
| 2022-03-23 | Ronin | sidechain validator / bridge | $625M; 173,600 ETH + 25.5M USDC | At least ~$35.7M later recovered/seized; gross estimate varies roughly $600M–$625M by pricing timestamp | 88 | Historically large validator-key compromise and bridge drain |
| 2022-08-01 | Nomad | cross-chain bridge smart contracts | $186M documented by Nomad ($190M widely reported); mixed assets | About $36M returned; remaining victim loss depends on later distributions and token prices | 71 | “Free-for-all” replay pattern is technically and historically distinct |
| 2023-03-13 | Euler | Ethereum lending contracts | $197M; 96,832 ETH + 43.6M DAI (approximately) | All recoverable assets were returned; later return value was ~$240M because prices moved | 72 | Large composability shock with near-complete recovery |
| 2024-07-18 | WazirX | centralized exchange Ethereum multisig | $230M+; mixed ETH/ERC-20 portfolio | No verified stolen-asset recovery total found; creditor distributions/restructuring are not the same as asset recovery | 74 | Major Ethereum-wallet custody compromise; must be labeled exchange, not protocol |
| 2025-02-21 | Bybit | centralized exchange / Safe signing infrastructure | $1.5B; ~401,347 ETH-family assets | Bybit reports ~$48.4M recovered by 2026-08-07; exchange solvency or replenishment is not attacker-fund recovery | 100 (cap) | Largest well-documented Ethereum-asset theft in the period |
| 2026-04-18 | KelpDAO rsETH bridge | cross-chain verification infrastructure | $292M; 116,500 rsETH | 30,765.6675 ETH was frozen on Arbitrum; “frozen” is not yet equivalent to returned, and broader recoverable estimates remain conditional | 78 | Current major bridge trust-model failure; no Ethereum consensus or bridge-contract bug |

The three 2022 scars need collision treatment. Preserve their dates; do not combine them into a single annual marker.

## Considered but not recommended for the default view

| Date | Candidate | Gross value | Decision |
|---|---|---:|---|
| 2017-07-19 | Parity multisig theft | $30M–$32.7M; 153,037 ETH | Keep in data, hide by default. The November freeze is the more distinctive Parity scar and avoids two close 2017 marks. |
| 2020-09-26 | KuCoin hot-wallet breach | ~$281M mixed-chain assets | Hide. Important exchange incident, but not sufficiently Ethereum-specific and ultimately covered/recovered. |
| 2021-10-27 | C.R.E.A.M. Finance | $130M mixed ERC-20/LP assets | Hide at overview density. A legitimate Ethereum application exploit, but Poly is the stronger 2021 landmark. |
| 2023-07-30 | Curve/Vyper pool exploits | about $61.7M from the project-authored pool table | Hide at overview density. Important compiler/reentrancy case, but smaller and close to Euler in the same ring. |

## Magnitude method

Use the stored `grossUsdAtIncident` and never current prices, TVL at risk, bad debt, compensation, or recovered value. For an amount `u` in USD:

```text
CAP_USD = 1_500_000_000
FLOOR_USD = 1_000_000
clamped = min(max(u, FLOOR_USD), CAP_USD)
visualMagnitude = round(100 * log10(clamped / FLOOR_USD)
                            / log10(CAP_USD / FLOOR_USD))
```

Recommended geometry mapping: `scarLength = 4 + 14 * visualMagnitude / 100` CSS px at the canonical canvas size, then scale with the specimen. Stroke width should vary over a narrower range, for example `1.0 + 2.5 * visualMagnitude / 100`, so magnitude reads mainly as length/rupture rather than visual weight. Cap everything at Bybit's $1.5B basis and expose the uncapped dollar value in accessible text.

Why this is defensible:

- logarithmic normalization acknowledges that the candidate set spans more than an order of magnitude;
- a fixed, documented cap is stable across refreshes and prevents one exchange theft from dominating the organism;
- gross incident value represents the severity at the moment of failure, while `recovered` remains a separate outcome field;
- values are contemporaneous reported estimates, so volatile tokens are not silently repriced with hindsight;
- mixed-asset incidents retain their native-unit caveat instead of pretending that unlike tokens form one native quantity.

If editorial policy later prefers net victim loss, add a second encoding or filter; do not overwrite `grossUsdAtIncident`, because recoveries, freezes, recapitalizations, insurance, and creditor distributions are economically different.

## Editorial and evidence cautions

- **Protocol vs ecosystem:** none of the recommended candidates demonstrates compromise of Ethereum consensus, execution, or cryptography. Labels must say “Ethereum application,” “bridge,” “wallet,” “sidechain,” or “exchange” as applicable.
- **Gross vs net:** Poly and Euler are still meaningful scars despite full/near-full return. Wormhole was recapitalized rather than attacker funds recovered. Parity funds were immobilized rather than stolen.
- **Valuation:** the stored USD amounts follow the named contemporaneous source and date. Do not multiply historical token units by a current quote.
- **Ronin:** sources use roughly $600M, $620M, and $625M because ETH moved between the exploit date and discovery/reporting date. The candidate uses $625M as the broadly reported incident estimate and records a $600M–$625M confidence range.
- **Nomad:** Nomad says “more than $186M”; Mandiant and much reporting round to $190M. The normalized value uses the project figure and records the range.
- **KelpDAO:** 30,765.6675 ETH is frozen under an Arbitrum governance-controlled path. Count it as restrained/frozen, not returned, until an authoritative disposition is published.
- **WazirX:** a restructuring payout can compensate creditors from remaining assets without recovering stolen tokens. The fields deliberately keep these concepts separate.

## Source-quality notes

Primary evidence includes project postmortems/disclosures, the SEC's DAO investigation, the FBI's Bybit attribution, forensic reports commissioned by affected parties, and the Arbitrum Security Council's on-chain emergency-action record. Corroboration favors OpenZeppelin, Chainalysis, Mandiant/Google, The Block, AP, and government records. URLs and per-source publication/check dates are stored on each JSON candidate.

Open question for integration: whether the product wants exchange-custody scars at all. If the scope is narrowed to on-chain applications and bridges, remove WazirX and Bybit together rather than leaving users to infer that one was an Ethereum protocol failure.
