/**
 * Edge-safe session token primitives.
 *
 * Keep this module free of database and other Node-only imports: middleware
 * runs in the Edge runtime. Node callers layer account revocation checks on
 * top in `lib/auth.ts`.
 */

const SESSION_COOKIE = "dw_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const DEV_SESSION_SECRET = "dev-only-unsafe-secret-set-AUTH_SECRET";

export type Role = "coach" | "member";

export interface SessionUser {
  /** Also the storage namespace for this account's data. */
  sub: string;
  role: Role;
  name: string;
  /** Present for database accounts so password changes revoke older tokens. */
  sessionVersion?: number;
}

function configuredSessionSecret(): string | null {
  const value = process.env.AUTH_SECRET?.trim();
  return value && new TextEncoder().encode(value).byteLength >= 32
    ? value
    : null;
}

/** Production can issue or validate sessions only with a strong secret. */
export function sessionSigningAvailable(): boolean {
  return (
    Boolean(configuredSessionSecret()) || process.env.NODE_ENV !== "production"
  );
}

function secret(): string {
  const configured = configuredSessionSecret();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return DEV_SESSION_SECRET;
  throw new Error("Session signing is not configured.");
}

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
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const body = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(body)));
  return `${payload}.${await hmac(payload)}`;
}

/** Verifies only the signed token properties available in the Edge runtime. */
export async function readSignedSessionToken(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    if (!safeEqual(sig, await hmac(payload))) return null;
    const body = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof body.exp !== "number" || body.exp * 1000 < Date.now())
      return null;
    if (
      typeof body.sub !== "string" ||
      (body.role !== "coach" && body.role !== "member") ||
      typeof body.name !== "string"
    ) {
      return null;
    }
    return {
      sub: body.sub,
      role: body.role,
      name: body.name,
      ...(Number.isInteger(body.sessionVersion)
        ? { sessionVersion: body.sessionVersion as number }
        : {}),
    };
  } catch {
    return null;
  }
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionMaxAge = SESSION_MAX_AGE;
