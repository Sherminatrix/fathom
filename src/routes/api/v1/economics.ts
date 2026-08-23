import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, getEconomics, jsonResponse } from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/economics")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: async () => {
        try {
          return jsonResponse(await getEconomics());
        } catch {
          return jsonResponse({ ok: false, error: "XRP spot unavailable" }, 503);
        }
      },
    },
  },
});
