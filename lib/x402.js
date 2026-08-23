/**
 * x402-shaped payment challenge for Fathom.
 * We settle on XRPL (RLUSD preferred, XRP with pay_at_least).
 * Agents retry the same HTTP request with X-PAYMENT (or the old XRPL headers).
 */

import { priceJson } from "./pricing.js";
import { BASE_USDC, getBasePayTo } from "./baseUsdc.js";

const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

/**
 * @param {{ id?: string, usd?: number, xrp?: string, drops?: bigint|string, rlusd?: string }} price
 * @param {{ path?: string, destination?: string | null }} [opts]
 */
export function x402Accepts(price, opts = {}) {
  const { path, destination } = opts;
  const resource = path || "/";
  const quote = priceJson(/** @type {{ xrp: string, drops: string|bigint, rlusd: string, usd?: number }} */ (price));
  /** @type {object[]} */
  const accepts = [];
  const basePayTo = getBasePayTo();
  if (basePayTo) {
    const atomic = String(Math.ceil(Number(quote.usd) * 1e6));
    accepts.push({
      scheme: "exact",
      network: "base",
      asset: BASE_USDC,
      payTo: basePayTo,
      maxAmountRequired: atomic,
      resource,
      description: `Fathom ${price.id} (USDC on Base)`,
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      extra: {
        name: "USDC",
        decimals: 6,
        chainId: 8453,
        preferred: true,
        ens: "titanking1.cb.id",
      },
    });
  }
  accepts.push(
    {
      scheme: "exact",
      network: "xrpl-mainnet",
      asset: "RLUSD",
      payTo: destination,
      maxAmountRequired: String(quote.usd),
      resource,
      description: `Fathom ${price.id} (RLUSD on XRPL)`,
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      extra: { issuer: RLUSD_ISSUER, preferred: !basePayTo },
    },
    {
      scheme: "exact",
      network: "xrpl-mainnet",
      asset: "XRP",
      payTo: destination,
      maxAmountRequired: quote.or.pay_at_least_drops,
      resource,
      description: `Fathom ${price.id} (XRP, include 5% buffer)`,
      mimeType: "application/json",
      maxTimeoutSeconds: 90,
      extra: {
        drops: quote.or.drops,
        pay_at_least_drops: quote.or.pay_at_least_drops,
        pay_at_least_xrp: quote.or.pay_at_least_xrp,
      },
    },
  );
  return accepts;
}

/** @param {unknown} body */
export function encodePaymentRequired(body) {
  return Buffer.from(JSON.stringify(body), "utf8").toString("base64");
}

/** @param {unknown} value */
export function parsePaymentHeader(value) {
  if (!value) return null;
  const raw = String(value).trim();
  let parsed = raw;
  try {
    parsed = Buffer.from(raw, "base64").toString("utf8");
  } catch {
    /* already json */
  }
  try {
    return JSON.parse(parsed);
  } catch {
    if (/^[A-F0-9]{64}$/i.test(raw)) return { payload: { txHash: raw } };
    return null;
  }
}

/**
 * Pull a Payment hash from x402 or legacy XRPL headers.
 * Sender is optional — the ledger Payment.Account is the source of truth.
 * @param {{ get?: Function } | Headers | Record<string, string | null>} headers
 */
/**
 * @param {{ get?: Function } | Headers | Record<string, string | null> | undefined} headers
 */
export function extractPaymentProof(headers) {
  const get = (/** @type {string} */ name) => {
    if (!headers) return "";
    if (typeof headers.get === "function") return headers.get(name) || headers.get(name.toLowerCase()) || "";
    const rec = /** @type {Record<string, string | null | undefined>} */ (headers);
    const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
    return (key && rec[key]) || "";
  };

  const legacyHash = String(get("x-xrpl-tx-hash") || "").trim();
  const legacySender = String(get("x-xrpl-sender") || "").trim();
  const xpay = parsePaymentHeader(get("x-payment") || get("PAYMENT") || get("payment"));
  const payload = xpay?.payload || xpay || {};
  const txHash = String(payload.txHash || payload.hash || payload.transaction || legacyHash || "").trim();
  const senderAddress = String(payload.sender || payload.account || legacySender || "").trim();
  return { txHash, senderAddress, x402: Boolean(xpay) };
}

/** @param {{ txHash?: string }} settlement */
export function paymentResponseHeader(settlement) {
  return encodePaymentRequired({
    x402Version: 1,
    network: "xrpl-mainnet",
    txHash: settlement?.txHash,
    settled: true,
  });
}
