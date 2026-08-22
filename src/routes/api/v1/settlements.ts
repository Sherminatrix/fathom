import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, jsonResponse, listSettlements } from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/settlements")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: async () => {
        try {
          const rows = await listSettlements(100);
          return jsonResponse({ ok: true, settlements: rows });
        } catch (err) {
          return jsonResponse(
            { error: "Settlement log unavailable", message: (err as Error).message },
            503,
          );
        }
      },
    },
  },
});
