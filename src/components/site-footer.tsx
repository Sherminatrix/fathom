import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-lg tracking-tight">Fathom</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Pay-per-call APIs for autonomous agents. Settled on the XRP Ledger. Master keys stay on this side of the gate.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-micro tracking-wide text-subtle">
          <Link to="/catalog" className="hover:text-fg">
            Catalog
          </Link>
          <Link to="/integrate" className="hover:text-fg">
            Integrate
          </Link>
          <Link to="/mcp" className="hover:text-fg">
            MCP
          </Link>
          <Link to="/deploy" className="hover:text-fg">
            Render
          </Link>
          <a href="/api/v1/health" className="hover:text-fg">
            Health
          </a>
        </div>
      </div>
    </footer>
  );
}
