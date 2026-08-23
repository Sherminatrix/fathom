/**
 * Base USDC (x402 exact) inspector.
 * Agent sends USDC to PLATFORM_BASE_WALLET_ADDRESS, retries with the tx hash.
 * No private key on this host — receive address only.
 */

import axios from "axios";

export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = 8453;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_RPC = "https://mainnet.base.org";

export function getBasePayTo() {
  const a = process.env.PLATFORM_BASE_WALLET_ADDRESS?.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(a || "") ? a : null;
}

/** @param {string} hash */
export function isEvmTxHash(hash) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(hash || "").trim());
}

/** @param {string | undefined} topic */
function topicAddress(topic) {
  if (!topic || topic.length < 42) return "";
  return `0x${topic.slice(-40)}`;
}

/** @param {string} method @param {unknown[]} params */
async function rpc(method, params) {
  const url = process.env.BASE_RPC_URL || DEFAULT_RPC;
  const { data } = await axios.post(
    url,
    { jsonrpc: "2.0", id: 1, method, params },
    { timeout: 12_000, headers: { "Content-Type": "application/json" } },
  );
  if (data.error) {
    const err = /** @type {Error & { code?: unknown }} */ (new Error(data.error.message || "Base RPC error"));
    err.code = data.error.code;
    throw err;
  }
  return data.result;
}

/**
 * @param {string} txHash
 * @param {number} minUsd
 */
export async function inspectUsdcPayment(txHash, minUsd) {
  const payTo = getBasePayTo();
  if (!payTo) return { ok: false, code: "NO_BASE_WALLET" };

  let receipt;
  try {
    receipt = await rpc("eth_getTransactionReceipt", [txHash]);
  } catch {
    return { ok: false, code: "LEDGER_UNREACHABLE" };
  }
  if (!receipt) return { ok: false, code: "NOT_FOUND" };
  if (receipt.status !== "0x1") return { ok: false, code: "NOT_SUCCESS", status: receipt.status };

  const wantTo = payTo.toLowerCase();
  const usdc = BASE_USDC.toLowerCase();
  const need = BigInt(Math.ceil(Number(minUsd) * 1e6));
  let best = 0n;
  let from = "";
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== usdc) continue;
    if (String(log.topics?.[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    if (topicAddress(log.topics?.[2]).toLowerCase() !== wantTo) continue;
    const amount = BigInt(log.data || "0x0");
    if (amount > best) {
      best = amount;
      from = topicAddress(log.topics?.[1]);
    }
  }
  if (best === 0n) {
    return { ok: false, code: "NOT_USDC", message: "No USDC Transfer to the Fathom Base address in this tx." };
  }
  if (best < need) {
    return {
      ok: false,
      code: "INSUFFICIENT_AMOUNT",
      amount: best.toString(),
      need: need.toString(),
    };
  }
  return {
    ok: true,
    from,
    to: payTo,
    amountAtomic: best.toString(),
    usd: Number(best) / 1e6,
    asset: "USDC",
    network: "base",
  };
}
