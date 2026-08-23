// @ts-nocheck
/**
 * Model Context Protocol (MCP) discovery documents for autonomous agents.
 * Free to read — no payment required. Agents use this to learn tools, prices,
 * and the exact HTTP envelope Fathom expects.
 */

import { Router } from "express";
import { getTreasuryAddress, MIN_RLUSD, MIN_XRP_DROPS, replayDb } from "../middleware/xrplPayment.js";
import { countSettlements } from "../lib/settlements.js";
import { priceJson, TOOL_PRICES } from "../lib/pricing.js";
import { getEconomics } from "../lib/economics.js";
import { getBasePayTo } from "../lib/baseUsdc.js";

export const TOOLS = [
  {
    name: "web_scrape",
    title: "Web scrape",
    description:
      "Fetch a public URL through Fathom's curated scrape provider. The platform injects the master provider key; agents never see it.",
    path: "/api/v1/proxy/scrape",
    method: "POST",
    price: priceJson(TOOL_PRICES.scrape),
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri", description: "Public http(s) URL to extract." },
        formats: {
          type: "array",
          items: { type: "string", enum: ["markdown", "html", "rawHtml"] },
          default: ["markdown"],
        },
      },
    },
  },
  {
    name: "web_map",
    title: "Site map",
    description:
      "List public URLs on a domain through Firecrawl Map. Capped at 10 links. USD floor $0.12, paid in live XRP or RLUSD.",
    path: "/api/v1/proxy/map",
    method: "POST",
    price: priceJson(TOOL_PRICES.map),
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri", description: "Site root to map, e.g. https://example.com" },
        search: { type: "string", description: "Optional text to filter discovered links." },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 10 },
      },
    },
  },
  {
    name: "web_search",
    title: "Web search",
    description:
      "Search the live web via Firecrawl. Returns up to 10 results (title, url, description). Full-page scrape of each hit is off. USD floor $0.03.",
    path: "/api/v1/proxy/search",
    method: "POST",
    price: priceJson(TOOL_PRICES.search),
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Search query." },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 10 },
      },
    },
  },
  {
    name: "market_quote",
    title: "Market quote",
    description:
      "Pull a last-sale quote for a listed symbol (XRP, RLUSD, majors) through the curated market-data provider.",
    path: "/api/v1/proxy/quote",
    method: "POST",
    price: priceJson(TOOL_PRICES.quote),
    inputSchema: {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: { type: "string", description: "Ticker, e.g. XRP, BTC, EUR/USD." },
      },
    },
  },
];

export function listCatalog() {
  return {
    marketplace: "Fathom",
    network: "xrpl-mainnet",
    destination: getTreasuryAddress(),
    minFee: { xrp: TOOL_PRICES.quote.xrp, xrpDrops: MIN_XRP_DROPS.toString(), rlusd: String(MIN_RLUSD) },
    tools: TOOLS,
  };
}

export async function getHealth() {
  let settlements = replayDb.size;
  try {
    settlements = await countSettlements();
  } catch {
    /* health still returns */
  }
  let cover = null;
  try {
    const eco = await getEconomics();
    cover = {
      xrpUsd: eco.spot.usd,
      change24hPct: eco.spot.change24hPct,
      alerts: eco.alerts,
    };
  } catch {
    cover = { error: "spot_unavailable" };
  }
  return {
    ok: true,
    service: "fathom",
    network: "xrpl-mainnet",
    cluster: process.env.XRPL_RPC_URL || "https://xrplcluster.com",
    destination: getTreasuryAddress(),
    minFee: { xrp: TOOL_PRICES.quote.xrp, rlusd: TOOL_PRICES.quote.rlusd },
    demoPayments: process.env.ALLOW_DEMO_PAYMENTS === "true",
    replayCacheSize: settlements,
    settlements,
    durableReplay: true,
    tools: TOOLS.map((t) => t.name),
    cover,
    base: {
      payTo: getBasePayTo(),
      ens: getBasePayTo() ? "titanking1.cb.id" : null,
      asset: "USDC",
      chain: "base",
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  };
}

/**
 * MCP-shaped tool listing. Compatible with LLM agents that speak HTTP MCP
 * discovery (/.well-known/mcp and /mcp/schema).
 */
export async function buildMcpSchema() {
  const destination = getTreasuryAddress();
  /** @type {Record<string, { coverXrp: string, liveDrops: string, usdFloor: number, coverRlusd: string }>} */
  let live = {};
  try {
    const eco = await getEconomics();
    for (const row of eco.tools) live[row.tool] = row;
  } catch {
    /* static TOOL_PRICES */
  }
  const idByName = { web_scrape: "scrape", web_map: "map", web_search: "search", market_quote: "quote" };
  return {
    mcp_version: "2024-11-05",
    protocol: "mcp",
    name: "fathom",
    title: "Fathom",
    description:
      "HTTP MCP tools with a USD floor. Prefer RLUSD (1:1). XRP is accepted at the live print; use pay_at_least_drops. One GET /.well-known/mcp is enough.",
    transport: { type: "http", encoding: "json" },
    settlement: {
      ledger: "xrpl",
      network: "mainnet",
      destination,
      preferred: "RLUSD",
      amount: {
        note: "Pay tools[].annotations.price in RLUSD (preferred) or XRP pay_at_least_drops. Do not call /api/v1/economics first.",
        discovery: "GET /.well-known/mcp",
        cache_s: 30,
      },
      headers: {
        "x-xrpl-tx-hash": {
          required: true,
          description: "Validated Payment transaction hash on XRPL Mainnet.",
        },
        "x-xrpl-sender": {
          required: true,
          description: "Classic address of the paying wallet (must match Payment.Account).",
        },
      },
      flow: [
        "POST the tool path with the JSON body. No account.",
        "On 402, read accepts[]: USDC on Base if listed, else RLUSD, else XRP pay_at_least_drops.",
        "Pay the treasury, then retry the same POST with header X-PAYMENT: base64({payload:{txHash}}).",
        "x-xrpl-tx-hash still works. x-xrpl-sender is optional (Account is read from the Payment).",
        "Do not retry a consumed hash. Master keys never leave the server.",
      ],
    },
    tools: TOOLS.map((tool) => {
      const id = idByName[tool.name] || "scrape";
      const row = live[id];
      const price = row
        ? priceJson({
            xrp: row.coverXrp,
            drops: row.liveDrops,
            rlusd: row.coverRlusd,
            usd: row.usdFloor,
          })
        : tool.price;
      return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          price,
          http: {
            method: tool.method,
            path: tool.path,
            headers: {
              "Content-Type": "application/json",
              "X-PAYMENT": "base64 { payload: { txHash } }",
            },
          },
        },
      };
    }),
    resources: [
      { uri: "fathom://mcp", name: "MCP", mimeType: "application/json", path: "/.well-known/mcp" },
      { uri: "fathom://health", name: "Health", mimeType: "application/json", path: "/api/v1/health" },
      { uri: "fathom://catalog", name: "Catalog", mimeType: "application/json", path: "/api/v1/catalog" },
      { uri: "fathom://economics", name: "Cover", mimeType: "application/json", path: "/api/v1/economics" },
    ],
  };
}

export function mcpRouter() {
  const router = Router();
  router.get("/", async (_req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    res.json(await buildMcpSchema());
  });
  router.get("/schema", async (_req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    res.json(await buildMcpSchema());
  });
  return router;
}

export default mcpRouter;
