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
import { anchorMemberDoc, rebaseMemberDoc } from "./day-offset";

const BOOTSTRAP_KEY = "demo_cohort";
const BOOTSTRAP_VERSION = "1";

/**
 * The connection string for Bharosa's own database.
 *
 * Production deliberately accepts only `BHAROSA_DATABASE_URL`. Reusing a
 * provider's generic `DATABASE_URL` is convenient, but it also makes it far
 * too easy for a new Bharosa deployment to silently attach to an older app's
 * database. Local development and tests retain the legacy fallbacks so an
 * existing developer environment does not break without warning.
 */
function connectionString(): string | undefined {
  const bharosa = process.env.BHAROSA_DATABASE_URL?.trim();
  if (bharosa) return bharosa;
  if (process.env.NODE_ENV === "production") return undefined;
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    undefined
  );
}

export function isConfigured(): boolean {
  return Boolean(connectionString());
}

/**
 * Production health data needs an authenticated TLS peer, not merely an
 * encrypted socket. Managed providers use publicly trusted certificates, so
 * certificate verification stays enabled. Local databases may explicitly use
 * sslmode=disable.
 */
function sslOption(): false | { rejectUnauthorized: boolean } {
  const url = connectionString() ?? "";
  if (/[?&]sslmode=disable/.test(url)) return false;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1")
      return false;
  } catch {
    /* unparseable URL — let pg produce the real error */
  }
  return { rejectUnauthorized: true };
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
      email          text,
      session_version integer not null default 1,
      created_at    timestamptz not null default now()
    );
    alter table account add column if not exists email text;
    alter table account add column if not exists session_version integer not null default 1;
    create unique index if not exists account_email_unique
      on account (lower(email)) where email is not null;

    create table if not exists password_reset_token (
      id         text primary key,
      user_id    text not null references account(user_id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at    timestamptz
    );
    create index if not exists password_reset_token_user_idx
      on password_reset_token (user_id, created_at desc);
    create index if not exists password_reset_token_expiry_idx
      on password_reset_token (expires_at);

    create table if not exists auth_rate_limit (
      scope             text not null,
      key_hash          text not null,
      window_started_at timestamptz not null default now(),
      attempts          integer not null default 1,
      updated_at        timestamptz not null default now(),
      primary key (scope, key_hash)
    );
    create index if not exists auth_rate_limit_updated_idx
      on auth_rate_limit (updated_at);

    create table if not exists private_file (
      id_hash      text primary key,
      owner_id     text not null,
      pathname     text not null unique,
      kind         text not null check (kind in ('meal-photo', 'report')),
      file_name    text not null,
      content_type text not null,
      size_bytes   bigint not null check (size_bytes > 0),
      created_at   timestamptz not null default now(),
      deleted_at   timestamptz
    );
    create index if not exists private_file_owner_idx
      on private_file (owner_id, created_at desc) where deleted_at is null;

    create table if not exists circle_profile (
      user_id        text primary key,
      display_name   text not null default '',
      city           text,
      discoverable   boolean not null default false,
      share_activity boolean not null default false,
      share_steps    boolean not null default false,
      updated_at     timestamptz not null default now()
    );
    alter table circle_profile add column if not exists bio text;
    -- Grid indices, not coordinates. The device coarsens to roughly a 3km cell
    -- before sending, so there is no precise position here to leak.
    alter table circle_profile add column if not exists cell_x integer;
    alter table circle_profile add column if not exists cell_y integer;
    create index if not exists circle_profile_cell_idx
      on circle_profile (cell_x, cell_y) where discoverable;

    -- One-tap encouragement. The published research is consistent that this
    -- mechanism -- social support -- is what helps, where ranking harms
    -- beginners.
    create table if not exists circle_nudge (
      id          text primary key,
      from_id     text not null,
      to_id       text not null,
      kind        text not null,
      created_at  timestamptz not null default now(),
      seen_at     timestamptz
    );
    create index if not exists circle_nudge_to_idx
      on circle_nudge (to_id, created_at desc);
    -- Discovery only ever queries by city, and only rows that opted in.
    create index if not exists circle_profile_city_idx
      on circle_profile (lower(city)) where discoverable;

    create table if not exists circle_connection (
      requester_id text not null,
      addressee_id text not null,
      status       text not null
        check (status in ('pending', 'accepted', 'declined', 'blocked')),
      created_at   timestamptz not null default now(),
      responded_at timestamptz,
      primary key (requester_id, addressee_id),
      check (requester_id <> addressee_id)
    );
    create index if not exists circle_connection_addressee_idx
      on circle_connection (addressee_id, status);
    create index if not exists circle_connection_requester_idx
      on circle_connection (requester_id, status);
  `);

  // The marker, not a row count, decides whether to seed. Counting would
  // resurrect the demo cohort the day Deepika deletes it, which is exactly
  // what she would be doing on purpose before real members arrive.
  const marked = await c.query("select 1 from app_meta where key = $1", [
    BOOTSTRAP_KEY,
  ]);
  if (marked.rowCount) return;

  for (const doc of seedMemberDocs()) {
    await c.query(
      `insert into member_state (user_id, name, doc) values ($1, $2, $3)
       on conflict (user_id) do nothing`,
      [doc.member.id, doc.member.name, JSON.stringify(doc)],
    );
  }
  await c.query(
    `insert into coach_state (user_id, doc) values ($1, $2)
     on conflict (user_id) do nothing`,
    ["deepika", JSON.stringify(seedCoachDoc())],
  );
  await c.query(
    `insert into app_meta (key, value) values ($1, $2) on conflict (key) do nothing`,
    [BOOTSTRAP_KEY, BOOTSTRAP_VERSION],
  );
}

export async function readMemberDoc(userId: string): Promise<MemberDoc | null> {
  await ensureReady();
  const r = await db().query(
    "select doc from member_state where user_id = $1",
    [userId],
  );
  const doc = r.rows[0]?.doc ?? null;
  // Relative day offsets are only meaningful next to the day they were written
  // from. Re-basing here means no caller can read a stale "today".
  return doc ? rebaseMemberDoc(doc as MemberDoc) : null;
}

export async function readAllMemberDocs(): Promise<MemberDoc[]> {
  await ensureReady();
  const r = await db().query("select doc from member_state order by name asc");
  return r.rows.map((row) => rebaseMemberDoc(row.doc as MemberDoc));
}

export async function writeMemberDoc(
  userId: string,
  doc: MemberDoc,
): Promise<void> {
  await ensureReady();
  // Whoever wrote this document did so with offsets relative to their today.
  // Recording that day is what lets the next read move them forward.
  doc = anchorMemberDoc(doc);
  await db().query(
    `insert into member_state (user_id, name, doc, updated_at)
     values ($1, $2, $3, now())
     on conflict (user_id) do update
       set name = excluded.name, doc = excluded.doc, updated_at = now()`,
    [userId, doc.member?.name ?? "", JSON.stringify(doc)],
  );
}

export async function readCoachDoc(userId: string): Promise<CoachDoc | null> {
  await ensureReady();
  const r = await db().query("select doc from coach_state where user_id = $1", [
    userId,
  ]);
  return r.rows[0]?.doc ?? null;
}

export async function writeCoachDoc(
  userId: string,
  doc: CoachDoc,
): Promise<void> {
  await ensureReady();
  await db().query(
    `insert into coach_state (user_id, doc, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set doc = excluded.doc, updated_at = now()`,
    [userId, JSON.stringify(doc)],
  );
}

/* ------------------------------------------------------------------ */
/* Self-created accounts. See lib/accounts.ts — passwords are hashed    */
/* before they get here and this module never sees a plaintext one.     */
/* ------------------------------------------------------------------ */

export async function readAccount(
  userId: string,
): Promise<StoredAccount | null> {
  await ensureReady();
  const r = await db().query(
    `select user_id, name, password_hash, email, session_version
     from account where user_id = $1`,
    [userId],
  );
  const row = r.rows[0];
  return row
    ? {
        userId: row.user_id,
        name: row.name,
        hash: row.password_hash,
        email: row.email ?? null,
        sessionVersion: row.session_version,
      }
    : null;
}

export async function readAccountByEmail(
  email: string,
): Promise<StoredAccount | null> {
  await ensureReady();
  const r = await db().query(
    `select user_id, name, password_hash, email, session_version
     from account where lower(email) = lower($1)`,
    [email],
  );
  const row = r.rows[0];
  return row
    ? {
        userId: row.user_id,
        name: row.name,
        hash: row.password_hash,
        email: row.email ?? null,
        sessionVersion: row.session_version,
      }
    : null;
}

/** Null means this is not a database-backed self-created account. */
export async function readAccountSessionVersion(
  userId: string,
): Promise<number | null> {
  await ensureReady();
  const r = await db().query(
    "select session_version from account where user_id = $1",
    [userId],
  );
  return r.rows[0]?.session_version ?? null;
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
    `insert into account (user_id, name, password_hash, email, session_version)
     values ($1, $2, $3, $4, $5)
     on conflict do nothing`,
    [a.userId, a.name, a.hash, a.email, a.sessionVersion],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Account and empty member document are one durable unit. */
export async function createAccountWithMemberDoc(
  account: StoredAccount,
  doc: MemberDoc,
): Promise<boolean> {
  await ensureReady();
  const client = await db().connect();
  try {
    await client.query("begin");
    const inserted = await client.query(
      `insert into account (user_id, name, password_hash, email, session_version)
       values ($1, $2, $3, $4, $5)
       on conflict do nothing`,
      [
        account.userId,
        account.name,
        account.hash,
        account.email,
        account.sessionVersion,
      ],
    );
    if (!(inserted.rowCount ?? 0)) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `insert into member_state (user_id, name, doc, updated_at)
       values ($1, $2, $3, now())`,
      [account.userId, account.name, JSON.stringify(doc)],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createPasswordResetToken(input: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await ensureReady();
  const client = await db().connect();
  try {
    await client.query("begin");
    // Serialise requests for one account so two simultaneous emails cannot
    // both leave usable tokens behind.
    await client.query(
      "select user_id from account where user_id = $1 for update",
      [input.userId],
    );
    await client.query(
      `update password_reset_token
         set used_at = now()
       where user_id = $1 and used_at is null`,
      [input.userId],
    );
    await client.query(
      `insert into password_reset_token (id, user_id, token_hash, expires_at)
       values ($1, $2, $3, $4)`,
      [input.id, input.userId, input.tokenHash, input.expiresAt],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await db()
    .query(
      `delete from password_reset_token
       where expires_at < now() - interval '7 days'`,
    )
    .catch(() => undefined);
}

export async function cancelPasswordResetToken(id: string): Promise<void> {
  await ensureReady();
  await db().query(
    `update password_reset_token set used_at = now()
     where id = $1 and used_at is null`,
    [id],
  );
}

/**
 * Consumes a reset token and changes the password in one transaction. The row
 * lock makes simultaneous submissions deterministic: exactly one can win.
 */
export async function consumePasswordResetToken(
  tokenHash: string,
  passwordHash: string,
): Promise<boolean> {
  await ensureReady();
  const client = await db().connect();
  try {
    await client.query("begin");
    const token = await client.query(
      `select user_id from password_reset_token
       where token_hash = $1 and used_at is null and expires_at > now()
       for update`,
      [tokenHash],
    );
    const userId = token.rows[0]?.user_id as string | undefined;
    if (!userId) {
      await client.query("rollback");
      return false;
    }

    const changed = await client.query(
      `update account
       set password_hash = $1, session_version = session_version + 1
       where user_id = $2`,
      [passwordHash, userId],
    );
    if (!(changed.rowCount ?? 0)) {
      await client.query("rollback");
      return false;
    }

    await client.query(
      `update password_reset_token set used_at = now()
       where user_id = $1 and used_at is null`,
      [userId],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Atomic fixed-window limiter; only privacy-preserving hashes reach the DB. */
export async function consumeAuthRateLimit(input: {
  scope: string;
  keyHash: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  await ensureReady();
  const r = await db().query(
    `insert into auth_rate_limit
       (scope, key_hash, window_started_at, attempts, updated_at)
     values ($1, $2, now(), 1, now())
     on conflict (scope, key_hash) do update set
       window_started_at = case
         when auth_rate_limit.window_started_at <= now() - ($3::int * interval '1 second')
           then now()
         else auth_rate_limit.window_started_at
       end,
       attempts = case
         when auth_rate_limit.window_started_at <= now() - ($3::int * interval '1 second')
           then 1
         else auth_rate_limit.attempts + 1
       end,
       updated_at = now()
     returning attempts`,
    [input.scope, input.keyHash, input.windowSeconds],
  );
  await db()
    .query(
      `delete from auth_rate_limit
       where updated_at < now() - interval '2 days'`,
    )
    .catch(() => undefined);
  return Number(r.rows[0]?.attempts ?? input.limit + 1) <= input.limit;
}

export interface PrivateFileRecord {
  idHash: string;
  ownerId: string;
  pathname: string;
  kind: "meal-photo" | "report";
  fileName: string;
  contentType: string;
  size: number;
}

const PRIVATE_FILE_LIMIT = 500;
const PRIVATE_FILE_BYTES_LIMIT = 500_000_000;

/**
 * Registers ownership after Blob upload. Advisory locking makes the per-owner
 * quota deterministic across concurrent serverless requests.
 */
export async function registerPrivateFile(
  record: PrivateFileRecord,
): Promise<boolean> {
  await ensureReady();
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      record.ownerId,
    ]);
    const usage = await client.query(
      `select count(*)::int as files,
              coalesce(sum(size_bytes), 0)::bigint as bytes
       from private_file
       where owner_id = $1 and deleted_at is null`,
      [record.ownerId],
    );
    const files = Number(usage.rows[0]?.files ?? 0);
    const bytes = Number(usage.rows[0]?.bytes ?? 0);
    if (
      files >= PRIVATE_FILE_LIMIT ||
      bytes + record.size > PRIVATE_FILE_BYTES_LIMIT
    ) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `insert into private_file
         (id_hash, owner_id, pathname, kind, file_name, content_type, size_bytes)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.idHash,
        record.ownerId,
        record.pathname,
        record.kind,
        record.fileName,
        record.contentType,
        record.size,
      ],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function readPrivateFileRecord(
  idHash: string,
): Promise<PrivateFileRecord | null> {
  await ensureReady();
  const result = await db().query(
    `select id_hash, owner_id, pathname, kind, file_name, content_type, size_bytes
     from private_file where id_hash = $1 and deleted_at is null`,
    [idHash],
  );
  const row = result.rows[0];
  return row
    ? {
        idHash: row.id_hash,
        ownerId: row.owner_id,
        pathname: row.pathname,
        kind: row.kind,
        fileName: row.file_name,
        contentType: row.content_type,
        size: Number(row.size_bytes),
      }
    : null;
}

export async function markPrivateFileDeleted(idHash: string): Promise<void> {
  await ensureReady();
  await db().query(
    `update private_file set deleted_at = now()
     where id_hash = $1 and deleted_at is null`,
    [idHash],
  );
}

/** Everyone who signed themselves up, for Deepika's roster. */
export async function readAccountNames(): Promise<
  { userId: string; name: string }[]
> {
  await ensureReady();
  const r = await db().query(
    "select user_id, name from account order by created_at asc",
  );
  return r.rows.map((row) => ({ userId: row.user_id, name: row.name }));
}

/** Every stored file belonging to one member, so deletion can reach the blobs. */
export async function readOwnedPrivateFilePaths(
  ownerId: string,
): Promise<string[]> {
  await ensureReady();
  const r = await db().query(
    "select pathname from private_file where owner_id = $1 and deleted_at is null",
    [ownerId],
  );
  return r.rows.map((row) => row.pathname as string);
}

/**
 * Erase an account and everything stored under it, in one transaction.
 *
 * A member asking to be deleted is exercising a right, not making a support
 * request, so this removes the record rather than flagging it: her document,
 * her file rows, her outstanding reset tokens, and the account itself. The
 * uploaded blobs are removed by the caller, which is the only layer that knows
 * about object storage.
 *
 * `MEMBERS`-provisioned accounts have no database row — their credentials live
 * in an environment variable that the running server cannot edit. Their
 * document is still removed and the caller reports honestly that the sign-in
 * itself has to be withdrawn by whoever runs the deployment.
 */
export async function deleteAccountData(userId: string): Promise<{
  removedAccount: boolean;
  removedDocument: boolean;
}> {
  await ensureReady();
  const client = await db().connect();
  try {
    await client.query("begin");
    const doc = await client.query(
      "delete from member_state where user_id = $1",
      [userId],
    );
    await client.query("delete from private_file where owner_id = $1", [
      userId,
    ]);
    // Deletion must not leave her in anyone else's circle, or on a discovery
    // list, after her record is gone.
    await client.query(
      "delete from circle_connection where requester_id = $1 or addressee_id = $1",
      [userId],
    );
    await client.query("delete from circle_profile where user_id = $1", [
      userId,
    ]);
    // password_reset_token cascades from account, but a MEMBERS account has no
    // account row for it to cascade from.
    await client.query("delete from password_reset_token where user_id = $1", [
      userId,
    ]);
    const account = await client.query(
      "delete from account where user_id = $1",
      [userId],
    );
    await client.query("commit");
    return {
      removedAccount: (account.rowCount ?? 0) > 0,
      removedDocument: (doc.rowCount ?? 0) > 0,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------ */
/* Circle — member-to-member connections                               */
/* ------------------------------------------------------------------ */

export interface StoredCircleProfile {
  userId: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  /** Grid cell, never a coordinate. See `lib/proximity.ts`. */
  cellX: number | null;
  cellY: number | null;
  discoverable: boolean;
  shareActivity: boolean;
  shareSteps: boolean;
}

const EMPTY_PROFILE = (userId: string): StoredCircleProfile => ({
  userId,
  displayName: "",
  bio: null,
  city: null,
  cellX: null,
  cellY: null,
  // Both default off. A member joins a circle by choosing to, not by
  // signing up.
  discoverable: false,
  shareActivity: false,
  shareSteps: false,
});

function toProfile(row: Record<string, unknown>): StoredCircleProfile {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? ""),
    bio: (row.bio as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    cellX: row.cell_x === null || row.cell_x === undefined ? null : Number(row.cell_x),
    cellY: row.cell_y === null || row.cell_y === undefined ? null : Number(row.cell_y),
    discoverable: Boolean(row.discoverable),
    shareActivity: Boolean(row.share_activity),
    shareSteps: Boolean(row.share_steps),
  };
}

export async function readCircleProfile(
  userId: string,
): Promise<StoredCircleProfile> {
  await ensureReady();
  const r = await db().query(
    "select * from circle_profile where user_id = $1",
    [userId],
  );
  return r.rows[0] ? toProfile(r.rows[0]) : EMPTY_PROFILE(userId);
}

export async function readCircleProfiles(
  userIds: string[],
): Promise<Map<string, StoredCircleProfile>> {
  if (!userIds.length) return new Map();
  await ensureReady();
  const r = await db().query(
    "select * from circle_profile where user_id = any($1::text[])",
    [userIds],
  );
  const found = new Map<string, StoredCircleProfile>(
    r.rows.map((row) => [String(row.user_id), toProfile(row)]),
  );
  // A member with no row has simply never opened the screen. Return the
  // all-off default rather than nothing, so callers need no special case.
  for (const id of userIds) if (!found.has(id)) found.set(id, EMPTY_PROFILE(id));
  return found;
}

export async function writeCircleProfile(
  profile: StoredCircleProfile,
): Promise<void> {
  await ensureReady();
  await db().query(
    `insert into circle_profile
       (user_id, display_name, bio, city, cell_x, cell_y,
        discoverable, share_activity, share_steps, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (user_id) do update set
       display_name = excluded.display_name,
       bio = excluded.bio,
       city = excluded.city,
       cell_x = excluded.cell_x,
       cell_y = excluded.cell_y,
       discoverable = excluded.discoverable,
       share_activity = excluded.share_activity,
       share_steps = excluded.share_steps,
       updated_at = now()`,
    [
      profile.userId,
      profile.displayName,
      profile.bio,
      profile.city,
      profile.cellX,
      profile.cellY,
      profile.discoverable,
      profile.shareActivity,
      profile.shareSteps,
    ],
  );
}

export interface StoredConnection {
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  createdAt: string;
  respondedAt: string | null;
}

function toConnection(row: Record<string, unknown>): StoredConnection {
  return {
    requesterId: String(row.requester_id),
    addresseeId: String(row.addressee_id),
    status: row.status as StoredConnection["status"],
    createdAt: new Date(row.created_at as string).toISOString(),
    respondedAt: row.responded_at
      ? new Date(row.responded_at as string).toISOString()
      : null,
  };
}

/** Every connection this member is either side of. */
export async function readConnectionsFor(
  userId: string,
): Promise<StoredConnection[]> {
  await ensureReady();
  const r = await db().query(
    `select * from circle_connection
     where requester_id = $1 or addressee_id = $1
     order by created_at desc`,
    [userId],
  );
  return r.rows.map(toConnection);
}

export async function readConnectionBetween(
  a: string,
  b: string,
): Promise<StoredConnection | null> {
  await ensureReady();
  const r = await db().query(
    `select * from circle_connection
     where (requester_id = $1 and addressee_id = $2)
        or (requester_id = $2 and addressee_id = $1)`,
    [a, b],
  );
  return r.rows[0] ? toConnection(r.rows[0]) : null;
}

/**
 * Ask to connect.
 *
 * Returns false when a connection already exists in either direction, which
 * covers the ordinary race of two people adding each other at once as well as
 * an attempt to re-send a request that was declined. A declined request is not
 * silently reopened: someone who said no should not have to say it repeatedly.
 */
export async function createConnectionRequest(
  requesterId: string,
  addresseeId: string,
): Promise<boolean> {
  await ensureReady();
  const r = await db().query(
    `insert into circle_connection (requester_id, addressee_id, status)
     values ($1, $2, 'pending')
     on conflict do nothing`,
    [requesterId, addresseeId],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Only the addressee may answer, which is enforced in the query itself. */
export async function respondToConnection(
  addresseeId: string,
  requesterId: string,
  status: "accepted" | "declined" | "blocked",
): Promise<boolean> {
  await ensureReady();
  const r = await db().query(
    `update circle_connection set status = $3, responded_at = now()
     where requester_id = $1 and addressee_id = $2 and status = 'pending'`,
    [requesterId, addresseeId, status],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Either side can walk away, at any time, without asking the other. */
export async function removeConnection(
  userId: string,
  otherId: string,
): Promise<boolean> {
  await ensureReady();
  const r = await db().query(
    `delete from circle_connection
     where (requester_id = $1 and addressee_id = $2)
        or (requester_id = $2 and addressee_id = $1)`,
    [userId, otherId],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Members in the same city who have opted in to being found.
 *
 * City is the most precise location this ever handles. Anyone already
 * connected, already asked, or who declined is excluded, so the list is people
 * she could actually reach out to and declining removes someone from view.
 */
export async function discoverByCity(
  userId: string,
  city: string,
  limit = 25,
): Promise<StoredCircleProfile[]> {
  await ensureReady();
  const r = await db().query(
    `select p.* from circle_profile p
     where p.discoverable
       and lower(p.city) = lower($2)
       and p.user_id <> $1
       and not exists (
         select 1 from circle_connection c
         where (c.requester_id = $1 and c.addressee_id = p.user_id)
            or (c.requester_id = p.user_id and c.addressee_id = $1)
       )
     order by p.updated_at desc
     limit $3`,
    [userId, city, limit],
  );
  return r.rows.map(toProfile);
}

/** Deleting an account must not leave her in anyone else's circle. */
export async function deleteCircleData(userId: string): Promise<void> {
  await ensureReady();
  await db().query(
    "delete from circle_connection where requester_id = $1 or addressee_id = $1",
    [userId],
  );
  await db().query("delete from circle_profile where user_id = $1", [userId]);
}

/**
 * Members in nearby cells who chose to be found.
 *
 * Queried by grid square rather than by distance, so the database is never
 * asked "who is closest to this point" — a question whose answer, repeated,
 * locates someone.
 */
export async function discoverNearby(
  userId: string,
  cells: { x: number; y: number }[],
  limit = 25,
): Promise<StoredCircleProfile[]> {
  if (!cells.length) return [];
  await ensureReady();
  const r = await db().query(
    `select p.* from circle_profile p
     where p.discoverable
       and p.user_id <> $1
       and (p.cell_x, p.cell_y) = any($2::record[])
       and not exists (
         select 1 from circle_connection c
         where (c.requester_id = $1 and c.addressee_id = p.user_id)
            or (c.requester_id = p.user_id and c.addressee_id = $1)
       )
     order by p.updated_at desc
     limit $3`,
    [userId, cells.map((c) => `(${c.x},${c.y})`), limit],
  );
  return r.rows.map(toProfile);
}

/** A one-tap encouragement, from one member to one member. */
export async function createNudge(input: {
  id: string;
  fromId: string;
  toId: string;
  kind: string;
}): Promise<void> {
  await ensureReady();
  await db().query(
    `insert into circle_nudge (id, from_id, to_id, kind) values ($1, $2, $3, $4)
     on conflict do nothing`,
    [input.id, input.fromId, input.toId, input.kind],
  );
}

/** How many encouragements are waiting, and who sent them. */
export async function readNudgesFor(
  userId: string,
  since: Date,
): Promise<{ fromId: string; kind: string; createdAt: string }[]> {
  await ensureReady();
  const r = await db().query(
    `select from_id, kind, created_at from circle_nudge
     where to_id = $1 and created_at >= $2
     order by created_at desc limit 50`,
    [userId, since.toISOString()],
  );
  return r.rows.map((row) => ({
    fromId: String(row.from_id),
    kind: String(row.kind),
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
}

/** Nudges sent recently, so one person cannot flood another. */
export async function countRecentNudges(
  fromId: string,
  toId: string,
  since: Date,
): Promise<number> {
  await ensureReady();
  const r = await db().query(
    `select count(*)::int as n from circle_nudge
     where from_id = $1 and to_id = $2 and created_at >= $3`,
    [fromId, toId, since.toISOString()],
  );
  return Number(r.rows[0]?.n ?? 0);
}
