import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cover")({ component: CoverPage });

type ToolRow = {
  tool: string;
  usdFloor: number;
  coverXrp: string;
  liveDrops: string;
  firecrawlCredits: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  coverage: number | null;
  status: "healthy" | "thin" | "underwater";
};

type Economics = {
  ok: boolean;
  assumed: { xrpUsd: number; firecrawlUsdPerCredit: number; note: string };
  spot: {
    usd: number;
    change24hPct: number | null;
    high24h: number | null;
    low24h: number | null;
    source: string;
    sessionLow: number;
    sessionHigh: number;
  };
  tools: ToolRow[];
  alerts: string[];
  rlUsdNote: string;
};

function CoverPage() {
  const [data, setData] = useState<Economics | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/economics");
      if (!res.ok) throw new Error("Spot feed unavailable");
      setData((await res.json()) as Economics);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const change = data?.spot.change24hPct;
  const changeLabel =
    change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% 24h`;

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Cover</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">XRP volatility vs credits.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Live XRP/USD against Firecrawl credit cost. If XRP falls through a tool's breakeven, that
          SKU loses money until you raise cover or switch agents to RLUSD.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        {data ? (
          <>
            <div className="mt-10 grid gap-3 sm:grid-cols-4">
              <Stat label="XRP / USD" value={`$${data.spot.usd.toFixed(4)}`} hint={data.spot.source} />
              <Stat label="24h" value={changeLabel} hint={range(data.spot.low24h, data.spot.high24h)} />
              <Stat
                label="Credit cost"
                value={`$${data.assumed.firecrawlUsdPerCredit.toFixed(4)}`}
                hint="FIRECRAWL_USD_PER_CREDIT"
              />
              <Stat
                label="Alerts"
                value={data.alerts.length ? data.alerts.join(", ") : "none"}
                hint={data.rlUsdNote}
              />
            </div>

            <div className="mt-10 overflow-x-auto rounded-xl shadow-hairline">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-bg-elevated font-mono text-micro tracking-wide text-subtle">
                  <tr>
                    <th className="px-4 py-3 font-medium">USD floor</th>
                    <th className="px-4 py-3 font-medium">Live XRP</th>
                    <th className="px-4 py-3 font-medium">Credits</th>
                    <th className="px-4 py-3 font-medium">Take USD</th>
                    <th className="px-4 py-3 font-medium">Cost USD</th>
                    <th className="px-4 py-3 font-medium">Margin</th>
                    <th className="px-4 py-3 font-medium">Cover ×</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tools.map((row) => (
                    <tr key={row.tool} className="border-t border-border">
                      <td className="px-4 py-4 font-mono text-xs">{row.tool}</td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">${row.usdFloor.toFixed(2)}</td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">{row.coverXrp} XRP</td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">{row.firecrawlCredits}</td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">${row.revenueUsd.toFixed(4)}</td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">${row.costUsd.toFixed(4)}</td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">${row.marginUsd.toFixed(4)}</td>
                      <td className="px-4 py-4 font-mono text-xs tabular-nums">
                        {row.coverage == null ? "—" : `${row.coverage.toFixed(2)}×`}
                      </td>
                      <td className="px-4 py-4">
                        <Badge>{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-2xl text-xs text-subtle">{data.assumed.note} Map assumes the 10-URL cap is fully billed.</p>
          </>
        ) : null}
      </div>
    </SiteShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="rounded-xl px-4 py-4 shadow-hairline">
      <p className="font-mono text-micro tracking-wide text-subtle">{label}</p>
      <p className="mt-2 font-display text-2xl tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function range(low: number | null, high: number | null) {
  if (low == null || high == null) return "session print";
  return `24h ${low.toFixed(3)}–${high.toFixed(3)}`;
}
