// @ts-nocheck
/**
 * Fathom API gateway — Express entrypoint.
 *
 * Standalone: `npm run api` (binds PORT).
 * Dashboard preview: this module is imported as Connect middleware and does
 * not bind a port; unmatched paths fall through to the UI.
 */

import "dotenv/config";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { xrplPayment, replayDb, getTreasuryStatus } from "./middleware/xrplPayment.js";
import { mcpRouter, buildMcpSchema, getHealth, listCatalog } from "./routes/mcp.js";
import { proxyRouter } from "./routes/proxy.js";
import { listSettlements } from "./lib/settlements.js";

/**
 * Simulated database handle (transient, in-memory).
 * `processedTxHashes` is a cache in front of the durable settlement log.
 */
export const db = replayDb;

const ALLOWED_HEADERS = [
  "Content-Type",
  "Accept",
  "Authorization",
  "x-xrpl-tx-hash",
  "x-xrpl-sender",
  "x-request-id",
];

export function createApp({ standalone = false } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Open CORS, configured conservatively: reflect any Origin, never enable
  // credentials alongside a wildcard, and only allow the payment headers
  // agents actually need. Preflight is cached for a day.
  app.use(
    cors({
      origin: (_origin, callback) => callback(null, true),
      credentials: false,
      methods: ["GET", "POST", "HEAD", "OPTIONS"],
      allowedHeaders: ALLOWED_HEADERS,
      exposedHeaders: ["x-fathom-settlement", "x-fathom-tx-hash"],
      maxAge: 86400,
      optionsSuccessStatus: 204,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/v1/health", async (_req, res) => {
    res.json(await getHealth());
  });

  app.get("/api/v1/catalog", (_req, res) => {
    res.json(listCatalog());
  });

  app.get("/api/v1/treasury", async (_req, res) => {
    try {
      res.json(await getTreasuryStatus());
    } catch {
      res.status(503).json({ error: "Treasury status unavailable" });
    }
  });

  app.get("/api/v1/settlements", async (_req, res) => {
    try {
      const rows = await listSettlements(100);
      res.json({ ok: true, settlements: rows });
    } catch {
      res.status(503).json({ error: "Settlement log unavailable" });
    }
  });

  // Paid surface — payment middleware runs before the reverse proxy.
  app.use("/api/v1/proxy", xrplPayment, proxyRouter());

  app.use("/mcp", mcpRouter());
  app.get("/.well-known/mcp", (_req, res) => {
    res.json(buildMcpSchema());
  });

  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || 500;
    res.status(status).json({
      error: status >= 500 ? "Internal gateway error" : "Request error",
      message: status >= 500 ? "Unexpected error" : err.message,
    });
  });

  if (standalone) {
    app.get("/", (_req, res) => {
      res.json({
        name: "Fathom",
        docs: "/mcp/schema",
        health: "/api/v1/health",
        wellKnown: "/.well-known/mcp",
      });
    });
    app.use((_req, res) => {
      res.status(404).json({ error: "Not found", hint: "GET /mcp/schema" });
    });
  } else {
    // Fall through so the dashboard can own every non-API path.
    app.use((_req, _res, next) => next());
  }

  return app;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

export const app = createApp({ standalone: isDirectRun() });

if (isDirectRun()) {
  const port = Number.parseInt(process.env.PORT || "8080", 10);
  app.listen(port, "0.0.0.0", () => {
    console.log(`Fathom API listening on 0.0.0.0:${port}`);
  });
}

export default app;
