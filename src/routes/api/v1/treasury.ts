import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, getTreasuryStatus, jsonResponse } from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/treasury")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: async () => {
        try {
          const status = await getTreasuryStatus();
          return jsonResponse(status);
        } catch (err) {
          return jsonResponse(
            { error: "Treasury status unavailable", message: (err as Error).message },
            503,
          );
        }
      },
    },
  },
});
