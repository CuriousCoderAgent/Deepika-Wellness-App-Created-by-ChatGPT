/**
 * A member's own copy of everything stored about her.
 *
 * The Privacy card has always said "you can request an export or deletion at
 * any time", and the only way to act on it was to message the coach and wait.
 * This makes the export immediate and self-service, which is what a data
 * right is supposed to be.
 *
 * It returns her document exactly as stored, plus a manifest of her uploaded
 * files. The files themselves are not inlined — they are fetched one at a time
 * through `/api/files/[id]`, which is the only place that authorises access to
 * private object storage, and a single response carrying every blood report a
 * member has ever uploaded is not something to create casually.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import { isConfigured, readMemberDoc, readOwnedPrivateFilePaths } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

export async function GET() {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // Deepika's console holds the whole cohort. An export is a member exercising
  // a right over her own record, so this is deliberately member-only rather
  // than a route that can dump everybody.
  if (user.role !== "member")
    return NextResponse.json(
      { error: "Exports are available to members." },
      { status: 403 },
    );
  if (!isConfigured())
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 503 },
    );

  try {
    const doc = await readMemberDoc(user.sub);
    if (!doc)
      return NextResponse.json({ error: "No record found." }, { status: 404 });
    const files = await readOwnedPrivateFilePaths(user.sub);
    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        account: { username: user.sub, name: user.name },
        document: doc,
        uploadedFileCount: files.length,
        note: "Meal photos and reports are stored privately and are downloaded individually from within the app.",
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="bharosa-export-${user.sub}.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    console.error("[account/export] failed", err);
    return NextResponse.json(
      { error: "Export is temporarily unavailable." },
      { status: 503 },
    );
  }
}
