# Ethereum protocol milestones

Last reviewed: 2026-08-21. Scope: mainnet genesis through that date; dates and times are UTC. The records the site ships live in `lib/event-data.mjs`, and every visible knot keeps its primary source URL and confidence in the shipped data.

## Selection

Frontier genesis is the **origin** of the chronology, drawn at the pith and not as a knot. Eleven upgrades are drawn as **knots**, all at the same size: nothing about a knot encodes importance.

This is deliberately not a complete fork history. It keeps the events that changed Ethereum's operating phase, consensus, fee market, scaling model, staking lifecycle or broadly useful execution behaviour, and leaves out emergency maintenance, difficulty-bomb postponements, preparatory forks subsumed by a larger event and parameter-only changes. No entry claims that a protocol event caused a market movement.

Each candidate was weighed on protocol impact, historical importance, recognisability and how much room it has on its ring. Exact activation timestamps and block, epoch and slot values come from [ethereum.org's maintained fork chronology](https://ethereum.org/ethereum-forks/); Ethereum Foundation announcements and the final EIPs corroborate the trigger and the content. Block-explorer links embedded by ethereum.org are corroboration, not the basis for inclusion.

## Visible chronology

| Date (UTC) | Event | Activation | Why it is visible | Primary source |
|---|---|---:|---|---|
| 2015-07-30 15:26:13 | Frontier genesis (origin) | block 0 | The beginning of mainnet and of the chronology. | [EF, "Ethereum Launches"](https://blog.ethereum.org/2015/07/30/ethereum-launches) |
| 2016-03-14 18:49:53 | Homestead | block 1,150,000 | Ended the bare-bones Frontier phase; `DELEGATECALL` and forward-compatible networking. | [EF, "Homestead Release"](https://blog.ethereum.org/2016/02/29/homestead-release) |
| 2016-07-20 13:20:40 | DAO fork | block 1,920,000 | An exceptional protocol-level state intervention; its rejection produced Ethereum Classic. | [EF, "Hard Fork Completed"](https://blog.ethereum.org/2016/07/20/hard-fork-completed) |
| 2017-10-16 05:22:11 | Byzantium | block 4,370,000 | First Metropolis stage: `REVERT`, `STATICCALL`, receipt status, alt_bn128; reward cut from 5 to 3 ETH. | [EF, "Byzantium HF Announcement"](https://blog.ethereum.org/2017/10/12/byzantium-hf-announcement) |
| 2019-02-28 19:52:04 | Constantinople / St. Petersburg | block 7,280,000 | `CREATE2`, bitwise shifting, `EXTCODEHASH`; St. Petersburg removed EIP-1283 in the same block. | [EF announcement](https://blog.ethereum.org/2019/02/22/ethereum-constantinople-st-petersburg-upgrade-announcement) |
| 2020-12-01 12:00:23 | Beacon Chain genesis | epoch 0, slot 0 | Launched proof-of-stake consensus, later mainnet's consensus layer. | [ethereum.org, "The Beacon Chain"](https://ethereum.org/roadmap/beacon-chain/) |
| 2021-08-05 12:33:42 | London / EIP-1559 | block 12,965,000 | A burned base fee plus a priority fee replaced the first-price fee market. | [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) |
| 2022-09-15 06:42:42 | Paris / The Merge | block 15,537,394; TTD 5.875 × 10²² | Proof-of-work block production ended; execution joined Beacon Chain consensus. | [EF, "Mainnet Merge Announcement"](https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement) |
| 2023-04-12 22:27:35 | Shanghai–Capella / Shapella | epoch 194,048; block 17,034,870 | Validator withdrawals completed the staking lifecycle. | [EF, "Mainnet Shapella Announcement"](https://blog.ethereum.org/2023/03/28/shapella-mainnet-announcement) |
| 2024-03-13 13:55:35 | Cancun–Deneb / Dencun | epoch 269,568; block 19,426,587 | EIP-4844 blob transactions: a separate data market for rollups. | [EF, "Dencun Mainnet Announcement"](https://blog.ethereum.org/2024/02/27/dencun-mainnet-announcement) |
| 2025-05-07 10:05:11 | Prague–Electra / Pectra | epoch 364,032; block 22,431,084 | EIP-7702 account delegation, higher effective balances, execution-triggered exits. | [EF, "Pectra Mainnet"](https://blog.ethereum.org/2025/04/23/pectra-mainnet) |
| 2025-12-03 21:49:11 | Fulu–Osaka / Fusaka | epoch 411,392; block 23,935,694 | PeerDAS: nodes sample and custody blob data instead of downloading all of it. | [EF, "Fusaka Mainnet Announcement"](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) |

All entries are high confidence. Naming and timing details that the records depend on:

- **Genesis** is block 0. EIP-6953 labels Frontier's activation as block 1; that is its taxonomy, not a different date.
- **The DAO knot marks the fork**, a protocol milestone, not the June exploit of The DAO's application contract. The exploit was an application failure, and the summary says so.
- **Constantinople and St. Petersburg** activated in one block and are one knot; "Constantinople" is the short label.
- **Beacon Chain genesis** was configured for 12:00:00; the first block was produced at 12:00:23, and the data uses the observed time.
- **The Merge** was triggered by terminal total difficulty, not a block height. Block 15,537,393 crossed it and 15,537,394 was the first post-Merge block. Bellatrix (2022-09-06) prepared the consensus layer and is not a separate knot.
- **Post-Merge upgrades** activate by consensus epoch and slot; execution block numbers are cross-references, not the trigger. Where an announcement rounds to the minute, the chronology's observed second is used.
- **Combined names** (Shapella, Dencun, Pectra, Fusaka) are the stable short labels; the layer-specific pairs are aliases.

## Exclusions

| Candidate | Activation | Why it is left out |
|---|---|---|
| Frontier Thawing | 2015-09-07, block 200,000 | Launch stabilisation, subordinate to genesis and Homestead. |
| Tangerine Whistle, Spurious Dragon | 2016-10-18, 2016-11-22 | Emergency DoS remediation; two more 2016 knots would overcrowd the ring. |
| Istanbul | 2019-12-08, block 9,069,000 | A real EVM and gas upgrade, but less distinct than the same-year completion of Metropolis. |
| Muir, Arrow and Gray Glacier | 2020-01-02, 2021-12-09, 2022-06-30 | Difficulty-bomb postponements, subsumed by the Merge story. |
| Berlin | 2021-04-15, block 12,244,000 | Access lists and repricing; London five months later carries the fee-market change. |
| Altair, Bellatrix | 2021-10-27, 2022-09-06 | Consensus steps represented by Beacon genesis and The Merge. |
| Fusaka BPO1 and BPO2 | 2025-12-09, 2026-01-07 | Blob-parameter-only forks: capacity, not the feature set. |
| Glamsterdam, Hegotá and later | planned Q4 2026 and after | No future knot is drawn; add after an official mainnet activation. |
