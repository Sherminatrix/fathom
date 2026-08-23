/**
 * Cover vs Firecrawl cost at the live XRP/USD print.
 * Map is the tightest: 10 credits worst-case against 0.05 XRP.
 */

import axios from "axios";
import { priceForPath, TOOL_PRICES, USD_FLOOR } from "./pricing.js";

const DEFAULT_CREDIT_USD = 0.006;
const CREDITS = { scrape: 1, search: 2, map: 10, quote: 0 };

/** @type {{ t: number, usd: number }[]} */
const samples = [];
/** @type {{ at: number, spot: null | { usd: number, change24hPct: number | null, high24h: number | null, low24h: number | null, source: string } }} */
let cache = { at: 0, spot: null };

function creditUsd() {
  const n = Number(process.env.FIRECRAWL_USD_PER_CREDIT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CREDIT_USD;
}

async function fetchSpot() {
  try {
    const { data } = await axios.get("https://api.binance.com/api/v3/ticker/24hr", {
      params: { symbol: "XRPUSDT" },
      timeout: 8_000,
    });
    return {
      usd: Number(data.lastPrice),
      change24hPct: Number(data.priceChangePercent),
      high24h: Number(data.highPrice),
      low24h: Number(data.lowPrice),
      source: "binance:XRPUSDT",
    };
  } catch {
    const { data } = await axios.get("https://api.coinbase.com/v2/prices/XRP-USD/spot", { timeout: 8_000 });
    return {
      usd: Number(data?.data?.amount),
      change24hPct: null,
      high24h: null,
      low24h: null,
      source: "coinbase:XRP-USD",
    };
  }
}

export async function getXrpSpot() {
  if (cache.spot && Date.now() - cache.at < 60_000) return cache.spot;
  const spot = await fetchSpot();
  if (!Number.isFinite(spot.usd) || spot.usd <= 0) throw new Error("XRP spot unavailable");
  cache = { at: Date.now(), spot };
  samples.push({ t: Date.now(), usd: spot.usd });
  if (samples.length > 48) samples.shift();
  return spot;
}

/**
 * @param {{ id: string, xrp: string, rlusd: string, drops: bigint }} price
 * @param {number} usd
 */
function toolRow(price, usd) {
  const usdFloor = USD_FLOOR[/** @type {keyof typeof USD_FLOOR} */ (price.id)] ?? Number(price.rlusd);
  const credits = CREDITS[/** @type {keyof typeof CREDITS} */ (price.id)] ?? 1;
  const revenueUsd = usdFloor;
  const costUsd = credits * creditUsd();
  const marginUsd = revenueUsd - costUsd;
  const ratio = costUsd === 0 ? Infinity : revenueUsd / costUsd;
  const liveDrops = Math.max(1_000, Math.ceil((usdFloor / usd) * 1_000_000));
  const liveXrp = liveDrops / 1_000_000;
  let status = "healthy";
  if (costUsd > 0 && ratio < 1) status = "underwater";
  else if (costUsd > 0 && ratio < 2) status = "thin";
  return {
    tool: price.id,
    usdFloor,
    coverXrp: liveXrp.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""),
    coverRlusd: String(usdFloor),
    liveDrops: String(liveDrops),
    firecrawlCredits: credits,
    revenueUsd: round(revenueUsd),
    costUsd: round(costUsd),
    marginUsd: round(marginUsd),
    coverage: Number.isFinite(ratio) ? round(ratio) : null,
    breakevenXrpUsd: null,
    dropPctToUnderwater: null,
    status,
  };
}

/**
 * Live XRP cover for a request path. USD floor / spot, 1_000 drop minimum.
 * If the print is missing, assume $1/XRP (more XRP required — safer).
 * @param {string | undefined} path
 */
export async function livePriceForPath(path) {
  const base = priceForPath(path);
  const usd = USD_FLOOR[/** @type {keyof typeof USD_FLOOR} */ (base.id)] ?? Number(base.rlusd);
  let spotUsd = 1;
  try {
    const spot = await getXrpSpot();
    if (spot.usd > 0) spotUsd = spot.usd;
  } catch {
    /* conservative $1 */
  }
  const drops = BigInt(Math.max(1_000, Math.ceil((usd / spotUsd) * 1_000_000)));
  const xrp = Number(drops) / 1_000_000;
  return {
    ...base,
    usd,
    rlusd: String(usd),
    drops,
    xrp: xrp.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""),
    spotUsd,
  };
}

/** @param {number} n */
function round(n) {
  return Math.round(n * 10000) / 10000;
}

export async function getEconomics() {
  const spot = await getXrpSpot();
  const tools = Object.values(TOOL_PRICES).map((p) => toolRow(p, spot.usd));
  const alerts = tools.filter((t) => t.status !== "healthy").map((t) => t.tool);
  const session = samples.map((s) => s.usd);
  const sessionMin = session.length ? Math.min(...session) : spot.usd;
  const sessionMax = session.length ? Math.max(...session) : spot.usd;
  return {
    ok: true,
    assumed: {
      xrpUsd: spot.usd,
      firecrawlUsdPerCredit: creditUsd(),
      note: "USD floors converted to XRP at this print. Override credit cost with FIRECRAWL_USD_PER_CREDIT.",
    },
    spot: {
      ...spot,
      usd: round(spot.usd),
      sampled: samples.length,
      sessionLow: round(sessionMin),
      sessionHigh: round(sessionMax),
    },
    tools,
    alerts,
    rlUsdNote: "RLUSD cover is 1:1 USD, so it is not XRP-volatile.",
  };
}
