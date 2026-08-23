import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CodePanel } from "@/components/code-panel";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MARKET } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/console")({ component: ConsolePage });

type Health = {
  demoPayments?: boolean;
  destination?: string | null;
  minFee?: { xrp: string };
};

type ToolId = "scrape" | "map" | "search" | "quote";

function ConsolePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [tool, setTool] = useState<ToolId>("scrape");
  const [url, setUrl] = useState("https://example.com");
  const [symbol, setSymbol] = useState("XRP");
  const [query, setQuery] = useState("XRP ledger");
  const [txHash, setTxHash] = useState("demo");
  const [sender, setSender] = useState("rFathomDemoAgent");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [status, setStatus] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/health")
      .then((res) => res.json())
      .then((data: Health) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        /* health is decorative */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const demo = health?.demoPayments === true;

  async function run() {
    setBusy(true);
    setResult("");
    setStatus(null);
    try {
      const path =
        tool === "scrape"
          ? "/api/v1/proxy/scrape"
          : tool === "map"
            ? "/api/v1/proxy/map"
            : tool === "search"
              ? "/api/v1/proxy/search"
              : "/api/v1/proxy/quote";
      const body =
        tool === "quote"
          ? { symbol }
          : tool === "search"
            ? { query, limit: 10 }
            : tool === "map"
              ? { url, limit: 10 }
              : { url, formats: ["markdown"] };
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-xrpl-tx-hash": txHash.trim(),
          "x-xrpl-sender": sender.trim(),
        },
        body: JSON.stringify(body),
      });
      setStatus(res.status);
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setStatus(0);
      setResult(JSON.stringify({ error: err instanceof Error ? err.message : "Request failed" }, null, 2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Console</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">Settle, then fetch.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          {demo
            ? "Preview sandbox: a tx hash of demo is accepted so you can exercise the proxy without broadcasting XRP."
            : "Paste a validated Payment hash. Demo settlements are disabled on this host."}
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <form
            className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            <div className="flex rounded-sm bg-bg p-1 shadow-[var(--shadow-border)]">
              {(
                [
                  ["scrape", "Scrape"],
                  ["search", "Search"],
                  ["map", "Map"],
                  ["quote", "Quote"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTool(id)}
                  className={cn(
                    "h-11 flex-1 rounded-xs text-sm transition-colors duration-150",
                    tool === id ? "bg-bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="mt-5 block text-xs font-medium text-muted">
              {tool === "quote" ? "Symbol" : tool === "search" ? "Query" : "URL"}
              {tool === "quote" ? (
                <Input className="mt-2" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
              ) : tool === "search" ? (
                <Input className="mt-2" value={query} onChange={(e) => setQuery(e.target.value)} />
              ) : (
                <Input className="mt-2" value={url} onChange={(e) => setUrl(e.target.value)} />
              )}
            </label>

            <label className="mt-4 block text-xs font-medium text-muted">
              x-xrpl-tx-hash
              <Input className="mt-2" value={txHash} onChange={(e) => setTxHash(e.target.value)} />
            </label>

            <label className="mt-4 block text-xs font-medium text-muted">
              x-xrpl-sender
              <Input className="mt-2" value={sender} onChange={(e) => setSender(e.target.value)} />
            </label>

            <p className="mt-4 break-all font-mono text-micro text-subtle">
              Xaman {health?.destination || MARKET.treasury} · USD floor, live XRP · GET /api/v1/economics
            </p>

            <Button type="submit" className="mt-5 w-full" disabled={busy}>
              {busy ? "Verifying…" : "Settle and call"}
            </Button>
          </form>

          <div className="min-w-0">
            <CodePanel
              label={status == null ? "response" : `HTTP ${status}`}
              code={result || "// Submit a paid request to see the upstream payload."}
            />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
