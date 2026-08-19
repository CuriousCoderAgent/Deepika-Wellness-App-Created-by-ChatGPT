/**
 * Durable storage.
 *
 * Two documents per row, one row per account: a member's own record and
 * history, or Deepika's practice-level settings. Plain Postgres over
 * a connection string, so this runs on Supabase, Neon, Railway or anything
 * else that speaks the protocol — no vendor SDK, nothing to migrate off.
 *
 * Without one, every function here reports "not configured" and the app falls
 * back to browser storage. That is not a degraded mode by accident:
 * it is what lets the prototype keep being a prototype, deployable with no
 * infrastructure at all, right up until the moment real people need their data
 * to survive changing phones.
 *
 * Server only. Never import this from a client component — it would pull the
 * connection string into the browser bundle.
 */

import { Pool } from "pg";
import type { StoredAccount } from "./accounts";
import type { CoachDoc, MemberDoc } from "./persist";
import { seedCoachDoc, seedMemberDocs } from "./persist";

const BOOTSTRAP_KEY = "demo_cohort";
const BOOTSTRAP_VERSION = "1";

/**
 * The connection string, under whichever name the provider used.
 *
 * Vercel's Storage tab provisions a database and injects the variables for
 * you, which is the path most people take — but the name depends on which
 * provider is behind it: Neon writes `DATABASE_URL`, Supabase and the older
 * Vercel Postgres write `POSTGRES_URL`. Both are the pooled connection, which
 * is the one this wants. Reading only the first name would leave someone
 * staring at a correctly provisioned database and an app that says storage is
 * not configured.
 */
function connectionString(): string | undefined {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || undefined;
}

export function isConfigured(): boolean {
  return Boolean(connectionString());
}

/**
 * Managed Postgres (Supabase, Neon, Railway) presents certificates this
 * runtime has no root for, so the chain goes unverified while the connection
 * itself stays encrypted — the standard posture for those providers. A local
 * database usually speaks no TLS at all, and asking for it there fails the
 * connection outright, so honour what the URL says.
 */
function sslOption(): false | { rejectUnauthorized: boolean } {
  const url = connectionString() ?? "";
  if (/[?&]sslmode=disable/.test(url)) return false;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  } catch {
    /* unparseable URL — let pg produce the real error */
  }
  return { rejectUnauthorized: false };
}

/**
 * One pool per process, reused across invocations.
 *
 * Serverless functions are frozen and thawed rather than torn down, so a
 * module-level pool survives between requests and a new connection is not paid
 * for on every call. Keep it small — many concurrent instances each holding a
 * handful of connections is how a free-tier database runs out of them. Point
 * the connection string at a pooled endpoint (Supabase's pooler, Neon's
 * -pooler host) and this stays comfortable. Vercel's own Storage integrations
 * inject the pooled one by default.
 */
let pool: Pool | null = null;
function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: sslOption(),
    });
    pool.on("error", () => {
      /* an idle client dropped; the pool replaces it on the next query */
    });
  }
  return pool;
}

let ready: Promise<void> | null = null;

/**
 * Creates the schema and, on a genuinely empty database, writes the demo
 * cohort. Runs at most once per process; every entry point awaits it.
 */
export function ensureReady(): Promise<void> {
  if (!ready) {
    ready = init().catch((err) => {
      // Clear the cache so the next request retries, rather than every later
      // call inheriting one transient failure at cold start.
      ready = null;
      throw err;
    });
  }
  return ready;
}

