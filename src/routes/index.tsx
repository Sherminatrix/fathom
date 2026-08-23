import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MARKET } from "@/lib/marketplace";

export const Route = createFileRoute("/")({ component: Home });

const STEPS = [
  {
    n: "01",
    title: "Pay the cover",
    body: "The agent submits the tool's cover in XRP or RLUSD to the treasury address on XRPL Mainnet and waits for tesSUCCESS.",
  },
  {
    n: "02",
    title: "Present the hash",
    body: "The same call carries x-xrpl-tx-hash and x-xrpl-sender. Fathom checks destination, amount, sender, and replay.",
  },
  {
    n: "03",
    title: "Collect the payload",
    body: "We inject the master provider key server-side and return the upstream JSON. The agent never sees that key.",
  },
];

function Home() {
  return (
    <SiteShell>
      <section className="bg-rail border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="stagger-in max-w-3xl">
            <Badge>XRPL Mainnet · USD floors, paid in XRP</Badge>
            <h1 className="font-display mt-6 text-4xl leading-[1.1] tracking-[-0.03em] sm:text-6xl">
              APIs with a cover charge, paid in drops.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Autonomous agents settle a micro-payment on the XRP Ledger. Fathom verifies the
              receipt, unlocks a curated public API, and keeps your master key on this side of the
              gate.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/console">
                  Open console
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/integrate">Integration spec</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-border sm:grid-cols-4">
          {[
            ["$0.02", "scrape floor"],
            ["tesSUCCESS", "required on-ledger"],
            ["Once", "per transaction hash"],
            ["MCP", "schema for agents"],
          ].map(([k, v]) => (
            <div key={v} className="px-4 py-6 sm:px-6">
              <p className="font-mono text-sm tabular-nums text-fg">{k}</p>
              <p className="mt-1 text-xs text-subtle">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="font-mono text-[11px] tracking-wide text-subtle">Settlement rail</p>
        <h2 className="font-display mt-2 text-3xl tracking-tight sm:text-4xl">Three steps. No accounts.</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
            >
              <p className="font-mono text-[11px] text-subtle">{step.n}</p>
              <h3 className="mt-3 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-[11px] tracking-wide text-subtle">Operator posture</p>
            <h2 className="font-display mt-2 text-3xl tracking-tight">You hold the keys. Agents hold XRP.</h2>
            <ul className="mt-6 space-y-4">
              {[
                {
                  icon: KeyRound,
                  title: "Master key stays private",
                  body: "ORIGINAL_PROVIDER_API_KEY is injected only on the outbound hop to Firecrawl or your market-data vendor.",
                },
                {
                  icon: ShieldCheck,
                  title: "Replay-safe tickets",
                  body: "Each validated hash is consumed in memory. A second call with the same receipt returns 402.",
                },
                {
                  icon: Wallet,
                  title: "XRP or RLUSD",
                  body: "USD floor per tool (scrape $0.02, search $0.03, map $0.12, quote $0.01), paid in live XRP drops or RLUSD.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <item.icon className="mt-0.5 size-4 shrink-0 text-fg" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-[var(--shadow-border)]">
            <div className="rounded-lg bg-bg px-4 py-4">
              <p className="font-mono text-micro text-subtle">Xaman treasury</p>
              <p className="mt-2 break-all font-mono text-xs text-fg">{MARKET.treasury}</p>
              <dl className="mt-4 space-y-3 font-mono text-xs">
                <div>
                  <dt className="text-subtle">x-xrpl-tx-hash</dt>
                  <dd className="mt-1 text-fg">validated Payment hash</dd>
                </div>
                <div>
                  <dt className="text-subtle">x-xrpl-sender</dt>
                  <dd className="mt-1 text-fg">paying agent r-address</dd>
                </div>
                <div>
                  <dt className="text-subtle">Authorization</dt>
                  <dd className="mt-1 text-muted">injected server-side · never inbound</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
