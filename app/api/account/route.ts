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
 * the outcome a deletion request is meant to avoid.
 *
 * When a blob genuinely will not delete, the choice is between blocking her
 * erasure on our storage bug and completing it while a file survives. This
 * completes it — a person asking to leave should not be held by our problem —
 * but it keeps that file's registry row, which is the only record of what the
 * object is and who it belonged to, and says so in the response rather than
 * reporting a clean deletion. The sentence people act on when deciding whether
 * to trust an erasure has to be true.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { del } from "@vercel/blob";
import {
  readSessionToken,
  sessionCookieName,
  verifyCredentials,
} from "@/lib/auth";
import { rateLimitKey, verifyAccount } from "@/lib/accounts";
import {
  consumeRateLimit,
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
    const allowed = await consumeRateLimit({
      scope: "delete-account",
      keyHash: rateLimitKey("delete-account", clientAddress(req)),
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

  // Deleting a blob is the one step that can partly fail, so it is tracked
  // rather than fired and forgotten. What used to happen: each failure was
  // caught, logged and ignored, the account was deleted anyway, and the
  // response said "all of your data have been deleted" — which could be
  // false, and is exactly the sentence a person acts on when they are
  // deciding whether to trust an erasure.
  const failed: string[] = [];

  async function removeBlob(pathname: string): Promise<void> {
    try {
      await del(pathname, { abortSignal: AbortSignal.timeout(20_000) });
    } catch (err) {
      // One retry: most failures here are a timeout or a transient 5xx, and
      // retrying costs a second against permanently orphaning a file.
      try {
        await del(pathname, { abortSignal: AbortSignal.timeout(20_000) });
      } catch (retryErr) {
        console.error(
          "[account] blob delete failed after retry",
          pathname,
          retryErr,
        );
        failed.push(pathname);
      }
    }
  }

  try {
    const pathnames = await readOwnedPrivateFilePaths(user.sub);
    // One call per file rather than a batch: a single unremovable blob should
    // not stop the rest of a member's photos being deleted.
    if (pathnames.length) await Promise.all(pathnames.map(removeBlob));

    // Her erasure still proceeds. A storage bug on our side must not become a
    // reason she cannot leave — but the registry rows for anything still in
    // storage are kept, because a blob with no row is an orphan nobody can
    // find again, and those rows are what makes a manual sweep possible.
    const result = await deleteAccountData(user.sub, {
      retainFilePathnames: failed,
    });

    if (failed.length)
      console.error(
        `[account] deletion incomplete for ${user.sub}: ${failed.length} file(s) remain in storage`,
        failed,
      );

    const response = NextResponse.json({
      deleted: true,
      // A MEMBERS-provisioned login lives in an environment variable this
      // server cannot rewrite. Her data is gone; say plainly that the sign-in
      // itself still has to be withdrawn by whoever runs the deployment.
      credentialRemoved: result.removedAccount,
      filesPending: failed.length,
      message: failed.length
        ? `Your account and records have been deleted. ${failed.length} uploaded file${failed.length === 1 ? "" : "s"} could not be removed from storage just now and ${failed.length === 1 ? "has" : "have"} been flagged for removal — nothing else about you remains.`
        : result.removedAccount
          ? "Your account and all of your data have been deleted."
          : "Your data has been deleted. Your sign-in was issued by your coach and will be withdrawn separately.",
    });
    response.cookies.set(sessionCookieName, "", { path: "/", maxAge: 0 });
    response.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    console.error("[account] delete failed", err);
    // Deliberately does not claim nothing changed: blobs are removed before
    // the database transaction, so by the time this runs some files may
    // already be gone. Saying "nothing was removed" would be a guess, and the
    // wrong one often enough to matter.
    return NextResponse.json(
      {
        error:
          "Deletion could not be completed. Your account is still here — please try again, and contact us if it keeps failing.",
      },
      { status: 503 },
    );
  }
}
