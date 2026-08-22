import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, getHealth, jsonResponse } from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: async () => jsonResponse(await getHealth()),
    },
  },
});
