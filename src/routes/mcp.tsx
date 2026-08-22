import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CodePanel } from "@/components/code-panel";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/mcp")({ component: McpLayout });

function McpLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/mcp") return <Outlet />;
  return <McpPage />;
}

function McpPage() {
  const [payload, setPayload] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/mcp/schema")
      .then(async (res) => {
        if (!res.ok) throw new Error("Schema unavailable");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPayload(JSON.stringify(data, null, 2));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Model Context Protocol</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">Machine-readable catalog.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          LLM agents can fetch this document and construct paid HTTP calls without a human in the loop.
        </p>

        <div className="mt-8 flex flex-wrap gap-2 font-mono text-micro text-muted">
          <span className="rounded-full px-3 py-1 shadow-hairline">GET /mcp/schema</span>
          <span className="rounded-full px-3 py-1 shadow-hairline">GET /.well-known/mcp</span>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-bg-elevated" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <CodePanel label="application/json" code={payload} />
          )}
        </div>
      </div>
    </SiteShell>
  );
}
