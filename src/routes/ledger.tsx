import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/ledger")({ component: LedgerPage });

type Row = {
  tx_hash: string;
  sender: string;
  destination: string;
  currency: string;
  amount: string;
  drops?: string | null;
  demo: boolean;
  tool?: string | null;
  created_at: string;
};

function shortHash(hash: string) {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function LedgerPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/settlements")
      .then((res) => {
        if (!res.ok) throw new Error("Could not read the settlement log");
        return res.json() as Promise<{ settlements: Row[] }>;
      })
      .then((data) => {
        if (!cancelled) setRows(data.settlements || []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Badge>Settlements</Badge>
        <h1 className="font-display mt-4 text-4xl tracking-tight sm:text-5xl">Payment ledger.</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Each row is a consumed XRPL hash. Restarting the gateway does not revive a ticket.
        </p>

        {error ? <p className="mt-8 text-sm text-destructive">{error}</p> : null}

        <div className="mt-10 overflow-x-auto rounded-xl shadow-hairline">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-bg-elevated font-mono text-micro tracking-wide text-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Hash</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Tool</th>
              </tr>
            </thead>
            <tbody>
              {rows == null ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={5}>
                    Reading log…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={5}>
                    No consumed payments yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.tx_hash} className="border-t border-border">
                    <td className="px-4 py-4 font-mono text-xs tabular-nums text-muted">
                      {formatWhen(row.created_at)}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">
                      <span title={row.tx_hash}>{shortHash(row.tx_hash)}</span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-muted">
                      <span title={row.sender}>{shortHash(row.sender)}</span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs tabular-nums">
                      {row.amount} {row.currency}
                    </td>
                    <td className="hidden px-4 py-4 font-mono text-xs text-muted sm:table-cell">
                      {row.tool || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SiteShell>
  );
}
