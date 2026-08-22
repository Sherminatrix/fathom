import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, jsonResponse, listCatalog } from "@/lib/gateway";

export const Route = createFileRoute("/api/v1/catalog")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: () => jsonResponse(listCatalog()),
    },
  },
});
