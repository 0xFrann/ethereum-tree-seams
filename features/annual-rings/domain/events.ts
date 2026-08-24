import type { Milestone, Scar } from './types';
import { assertIsoDate } from './dates';

const milestone = (
  id: string,
  date: string,
  name: string,
  summary: string,
  category: string,
  activation: string,
  sourceUrl: string,
): Milestone => ({ id, date, name, summary, category, activation, sourceUrl });

const scar = (
  id: string,
  date: string,
  name: string,
  summary: string,
  affectedLayer: string,
  grossUsdAtIncident: number,
  reportedImpact: string,
  recoveryStatus: string,
  healingState: Scar['healingState'],
  sourceUrl: string,
): Scar => ({
  id,
  date,
  name,
  summary,
  affectedLayer,
  grossUsdAtIncident,
  reportedImpact,
  recoveryStatus,
  healingState,
  sourceUrl,
  visualMagnitude: scarMagnitude(grossUsdAtIncident),
});

export const ORIGIN = milestone(
  'frontier-genesis',
  '2015-07-30',
  'Frontier genesis',
  'Ethereum mainnet began with the Frontier release.',
  'genesis',
  'genesis block 0',
  'https://blog.ethereum.org/2015/07/30/ethereum-launches',
);

export const MILESTONES: readonly Milestone[] = [
  milestone(
    'byzantium',
    '2017-10-16',
    'Byzantium',
    'The first Metropolis-stage fork expanded Ethereum’s cryptographic and virtual-machine capabilities.',
    'upgrade',
    'block 4,370,000',
    'https://blog.ethereum.org/2017/10/12/byzantium-hf-announcement',
  ),
  milestone(
    'constantinople-st-petersburg',
    '2019-02-28',
    'Constantinople / St. Petersburg',
    'The paired forks added CREATE2 and removed a postponed pricing change.',
    'upgrade',
    'block 7,280,000',
    'https://blog.ethereum.org/2019/02/22/ethereum-constantinople-st-petersburg-upgrade-announcement',
  ),
  milestone(
    'beacon-chain-genesis',
    '2020-12-01',
    'Beacon Chain genesis',
    'Ethereum’s proof-of-stake consensus chain began producing blocks.',
    'consensus',
    'epoch 0',
    'https://ethereum.org/roadmap/beacon-chain/',
  ),
  milestone(
    'london',
    '2021-08-05',
    'London',
    'EIP-1559 introduced Ethereum’s base-fee market and burn mechanism.',
    'fee market',
    'block 12,965,000',
    'https://eips.ethereum.org/EIPS/eip-1559',
  ),
  milestone(
    'the-merge',
    '2022-09-15',
    'The Merge',
    'Ethereum ended proof-of-work block production and adopted proof of stake.',
    'consensus',
    'first PoS block 15,537,394',
    'https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement',
  ),
  milestone(
    'shapella',
    '2023-04-12',
    'Shapella',
    'Shanghai and Capella enabled validator withdrawals.',
    'withdrawals',
    'epoch 194,048',
    'https://blog.ethereum.org/2023/03/28/shapella-mainnet-announcement',
  ),
  milestone(
    'dencun',
    '2024-03-13',
    'Dencun',
    'EIP-4844 introduced blob transactions for rollup data availability.',
    'scaling',
    'epoch 269,568',
    'https://blog.ethereum.org/2024/02/27/dencun-mainnet-announcement',
  ),
  milestone(
    'pectra',
    '2025-05-07',
    'Pectra',
    'Prague–Electra added account delegation and validator-management improvements.',
    'upgrade',
    'epoch 364,032',
    'https://blog.ethereum.org/2025/04/23/pectra-mainnet',
  ),
];

