import { createFileRoute } from "@tanstack/react-router";
import { CodePanel } from "@/components/code-panel";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { MARKET } from "@/lib/marketplace";

export const Route = createFileRoute("/deploy")({ component: DeployPage });

const ENV = `NODE_VERSION=22
NITRO_PRESET=node-server
ALLOW_DEMO_PAYMENTS=false
PLATFORM_XRPL_WALLET_ADDRESS=${MARKET.treasury}
TARGET_SCRAPE_API_URL=https://api.firecrawl.dev/v1/scrape
ORIGINAL_PROVIDER_API_KEY=fc-your-firecrawl-key
DATABASE_URL=postgresql://…   # Render Postgres Internal URL`;

function DeployPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Render</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">Public URL.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Render runs the Node server. GitHub Pages cannot — it has no backend to verify payments or
          hold the Firecrawl key.
        </p>

        <ol className="mt-12 space-y-8">
          <li>
            <p className="font-mono text-micro text-subtle">01 · GitHub</p>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Put this project in a GitHub repo (new repository, then push). Render deploys from Git,
              not from this preview.
            </p>
          </li>
          <li>
            <p className="font-mono text-micro text-subtle">02 · Web service</p>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              On Render: New → Web Service → that repo. Runtime Node. Build{" "}
              <span className="font-mono text-fg">npm install && npm run build</span>. Start{" "}
              <span className="font-mono text-fg">node .output/server/index.mjs</span>. Instance free
              is fine to start.
            </p>
          </li>
          <li>
            <p className="font-mono text-micro text-subtle">03 · Postgres</p>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              New → Postgres. Copy the Internal Database URL into{" "}
              <span className="font-mono text-fg">DATABASE_URL</span> on the web service. That is the
              durable settlement log. Without it, used hashes reset on every deploy.
            </p>
          </li>
          <li>
            <p className="font-mono text-micro text-subtle">04 · Environment</p>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Paste these on the service. Keep demo payments off. The Firecrawl key stays on Render —
              never in the repo.
            </p>
            <CodePanel className="mt-4" label="Environment" code={ENV} />
          </li>
          <li>
            <p className="font-mono text-micro text-subtle">05 · Ship</p>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Deploy. You get a URL like <span className="font-mono text-fg">fathom.onrender.com</span>.
              Agents read <span className="font-mono text-fg">/.well-known/mcp</span>. Health is{" "}
              <span className="font-mono text-fg">/api/v1/health</span>. A{" "}
              <span className="font-mono text-fg">render.yaml</span> is in the repo if you prefer a
              Blueprint instead of the form.
            </p>
          </li>
        </ol>
      </div>
    </SiteShell>
  );
}
