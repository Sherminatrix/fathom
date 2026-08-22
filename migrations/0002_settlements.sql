-- Durable replay tickets and settlement log.
-- One row per consumed XRPL Payment hash. The primary key is the replay lock.

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
);

create index if not exists settlements_created_at_idx on settlements (created_at desc);
