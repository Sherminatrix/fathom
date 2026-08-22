import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  handleMap,
  jsonResponse,
  mapUsage,
  requirePayment,
} from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/proxy/map")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: () => jsonResponse(mapUsage, 405),
      POST: async ({ request }) => {
        const paid = await requirePayment(request);
        if (!paid.ok) return jsonResponse(paid.body, paid.status);
        try {
          const body = await request.json().catch(() => ({}));
          const data = await handleMap(body);
          return jsonResponse(data, 200, {
            "x-fathom-settlement": paid.settlement.demo ? "demo" : "validated",
            "x-fathom-tx-hash": paid.settlement.txHash,
          });
        } catch (err) {
          const status = (err as { status?: number }).status || 502;
          return jsonResponse(
            { error: status === 400 ? "Bad Request" : "Bad Gateway", message: (err as Error).message },
            status,
          );
        }
      },
    },
  },
});
