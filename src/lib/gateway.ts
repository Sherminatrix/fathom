import { getTreasuryStatus, verifyXrplPayment } from "../../middleware/xrplPayment.js";
import { getEconomics } from "../../lib/economics.js";
import { listSettlements } from "../../lib/settlements.js";
import { buildMcpSchema, getHealth, listCatalog } from "../../routes/mcp.js";
import { handleMap, handleQuote, handleScrape, handleSearch, mapUsage, quoteUsage, scrapeUsage, searchUsage } from "../../routes/proxy.js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Accept, Authorization, x-xrpl-tx-hash, x-xrpl-sender, x-request-id",
  "access-control-allow-methods": "GET, POST, OPTIONS, HEAD",
  "access-control-expose-headers": "x-fathom-settlement, x-fathom-tx-hash",
  "access-control-max-age": "86400",
};

export function jsonResponse(data: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS,
      ...extra,
    },
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function requirePayment(request: Request) {
  const url = new URL(request.url);
  return verifyXrplPayment({
    txHash: request.headers.get("x-xrpl-tx-hash"),
    senderAddress: request.headers.get("x-xrpl-sender"),
    path: url.pathname,
    method: request.method,
  }) as Promise<
    | { ok: true; settlement: { demo?: boolean; txHash: string } }
    | { ok: false; status: number; body: unknown }
  >;
}

export { buildMcpSchema, getEconomics, getHealth, getTreasuryStatus, handleMap, handleQuote, handleScrape, handleSearch, listCatalog, listSettlements, mapUsage, quoteUsage, scrapeUsage, searchUsage };
