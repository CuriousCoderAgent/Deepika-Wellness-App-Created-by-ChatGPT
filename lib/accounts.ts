/**
 * Accounts people create for themselves.
 *
 * The env-var cohort in lib/auth.ts stays as it is — Deepika's login and any
 * account handed out by hand. This is the other half: a woman who gets the
 * link from Deepika, picks her own username and password, and is in. At the
 * size this is meant for, one person minting credentials for twenty others
 * and passing them around on WhatsApp is worse for everyone, including for
 * the passwords.
 *
 * Passwords here are hashed, not compared. The env-var ones are plain because
 * they are typed by whoever runs the deployment and are already visible to
 * them; these belong to the members themselves, so they are stored as scrypt
 * hashes with a per-account salt and nothing can read them back — including
 * Deepika, and including anyone who gets a copy of the database.
 *
 * Server only. Node's crypto is not available in the Edge middleware, which is
 * exactly why the middleware imports from lib/auth.ts and never from here.
 */

import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCb,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";
import {
  cancelPasswordResetToken,
  consumePasswordResetToken,
  createAccountWithMemberDoc,
  createPasswordResetToken,
  readAccount,
  readAccountByEmail,
} from "./db";
import { newMember } from "./emptyState";
import { RESERVED_USERNAMES } from "./persist";
import type { SessionUser } from "./auth";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const DUMMY_PASSWORD_HASH = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;

export interface StoredAccount {
  userId: string;
  name: string;
  hash: string;
  email: string | null;
  sessionVersion: number;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function passwordMatches(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(
    password,
    Buffer.from(saltB64, "base64"),
    expected.length,
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Usernames are lowercased and restricted, because this one string is also the
 * key her data is stored under and the id every record of hers carries. Let it
 * be free-form and a stray capital or trailing space becomes a second, empty
 * account she cannot get out of.
 */
export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function emailProblem(raw: string): string | null {
  const email = normaliseEmail(raw);
  if (!email) return "Please add your email address.";
  if (email.length > 254) return "That email address is too long.";
  const at = email.lastIndexOf("@");
  if (at < 1 || at > 64 || at !== email.indexOf("@")) {
    return "Enter a valid email address.";
  }
  const local = email.slice(0, at);
  if (!/^[^\s@\u0000-\u001f\u007f]+$/.test(local)) {
    return "Enter a valid email address.";
  }
  const domain = email.slice(at + 1);
  if (
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain
      .split(".")
      .some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
  ) {
    return "Enter a valid email address.";
  }
  return null;
}

export function usernameProblem(username: string): string | null {
  if (username.length < 3) return "Usernames need at least 3 characters.";
  if (username.length > 24) return "Usernames can be at most 24 characters.";
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(username)) {
    return "Use letters, numbers, dots, dashes or underscores.";
  }
  return null;
}

export function passwordProblem(password: string): string | null {
  // Length only. Symbol-and-capital rules do not make passwords better, they
  // make them written on paper. A verified email reset flow handles forgotten
  // passwords without weakening this rule.
  if (password.length < 8) return "Passwords need at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

/** Names already spoken for, whoever holds them. */
export function isTaken(username: string): boolean {
  if (username === "deepika") return true;
  if (RESERVED_USERNAMES.includes(username)) return true;
  const members = process.env.MEMBERS ?? "";
  return members
    .split(/[\n,]+/)
    .map((line) => line.trim().split(":")[0]?.trim().toLowerCase())
    .filter(Boolean)
    .includes(username);
}

/**
 * Creates the account and her (empty) member record in one go, so she shows up
 * in Deepika's console the moment she signs up rather than only once she has
 * logged something. Returns null if the username went to someone else.
 */
export async function createAccount(
  username: string,
  password: string,
  displayName: string,
  email: string,
): Promise<SessionUser | null> {
  if (isTaken(username)) return null;
  if (await readAccount(username)) return null;

  const name = displayName.trim() || username;
  const account: StoredAccount = {
    userId: username,
    name,
    hash: await hashPassword(password),
    email: normaliseEmail(email),
    sessionVersion: 1,
  };
  const created = await createAccountWithMemberDoc(account, {
    member: newMember(username, name),
    actions: [],
    pulses: [],
    workoutLogs: [],
    messages: [],
    sessions: [],
    reports: [],
    foodEntries: [],
  });
  // A second signup that raced this one loses here rather than overwriting.
  if (!created) return null;

  return { sub: username, role: "member", name, sessionVersion: 1 };
}

export async function verifyAccount(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const account = await readAccount(normaliseUsername(username));
  const matches = await passwordMatches(
    password,
    account?.hash ?? DUMMY_PASSWORD_HASH,
  );
  if (!account || !matches) return null;
  return {
    sub: account.userId,
    role: "member",
    name: account.name,
    sessionVersion: account.sessionVersion,
  };
}

function resetTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Stable, non-reversible database keys for anonymous rate limits. AUTH_SECRET
 * is already required in production and keeps emails/IPs out of the limiter.
 */
export function authRateLimitKey(scope: string, value: string): string {
  const configured = process.env.AUTH_SECRET?.trim();
  const secret =
    configured && Buffer.byteLength(configured, "utf8") >= 32
      ? configured
      : process.env.NODE_ENV !== "production"
        ? "dev-only-unsafe-secret-set-AUTH_SECRET"
        : null;
  if (!secret)
    throw new Error("Authentication rate limiting is not configured.");
  return createHmac("sha256", secret)
    .update(scope)
    .update("\0")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export interface PasswordResetDelivery {
  id: string;
  token: string;
  email: string;
  name: string;
  expiresAt: Date;
}

/**
 * Resolves either an email address or a username for backwards-compatible
 * mobile clients. The caller must always return the same public response,
 * including when this returns null.
 */
export async function beginPasswordReset(
  rawIdentifier: string,
): Promise<PasswordResetDelivery | null> {
  const identifier = rawIdentifier.trim();
  if (!identifier || identifier.length > 254) return null;

  const account = identifier.includes("@")
    ? emailProblem(identifier)
      ? null
      : await readAccountByEmail(normaliseEmail(identifier))
    : usernameProblem(normaliseUsername(identifier))
      ? null
      : await readAccount(normaliseUsername(identifier));
  if (!account?.email) return null;

  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await createPasswordResetToken({
    id,
    userId: account.userId,
    tokenHash: resetTokenHash(token),
    expiresAt,
  });
  return { id, token, email: account.email, name: account.name, expiresAt };
}

export async function cancelPasswordReset(id: string): Promise<void> {
  await cancelPasswordResetToken(id);
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<boolean> {
  if (token.length < 32 || token.length > 256) return false;
  return consumePasswordResetToken(
    resetTokenHash(token),
    await hashPassword(password),
  );
}
