import { createFileRoute } from "@tanstack/react-router";
import { buildMcpSchema, corsPreflight, jsonResponse } from "@/lib/gateway";

export const Route = createFileRoute("/.well-known/mcp")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: () => jsonResponse(buildMcpSchema()),
    },
  },
});
