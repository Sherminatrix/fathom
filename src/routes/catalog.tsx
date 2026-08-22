import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/catalog")({ component: CatalogPage });

const TOOLS = [
  {
    name: "web_scrape",
    path: "/api/v1/proxy/scrape",
    title: "Web scrape",
    summary: "Extract markdown from a public URL through the curated scrape provider.",
    fields: "url, formats[]",
  },
  {
    name: "web_map",
    path: "/api/v1/proxy/map",
    title: "Site map",
    summary: "List public URLs on a domain via Firecrawl Map.",
    fields: "url, search?, limit?",
  },
  {
    name: "market_quote",
    path: "/api/v1/proxy/quote",
    title: "Market quote",
    summary: "Last-sale quote for XRP, RLUSD, and major symbols via the curated data vendor.",
    fields: "symbol",
  },
];

function CatalogPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Catalog</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">Three tools. One price.</h1>
        <p className="mt-4 max-w-xl text-muted">
          Every call costs 0.005 XRP or 0.005 RLUSD, verified on mainnet before the upstream request is made.
        </p>

        <div className="mt-10 overflow-hidden rounded-xl shadow-[var(--shadow-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-elevated font-mono text-[11px] tracking-wide text-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Tool</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Path</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Input</th>
                <th className="px-4 py-3 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool) => (
                <tr key={tool.name} className="border-t border-border">
                  <td className="px-4 py-4">
                    <p className="font-medium">{tool.title}</p>
                    <p className="mt-1 max-w-xs text-xs text-muted">{tool.summary}</p>
                  </td>
                  <td className="hidden px-4 py-4 font-mono text-xs text-muted sm:table-cell">{tool.path}</td>
                  <td className="hidden px-4 py-4 font-mono text-xs text-muted md:table-cell">{tool.fields}</td>
                  <td className="px-4 py-4 font-mono text-xs tabular-nums">0.005 XRP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/console">Try in console</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/mcp">Read MCP schema</Link>
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}
