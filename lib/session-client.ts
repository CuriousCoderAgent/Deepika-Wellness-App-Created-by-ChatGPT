/**
 * The signed-in account, readable from the browser.
 *
 * Two cookies do two different jobs here, and it matters which is which:
 *
 *   dw_session  httpOnly, signed. The actual credential. Middleware checks it
 *               on every protected request. JavaScript can never read it.
 *   dw_user     plain, readable. Not a credential — just "who is this", so the
 *               client can namespace local storage and decide whether to load
 *               the demo data or a blank start.
 *
 * Forging dw_user gets you a different pile of localStorage and nothing else:
 * every authorisation decision still runs against the signed cookie on the
 * server. It is a hint, not a key.
 *
 * This lives apart from lib/auth.ts on purpose, so the module that reads
 * passwords out of the environment is never pulled into the browser bundle.
 */

export const USER_COOKIE = "dw_user";

/** Also the storage namespace for the seeded demo account. */
export const DEMO_MEMBER_ID = "radhika";

export interface ClientSession {
  sub: string;
  role: "coach" | "member";
  name: string;
}

/**
 * Plain JSON, deliberately not URL-encoded here — Next's cookie API encodes
 * values on the way out, so pre-encoding produces a double-encoded string that
 * survives one decodeURIComponent and then fails JSON.parse silently.
 */
export function encodeUserCookie(u: ClientSession): string {
  return JSON.stringify(u);
}

export function readUserCookie(): ClientSession | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${USER_COOKIE}=`));
  if (!hit) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(hit.slice(USER_COOKIE.length + 1)));
    if (!parsed?.sub || !parsed?.role) return null;
    return parsed as ClientSession;
  } catch {
    return null;
  }
}
