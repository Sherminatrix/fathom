import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  handleScrape,
  jsonResponse,
  requirePayment,
  scrapeUsage,
  settlementHeaders,
} from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/proxy/scrape")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: () => jsonResponse(scrapeUsage, 405),
      POST: async ({ request }) => {
        const paid = await requirePayment(request);
        if (!paid.ok) return jsonResponse(paid.body, paid.status, paid.headers);
        try {
          const body = await request.json().catch(() => ({}));
          const data = await handleScrape(body);
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
