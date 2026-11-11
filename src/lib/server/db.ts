import "server-only";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { seedBotSettings, seedKnowledge } from "../seed";

/** Live mode aktif jika DATABASE_URL di-set. Tanpa itu aplikasi berjalan sebagai demo (localStorage). */
export const isLive = () => Boolean(process.env.DATABASE_URL);

let _sql: postgres.Sql | null = null;
export function sql() {
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL!, {
      max: 1,
      prepare: false, // aman untuk connection pooler (Neon / Supabase)
      transform: postgres.camel,
      onnotice: () => {},
    });
  }
  return _sql;
}

const SCHEMA = `
create table if not exists users (
  id text primary key,
  name text not null,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','agent')),
  active boolean not null default true,
  territory text,
  cities jsonb not null default '[]'
);
create sequence if not exists lead_seq start 1001;
create table if not exists leads (
  id text primary key,
  phone text not null unique,
  name text, city text, unit text,
  source text not null default 'Unknown',
  campaign text, ad_id text, ctwa_clid text,
  agent_id text references users(id) on delete set null,
  in_queue boolean not null default false,
  queue_reason text,
  ai_active boolean not null default true,
  created_at double precision not null,
  last_customer_msg_at double precision not null,
  assigned_at double precision,
  warm_at double precision,
  capi_status text,
  capi_sent_at double precision
);
alter table leads add column if not exists resolved boolean not null default false;
alter table leads add column if not exists profile_name text;
alter table leads add column if not exists ad_headline text;
alter table leads add column if not exists source_url text;
create table if not exists messages (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  wa_message_id text unique,
  sender text not null,
  text text not null,
  at double precision not null,
  author text, status text,
  template boolean not null default false,
  knowledge text
);
create index if not exists messages_lead_idx on messages(lead_id, at);
create table if not exists audit (
  id text primary key, at double precision not null, actor text not null,
  action text not null, target text not null, detail text
);
create table if not exists knowledge (
  id text primary key, title text not null, category text not null default '',
  keywords jsonb not null default '[]', answer text not null, active boolean not null default true
);
create table if not exists kv (key text primary key, value jsonb not null);
create table if not exists capi_events (
  id text primary key, lead_id text not null, event_name text not null,
  at double precision not null, ok boolean not null, response text
);
`;

let ready: Promise<void> | null = null;

/** Membuat tabel (idempotent) dan admin pertama. Dipanggil di awal setiap request API live. */
export function ensureDb() {
  if (!ready) {
    ready = (async () => {
      const db = sql();
      await db.unsafe(SCHEMA);
      const [{ count }] = await db`select count(*)::int as count from users`;
      if (count === 0) {
        const pw = process.env.ADMIN_PASSWORD;
        if (!pw || pw.length < 8) throw new Error("ADMIN_PASSWORD (min. 8 karakter) wajib di-set untuk membuat akun admin pertama.");
        await db`insert into users ${db({ id: "u-admin", name: "Admin", username: "admin", passwordHash: await bcrypt.hash(pw, 10), role: "admin", active: true, territory: null, cities: db.json([]) })}`;
      }
      const [{ kb }] = await db`select count(*)::int as kb from knowledge`;
      const bot = await db`select 1 from kv where key = 'bot'`;
      if (kb === 0 && bot.length === 0) {
        for (const k of seedKnowledge()) await db`insert into knowledge ${db({ ...k, keywords: db.json(k.keywords) })}`;
      }
      if (bot.length === 0) await db`insert into kv ${db({ key: "bot", value: db.json(seedBotSettings() as never) })}`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const rows = await sql()`select value from kv where key = ${key}`;
  return rows[0]?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown) {
  const db = sql();
  await db`insert into kv (key, value) values (${key}, ${db.json(value as never)}) on conflict (key) do update set value = excluded.value`;
}

export const uid = () => crypto.randomUUID();

export async function addAudit(actor: string, action: string, target: string, detail?: string) {
  const db = sql();
  await db`insert into audit ${db({ id: uid(), at: Date.now(), actor, action, target, detail: detail ?? null })}`;
}
