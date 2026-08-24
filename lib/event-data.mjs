const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEALING_STATES = new Set(["healed", "closed", "open"]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

function assertDate(value, label) {
  assertString(value, label);
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`${label} must use ISO YYYY-MM-DD format.`);

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a real calendar date.`);
  }
}

function assertSourceUrl(value, label) {
  assertString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid source URL.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }
}

function validateId(id, label, ids) {
  assertString(id, `${label}.id`);
  if (!ID.test(id)) throw new Error(`${label}.id must be a kebab-case identifier.`);
  if (ids.has(id)) throw new Error(`Duplicate event id: ${id}.`);
  ids.add(id);
}

function validateMilestoneRecord(milestone, label, ids) {
  assertRecord(milestone, label);
  validateId(milestone.id, label, ids);
  assertDate(milestone.date, `${label}.date`);
  for (const field of ["name", "summary", "category", "confidence"]) {
    assertString(milestone[field], `${label}.${field}`);
  }
  assertSourceUrl(milestone.sourceUrl, `${label}.sourceUrl`);
  if (milestone.activation !== undefined) {
    assertString(milestone.activation, `${label}.activation`);
  }
}

function magnitudeFor(grossUsdAtIncident) {
  const clamped = Math.min(1_500_000_000, Math.max(1_000_000, grossUsdAtIncident));
  return Math.round(
    (100 * Math.log10(clamped / 1_000_000)) / Math.log10(1_500_000_000 / 1_000_000),
  );
}

function validateScarRecord(scar, label, ids) {
  assertRecord(scar, label);
  validateId(scar.id, label, ids);
  assertDate(scar.date, `${label}.date`);
  for (const field of [
    "name",
    "summary",
    "affectedLayer",
    "reportedImpact",
    "recoveryStatus",
    "confidence",
  ]) {
    assertString(scar[field], `${label}.${field}`);
  }
  assertSourceUrl(scar.sourceUrl, `${label}.sourceUrl`);

  if (!Number.isFinite(scar.grossUsdAtIncident) || scar.grossUsdAtIncident <= 0) {
    throw new Error(`${label}.grossUsdAtIncident must be a positive finite number.`);
  }
  if (
    !Number.isInteger(scar.visualMagnitude)
    || scar.visualMagnitude < 0
    || scar.visualMagnitude > 100
  ) {
    throw new Error(`${label}.visualMagnitude must be an integer from 0 through 100.`);
  }
  const expectedMagnitude = magnitudeFor(scar.grossUsdAtIncident);
  if (scar.visualMagnitude !== expectedMagnitude) {
    throw new Error(
      `${label}.visualMagnitude must equal ${expectedMagnitude} for its reported gross impact.`,
    );
  }
  if (!HEALING_STATES.has(scar.healingState)) {
    throw new Error(`${label}.healingState must be healed, closed, or open.`);
  }
  if (
    Object.hasOwn(scar, "ethereumProtocolCompromised")
    && scar.ethereumProtocolCompromised !== false
  ) {
    throw new Error(`${label} must not claim that the Ethereum protocol was compromised.`);
  }
}

export function validateMilestones(records) {
  if (!Array.isArray(records)) throw new TypeError("Milestones must be an array.");
  const ids = new Set();
  records.forEach((record, index) => validateMilestoneRecord(record, `milestones[${index}]`, ids));
  return records;
}

export function validateScars(records) {
  if (!Array.isArray(records)) throw new TypeError("Scars must be an array.");
  const ids = new Set();
  records.forEach((record, index) => validateScarRecord(record, `scars[${index}]`, ids));
  return records;
}

export function validateEventData(data) {
  assertRecord(data, "Event data");
  const ids = new Set();
  validateMilestoneRecord(data.origin, "origin", ids);

  if (!Array.isArray(data.milestones)) throw new TypeError("Milestones must be an array.");
  data.milestones.forEach((record, index) => {
    validateMilestoneRecord(record, `milestones[${index}]`, ids);
  });

  if (!Array.isArray(data.scars)) throw new TypeError("Scars must be an array.");
  data.scars.forEach((record, index) => validateScarRecord(record, `scars[${index}]`, ids));
  return data;
}

export const ORIGIN = deepFreeze({
  id: "frontier-genesis",
  date: "2015-07-30",
  name: "Frontier genesis",
  summary: "Ethereum mainnet launched with the Frontier release, establishing the programmable chain represented by this chronology.",
  category: "genesis",
  sourceUrl: "https://blog.ethereum.org/2015/07/30/ethereum-launches",
  confidence: "high",
  activation: "genesis block 0",
});

export const MILESTONES = deepFreeze([
  {
    id: "homestead",
    date: "2016-03-14",
    name: "Homestead",
    summary: "Ethereum's second major release moved the network beyond the deliberately bare-bones Frontier phase and added protocol and networking changes for future upgrades.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2016/02/29/homestead-release",
    confidence: "high",
    activation: "block 1,150,000",
  },
  {
    id: "dao-fork",
    date: "2016-07-20",
    name: "DAO fork",
    summary: "An exceptional protocol-level state intervention moved affected DAO balances into a recovery contract; participants who rejected it continued the chain now known as Ethereum Classic.",
    category: "other",
    sourceUrl: "https://blog.ethereum.org/2016/07/20/hard-fork-completed",
    confidence: "high",
    activation: "block 1,920,000",
  },
  {
    id: "byzantium",
    date: "2017-10-16",
    name: "Byzantium",
    summary: "The first Metropolis-stage fork expanded EVM error handling and cryptographic capabilities, delayed the difficulty bomb, and reduced proof-of-work issuance.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2017/10/12/byzantium-hf-announcement",
    confidence: "high",
    activation: "block 4,370,000",
  },
  {
    id: "constantinople-st-petersburg",
    date: "2019-02-28",
    name: "Constantinople / St. Petersburg",
    summary: "The simultaneous forks added CREATE2 and other EVM improvements while removing EIP-1283 after the originally planned activation was postponed for a security concern.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2019/02/22/ethereum-constantinople-st-petersburg-upgrade-announcement",
    confidence: "high",
    activation: "block 7,280,000",
  },
  {
    id: "beacon-chain-genesis",
    date: "2020-12-01",
    name: "Beacon Chain genesis",
    summary: "Ethereum's proof-of-stake Beacon Chain began producing blocks beside proof-of-work mainnet and later became Ethereum's consensus layer at The Merge.",
    category: "consensus",
    sourceUrl: "https://ethereum.org/roadmap/beacon-chain/",
    confidence: "high",
    activation: "epoch 0 · slot 0",
  },
  {
    id: "london-eip-1559",
    date: "2021-08-05",
    name: "London / EIP-1559",
    summary: "London redesigned Ethereum's transaction fee market by introducing a dynamically adjusted base fee that is burned and a separate priority fee.",
    category: "fee market",
    sourceUrl: "https://eips.ethereum.org/EIPS/eip-1559",
    confidence: "high",
    activation: "block 12,965,000",
  },
  {
    id: "the-merge",
    date: "2022-09-15",
    name: "The Merge",
    summary: "Ethereum mainnet ended proof-of-work block production and adopted the Beacon Chain's proof-of-stake consensus without resetting execution state or transaction history.",
    category: "consensus",
    sourceUrl: "https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement",
    confidence: "high",
    activation: "TTD 58,750,000,000,000,000,000,000 · first PoS block 15,537,394",
  },
  {
    id: "shapella",
    date: "2023-04-12",
    name: "Shapella",
    summary: "Shanghai execution changes and Capella consensus changes together enabled partial and full validator withdrawals from the Beacon Chain to the execution layer.",
    category: "withdrawals",
    sourceUrl: "https://blog.ethereum.org/2023/03/28/shapella-mainnet-announcement",
    confidence: "high",
    activation: "epoch 194,048 · slot 6,209,536 · execution block 17,034,870",
  },
  {
    id: "dencun",
    date: "2024-03-13",
    name: "Dencun",
    summary: "Dencun introduced ephemeral blob transactions and a separate blob fee market, giving rollups a cheaper data-availability path than calldata.",
    category: "scaling",
    sourceUrl: "https://blog.ethereum.org/2024/02/27/dencun-mainnet-announcement",
    confidence: "high",
    activation: "epoch 269,568 · slot 8,626,176 · execution block 19,426,587",
  },
  {
    id: "pectra",
    date: "2025-05-07",
    name: "Pectra",
    summary: "Pectra added EOA code delegation and major validator-management improvements, including higher effective balances and execution-triggered exits.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2025/04/23/pectra-mainnet",
    confidence: "high",
    activation: "epoch 364,032 · slot 11,649,024 · execution block 22,431,084",
  },
  {
    id: "fusaka",
    date: "2025-12-03",
    name: "Fusaka",
    summary: "Fusaka introduced PeerDAS, distributing blob-data custody and sampling across nodes to enable safer growth in blob throughput.",
    category: "scaling",
    sourceUrl: "https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement",
    confidence: "high",
    activation: "epoch 411,392 · slot 13,164,544 · execution block 23,935,694",
  },
]);

export const SCARS = deepFreeze([
  {
    id: "the-dao-2016",
    date: "2016-06-17",
    name: "The DAO exploit",
    summary: "An attacker exploited The DAO's application-contract logic and diverted about one third of its ETH into a child DAO. Ethereum consensus was not broken.",
    affectedLayer: "application smart contract on Ethereum",
    grossUsdAtIncident: 60_000_000,
    reportedImpact: "Approximately 3.6M ETH; about $60M gross at the incident date.",
    recoveryStatus: "The 2016-07-20 protocol fork created a recovery path for DAO holders on the ETH chain; this was not ordinary attacker repayment and does not erase the Ethereum Classic branch.",
    sourceUrl: "https://www.sec.gov/litigation/investreport/34-81207.pdf",
    confidence: "high",
    visualMagnitude: 56,
    healingState: "healed",
  },
  {
    id: "parity-freeze-2017",
    date: "2017-11-06",
    name: "Parity multisig library self-destruct",
    summary: "A user became owner of a shared Parity wallet library and triggered its self-destruct path, leaving dependent wallets unable to execute. This was application-level immobilization, not attacker theft.",
    affectedLayer: "wallet smart-contract library on Ethereum",
    grossUsdAtIncident: 150_000_000,
    reportedImpact: "513,774.16 ETH frozen; approximately $150M at the incident date.",
    recoveryStatus: "The affected ETH remained locked as checked, with no generally accepted protocol recovery; economic impairment is unresolved and differs from theft.",
    sourceUrl: "https://medium.com/paritytech/a-postmortem-on-the-parity-multi-sig-library-self-destruct-63daca3a4cf7",
    confidence: "high",
    visualMagnitude: 69,
    healingState: "closed",
  },
  {
    id: "poly-network-2021",
    date: "2021-08-10",
    name: "Poly Network exploit",
    summary: "An attacker abused Poly Network's cross-chain contract logic and moved a mixed portfolio from Ethereum, BSC, and Polygon. Ethereum's base protocol was not compromised.",
    affectedLayer: "cross-chain bridge/application contracts",
    grossUsdAtIncident: 612_000_000,
    reportedImpact: "Mixed cross-chain assets valued at approximately $612M gross at the incident date.",
    recoveryStatus: "Poly reported that all affected assets were returned or restored within 15 days; $33.4M USDT had been issuer-frozen during the process.",
    sourceUrl: "https://medium.com/poly-network/honour-exploit-and-code-how-we-lost-610m-dollar-and-got-it-back-c4a7d0606267",
    confidence: "high",
    visualMagnitude: 88,
    healingState: "healed",
  },
  {
    id: "wormhole-2022",
    date: "2022-02-02",
    name: "Wormhole bridge exploit",
    summary: "An attacker bypassed verification in Wormhole's Solana-side contract, minted 120,000 uncollateralized weETH, and redeemed 93,750 for native ETH. The vulnerable component was not Ethereum.",
    affectedLayer: "Solana-side bridge contract securing Ethereum-backed wrapped assets",
    grossUsdAtIncident: 320_000_000,
    reportedImpact: "120,000 unbacked weETH, including 93,750 redeemed for ETH; approximately $320M gross.",
    recoveryStatus: "Jump supplied 120,000 ETH to restore bridge backing; this recapitalized users but did not recover the stolen assets from the attacker.",
    sourceUrl: "https://wormholecrypto.medium.com/wormhole-incident-report-02-02-22-ad9b8f21eec6",
    confidence: "high",
    visualMagnitude: 79,
    healingState: "healed",
  },
  {
    id: "ronin-2022",
    date: "2022-03-23",
    name: "Ronin bridge validator compromise",
    summary: "Attackers controlled five of nine Ronin validator keys and authorized fraudulent bridge withdrawals. Ronin is an Ethereum-linked sidechain; Ethereum consensus was not compromised.",
    affectedLayer: "Ethereum sidechain validator and bridge custody",
    grossUsdAtIncident: 625_000_000,
    reportedImpact: "173,600 ETH and 25.5M USDC; approximately $625M gross by public discovery.",
    recoveryStatus: "At least $35.7M was documented as seized or recovered by 2024; reimbursement or recapitalization is not recovery from the attacker.",
    sourceUrl: "https://roninchain.com/blog/posts/securing-ronin-6513cc78a5edc1001b03c365",
    confidence: "high",
    visualMagnitude: 88,
    healingState: "closed",
  },
  {
    id: "nomad-2022",
    date: "2022-08-01",
    name: "Nomad bridge exploit",
    summary: "A faulty Replica initialization caused messages to be accepted without valid proof, and many addresses copied the withdrawal pattern. The bridge application failed; Ethereum's base protocol was not compromised.",
    affectedLayer: "cross-chain bridge smart contracts",
    grossUsdAtIncident: 186_000_000,
    reportedImpact: "Mixed bridged tokens valued at approximately $186M gross.",
    recoveryStatus: "About $36M was returned; the remaining principal is not a precise victim net loss because asset values and later distributions changed.",
    sourceUrl: "https://medium.com/nomad-xyz-blog/the-road-to-recovery-6abe5eec8ff1",
    confidence: "high",
    visualMagnitude: 71,
    healingState: "closed",
  },
  {
    id: "euler-2023",
    date: "2023-03-13",
    name: "Euler V1 exploit",
    summary: "An attacker exploited Euler V1's application accounting around donateToReserves and liquidations, draining ETH and DAI. The exploiter later returned all recoverable assets after negotiations.",
    affectedLayer: "Ethereum lending application contracts",
    grossUsdAtIncident: 197_000_000,
    reportedImpact: "Approximately 96,832 ETH and 43.6M DAI; about $197M gross at the incident date.",
    recoveryStatus: "All recoverable assets were returned; their later $240M market value must not be treated as a larger original loss or subtracted from $197M.",
    sourceUrl: "https://www.euler.finance/blog/war-peace-behind-the-scenes-of-eulers-240m-exploit-recovery",
    confidence: "high",
    visualMagnitude: 72,
    healingState: "healed",
  },
  {
    id: "bybit-2025",
    date: "2025-02-21",
    name: "Bybit cold-wallet theft",
    summary: "Malicious JavaScript served through compromised Safe infrastructure altered a cold-wallet transaction presented to Bybit signers. This was an exchange custody and signing compromise; Ethereum and the Safe contracts were not broken.",
    affectedLayer: "centralized exchange custody and wallet-signing infrastructure",
    grossUsdAtIncident: 1_500_000_000,
    reportedImpact: "Approximately 401,347 ETH-family assets; up to $1.5B gross at the incident snapshot.",
    recoveryStatus: "Bybit reported approximately $48.4M recovered by 2026-08-07; asset replacement or solvency does not reduce the theft and recovery remains ongoing.",
    sourceUrl: "https://www.bybit.com/en/press/post/bybit-confirms-security-integrity-amid-safe-wallet-incident-no-compromise-in-infrastructure-blt9986889e919da8d2",
    confidence: "high",
    visualMagnitude: 100,
    healingState: "open",
  },
  {
    id: "kelpdao-2026",
    date: "2026-04-18",
    name: "KelpDAO rsETH bridge exploit",
    summary: "Attackers compromised RPC inputs to a single-verifier path and induced an attestation for a nonexistent source-chain burn, releasing rsETH from escrow. Neither Ethereum consensus nor the bridge contract code was exploited.",
    affectedLayer: "cross-chain verification infrastructure and Ethereum bridge escrow",
    grossUsdAtIncident: 292_000_000,
    reportedImpact: "116,500 rsETH released from bridge escrow; approximately $292M gross.",
    recoveryStatus: "30,765.6675 ETH, about $71.1M, was frozen but not returned; broader recoverable estimates remain conditional and the incident is unresolved.",
    sourceUrl: "https://layerzero.network/publications/kelpdao-incident-report.pdf",
    confidence: "high",
    visualMagnitude: 78,
    healingState: "open",
  },
]);

export const EVENT_DATA = deepFreeze({
  origin: ORIGIN,
  milestones: MILESTONES,
  scars: SCARS,
});

validateEventData(EVENT_DATA);
