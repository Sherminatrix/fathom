# Fathom

XRP-settled API marketplace for autonomous agents. Pay 0.005 XRP or RLUSD per call on XRPL Mainnet. Master provider keys stay on the server.

Treasury: `rkpckEddjHhS2vvg7sR3Gb3BX3CVzE2kb`

## Run locally

```bash
npm install
cp .env.example .env
# fill ORIGINAL_PROVIDER_API_KEY and PLATFORM_XRPL_WALLET_ADDRESS
npm run dev
```

API-only: `npm run api`

## Deploy on Render

1. Create a **Web Service** from this repo.
2. Build: `npm install && npm run build`
3. Start: `node .output/server/index.mjs`
4. Add **Postgres** and set `DATABASE_URL` to the Internal Database URL.
5. Set environment variables (see `.env.example` and `render.yaml`):

- `NODE_VERSION=22`
- `NITRO_PRESET=node-server`
- `ALLOW_DEMO_PAYMENTS=false`
- `PLATFORM_XRPL_WALLET_ADDRESS`
- `TARGET_SCRAPE_API_URL=https://api.firecrawl.dev/v1/scrape`
- `ORIGINAL_PROVIDER_API_KEY`
- `DATABASE_URL`

Agents: `GET /.well-known/mcp` and `GET /api/v1/health`.
