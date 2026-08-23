/**
 * Competitive cover is a USD floor. Agents should prefer RLUSD (no FX).
 * XRP is accepted at the live print; pay_at_least adds 5% then rounds up
 * 1,000 drops so a 30s-cached quote does not 402.
 */

export const USD_FLOOR = {
  scrape: 0.02,
  search: 0.03,
  map: 0.12,
  quote: 0.01,
};

export const TOOL_PRICES = {
  scrape: { id: "scrape", xrp: "0.02", drops: 20_000n, rlusd: "0.02", usd: 0.02 },
  map: { id: "map", xrp: "0.12", drops: 120_000n, rlusd: "0.12", usd: 0.12, maxLimit: 10 },
  search: { id: "search", xrp: "0.03", drops: 30_000n, rlusd: "0.03", usd: 0.03, maxLimit: 10 },
  quote: { id: "quote", xrp: "0.01", drops: 10_000n, rlusd: "0.01", usd: 0.01 },
};

export const DISCOVERY_CACHE_S = 30;

/** @param {string | undefined} path */
export function priceForPath(path) {
  const p = String(path || "").toLowerCase();
  if (p.includes("search")) return TOOL_PRICES.search;
  if (p.includes("/map") || p.endsWith("map")) return TOOL_PRICES.map;
  if (p.includes("quote")) return TOOL_PRICES.quote;
  return TOOL_PRICES.scrape;
}

/** @param {bigint | number | string} drops */
export function payAtLeastDrops(drops) {
  const n = Number(drops);
  const padded = Math.ceil(n * 1.05);
  return BigInt(Math.max(1_000, Math.ceil(padded / 1_000) * 1_000));
}

/** @param {bigint | number | string} drops */
export function formatXrp(drops) {
  return (Number(drops) / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Machine price object: RLUSD first, XRP with overpay hint.
 * @param {{ xrp: string, drops: bigint | string, rlusd: string, id?: string, usd?: number, spotUsd?: number }} price
 */
export function priceJson(price) {
  const drops = BigInt(price.drops);
  const pay = payAtLeastDrops(drops);
  const usd = price.usd ?? Number(price.rlusd);
  return {
    preferred: "RLUSD",
    usd,
    amount: String(price.rlusd),
    currency: "RLUSD",
    or: {
      currency: "XRP",
      amount: price.xrp,
      drops: drops.toString(),
      pay_at_least_drops: pay.toString(),
      pay_at_least_xrp: formatXrp(pay),
    },
    cache_s: DISCOVERY_CACHE_S,
    discovery: "GET /.well-known/mcp",
    spotUsd: price.spotUsd,
  };
}
