/**
 * Competitive cover is a USD floor, paid in XRP at the live print (or RLUSD 1:1).
 * Floors are ~2–3× Firecrawl credits so we stay green without looking expensive
 * versus other agent APIs. Static XRP amounts are fallbacks if the spot feed dies
 * (priced as if XRP = $1, which is conservative vs ~$1.45).
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

/** @param {string | undefined} path */
export function priceForPath(path) {
  const p = String(path || "").toLowerCase();
  if (p.includes("search")) return TOOL_PRICES.search;
  if (p.includes("/map") || p.endsWith("map")) return TOOL_PRICES.map;
  if (p.includes("quote")) return TOOL_PRICES.quote;
  return TOOL_PRICES.scrape;
}

/** @param {{ xrp: string, drops: bigint, rlusd: string, id?: string, usd?: number, spotUsd?: number }} price */
export function priceJson(price) {
  return {
    usd: price.usd ?? Number(price.rlusd),
    amount: price.xrp,
    currency: "XRP",
    drops: price.drops.toString(),
    or: { amount: price.rlusd, currency: "RLUSD" },
    quote: "GET /api/v1/economics",
    spotUsd: price.spotUsd,
  };
}
