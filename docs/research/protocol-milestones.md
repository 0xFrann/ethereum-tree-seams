# Ethereum protocol milestones

Checked: **2026-08-21**  
Scope: Ethereum mainnet genesis through 2026-08-21. Dates and times are UTC.  
Companion data: [`protocol-milestones.json`](./protocol-milestones.json)

## Recommendation

Use **Frontier genesis as the origin/pith marker**, not as a knot. Use the following **11 visible knots**: Homestead, DAO fork, Byzantium, Constantinople/St. Petersburg, Beacon Chain genesis, London, The Merge, Shapella, Dencun, Pectra, and Fusaka.

This is intentionally not a complete fork history. It keeps events that changed Ethereum's operating phase, consensus, fee market, scaling model, staking lifecycle, or broadly useful execution behavior; it omits emergency maintenance, difficulty-only postponements, preparatory forks subsumed by a larger event, and parameter-only changes. No entry claims that a protocol event caused a market movement.

## Selection rubric

Each candidate was judged on protocol impact, historical importance, recognizability, narrative value, and visual spacing. “Visible knot” means a candidate should be available to the renderer; genesis is separately recommended as an origin marker. Exact observed activation timestamps and block/epoch/slot values use ethereum.org's maintained fork chronology, while EF announcements and EIPs corroborate activation triggers and protocol content.

## Recommended visible chronology

| Date (UTC) | Event | Activation | Category | Treatment | Why visible |
|---|---|---:|---|---|---|
| 2015-07-30 15:26:13 | Frontier genesis | block 0 | genesis | origin marker | The conceptual beginning of Ethereum mainnet and the tree chronology. |
| 2016-03-14 18:49:53 | Homestead | block 1,150,000 | upgrade | knot | Ethereum's second major release moved the network beyond the deliberately bare-bones Frontier phase and added forward-compatible networking. |
| 2016-07-20 13:20:40 | DAO fork | block 1,920,000 | other | knot | An exceptional protocol-level state intervention whose rejection also produced the persistent Ethereum Classic chain. |
| 2017-10-16 05:22:11 | Byzantium | block 4,370,000 | upgrade | knot | The first Metropolis stage substantially expanded EVM error handling and cryptographic capabilities while changing issuance. |
| 2019-02-28 19:52:04 | Constantinople / St. Petersburg | block 7,280,000 | upgrade | knot | The second Metropolis stage added CREATE2 and other EVM improvements while St. Petersburg simultaneously disabled the unsafe EIP-1283 change. |
| 2020-12-01 12:00:23 | Beacon Chain genesis | epoch 0, slot 0 | consensus | knot | It launched Ethereum's proof-of-stake consensus chain, which later became mainnet's consensus layer. |
| 2021-08-05 12:33:42 | London / EIP-1559 | block 12,965,000 | fee market | knot | EIP-1559 replaced the first-price-only fee market with a protocol base fee that is burned, plus a priority fee. |
| 2022-09-15 06:42:42 | Paris / The Merge | block 15,537,394; TTD 58,750,000,000,000,000,000,000 | consensus | knot | Ethereum mainnet stopped proof-of-work block production and adopted the Beacon Chain's proof-of-stake consensus. |
| 2023-04-12 22:27:35 | Shanghai–Capella / Shapella | epoch 194,048; slot 6,209,536; block 17,034,870 | withdrawals | knot | It completed the initial staking lifecycle by enabling partial and full validator withdrawals. |
| 2024-03-13 13:55:35 | Cancun–Deneb / Dencun | epoch 269,568; slot 8,626,176; block 19,426,587 | scaling | knot | EIP-4844 introduced blob transactions, a new temporary data market designed for rollups. |
| 2025-05-07 10:05:11 | Prague–Electra / Pectra | epoch 364,032; slot 11,649,024; block 22,431,084 | upgrade | knot | It added EIP-7702 account delegation and major validator-management improvements including higher effective balances and execution-triggered exits. |
| 2025-12-03 21:49:11 | Fulu–Osaka / Fusaka | epoch 411,392; slot 13,164,544; block 23,935,694 | scaling | knot | PeerDAS changed blob-data availability so nodes sample and custody portions rather than every node downloading every blob, enabling safer blob scaling. |

## Candidate notes and evidence

### Frontier genesis — include as origin, not a knot

Frontier was Ethereum's first live mainnet release, producing genesis block 0 on 2015-07-30 at 15:26:13 UTC. It was deliberately bare-bones and aimed at technical users, but established the programmable mainnet whose growth the visualization represents.