export const SCARS: readonly Scar[] = [
  scar(
    'the-dao-2016',
    '2016-06-17',
    'The DAO exploit',
    'A reentrancy flaw in The DAO application contract diverted ETH; Ethereum consensus was not broken.',
    'application smart contract',
    60_000_000,
    'About 3.6M ETH, approximately $60M at the incident date.',
    'A protocol recovery path was created for DAO holders on the ETH chain.',
    'healed',
    'https://www.sec.gov/litigation/investreport/34-81207.pdf',
  ),
  scar(
    'parity-freeze-2017',
    '2017-11-06',
    'Parity multisig freeze',
    'A shared wallet-library self-destruct left dependent wallets unable to execute.',
    'wallet smart-contract library',
    150_000_000,
    '513,774 ETH frozen, approximately $150M at the incident date.',
    'The affected ETH remains locked.',
    'closed',
    'https://medium.com/paritytech/a-postmortem-on-the-parity-multi-sig-library-self-destruct-63daca3a4cf7',
  ),
  scar(
    'poly-network-2021',
    '2021-08-10',
    'Poly Network exploit',
    'A cross-chain contract flaw moved a mixed portfolio; Ethereum’s base protocol was not compromised.',
    'cross-chain bridge contracts',
    612_000_000,
    'Approximately $612M gross.',
    'Poly Network reported assets returned or restored.',
    'healed',
    'https://medium.com/poly-network/honour-exploit-and-code-how-we-lost-610m-dollar-and-got-it-back-c4a7d0606267',
  ),
  scar(
    'wormhole-2022',
    '2022-02-02',
    'Wormhole bridge exploit',
    'A Solana-side verification failure created unbacked wrapped ETH.',
    'bridge verification contract',
    320_000_000,
    'Approximately $320M gross.',
    'The bridge was recapitalized.',
    'healed',
    'https://wormholecrypto.medium.com/wormhole-incident-report-02-02-22-ad9b8f21eec6',
  ),
  scar(
    'ronin-2022',
    '2022-03-23',
    'Ronin validator compromise',
    'Compromised validator keys authorized fraudulent bridge withdrawals.',
    'sidechain validator and bridge custody',
    625_000_000,
    'Approximately $625M gross.',
    'Recovery and reimbursement remain distinct from the theft.',
    'closed',
    'https://roninchain.com/blog/posts/securing-ronin-6513cc78a5edc1001b03c365',
  ),
  scar(
    'nomad-2022',
    '2022-08-01',
    'Nomad bridge exploit',
    'A faulty initialization accepted withdrawals without valid proofs.',
    'cross-chain bridge contracts',
    186_000_000,
    'Approximately $186M gross.',
    'Some funds were returned.',
    'closed',
    'https://medium.com/nomad-xyz-blog/the-road-to-recovery-6abe5eec8ff1',
  ),
  scar(
    'euler-2023',
    '2023-03-13',
    'Euler V1 exploit',
    'An application accounting flaw drained the lending protocol.',
    'Ethereum lending application',
    197_000_000,
    'Approximately $197M gross.',
    'Recoverable assets were returned.',
    'healed',
    'https://www.euler.finance/blog/war-peace-behind-the-scenes-of-eulers-240m-exploit-recovery',
  ),
  scar(
    'bybit-2025',
    '2025-02-21',
    'Bybit cold-wallet theft',
    'Compromised signing infrastructure altered a custody transaction.',
    'exchange custody and signing infrastructure',
    1_500_000_000,
    'Up to $1.5B gross at the incident snapshot.',
    'Recovery remains ongoing.',
    'open',
    'https://www.bybit.com/en/press/post/bybit-confirms-security-integrity-amid-safe-wallet-incident-no-compromise-in-infrastructure-blt9986889e919da8d2',
  ),
];

export function scarMagnitude(value: number): number {
  const minimum = 1_000_000;
  const maximum = 1_500_000_000;
  const clamped = Math.min(maximum, Math.max(minimum, value));
  return Math.round(
    (100 * Math.log10(clamped / minimum)) / Math.log10(maximum / minimum),
  );
}

export function validateEvents(
  milestones: readonly Milestone[],
  scars: readonly Scar[],
): void {
  const ids = new Set<string>();
  for (const event of [...milestones, ...scars]) {
    assertIsoDate(event.date);
    if (!/^https?:\/\//.test(event.sourceUrl))
      throw new Error(`${event.id} needs a web source.`);
    if (ids.has(event.id)) throw new Error(`Duplicate event id: ${event.id}.`);
    ids.add(event.id);
  }
}

validateEvents(MILESTONES, SCARS);
