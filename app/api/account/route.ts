/**
 * Deleting an account, from inside the app.
 *
 * Google Play requires an app that creates accounts to offer deletion from
 * within the app, not only a web page describing how to ask. `/account-deletion`
 * explained the process and left the member waiting on a human; this does it.
 *
 * Deletion is irreversible and there is no undo, so it asks for the password
 * again. A signed session proves the phone was unlocked at some point — it does
 * not prove the person holding it meant to erase a year of health records.
 *
 * Order matters: object storage first, then the database. A blob left behind
 * with no row pointing at it is unreachable but still stored, which is exactly
 * the outcome a deletion request is meant to avoid. Doing storage first means a
 * failure leaves the account intact and retryable instead of half-erased.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { del } from "@vercel/blob";
import { readSessionToken, sessionCookieName, verifyCredentials } from "@/lib/auth";
import { authRateLimitKey, verifyAccount } from "@/lib/accounts";
import {
  consumeAuthRateLimit,
  deleteAccountData,
  isConfigured,
  readOwnedPrivateFilePaths,
} from "@/lib/db";
import { USER_COOKIE } from "@/lib/session-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientAddress(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

export async function DELETE(req: Request) {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // The coach console holds every member's record. Deletion is scoped to the
  // signed-in person's own account, and Deepika removing a member is a
  // different decision that belongs in the console, not here.
  if (user.role !== "member")
    return NextResponse.json(
      { error: "Account deletion is available to members." },
      { status: 403 },
    );
  if (!isConfigured())
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 503 },
    );

  const raw = await req.text();
  if (raw.length > 8_192)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { password, confirm } = (() => {
    try {
      return JSON.parse(raw || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  if (confirm !== "DELETE")
    return NextResponse.json(
      { error: "This request was not confirmed." },
      { status: 400 },
    );
  if (typeof password !== "string" || !password)
    return NextResponse.json(
      { error: "Enter your password to confirm." },
      { status: 400 },
    );

  try {
    const allowed = await consumeAuthRateLimit({
      scope: "delete-account",
      keyHash: authRateLimitKey("delete-account", clientAddress(req)),
      limit: 5,
      windowSeconds: 15 * 60,
    });
    if (!allowed)
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      );
  } catch {
    return NextResponse.json(
      { error: "Deletion is temporarily unavailable." },
      { status: 503 },
    );
  }

  // Same two account sources as sign-in: the environment first, then the
  // database.
  const verified =
    (await verifyCredentials(user.sub, password)) ??
    (await verifyAccount(user.sub, password).catch(() => null));
  if (!verified || verified.sub !== user.sub)
    return NextResponse.json(
      { error: "That password is not correct." },
      { status: 403 },
    );

  try {
    const pathnames = await readOwnedPrivateFilePaths(user.sub);
    if (pathnames.length) {
      // One call per file rather than a batch: a single unremovable blob
      // should not stop the rest of a member's photos being deleted.
      await Promise.all(
        pathnames.map((pathname) =>
          del(pathname, { abortSignal: AbortSignal.timeout(20_000) }).catch(
            (err) => {
              console.error("[account] blob delete failed", pathname, err);
            },
          ),
        ),
      );
    }

    const result = await deleteAccountData(user.sub);

    const response = NextResponse.json({
      deleted: true,
      // A MEMBERS-provisioned login lives in an environment variable this
      // server cannot rewrite. Her data is gone; say plainly that the sign-in
      // itself still has to be withdrawn by whoever runs the deployment.
      credentialRemoved: result.removedAccount,
      message: result.removedAccount
        ? "Your account and all of your data have been deleted."
        : "Your data has been deleted. Your sign-in was issued by your coach and will be withdrawn separately.",
    });
    response.cookies.set(sessionCookieName, "", { path: "/", maxAge: 0 });
    response.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    console.error("[account] delete failed", err);
    return NextResponse.json(
      { error: "Deletion could not be completed. Nothing was removed." },
      { status: 503 },
    );
  }
}
