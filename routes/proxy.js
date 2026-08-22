// @ts-nocheck
/**
 * Paid reverse proxy. After xrplPayment has verified settlement, we:
 *  - drop inbound agent headers (so they cannot smuggle Authorization)
 *  - inject ORIGINAL_PROVIDER_API_KEY only on the server-to-provider hop
 *  - return the upstream JSON untouched
 */

import axios from "axios";
import { Router } from "express";

const REQUEST_TIMEOUT_MS = 20_000;

function assertPublicHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    const err = new Error("url must be a valid absolute http(s) URL");
    err.status = 400;
    throw err;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const err = new Error("url must use http or https");
    err.status = 400;
    throw err;
  }
  return parsed.toString();
}

function providerHeaders() {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Fathom-Proxy/1.0",
  };
  const key = process.env.ORIGINAL_PROVIDER_API_KEY;
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function mockScrape(body) {
  const url = body?.url || "https://example.com";
  return {
    success: true,
    provider: "fathom-mock",
    data: {
      url,
      title: "Example domain",
      markdown:
        "# Example domain\n\nThis is a curated scrape payload returned by Fathom's mock provider. Configure ORIGINAL_PROVIDER_API_KEY and TARGET_SCRAPE_API_URL to forward to Firecrawl (or another extractor) without exposing that key to agents.",
      excerpt: "Curated scrape payload. Master API key stays on the server.",
      fetchedAt: new Date().toISOString(),
    },
  };
}

function mockQuote(symbol) {
  const upper = String(symbol || "XRP").toUpperCase();
  const book = {
    XRP: { price: "3.12", currency: "USD", name: "XRP" },
    RLUSD: { price: "1.00", currency: "USD", name: "Ripple USD" },
    BTC: { price: "97450.00", currency: "USD", name: "Bitcoin" },
    ETH: { price: "3520.40", currency: "USD", name: "Ether" },
  };
  const row = book[upper] || { price: "1.00", currency: "USD", name: upper };
  return {
    symbol: upper,
    name: row.name,
    price: row.price,
    currency: row.currency,
    timestamp: new Date().toISOString(),
    provider: "fathom-mock",
  };
}

/**
 * Forward to the curated scrape provider, or the mock if no key/url is configured.
 */
export async function handleScrape(body) {
  const url = assertPublicHttpUrl(body?.url);
  const payload = { ...body, url, formats: body?.formats || ["markdown"] };
  const target = process.env.TARGET_SCRAPE_API_URL;
  const key = process.env.ORIGINAL_PROVIDER_API_KEY;

  if (!target || !key) {
    return mockScrape(payload);
  }

  const response = await axios.post(target, payload, {
    headers: providerHeaders(),
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: () => true,
    maxRedirects: 0,
  });

  if (response.status >= 400) {
    const err = new Error("Upstream scrape provider rejected the request");
    err.status = 502;
    err.upstreamStatus = response.status;
    throw err;
  }
  return response.data;
}

export async function handleQuote(body) {
  const symbol = String(body?.symbol || "").trim();
  if (!symbol) {
    const err = new Error("symbol is required");
    err.status = 400;
    throw err;
  }

  const target = process.env.TARGET_QUOTE_API_URL;
  const key = process.env.ORIGINAL_PROVIDER_API_KEY;

  if (!target || !key) {
    return mockQuote(symbol);
  }

  const url = new URL(target);
  url.searchParams.set("symbol", symbol);
  if (!url.searchParams.get("apikey") && key) {
    url.searchParams.set("apikey", key);
  }

  const response = await axios.get(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Fathom-Proxy/1.0",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: () => true,
    maxRedirects: 0,
  });

  if (response.status >= 400) {
    const err = new Error("Upstream quote provider rejected the request");
    err.status = 502;
    err.upstreamStatus = response.status;
    throw err;
  }
  return response.data;
}

function mockMap(url) {
  return {
    success: true,
    provider: "fathom-mock",
    links: [url, `${url.replace(/\/$/, "")}/about`],
  };
}

function mapTargetUrl() {
  if (process.env.TARGET_MAP_API_URL) return process.env.TARGET_MAP_API_URL;
  const scrape = process.env.TARGET_SCRAPE_API_URL || "";
  if (/firecrawl\.dev/i.test(scrape) || process.env.ORIGINAL_PROVIDER_API_KEY) {
    return "https://api.firecrawl.dev/v2/map";
  }
  if (scrape.includes("/scrape")) return scrape.replace(/\/scrape\/?$/, "/map");
  return "";
}

/**
 * Firecrawl Map: list public URLs on a site. Same master key as scrape.
 */
export async function handleMap(body) {
  const url = assertPublicHttpUrl(body?.url);
  const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 5000);
  const payload = { url, limit };
  if (body?.search) payload.search = String(body.search);

  const target = mapTargetUrl();
  const key = process.env.ORIGINAL_PROVIDER_API_KEY;
  if (!target || !key) return mockMap(url);

  const response = await axios.post(target, payload, {
    headers: providerHeaders(),
    timeout: 45_000,
    validateStatus: () => true,
    maxRedirects: 0,
  });

  if (response.status >= 400) {
    const err = new Error("Upstream map provider rejected the request");
    err.status = 502;
    err.upstreamStatus = response.status;
    throw err;
  }
  return response.data;
}

export const scrapeUsage = {
  error: "Send POST with JSON { url, formats? } and XRPL payment headers.",
  path: "/api/v1/proxy/scrape",
};

export const mapUsage = {
  error: "Send POST with JSON { url, search?, limit? } and XRPL payment headers.",
  path: "/api/v1/proxy/map",
};

export const quoteUsage = {
  error: "Send POST with JSON { symbol } and XRPL payment headers.",
  path: "/api/v1/proxy/quote",
};

function sendProxyError(res, err) {
  const status = err.status || 502;
  res.status(status).json({
    error: status === 400 ? "Bad Request" : "Bad Gateway",
    message: err.message || "Upstream provider request failed",
    upstreamStatus: err.upstreamStatus,
  });
}

export function proxyRouter() {
  const router = Router();

  router.get("/scrape", (_req, res) => res.status(405).json(scrapeUsage));
  router.post("/scrape", async (req, res) => {
    try {
      const data = await handleScrape(req.body || {});
      res.json(data);
    } catch (err) {
      sendProxyError(res, err);
    }
  });

  router.get("/map", (_req, res) => res.status(405).json(mapUsage));
  router.post("/map", async (req, res) => {
    try {
      const data = await handleMap(req.body || {});
      res.json(data);
    } catch (err) {
      sendProxyError(res, err);
    }
  });

  router.get("/quote", (_req, res) => res.status(405).json(quoteUsage));
  router.post("/quote", async (req, res) => {
    try {
      const data = await handleQuote(req.body || {});
      res.json(data);
    } catch (err) {
      sendProxyError(res, err);
    }
  });

  return router;
}

export default proxyRouter;
