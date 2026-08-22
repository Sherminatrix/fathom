// @ts-nocheck
/**
 * Fathom XRPL payment verification
 * --------------------------------
 * Autonomous agents pre-pay a micro-amount of XRP or RLUSD on XRPL Mainnet,
 * then present the resulting transaction hash on every marketplace call.
 *
 * Payment verification loop (maintain this in natural language):
 *
 *  1. Read `x-xrpl-tx-hash` and `x-xrpl-sender` from the incoming request.
 *  2. Reject immediately if either header is missing (402).
 *  3. If the hash was already seen in the durable settlement log, reject (402).
 *     A hash is a one-shot ticket. Rows live in Postgres (Neon) or on-disk PGLite
 *     so a process restart cannot revive a spent payment.
 *  4. Connect to XRPL Mainnet via the official `xrpl` client
 *     (`wss://xrplcluster.com`, the WebSocket front of https://xrplcluster.com).
 *     If the socket is down, fall back to a JSON-RPC POST against
 *     `https://xrplcluster.com` so verification still works.
 *  5. Load the transaction. It must exist, be `validated`, and have
 *     `meta.TransactionResult === "tesSUCCESS"`.
 *  6. Confirm `TransactionType === "Payment"`.
 *  7. Confirm `Destination` equals PLATFORM_XRPL_WALLET_ADDRESS.
 *  8. Confirm `Account` (the paying wallet) equals the declared sender header.
 *  9. Read `delivered_amount` (fallback: `Amount`) and require at least
 *     0.005 XRP (5_000 drops) or 0.005 RLUSD.
 * 10. Only after every check passes, insert the hash into the settlement log
 *     (primary key = replay lock) and attach a receipt onto the request.
 *
 * Demo mode: when ALLOW_DEMO_PAYMENTS=true and txHash is the literal "demo",
 * steps 4–9 are skipped so the operator console can exercise the proxy without
 * broadcasting a real payment. Never enable this on a public wallet.
 */

import axios from "axios";
import { Client, dropsToXrp, isValidClassicAddress } from "xrpl";
import { consumeSettlement, hasConsumed, memorySize } from "../lib/settlements.js";

/** 0.005 XRP, expressed in drops (1 XRP = 1_000_000 drops). */
export const MIN_XRP_DROPS = 5_000n;

/** Equivalent RLUSD threshold — 0.005 of the issued stablecoin. */
export const MIN_RLUSD = 0.005;

/** Official RLUSD issued-currency hex (ASCII "RLUSD" padded to 160 bits). */
export const RLUSD_HEX = "524C555344000000000000000000000000000000";

/** Ripple-issued RLUSD issuer on mainnet. Other RLUSD issuers are still accepted by currency code. */
export const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

const DEFAULT_WS = "wss://xrplcluster.com";
const DEFAULT_RPC = "https://xrplcluster.com";

/** Operator treasury — Xaman classic address. Env overrides this if set. */
export const DEFAULT_TREASURY_ADDRESS = "rkpckEddjHhS2vvg7sR3Gb3BX3CVzE2kb";

export function getTreasuryAddress() {
  return process.env.PLATFORM_XRPL_WALLET_ADDRESS?.trim() || DEFAULT_TREASURY_ADDRESS;
}

const TF_SET_NO_RIPPLE = 131072;
const RLUSD_TRUST_LIMIT = "1000000000";

function isRlusdLine(line) {
  if (!line) return false;
  const code = decodeCurrency(line.currency);
  return code === "RLUSD" || line.currency === RLUSD_HEX;
}

/**
 * Live RLUSD trust-line status for the Xaman treasury.
 * A TrustSet must be signed in Xaman — this never holds a secret.
 */
