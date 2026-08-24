export const dynamic = "force-dynamic";

const RPC_URL = process.env.ETHEREUM_RPC_URL ?? "https://ethereum-rpc.publicnode.com";
const HEX_QUANTITY = /^0x[0-9a-f]+$/i;
const HASH = /^0x[0-9a-f]{64}$/i;

type RpcBlock = {
  hash?: unknown;
  number?: unknown;
  timestamp?: unknown;
  transactions?: unknown;
};

function parseQuantity(value: unknown) {
  if (typeof value !== "string" || !HEX_QUANTITY.test(value)) throw new Error("Invalid RPC quantity");
  const parsed = Number(BigInt(value));
  if (!Number.isSafeInteger(parsed)) throw new Error("RPC quantity exceeds safe integer range");
  return parsed;
}

export async function GET() {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: ["latest", false],
        id: 1,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error(`Ethereum RPC returned ${response.status}`);
    const payload = await response.json() as { result?: RpcBlock; error?: unknown };
    const block = payload.result;
    if (!block || typeof block.hash !== "string" || !HASH.test(block.hash)) {
      throw new Error("Ethereum RPC returned an invalid block");
    }
    if (!Array.isArray(block.transactions) || !block.transactions.every((item) => typeof item === "string" && HASH.test(item))) {
      throw new Error("Ethereum RPC returned invalid transactions");
    }

    return Response.json(
      {
        blockHash: block.hash,
        blockNumber: parseQuantity(block.number),
        timestamp: parseQuantity(block.timestamp),
        transactionCount: block.transactions.length,
      },
      { headers: { "Cache-Control": "public, max-age=4, s-maxage=8, stale-while-revalidate=16" } },
    );
  } catch {
    return Response.json(
      { error: "Ethereum mainnet head is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "12" } },
    );
  }
}
