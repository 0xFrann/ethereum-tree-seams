const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export function validateMilestones(records) {
  if (!Array.isArray(records)) throw new TypeError("Milestones must be an array.");
  const ids = new Set();
  records.forEach((record, index) => validateMilestoneRecord(record, `milestones[${index}]`, ids));
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

  return data;
}

export const ORIGIN = deepFreeze({
  id: "frontier-genesis",
  date: "2015-07-30",
  name: "Frontier genesis",
  summary: "Ethereum mainnet went live with the Frontier release.",
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
    summary: "The second release ended the bare-bones Frontier phase.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2016/02/29/homestead-release",
    confidence: "high",
    activation: "block 1,150,000",
  },
  {
    id: "dao-fork",
    date: "2016-07-20",
    name: "DAO fork",
    summary: "A single state change undid the DAO theft; the chain split.",
    category: "other",
    sourceUrl: "https://blog.ethereum.org/2016/07/20/hard-fork-completed",
    confidence: "high",
    activation: "block 1,920,000",
  },
  {
    id: "byzantium",
    date: "2017-10-16",
    name: "Byzantium",
    summary: "Metropolis began: new EVM opcodes and lower mining issuance.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2017/10/12/byzantium-hf-announcement",
    confidence: "high",
    activation: "block 4,370,000",
  },
  {
    id: "constantinople-st-petersburg",
    date: "2019-02-28",
    name: "Constantinople / St. Petersburg",
    summary: "Added CREATE2 and cheaper opcodes; EIP-1283 was pulled for safety.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2019/02/22/ethereum-constantinople-st-petersburg-upgrade-announcement",
    confidence: "high",
    activation: "block 7,280,000",
  },
  {
    id: "beacon-chain-genesis",
    date: "2020-12-01",
    name: "Beacon Chain genesis",
    summary: "The proof-of-stake chain started running beside mainnet.",
    category: "consensus",
    sourceUrl: "https://ethereum.org/roadmap/beacon-chain/",
    confidence: "high",
    activation: "epoch 0 · slot 0",
  },
  {
    id: "london-eip-1559",
    date: "2021-08-05",
    name: "London / EIP-1559",
    summary: "A burned base fee replaced the first-price gas auction.",
    category: "fee market",
    sourceUrl: "https://eips.ethereum.org/EIPS/eip-1559",
    confidence: "high",
    activation: "block 12,965,000",
  },
  {
    id: "the-merge",
    date: "2022-09-15",
    name: "The Merge",
    summary: "Mainnet dropped mining and moved to proof of stake.",
    category: "consensus",
    sourceUrl: "https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement",
    confidence: "high",
    activation: "TTD 58,750,000,000,000,000,000,000 · first PoS block 15,537,394",
  },
  {
    id: "shapella",
    date: "2023-04-12",
    name: "Shapella",
    summary: "Validators could finally withdraw staked ETH.",
    category: "withdrawals",
    sourceUrl: "https://blog.ethereum.org/2023/03/28/shapella-mainnet-announcement",
    confidence: "high",
    activation: "epoch 194,048 · slot 6,209,536 · execution block 17,034,870",
  },
  {
    id: "dencun",
    date: "2024-03-13",
    name: "Dencun",
    summary: "Blob transactions gave rollups cheap, temporary data.",
    category: "scaling",
    sourceUrl: "https://blog.ethereum.org/2024/02/27/dencun-mainnet-announcement",
    confidence: "high",
    activation: "epoch 269,568 · slot 8,626,176 · execution block 19,426,587",
  },
  {
    id: "pectra",
    date: "2025-05-07",
    name: "Pectra",
    summary: "Plain accounts gained code, and validators bigger balances.",
    category: "upgrade",
    sourceUrl: "https://blog.ethereum.org/2025/04/23/pectra-mainnet",
    confidence: "high",
    activation: "epoch 364,032 · slot 11,649,024 · execution block 22,431,084",
  },
  {
    id: "fusaka",
    date: "2025-12-03",
    name: "Fusaka",
    summary: "PeerDAS split blob custody across nodes, raising throughput.",
    category: "scaling",
    sourceUrl: "https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement",
    confidence: "high",
    activation: "epoch 411,392 · slot 13,164,544 · execution block 23,935,694",
  },
]);

export const EVENT_DATA = deepFreeze({
  origin: ORIGIN,
  milestones: MILESTONES,
});

validateEventData(EVENT_DATA);