export async function getTreasuryStatus() {
  const address = getTreasuryAddress();
  const rpc = process.env.XRPL_RPC_URL || DEFAULT_RPC;
  const trustSet = {
    TransactionType: "TrustSet",
    Account: address,
    LimitAmount: {
      currency: RLUSD_HEX,
      issuer: RLUSD_ISSUER,
      value: RLUSD_TRUST_LIMIT,
    },
    Flags: TF_SET_NO_RIPPLE,
  };
  const xaman = {
    addToken: `https://xaman.app/detect/request:${RLUSD_ISSUER}:${RLUSD_HEX}`,
    addTokenLegacy: `https://xumm.app/detect/request:${RLUSD_ISSUER}:${RLUSD_HEX}`,
  };

  try {
    const { data } = await axios.post(
      rpc,
      {
        method: "account_lines",
        params: [{ account: address, peer: RLUSD_ISSUER, ledger_index: "validated" }],
      },
      { timeout: 8_000, headers: { "Content-Type": "application/json" } },
    );
    const lines = data?.result?.lines || [];
    const line = lines.find(isRlusdLine);
    const limit = Number.parseFloat(line?.limit ?? "0");
    return {
      address,
      issuer: RLUSD_ISSUER,
      currency: "RLUSD",
      currencyHex: RLUSD_HEX,
      configured: Boolean(line && Number.isFinite(limit) && limit > 0),
      limit: line?.limit ?? "0",
      balance: line?.balance ?? "0",
      xaman,
      trustSet,
    };
  } catch (err) {
    return {
      address,
      issuer: RLUSD_ISSUER,
      currency: "RLUSD",
      currencyHex: RLUSD_HEX,
      configured: false,
      limit: "0",
      balance: "0",
      error: "Could not read account_lines from the XRPL cluster.",
      xaman,
      trustSet,
    };
  }
}

/**
 * Simulated database: the in-memory Map is now a cache in front of the durable
 * settlement log (`lib/settlements.js`). Restarts reload from disk/Postgres.
 */
export const replayDb = {
  /** @type {Map<string, number>} */
  processedTxHashes: new Map(),
  ttlMs: 24 * 60 * 60 * 1000,
  has(hash) {
    return this.processedTxHashes.has(normalizeHash(hash));
  },
  add(hash) {
    this.processedTxHashes.set(normalizeHash(hash), Date.now());
  },
  prune() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [hash, seenAt] of this.processedTxHashes) {
      if (seenAt < cutoff) this.processedTxHashes.delete(hash);
    }
  },
  get size() {
    return Math.max(this.processedTxHashes.size, memorySize());
  },
};

const pruneTimer = setInterval(() => replayDb.prune(), 5 * 60 * 1000);
if (typeof pruneTimer.unref === "function") pruneTimer.unref();

/** @type {import("xrpl").Client | null} */
let sharedClient = null;
let connecting = null;

function normalizeHash(hash) {
  return String(hash || "").trim().toLowerCase();
}

function paymentRequired(code, message, extra = {}) {
  return {
    ok: false,
    status: 402,
    body: {
      error: "Payment Required",
      code,
      message,
      settle: {
        destination: getTreasuryAddress() || null,
        min: { xrp: "0.005", rlusd: "0.005" },
        headers: ["x-xrpl-tx-hash", "x-xrpl-sender"],
      },
      ...extra,
    },
  };
}

function decodeCurrency(code) {
  if (!code) return "";
  if (code.length <= 3) return code.toUpperCase();
  if (code.toUpperCase() === RLUSD_HEX) return "RLUSD";
  try {
    const buf = Buffer.from(code, "hex");
    const ascii = buf.toString("ascii").replace(/\0/g, "").trim();
    return ascii || code;
  } catch {
    return code;
  }
}

/**
 * Decide whether a Payment amount (drops string or issued-currency object)
 * clears the marketplace minimum.
 */
export function meetsMinimumFee(amount) {
  if (amount == null) return { ok: false, reason: "missing_amount" };

  if (typeof amount === "string" || typeof amount === "number") {
    try {
      const drops = BigInt(String(amount).split(".")[0]);
      if (drops >= MIN_XRP_DROPS) {
        return {
          ok: true,
          currency: "XRP",
          drops: drops.toString(),
          xrp: String(dropsToXrp(drops.toString())),
        };
      }
      return {
        ok: false,
        reason: "insufficient_xrp",
        drops: drops.toString(),
        needDrops: MIN_XRP_DROPS.toString(),
      };
    } catch {
      return { ok: false, reason: "malformed_drops" };
    }
  }

  if (typeof amount === "object") {
    const currency = decodeCurrency(amount.currency);
    const value = Number.parseFloat(amount.value);
    if (!Number.isFinite(value)) return { ok: false, reason: "malformed_iou_value" };
    if (currency === "RLUSD") {
      if (value + Number.EPSILON >= MIN_RLUSD) {
        return { ok: true, currency: "RLUSD", value: String(value), issuer: amount.issuer };
      }
      return { ok: false, reason: "insufficient_rlusd", value: String(value), need: String(MIN_RLUSD) };
    }
    return { ok: false, reason: "unsupported_currency", currency };
  }

  return { ok: false, reason: "unrecognized_amount" };
}

