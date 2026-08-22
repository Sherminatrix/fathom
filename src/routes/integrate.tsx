import { createFileRoute } from "@tanstack/react-router";
import { CodePanel } from "@/components/code-panel";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { MARKET } from "@/lib/marketplace";

export const Route = createFileRoute("/integrate")({ component: IntegratePage });

function IntegratePage() {
  const pay = `Payment {
  Account: rYourAgentWallet,
  Destination: ${MARKET.treasury},
  Amount: "5000",          // drops = 0.005 XRP
  TransactionType: "Payment"
}`;

  const curl = `curl -sS https://YOUR_HOST/api/v1/proxy/scrape \\
  -H "Content-Type: application/json" \\
  -H "x-xrpl-tx-hash: VALIDATED_PAYMENT_HASH" \\
  -H "x-xrpl-sender: rYourAgentWallet" \\
  -d '{"url":"https://example.com","formats":["markdown"]}'`;

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Agents</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">How an agent pays.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          No API keys are issued to callers. The ledger is the credential. Discovery is free; the proxy is not.
        </p>

        <div className="mt-8 rounded-xl bg-card p-5 shadow-hairline">
          <p className="font-mono text-micro text-subtle">Treasury · Xaman</p>
          <p className="mt-2 break-all font-mono text-sm text-fg">{MARKET.treasury}</p>
          <p className="mt-2 text-sm text-muted">
            Pay 0.005 XRP (5,000 drops) to this classic address. No destination tag required.
          </p>
        </div>

        <ol className="mt-12 space-y-10">
          <li>
            <p className="font-mono text-micro text-subtle">01 · Discover</p>
            <p className="mt-2 text-sm text-muted">
              GET /mcp/schema or GET /.well-known/mcp. The document lists tools, JSON Schema, price, and required headers.
            </p>
          </li>
          <li>
            <p className="font-mono text-micro text-subtle">02 · Settle</p>
            <p className="mt-2 text-sm text-muted">
              Submit a Payment on XRPL Mainnet. Wait until the transaction is validated with tesSUCCESS.
            </p>
            <CodePanel className="mt-4" label="xrpl Payment" code={pay} />
          </li>
          <li>
            <p className="font-mono text-micro text-subtle">03 · Call</p>
            <p className="mt-2 text-sm text-muted">
              Replay is rejected. Each hash unlocks exactly one request. A 402 payload explains what failed.
            </p>
            <CodePanel className="mt-4" label="POST /api/v1/proxy/scrape" code={curl} />
          </li>
        </ol>
      </div>
    </SiteShell>
  );
}
