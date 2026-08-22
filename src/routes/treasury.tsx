import { createFileRoute } from "@tanstack/react-router";
import { Check, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CodePanel } from "@/components/code-panel";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MARKET } from "@/lib/marketplace";

export const Route = createFileRoute("/treasury")({ component: TreasuryPage });

const XAMAN_RLUSD = `https://xaman.app/detect/request:${MARKET.rlusdIssuer}:${MARKET.rlusdHex}`;

type TreasuryStatus = {
  address: string;
  issuer: string;
  configured: boolean;
  limit: string;
  balance: string;
  error?: string;
  xaman: { addToken: string };
  trustSet: Record<string, unknown>;
};

function TreasuryPage() {
  const [status, setStatus] = useState<TreasuryStatus | null>(null);
  const [error, setError] = useState("");
  const [watching, setWatching] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/v1/treasury");
    if (!res.ok) throw new Error("Could not read the ledger");
    return res.json() as Promise<TreasuryStatus>;
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!watching || status?.configured) return;
    const id = window.setInterval(() => {
      refresh()
        .then((data) => {
          setStatus(data);
          if (data.configured) setWatching(false);
        })
        .catch(() => {
          /* keep watching */
        });
    }, 4000);
    return () => window.clearInterval(id);
  }, [watching, status?.configured, refresh]);

  const ready = status?.configured === true;

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Xaman treasury</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">RLUSD trust line.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Fathom cannot sign for your wallet. Open Xaman, add Ripple’s RLUSD token, and slide to
          accept. This page watches mainnet until the line is live.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl bg-card p-5 shadow-hairline">
            <p className="font-mono text-micro text-subtle">Account</p>
            <p className="mt-2 break-all font-mono text-sm">{status?.address || MARKET.treasury}</p>
            <p className="mt-4 font-mono text-micro text-subtle">Issuer</p>
            <p className="mt-2 break-all font-mono text-sm text-muted">
              {status?.issuer || MARKET.rlusdIssuer}
            </p>
          </article>
          <article className="rounded-xl bg-card p-5 shadow-hairline">
            <p className="font-mono text-micro text-subtle">RLUSD</p>
            <p className="mt-2 font-medium">
              {status == null && !error ? "Reading ledger…" : ready ? "Trust line active" : "Not configured"}
            </p>
            <p className="mt-2 font-mono text-sm tabular-nums text-muted">
              Limit {status?.limit ?? "0"} · balance {status?.balance ?? "0"}
            </p>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            {status?.error ? <p className="mt-3 text-sm text-destructive">{status.error}</p> : null}
          </article>
        </div>

        {!ready ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a
                href={status?.xaman.addToken ?? XAMAN_RLUSD}
                target="_blank"
                rel="noreferrer"
                onClick={() => setWatching(true)}
              >
                Open Xaman
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                setWatching(true);
                void refresh()
                  .then(setStatus)
                  .catch((err: Error) => setError(err.message));
              }}
            >
              <RefreshCw className="size-4" />
              {watching ? "Watching ledger…" : "Check ledger"}
            </Button>
          </div>
        ) : (
          <p className="mt-8 inline-flex h-11 items-center gap-2 font-medium">
            <Check className="size-4" strokeWidth={1.75} />
            This treasury can receive 0.005 RLUSD from agents.
          </p>
        )}

        <ol className="mt-12 space-y-5 text-sm text-muted">
          <li>
            <span className="font-mono text-micro text-subtle">01</span>
            <span className="ml-3">In Xaman, tap Add a token.</span>
          </li>
          <li>
            <span className="font-mono text-micro text-subtle">02</span>
            <span className="ml-3">Choose RLUSD (Ripple).</span>
          </li>
          <li>
            <span className="font-mono text-micro text-subtle">03</span>
            <span className="ml-3">Tap Setup TrustLine, then slide to accept and sign.</span>
          </li>
          <li>
            <span className="font-mono text-micro text-subtle">04</span>
            <span className="ml-3">Return here. The ledger check updates on its own.</span>
          </li>
        </ol>

        {status?.trustSet ? (
          <CodePanel className="mt-10" label="TrustSet" code={JSON.stringify(status.trustSet, null, 2)} />
        ) : null}
      </div>
    </SiteShell>
  );
}