function pickTxFields(result) {
  // xrpl.js v2+ / Clio: fields live under tx_json. Older rippled: flattened onto result.
  const tx = result?.tx_json && typeof result.tx_json === "object" ? result.tx_json : result;
  const meta = result?.meta && typeof result.meta === "object" ? result.meta : {};
  return { tx, meta, hash: result?.hash || tx?.hash, validated: result?.validated === true };
}

async function getWsClient() {
  if (sharedClient?.isConnected()) return sharedClient;
  if (connecting) return connecting;
  const url = process.env.XRPL_WS_URL || DEFAULT_WS;
  connecting = (async () => {
    const client = new Client(url, { connectionTimeout: 8_000 });
    await client.connect();
    client.on("disconnected", () => {
      if (sharedClient === client) sharedClient = null;
    });
    sharedClient = client;
    return client;
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

async function fetchTxFromWebsocket(txHash) {
  const client = await getWsClient();
  const response = await client.request({ command: "tx", transaction: txHash, binary: false });
  return response.result;
}

async function fetchTxFromJsonRpc(txHash) {
  const url = process.env.XRPL_RPC_URL || DEFAULT_RPC;
  const { data } = await axios.post(
    url,
    { method: "tx", params: [{ transaction: txHash, binary: false }] },
    { timeout: 8_000, headers: { "Content-Type": "application/json" } },
  );
  if (data?.error || data?.result?.error) {
    const err = new Error(data?.error_message || data?.result?.error_message || "tx not found");
    err.code = data?.error || data?.result?.error;
    throw err;
  }
  return data.result;
}

/**
 * Core verifier used by both the Express middleware and the dashboard's
 * isomorphic API routes. Never throws for expected payment failures.
 *
 * @param {{ txHash?: string | null, senderAddress?: string | null, path?: string, method?: string }} input
 */
export async function verifyXrplPayment(input) {
  const txHash = String(input?.txHash || "").trim();
  const senderAddress = String(input?.senderAddress || "").trim();

  if (!txHash || !senderAddress) {
    return paymentRequired(
      "MISSING_HEADERS",
      "Send x-xrpl-tx-hash and x-xrpl-sender. Pay 0.005 XRP (or RLUSD) to the platform wallet first.",
    );
  }

  const demoEnabled = process.env.ALLOW_DEMO_PAYMENTS === "true";
  if (normalizeHash(txHash) === "demo") {
    if (!demoEnabled) {
      return paymentRequired(
        "DEMO_DISABLED",
        "Demo settlements are disabled. Submit a real validated Payment hash from XRPL Mainnet.",
      );
    }
    return {
      ok: true,
      settlement: {
        demo: true,
        txHash: "demo",
        sender: senderAddress,
        currency: "XRP",
        drops: MIN_XRP_DROPS.toString(),
        network: "demo",
      },
    };
  }

  if (await hasConsumed(txHash)) {
    return paymentRequired(
      "REPLAY",
      "This transaction hash has already been consumed. Submit a new Payment.",
      { txHash },
    );
  }

  const destination = getTreasuryAddress();
  if (!destination || !isValidClassicAddress(destination)) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "Gateway misconfigured",
        code: "NO_PLATFORM_WALLET",
        message: "PLATFORM_XRPL_WALLET_ADDRESS is not set to a valid classic address.",
      },
    };
  }

  if (!isValidClassicAddress(senderAddress)) {
    return paymentRequired("INVALID_SENDER", "x-xrpl-sender must be a classic XRPL address (r...).");
  }

  let result;
  try {
    try {
      result = await fetchTxFromWebsocket(txHash);
    } catch {
      result = await fetchTxFromJsonRpc(txHash);
    }
  } catch (err) {
    const notFound = /txnNotFound|transactionNotFound|actNotFound/i.test(String(err?.code || err?.message || ""));
    if (notFound) {
      return paymentRequired("NOT_FOUND", "No transaction with that hash exists on XRPL Mainnet.", { txHash });
    }
    return {
      ok: false,
      status: 503,
      body: {
        error: "Ledger unreachable",
        code: "LEDGER_UNREACHABLE",
        message: "Could not reach the XRPL public cluster. Retry in a moment.",
      },
    };
  }

  const { tx, meta, hash, validated } = pickTxFields(result);

  if (!validated) {
    return paymentRequired(
      "NOT_VALIDATED",
      "Transaction is not in a validated ledger yet. Wait for tesSUCCESS on mainnet, then retry.",
      { txHash: hash || txHash },
    );
  }

  const engineResult = meta?.TransactionResult;
  if (engineResult && engineResult !== "tesSUCCESS") {
    return paymentRequired(
      "NOT_SUCCESS",
      `Transaction engine result was ${engineResult}, not tesSUCCESS.`,
      { txHash: hash || txHash, engineResult },
    );
  }

  if (tx?.TransactionType !== "Payment") {
    return paymentRequired(
      "NOT_PAYMENT",
      `Transaction type is ${tx?.TransactionType || "unknown"}, expected Payment.`,
      { txHash: hash || txHash },
    );
  }

  if (tx.Destination !== destination) {
    return paymentRequired(
      "WRONG_DESTINATION",
      "Payment Destination does not match the Fathom treasury address.",
      { expected: destination, actual: tx.Destination },
    );
  }

  if (tx.Account !== senderAddress) {
    return paymentRequired(
      "WRONG_SENDER",
      "Payment Account does not match x-xrpl-sender. The paying wallet must identify itself.",
      { expected: senderAddress, actual: tx.Account },
    );
  }

  const delivered = meta.delivered_amount ?? meta.DeliveredAmount ?? tx.DeliverMax ?? tx.Amount;
  const feeCheck = meetsMinimumFee(delivered);
  if (!feeCheck.ok) {
    return paymentRequired(
      "INSUFFICIENT_AMOUNT",
      "Delivered amount is below the 0.005 XRP / 0.005 RLUSD threshold.",
      { detail: feeCheck },
    );
  }

  // Consume only after the full loop succeeds so a 503 cannot burn a valid payment.
  // Unique tx_hash is the lock: a concurrent twin insert loses and returns 402.
  let consumed;
  try {
    consumed = await consumeSettlement({
      txHash: hash || txHash,
      sender: senderAddress,
      destination,
      currency: feeCheck.currency,
      amount: feeCheck.value || feeCheck.xrp,
      drops: feeCheck.drops,
      demo: false,
      tool: input?.path || null,
    });
  } catch (err) {
    console.error("[fathom] settlement log write failed", err);
    return {
      ok: false,
      status: 503,
      body: {
        error: "Settlement log unavailable",
        code: "LEDGER_UNAVAILABLE",
        message: "Could not record the payment ticket. Retry in a moment — the hash was not consumed.",
      },
    };
  }
  if (!consumed.ok) {
    return paymentRequired("REPLAY", "This transaction hash has already been consumed. Submit a new Payment.", {
      txHash: hash || txHash,
    });
  }
  replayDb.add(hash || txHash);

  return {
    ok: true,
    settlement: {
      demo: false,
      txHash: hash || txHash,
      sender: senderAddress,
      destination,
      currency: feeCheck.currency,
      drops: feeCheck.drops,
      value: feeCheck.value || feeCheck.xrp,
      network: "xrpl-mainnet",
      ledgerIndex: result.ledger_index ?? tx.ledger_index,
    },
  };
}

/**
 * Express middleware. Reads payment headers, runs the verification loop,
 * stamps settlement onto the request, or returns 402 JSON.
 */
export function xrplPayment(req, res, next) {
  if (req.method === "OPTIONS" || req.method === "HEAD") {
    next();
    return;
  }
  const txHash = req.get("x-xrpl-tx-hash");
  const senderAddress = req.get("x-xrpl-sender");

  verifyXrplPayment({
    txHash,
    senderAddress,
    path: req.path,
    method: req.method,
  })
    .then((outcome) => {
      if (!outcome.ok) {
        return res.status(outcome.status).json(outcome.body);
      }
      req.settlement = outcome.settlement;
      res.setHeader("x-fathom-settlement", outcome.settlement.demo ? "demo" : "validated");
      res.setHeader("x-fathom-tx-hash", outcome.settlement.txHash);
      next();
    })
    .catch((err) => {
      console.error("[fathom] payment middleware crashed", err);
      res.status(500).json({ error: "Payment verification failed unexpectedly" });
    });
}

export default xrplPayment;
