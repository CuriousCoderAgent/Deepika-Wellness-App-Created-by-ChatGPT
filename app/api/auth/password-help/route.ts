import { NextResponse } from "next/server";
import {
  authRateLimitKey,
  beginPasswordReset,
  cancelPasswordReset,
} from "@/lib/accounts";
import { consumeAuthRateLimit, isConfigured } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_MESSAGE =
  "If an account matches those details, we’ll email a password-reset link shortly.";

function genericResponse() {
  return NextResponse.json({ message: GENERIC_MESSAGE });
}

function clientAddress(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Always generic: no account, limit, database, or delivery enumeration. */
export async function POST(req: Request) {
  const notBefore = new Promise((resolve) => setTimeout(resolve, 500));
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  const body =
    Number.isFinite(contentLength) && contentLength <= 4_096
      ? await req.json().catch(() => ({}) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  // Mobile already sends `username`; it may contain either username or email.
  const identifier =
    typeof body.email === "string"
      ? body.email
      : typeof body.username === "string"
        ? body.username
        : "";

  try {
    if (isConfigured()) {
      const addressAllowed = await consumeAuthRateLimit({
        scope: "password-help-address",
        keyHash: authRateLimitKey("password-help-address", clientAddress(req)),
        limit: 10,
        windowSeconds: 15 * 60,
      });

      if (!addressAllowed) {
        await notBefore;
        return genericResponse();
      }

      const identifierAllowed = await consumeAuthRateLimit({
        scope: "password-help-identifier",
        keyHash: authRateLimitKey(
          "password-help-identifier",
          identifier || "empty",
        ),
        limit: 3,
        windowSeconds: 15 * 60,
      });

      if (identifierAllowed) {
        const reset = await beginPasswordReset(identifier);
        if (reset) {
          try {
            await sendPasswordResetEmail({
              to: reset.email,
              name: reset.name,
              token: reset.token,
              resetId: reset.id,
              requestUrl: req.url,
            });
          } catch {
            // Never leave an undelivered credential usable in the database.
            await cancelPasswordReset(reset.id).catch(() => undefined);
          }
        }
      }
    }
  } catch {
    // Recovery must not disclose storage/provider health or account existence.
  }

  await notBefore;
  return genericResponse();
}
