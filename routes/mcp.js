// @ts-nocheck
/**
 * Model Context Protocol (MCP) discovery documents for autonomous agents.
 * Free to read — no payment required. Agents use this to learn tools, prices,
 * and the exact HTTP envelope Fathom expects.
 */

import { Router } from "express";
import { getTreasuryAddress, MIN_RLUSD, MIN_XRP_DROPS, replayDb } from "../middleware/xrplPayment.js";
import { countSettlements } from "../lib/settlements.js";

export const TOOLS = [
  {
    name: "web_scrape",
    title: "Web scrape",
    description:
      "Fetch a public URL through Fathom's curated scrape provider. The platform injects the master provider key; agents never see it.",
    path: "/api/v1/proxy/scrape",
    method: "POST",
    price: { amount: "0.005", currency: "XRP", or: { amount: "0.005", currency: "RLUSD" } },
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
      "List public URLs on a domain through Firecrawl Map. Same 0.005 cover as scrape. Optional search filters the link set.",
    path: "/api/v1/proxy/map",
    method: "POST",
    price: { amount: "0.005", currency: "XRP", or: { amount: "0.005", currency: "RLUSD" } },
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri", description: "Site root to map, e.g. https://example.com" },
        search: { type: "string", description: "Optional text to filter discovered links." },
        limit: { type: "integer", minimum: 1, maximum: 5000, default: 100 },
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
    price: { amount: "0.005", currency: "XRP", or: { amount: "0.005", currency: "RLUSD" } },
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
    minFee: { xrp: "0.005", xrpDrops: MIN_XRP_DROPS.toString(), rlusd: String(MIN_RLUSD) },
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
  return {
    ok: true,
    service: "fathom",
    network: "xrpl-mainnet",
    cluster: process.env.XRPL_RPC_URL || "https://xrplcluster.com",
    destination: getTreasuryAddress(),
    minFee: { xrp: "0.005", rlusd: "0.005" },
    demoPayments: process.env.ALLOW_DEMO_PAYMENTS === "true",
    replayCacheSize: settlements,
    settlements,
    durableReplay: true,
    tools: TOOLS.map((t) => t.name),
  };
}

/**
 * MCP-shaped tool listing. Compatible with LLM agents that speak HTTP MCP
 * discovery (/.well-known/mcp and /mcp/schema).
 */
export function buildMcpSchema() {
  const destination = getTreasuryAddress();
  return {
    mcp_version: "2024-11-05",
    protocol: "mcp",
    name: "fathom",
    title: "Fathom",
    description:
      "XRP-settled reverse proxy for curated public APIs. Agents pay 0.005 XRP or RLUSD per call on XRPL Mainnet, then present the transaction hash.",
    transport: { type: "http", encoding: "json" },
    settlement: {
      ledger: "xrpl",
      network: "mainnet",
      destination,
      amount: { xrp_drops: MIN_XRP_DROPS.toString(), xrp: "0.005", rlusd: "0.005" },
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
        "Submit a Payment of at least 0.005 XRP or 0.005 RLUSD to the destination address.",
        "Wait until the transaction is validated with tesSUCCESS.",
        "Call a tool path with the two payment headers.",
        "Fathom verifies destination, sender, amount, and consumes the hash (replay-safe).",
        "The upstream response is returned raw. The master provider key is never exposed.",
      ],
    },
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: {
        price: tool.price,
        http: {
          method: tool.method,
          path: tool.path,
          headers: {
            "Content-Type": "application/json",
            "x-xrpl-tx-hash": "<validated payment hash>",
            "x-xrpl-sender": "<paying classic address>",
          },
        },
      },
    })),
    resources: [
      { uri: "fathom://health", name: "Health", mimeType: "application/json", path: "/api/v1/health" },
      { uri: "fathom://catalog", name: "Catalog", mimeType: "application/json", path: "/api/v1/catalog" },
    ],
  };
}

export function mcpRouter() {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json(buildMcpSchema());
  });
  router.get("/schema", (_req, res) => {
    res.json(buildMcpSchema());
  });
  return router;
}

export default mcpRouter;
