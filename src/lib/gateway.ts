import { getTreasuryStatus, verifyXrplPayment } from "../../middleware/xrplPayment.js";
import { paymentResponseHeader } from "../../lib/x402.js";
import { getEconomics } from "../../lib/economics.js";
import { listSettlements } from "../../lib/settlements.js";
import { buildMcpSchema, getHealth, listCatalog } from "../../routes/mcp.js";
import { handleMap, handleQuote, handleScrape, handleSearch, mapUsage, quoteUsage, scrapeUsage, searchUsage } from "../../routes/proxy.js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "Content-Type, Accept, Authorization, x-xrpl-tx-hash, x-xrpl-sender, x-request-id, X-PAYMENT, PAYMENT-SIGNATURE",
  "access-control-allow-methods": "GET, POST, OPTIONS, HEAD",
  "access-control-expose-headers":
    "x-fathom-settlement, x-fathom-tx-hash, PAYMENT-REQUIRED, X-PAYMENT-RESPONSE",
  "access-control-max-age": "86400",
};

export function jsonResponse(data: unknown, status = 200, extra?: Record<string, string>) {
  const cache =
    status === 200
      ? { "cache-control": extra?.["cache-control"] || "public, max-age=30" }
      : { "cache-control": "no-store" };
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS,
      ...cache,
      ...extra,
    },
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function settlementHeaders(settlement: { demo?: boolean; txHash: string }) {
  return {
    "x-fathom-settlement": settlement.demo ? "demo" : "validated",
    "x-fathom-tx-hash": settlement.txHash,
    "X-PAYMENT-RESPONSE": paymentResponseHeader(settlement),
  };
}

export async function requirePayment(request: Request) {
  const url = new URL(request.url);
  return verifyXrplPayment({
    headers: request.headers,
    path: url.pathname,
    method: request.method,
  }) as Promise<
    | { ok: true; settlement: { demo?: boolean; txHash: string } }
    | { ok: false; status: number; body: unknown; headers?: Record<string, string> }
  >;
}

export { buildMcpSchema, getEconomics, getHealth, getTreasuryStatus, handleMap, handleQuote, handleScrape, handleSearch, listCatalog, listSettlements, mapUsage, quoteUsage, scrapeUsage, searchUsage };
