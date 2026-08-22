// @ts-nocheck
/**
 * Durable settlement store.
 * Neon (DATABASE_URL) in production; filesystem PGLite in preview so consumed
 * hashes survive process restarts. Unique tx_hash is the replay lock.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".data", "settlements");

const CREATE_TABLE = `
create table if not exists settlements (
  tx_hash text primary key,
  sender text not null,
  destination text not null,
  currency text not null,
  amount text not null,
  drops text,
  demo boolean not null default false,
  tool text,
  created_at timestamptz not null default now()
)`;

const CREATE_INDEX = `create index if not exists settlements_created_at_idx on settlements (created_at desc)`;

const SEED = {
  txHash: "8C28C6813EB0152A3247728F168C311A6F8FC3833875B106B4D16C05C49DFAFA",
  sender: "rMdG3ju8pgyVh29ELPWaDuA74CpWW6Fxns",
  destination: "rkpckEddjHhS2vvg7sR3Gb3BX3CVzE2kb",
  currency: "XRP",
  amount: "0.694272",
  drops: "694272",
  tool: "/api/v1/proxy/scrape",
};

/** @type {Set<string>} */
const memory = new Set();

/** @type {Promise<{ query: (text: string, params?: unknown[]) => Promise<any[]> }> | null} */
let clientPromise = null;

function normalizeHash(hash) {
  return String(hash || "")
    .trim()
    .replace(/^0x/i, "")
    .toUpperCase();
}

function isUniqueViolation(err) {
  return err?.code === "23505" || /duplicate key|unique constraint/i.test(String(err?.message || ""));
}

async function createClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query(CREATE_TABLE);
    await pool.query(CREATE_INDEX);
    const client = {
      async query(text, params = []) {
        const res = await pool.query(text, params);
        return res.rows;
      },
    };
    await seedIfEmpty(client);
    return client;
  }

  await mkdir(DATA_DIR, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(DATA_DIR);
  await pg.waitReady;
  await pg.exec(`${CREATE_TABLE};${CREATE_INDEX};`);
  const client = {
    async query(text, params = []) {
      const res = await pg.query(text, params);
      return res.rows;
    },
  };
  await seedIfEmpty(client);
  return client;
}

async function seedIfEmpty(client) {
  const hash = normalizeHash(SEED.txHash);
  const existing = await client.query("select 1 as ok from settlements where tx_hash = $1 limit 1", [hash]);
  if (existing.length) {
    memory.add(hash);
    return;
  }
  await client.query(
    `insert into settlements (tx_hash, sender, destination, currency, amount, drops, demo, tool)
     values ($1, $2, $3, $4, $5, $6, false, $7)
     on conflict (tx_hash) do nothing`,
    [hash, SEED.sender, SEED.destination, SEED.currency, SEED.amount, SEED.drops, SEED.tool],
  );
  memory.add(hash);
}

export async function getSettlementClient() {
  clientPromise ??= createClient().catch((err) => {
    clientPromise = null;
    throw err;
  });
  return clientPromise;
}

export async function hasConsumed(txHash) {
  const hash = normalizeHash(txHash);
  if (!hash) return false;
  if (memory.has(hash)) return true;
  const sql = await getSettlementClient();
  const rows = await sql.query("select 1 as ok from settlements where tx_hash = $1 limit 1", [hash]);
  if (rows.length) {
    memory.add(hash);
    return true;
  }
  return false;
}

/**
 * Insert-or-reject. Returns { ok: true } on first consume, { ok: false, replay: true }
 * if the hash is already in the log.
 */
export async function consumeSettlement(entry) {
  const hash = normalizeHash(entry.txHash);
  if (!hash) throw new Error("txHash required");
  if (memory.has(hash)) return { ok: false, replay: true };

  const sql = await getSettlementClient();
  try {
    await sql.query(
      `insert into settlements
        (tx_hash, sender, destination, currency, amount, drops, demo, tool)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        hash,
        entry.sender || "",
        entry.destination || "",
        entry.currency || "XRP",
        String(entry.amount ?? entry.value ?? entry.drops ?? ""),
        entry.drops != null ? String(entry.drops) : null,
        Boolean(entry.demo),
        entry.tool || entry.path || null,
      ],
    );
    memory.add(hash);
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      memory.add(hash);
      return { ok: false, replay: true };
    }
    throw err;
  }
}

export async function listSettlements(limit = 50) {
  const sql = await getSettlementClient();
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return sql.query(
    `select tx_hash, sender, destination, currency, amount, drops, demo, tool, created_at
     from settlements
     order by created_at desc
     limit $1`,
    [cap],
  );
}

export async function countSettlements() {
  const sql = await getSettlementClient();
  const rows = await sql.query("select count(*)::int as n from settlements");
  return Number(rows[0]?.n ?? 0);
}

/** In-memory size used by health when the disk query has not run yet. */
export function memorySize() {
  return memory.size;
}

export { normalizeHash };