async function init(): Promise<void> {
  const c = db();
  await c.query(`
    create table if not exists member_state (
      user_id    text primary key,
      name       text not null default '',
      doc        jsonb not null,
      updated_at timestamptz not null default now()
    );
    create table if not exists coach_state (
      user_id    text primary key,
      doc        jsonb not null,
      updated_at timestamptz not null default now()
    );
    create table if not exists app_meta (
      key   text primary key,
      value text not null
    );
    create table if not exists account (
      user_id       text primary key,
      name          text not null,
      password_hash text not null,
      created_at    timestamptz not null default now()
    );
  `);

  // The marker, not a row count, decides whether to seed. Counting would
  // resurrect the demo cohort the day Deepika deletes it, which is exactly
  // what she would be doing on purpose before real members arrive.
  const marked = await c.query("select 1 from app_meta where key = $1", [BOOTSTRAP_KEY]);
  if (marked.rowCount) return;

  for (const doc of seedMemberDocs()) {
    await c.query(
      `insert into member_state (user_id, name, doc) values ($1, $2, $3)
       on conflict (user_id) do nothing`,
      [doc.member.id, doc.member.name, JSON.stringify(doc)]
    );
  }
  await c.query(
    `insert into coach_state (user_id, doc) values ($1, $2)
     on conflict (user_id) do nothing`,
    ["deepika", JSON.stringify(seedCoachDoc())]
  );
  await c.query(
    `insert into app_meta (key, value) values ($1, $2) on conflict (key) do nothing`,
    [BOOTSTRAP_KEY, BOOTSTRAP_VERSION]
  );
}

export async function readMemberDoc(userId: string): Promise<MemberDoc | null> {
  await ensureReady();
  const r = await db().query("select doc from member_state where user_id = $1", [userId]);
  return r.rows[0]?.doc ?? null;
}

export async function readAllMemberDocs(): Promise<MemberDoc[]> {
  await ensureReady();
  const r = await db().query("select doc from member_state order by name asc");
  return r.rows.map((row) => row.doc as MemberDoc);
}

export async function writeMemberDoc(userId: string, doc: MemberDoc): Promise<void> {
  await ensureReady();
  await db().query(
    `insert into member_state (user_id, name, doc, updated_at)
     values ($1, $2, $3, now())
     on conflict (user_id) do update
       set name = excluded.name, doc = excluded.doc, updated_at = now()`,
    [userId, doc.member?.name ?? "", JSON.stringify(doc)]
  );
}

export async function readCoachDoc(userId: string): Promise<CoachDoc | null> {
  await ensureReady();
  const r = await db().query("select doc from coach_state where user_id = $1", [userId]);
  return r.rows[0]?.doc ?? null;
}

export async function writeCoachDoc(userId: string, doc: CoachDoc): Promise<void> {
  await ensureReady();
  await db().query(
    `insert into coach_state (user_id, doc, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set doc = excluded.doc, updated_at = now()`,
    [userId, JSON.stringify(doc)]
  );
}

/* ------------------------------------------------------------------ */
/* Self-created accounts. See lib/accounts.ts — passwords are hashed    */
/* before they get here and this module never sees a plaintext one.     */
/* ------------------------------------------------------------------ */

export async function readAccount(userId: string): Promise<StoredAccount | null> {
  await ensureReady();
  const r = await db().query(
    "select user_id, name, password_hash from account where user_id = $1",
    [userId]
  );
  const row = r.rows[0];
  return row ? { userId: row.user_id, name: row.name, hash: row.password_hash } : null;
}

/**
 * Insert only — never an upsert. Two people picking the same username at the
 * same moment must end with one account and one clear failure, not with the
 * second silently taking over the first one's row.
 *
 * Returns false when the name was already taken.
 */
export async function writeAccount(a: StoredAccount): Promise<boolean> {
  await ensureReady();
  const r = await db().query(
    `insert into account (user_id, name, password_hash) values ($1, $2, $3)
     on conflict (user_id) do nothing`,
    [a.userId, a.name, a.hash]
  );
  return (r.rowCount ?? 0) > 0;
}

/** Everyone who signed themselves up, for Deepika's roster. */
export async function readAccountNames(): Promise<{ userId: string; name: string }[]> {
  await ensureReady();
  const r = await db().query("select user_id, name from account order by created_at asc");
  return r.rows.map((row) => ({ userId: row.user_id, name: row.name }));
}
