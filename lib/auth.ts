/**
 * Authentication for the pilot.
 *
 * One environment-managed coach account, optional environment-managed member
 * accounts, and database-backed self-created member accounts.
 *
 * Configuration:
 *   AUTH_SECRET      random string, signs the session cookie
 *   COACH_PASSWORD   Deepika's password
 *   MEMBERS          the cohort, as "username:password:Display Name" entries
 *                    separated by commas or newlines. Example:
 *                      radhika:someword:Radhika,priya:otherword:Priya
 *
 * With none of these set, local development falls back to the demo accounts
 * below. Production never accepts those public credentials or the development
 * signing key: missing configuration makes sign-in unavailable.
 */
import { readSignedSessionToken, type SessionUser } from "./session-token";

export {
  createSessionToken,
  sessionCookieName,
  sessionMaxAge,
  sessionSigningAvailable,
  type Role,
  type SessionUser,
} from "./session-token";

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

/** Public demo credentials are a local-development convenience only. */
export function demoAuthIsEnabled(): boolean {
  return Boolean(
    process.env.NODE_ENV !== "production" &&
      !process.env.AUTH_SECRET?.trim() &&
      !process.env.COACH_PASSWORD?.trim() &&
      !process.env.MEMBERS?.trim(),
  );
}

export const demoCredentials = {
  coach: { username: "deepika", password: DEMO_COACH_PASSWORD },
  member: { username: DEMO_MEMBER_ID, password: DEMO_MEMBER_PASSWORD },
};

/** Parses MEMBERS into accounts. Malformed entries are skipped, not fatal. */
function memberAccounts(): Account[] {
  const raw = process.env.MEMBERS?.trim();
  if (!raw) {
    return demoAuthIsEnabled()
      ? [
          {
            sub: DEMO_MEMBER_ID,
            role: "member",
            name: "Radhika",
            username: DEMO_MEMBER_ID,
            password: DEMO_MEMBER_PASSWORD,
          },
        ]
      : [];
  }
  return raw
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [username, password, ...rest] = line.split(":");
      if (!username || !password) return null;
      const name =
        rest.join(":").trim() ||
        username.charAt(0).toUpperCase() + username.slice(1);
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
  const coachPassword =
    process.env.COACH_PASSWORD?.trim() ||
    (demoAuthIsEnabled() ? DEMO_COACH_PASSWORD : null);
  return [
    ...(coachPassword
      ? [
          {
            sub: "deepika",
            role: "coach" as const,
            name: "Deepika",
            username: "deepika",
            password: coachPassword,
          },
        ]
      : []),
    ...memberAccounts(),
  ];
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function readSessionToken(
  token: string | undefined,
): Promise<SessionUser | null> {
  const user = await readSignedSessionToken(token);
  if (!user) return null;

  // Node route handlers additionally compare database-account versions, which
  // makes every old API session unusable after a password reset. Middleware
  // imports only the Edge-safe verifier and never pulls this module into its
  // bundle.
  if (process.env.NEXT_RUNTIME !== "edge" && user.role === "member") {
    try {
      const { isConfigured, readAccountSessionVersion } = await import("./db");
      if (isConfigured()) {
        const current = await readAccountSessionVersion(user.sub);
        if (current === null) {
          // Environment-backed members have no database account/version.
          if (user.sessionVersion !== undefined) return null;
        } else if (user.sessionVersion !== current) {
          return null;
        }
      } else if (user.sessionVersion !== undefined) {
        return null;
      }
    } catch {
      // A versioned session belongs to a DB account, so fail closed when its
      // revocation state cannot be checked. Environment accounts still work.
      if (user.sessionVersion !== undefined) return null;
    }
  }
  return user;
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const account = accounts().find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase(),
  );
  if (!account) return null;
  if (!safeEqual(account.password, password)) return null;
  return { sub: account.sub, role: account.role, name: account.name };
}
