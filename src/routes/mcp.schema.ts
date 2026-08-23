import { createFileRoute } from "@tanstack/react-router";
import { buildMcpSchema, corsPreflight, jsonResponse } from "@/lib/gateway";

export const Route = createFileRoute("/mcp/schema")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: async () => jsonResponse(await buildMcpSchema()),
    },
  },
});
