export const MARKET = {
  name: "Fathom",
  minXrp: "0.01",
  minRlusd: "0.01",
  prices: {
    scrape: "0.015",
    map: "0.05",
    search: "0.03",
    quote: "0.01",
  },
  txHeader: "x-xrpl-tx-hash",
  senderHeader: "x-xrpl-sender",
  network: "XRPL Mainnet",
  treasury: "rkpckEddjHhS2vvg7sR3Gb3BX3CVzE2kb",
  rlusdIssuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
  rlusdHex: "524C555344000000000000000000000000000000",
} as const;

export const NAV = [
  { to: "/catalog", label: "Catalog" },
  { to: "/integrate", label: "Integrate" },
  { to: "/treasury", label: "Treasury" },
  { to: "/cover", label: "Cover" },
  { to: "/ledger", label: "Ledger" },
  { to: "/mcp", label: "MCP" },
  { to: "/console", label: "Console" },
] as const;
