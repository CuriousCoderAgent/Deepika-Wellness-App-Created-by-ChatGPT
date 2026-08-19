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

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { readAccount, writeAccount, writeMemberDoc } from "./db";
import { newMember } from "./emptyState";
import { RESERVED_USERNAMES } from "./persist";
import type { SessionUser } from "./auth";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const KEYLEN = 64;

export interface StoredAccount {
  userId: string;
  name: string;
  hash: string;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
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
  // make them written on paper — and there is no reset flow here to rescue
  // anyone who forgets.
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
  displayName: string
): Promise<SessionUser | null> {
  if (isTaken(username)) return null;
  if (await readAccount(username)) return null;

  const name = displayName.trim() || username;
  const created = await writeAccount({
    userId: username,
    name,
    hash: await hashPassword(password),
  });
  // A second signup that raced this one loses here rather than overwriting.
  if (!created) return null;

  await writeMemberDoc(username, {
    member: newMember(username, name),
    actions: [],
    pulses: [],
    workoutLogs: [],
    messages: [],
    sessions: [],
    reports: [],
    foodEntries: [],
  });

  return { sub: username, role: "member", name };
}

export async function verifyAccount(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const account = await readAccount(normaliseUsername(username));
  if (!account) return null;
  if (!(await passwordMatches(password, account.hash))) return null;
  return { sub: account.userId, role: "member", name: account.name };
}
