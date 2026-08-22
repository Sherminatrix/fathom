export const MARKET = {
  name: "Fathom",
  minXrp: "0.005",
  minRlusd: "0.005",
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
  { to: "/ledger", label: "Ledger" },
  { to: "/mcp", label: "MCP" },
  { to: "/console", label: "Console" },
] as const;
