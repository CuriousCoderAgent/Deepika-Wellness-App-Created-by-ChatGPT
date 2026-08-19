/**
 * Authentication for the pilot.
 *
 * One coach account and any number of member accounts, all defined by
 * environment variables. No external auth service and no database — that is
 * the right size for a closed pilot and keeps the app deployable with nothing
 * but env vars.
 *
 * Configuration:
 *   AUTH_SECRET      random string, signs the session cookie
 *   COACH_PASSWORD   Deepika's password
 *   MEMBERS          the cohort, as "username:password:Display Name" entries
 *                    separated by commas or newlines. Example:
 *                      radhika:someword:Radhika,priya:otherword:Priya
 *
 * With none of these set the app falls back to the demo accounts below so a
 * preview deployment still opens. That fallback is only defensible while the
 * data is fictional — a password in a public repo is not a password.
 */

const SESSION_COOKIE = "dw_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — this cohort should not be re-typing passwords

export type Role = "coach" | "member";

export interface SessionUser {
  /** Also the storage namespace for this account's data. */
  sub: string;
  role: Role;
  name: string;
}

interface Account extends SessionUser {
  username: string;
  password: string;
}

/**
 * The one account that carries the seeded demo history, so Deepika has
 * something populated to look at. Every other member starts empty.
 */
export const DEMO_MEMBER_ID = "radhika";

const DEMO_COACH_PASSWORD = "deepika2026";
const DEMO_MEMBER_PASSWORD = "radhika2026";

export function sessionsAreSecure(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.COACH_PASSWORD && process.env.MEMBERS);
}

export const demoCredentials = {
  coach: { username: "deepika", password: DEMO_COACH_PASSWORD },
  member: { username: DEMO_MEMBER_ID, password: DEMO_MEMBER_PASSWORD },
};

/** Parses MEMBERS into accounts. Malformed entries are skipped, not fatal. */
function memberAccounts(): Account[] {
  const raw = process.env.MEMBERS?.trim();
  if (!raw) {
    return [
      {
        sub: DEMO_MEMBER_ID,
        role: "member",
        name: "Radhika",
        username: DEMO_MEMBER_ID,
        password: DEMO_MEMBER_PASSWORD,
      },
    ];
  }
  return raw
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [username, password, ...rest] = line.split(":");
      if (!username || !password) return null;
      const name = rest.join(":").trim() || username.charAt(0).toUpperCase() + username.slice(1);
      return {
        sub: username.toLowerCase(),
        role: "member" as const,
        name,
        username: username.toLowerCase(),
        password,
      };
    })
    .filter(Boolean) as Account[];
}

function accounts(): Account[] {
  return [
    {
      sub: "deepika",
      role: "coach",
      name: "Deepika",
      username: "deepika",
      password: process.env.COACH_PASSWORD || DEMO_COACH_PASSWORD,
    },
    ...memberAccounts(),
  ];
}

function secret(): string {
  return process.env.AUTH_SECRET || "dev-only-unsafe-secret-set-AUTH_SECRET";
}

/* ------------------------------------------------------------------ */
/* Signing — Web Crypto, so this works in both the Edge middleware and  */
/* Node route handlers without a polyfill.                              */
/* ------------------------------------------------------------------ */

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const body = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(body)));
  return `${payload}.${await hmac(payload)}`;
}

export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmac(payload))) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof body.exp !== "number" || body.exp * 1000 < Date.now()) return null;
    return { sub: body.sub, role: body.role, name: body.name };
  } catch {
    return null;
  }
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const account = accounts().find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!account) return null;
  if (!safeEqual(account.password, password)) return null;
  return { sub: account.sub, role: account.role, name: account.name };
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionMaxAge = SESSION_MAX_AGE;