- Primary: [ethereum.org fork chronology](https://ethereum.org/ethereum-forks/#frontier) — maintained official chronology, observed time.
- Backup: [EF, “Ethereum Launches”](https://blog.ethereum.org/2015/07/30/ethereum-launches) — official launch announcement.
- Confidence: **high**.
- Naming/date detail: EIP-6953 labels Frontier's activation trigger as block 1, while ethereum.org identifies genesis as block 0. The visualization should label the origin `2015-07-30` and treat block 0 as genesis, not imply that block 1 is genesis.

### Homestead — include

Homestead activated at block 1,150,000 on 2016-03-14 at 18:49:53 UTC and was Ethereum's second major release. It introduced several protocol changes, `DELEGATECALL`, and devp2p forward-compatibility rules that supported later upgrades.

- Primary: [EF, “Homestead Release”](https://blog.ethereum.org/2016/02/29/homestead-release) — official protocol announcement and activation block.
- Backup: [ethereum.org fork chronology](https://ethereum.org/ethereum-forks/#homestead) — observed activation time and summary.
- Confidence: **high**.
- Naming/date detail: the announcement predicted “roughly” Pi Day; the exact observed timestamp comes from the maintained chronology.

### DAO fork — include as protocol intervention

The DAO fork activated at block 1,920,000 on 2016-07-20 at 13:20:40 UTC and applied an irregular state change that moved affected DAO balances into a recovery contract. Some participants rejected the intervention and continued the unforked chain, now Ethereum Classic.

- Primary: [EF, “Hard Fork Completed”](https://blog.ethereum.org/2016/07/20/hard-fork-completed) — official completion report and state-change description.
- Backup: [ethereum.org fork chronology](https://ethereum.org/ethereum-forks/#dao-fork) — exact observed time and historical context.
- Confidence: **high**.
- Naming/date detail: this candidate is the **DAO fork**, not the earlier DAO contract exploit. Render the fork as a knot and leave the exploit/loss to the scar chronology so the same incident is not falsely described as a protocol hack.

### Byzantium — include

Byzantium activated at block 4,370,000 on 2017-10-16 at 05:22:11 UTC as the first Metropolis-stage fork. It added `REVERT`, `STATICCALL`, receipt status, and alt_bn128 cryptographic operations, while delaying the difficulty bomb and reducing the block reward from 5 ETH to 3 ETH.

- Primary: [EF, “Byzantium HF Announcement”](https://blog.ethereum.org/2017/10/12/byzantium-hf-announcement) — official protocol announcement and changes.
- Backup: [ethereum.org fork chronology](https://ethereum.org/ethereum-forks/#byzantium) — exact observed activation time.
- Confidence: **high**.
- Naming/date detail: “Metropolis” was the broader development phase; Byzantium and Constantinople are distinct activations and should not be collapsed into one dated event.

### Constantinople / St. Petersburg — include as one simultaneous knot

Constantinople and St. Petersburg activated together at block 7,280,000 on 2019-02-28 at 19:52:04 UTC. Constantinople added `CREATE2`, bitwise shifting, `EXTCODEHASH`, and an issuance/difficulty adjustment; St. Petersburg simultaneously removed EIP-1283 after the originally planned activation was postponed for a security concern.

- Primary: [EF, “Ethereum Constantinople/St. Petersburg Upgrade Announcement”](https://blog.ethereum.org/2019/02/22/ethereum-constantinople-st-petersburg-upgrade-announcement) — official naming, shared activation block, and protocol content.
- Backup: [ethereum.org fork chronology](https://ethereum.org/ethereum-forks/#constantinople) — exact observed activation time.
- Confidence: **high**.
- Naming/date detail: this is one visible knot with both canonical simultaneous fork names; “Constantinople” alone is a recognizable short label, but the detail view should retain St. Petersburg.

### Beacon Chain genesis — include

The Beacon Chain began producing blocks at epoch 0/slot 0 on 2020-12-01 at 12:00:23 UTC after its minimum deposit conditions were met. It initially ran beside proof-of-work mainnet without executing user transactions, then became Ethereum's consensus layer at The Merge.

- Primary: [ethereum.org, “The Beacon Chain”](https://ethereum.org/roadmap/beacon-chain/) — official roadmap history and protocol role.
- Backup: [EF, “eth2 quick update no. 19”](https://blog.ethereum.org/2020/11/04/eth2-quick-update-no-19) — mainnet specification, deposit condition, and minimum genesis time.
- Confidence: **high**.
- Naming/date detail: the configured `MIN_GENESIS_TIME` was 12:00:00 UTC; the maintained chronology records the first produced block at 12:00:23 UTC. Use the observed time for event data and note that the then-current “eth2” name is deprecated.

### London / EIP-1559 — include

London activated at block 12,965,000 on 2021-08-05 at 12:33:42 UTC. Its central change, EIP-1559, introduced a dynamically adjusted base fee that is burned and a separate priority fee, materially redesigning Ethereum's transaction fee market.

- Primary: [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) — final protocol specification and mechanism.
- Backup: [EF, “London Mainnet Announcement”](https://blog.ethereum.org/2021/07/15/london-mainnet-announcement) — official mainnet block announcement; [ethereum.org chronology](https://ethereum.org/ethereum-forks/#london) provides the observed time.
- Confidence: **high**.
- Naming/date detail: display `London / EIP-1559`; London contained other EIPs, so do not equate the whole fork exclusively with EIP-1559 in the detailed summary.

### Paris / The Merge — include

The Merge completed on 2022-09-15 at 06:42:42 UTC when terminal total difficulty 58,750,000,000,000,000,000,000 caused block 15,537,394 to become the first proof-of-stake execution payload. This ended proof-of-work block production on Ethereum mainnet and joined its execution history to Beacon Chain consensus without resetting state or transaction history.

- Primary: [EF, “Mainnet Merge Announcement”](https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement) — official two-stage activation specification and TTD.
- Backup: [ethereum.org, “The Merge”](https://ethereum.org/roadmap/merge/) and [fork chronology](https://ethereum.org/ethereum-forks/#paris-the-merge) — protocol explanation and observed block/time.
- Confidence: **high**.
- Naming/date detail: Bellatrix (epoch 144,896 on 2022-09-06) prepared the consensus layer; Paris was the TTD-triggered execution transition commonly called The Merge. The chronology notes that PoW block 15,537,393 crossed TTD and the next block, 15,537,394, was the first post-Merge block.

### Shanghai–Capella / Shapella — include

Shapella activated at epoch 194,048 (slot 6,209,536; execution block 17,034,870) on 2023-04-12 at 22:27:35 UTC. Shanghai execution changes and Capella consensus changes together enabled validator rewards and principal to be withdrawn from the Beacon Chain to the execution layer.

- Primary: [EF, “Mainnet Shapella Announcement”](https://blog.ethereum.org/2023/03/28/shapella-mainnet-announcement) — official epoch, time, naming, and functionality.
- Backup: [ethereum.org fork chronology](https://ethereum.org/ethereum-forks/#shanghai-capella-shapella) — observed block, epoch, slot, and time.
- Confidence: **high**.
- Naming/date detail: `Shapella` is the conventional combined name; retain `Shanghai–Capella` as the canonical layer-specific alias.

### Cancun–Deneb / Dencun — include

Dencun activated at epoch 269,568 (slot 8,626,176; execution block 19,426,587) on 2024-03-13 at 13:55:35 UTC. Its headline EIP-4844 introduced ephemeral blob transactions and a separate blob fee market, giving rollups a cheaper data-availability path than calldata.

- Primary: [EF, “Dencun Mainnet Announcement”](https://blog.ethereum.org/2024/02/27/dencun-mainnet-announcement) — official epoch, time, and included EIPs.
- Backup: [ethereum.org, “Dencun”](https://ethereum.org/roadmap/dencun/) and [fork chronology](https://ethereum.org/ethereum-forks/#cancun-deneb-dencun) — protocol explanation and observed block/slot/time.
- Confidence: **high**.
- Naming/date detail: the announcement rounds activation to 13:55 UTC; the chronology records 13:55:35. Use the exact observed timestamp.

### Prague–Electra / Pectra — include

Pectra activated at epoch 364,032 (slot 11,649,024; execution block 22,431,084) on 2025-05-07 at 10:05:11 UTC. It added EIP-7702 EOA code delegation, raised validator effective-balance limits through EIP-7251, enabled execution-triggered validator exits through EIP-7002, and increased blob capacity.

- Primary: [EF, “Pectra Mainnet Announcement”](https://blog.ethereum.org/2025/04/23/pectra-mainnet) — official epoch, time, and overview.
- Backup: [EIP-7600, Hardfork Meta — Pectra](https://eips.ethereum.org/EIPS/eip-7600) and [ethereum.org chronology](https://ethereum.org/ethereum-forks/#prague-electra-pectra) — final EIP set and observed block/slot.
- Confidence: **high**.
- Naming/date detail: `Pectra` is the combined short name for Prague (execution) and Electra (consensus).

### Fulu–Osaka / Fusaka — include

Fusaka activated at epoch 411,392 (slot 13,164,544; execution block 23,935,694) on 2025-12-03 at 21:49:11 UTC. Its headline PeerDAS change distributed blob custody and sampling across nodes, enabling blob throughput to scale without requiring every node to download every blob; it also included execution-layer resource limits and repricing.

- Primary: [EF, “Fusaka Mainnet Announcement”](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) — official slot, time, and overview.
- Backup: [EIP-7607, Hardfork Meta — Fusaka](https://eips.ethereum.org/EIPS/eip-7607) and [ethereum.org chronology](https://ethereum.org/ethereum-forks/#fulu-osaka-fusaka) — final activation epoch/EIP set and observed block.
- Confidence: **high**.
- Naming/date detail: official sources use both layer orderings (`Fulu–Osaka` and `Osaka/Fulu`); `Fusaka` is the stable short label.

## Explicit exclusions

| Candidate(s) | Date / activation | Decision | Reason |
|---|---|---|---|
| Frontier Thawing | 2015-09-07; block 200,000 | exclude | Important launch stabilization, but its gas-limit thaw is visually and narratively subordinate to genesis and Homestead. |
| Tangerine Whistle and Spurious Dragon | 2016-10-18 / 2016-11-22; blocks 2,463,000 / 2,675,000 | exclude | Material emergency DoS remediation, but two additional 2016 knots would overcrowd the ring; document them in methodology rather than treating every emergency fork as a headline milestone. |
| Istanbul | 2019-12-08; block 9,069,000 | exclude | A meaningful EVM/cryptography and gas-cost upgrade, but less distinct to a general narrative than the same-year completion of Metropolis. |
| Muir, Arrow, and Gray Glacier | 2020-01-02 / 2021-12-09 / 2022-06-30 | exclude | These chiefly postponed the proof-of-work difficulty bomb; they are maintenance steps subsumed by the eventual Merge story. |
| Berlin | 2021-04-15; block 12,244,000 | exclude | Access lists and gas repricing mattered technically, but London five months later has much greater fee-market and public narrative significance. |
| Altair and Bellatrix | 2021-10-27 / 2022-09-06; epochs 74,240 / 144,896 | exclude | Important consensus upgrades, but they are preparatory steps represented by Beacon genesis and The Merge. |
| Fusaka BPO1 and BPO2 | 2025-12-09 / 2026-01-07; epochs 412,672 / 419,072 | exclude | Preconfigured blob-parameter-only forks changed capacity, not the protocol feature set; including them would blur the distinction between named milestones and parameter tuning. |
| Glamsterdam | planned Q4 2026; no activation epoch/date as of check | exclude pending activation | It is in development and scheduled after the 2026-08-21 cutoff. Do not render a future knot; revisit only after an official mainnet activation announcement and successful activation. |
| Hegotá and later roadmap items | 2027 or later; unscheduled | exclude | Future roadmap work is outside the date scope and remains subject to change. |

## Disputes and implementation cautions

- **Date precision:** scheduled announcements sometimes state a minute while the maintained chronology supplies the observed second. Machine data uses the observed timestamp and preserves the announcement as corroboration.
- **Post-Merge block numbers:** upgrades activate by consensus-layer epoch/slot. Execution block numbers are useful observed cross-references, not the activation trigger.
- **Merge trigger:** The Merge was triggered by terminal total difficulty, not a preselected block height. Store the TTD and the first post-Merge block separately.
- **DAO classification:** the intervention is a protocol milestone; the application exploit is not a protocol failure. If both datasets display the date, their labels and semantic types must remain distinct.
- **Genesis semantics:** genesis is block 0; EIP-6953's Frontier trigger value of block 1 reflects its activation taxonomy, not a different genesis date.
- **Future cutoff:** no upgrade after Fusaka had activated by 2026-08-21. Glamsterdam was officially described as upcoming for Q4 2026, so it is an exclusion, not a low-confidence accepted milestone.

## Source policy

All accepted facts use primary Ethereum sources: Ethereum Foundation protocol announcements, ethereum.org maintained protocol histories, and final EIPs. Block explorer links embedded by ethereum.org are corroborative observations, not the sole basis for inclusion. Every URL in the JSON records its source type, check date, confidence, and any naming or timing dispute.
