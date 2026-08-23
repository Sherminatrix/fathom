import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  handleSearch,
  jsonResponse,
  requirePayment,
  searchUsage,
  settlementHeaders,
} from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/proxy/search")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: () => jsonResponse(searchUsage, 405),
      POST: async ({ request }) => {
        const paid = await requirePayment(request);
        if (!paid.ok) return jsonResponse(paid.body, paid.status, paid.headers);
        try {
          const body = await request.json().catch(() => ({}));
          const data = await handleSearch(body);
          return jsonResponse(data, 200, settlementHeaders(paid.settlement));
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
