/**
 * The signed-in account's data.
 *
 * GET  loads it. A member gets her own document and nothing else; Deepika gets
 *      every member's document, which is what makes the console show real
 *      activity instead of only the demo cohort.
 * PUT  saves it back, scoped the same way.
 *
 * Which account is being read or written is taken from the signed session
 * cookie, never from the request body. A member cannot ask for someone else's
 * record by changing an id, because there is no id to change.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import {
  isConfigured,
  readAllMemberDocs,
  readCoachDoc,
  readMemberDoc,
  writeCoachDoc,
  writeMemberDoc,
} from "@/lib/db";
import type { CoachDoc, MemberDoc } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  return readSessionToken(cookies().get(sessionCookieName)?.value);
}

export async function GET() {
  const user = await session();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Not an error. It is the honest answer to "is there a database", and the
  // client uses it to decide whether to fall back to browser storage.
  if (!isConfigured()) return NextResponse.json({ configured: false });

  try {
    if (user.role === "coach") {
      const [docs, coach] = await Promise.all([
        readAllMemberDocs(),
        readCoachDoc(user.sub),
      ]);
      return NextResponse.json({ configured: true, docs, coach });
    }
    return NextResponse.json({ configured: true, doc: await readMemberDoc(user.sub) });
  } catch (err) {
    console.error("[state] read failed", err);
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}

export async function PUT(req: Request) {
  const user = await session();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ configured: false });

  let body: { doc?: MemberDoc; docs?: MemberDoc[]; coach?: CoachDoc };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  try {
    if (user.role === "coach") {
      // Deepika edits members — publishes a week, sends a message, adds a
      // note — so she writes to their documents. Only the ones that actually
      // changed are sent, which keeps her from stamping her copy of the
      // cohort over a member who logged something a moment ago.
      for (const doc of body.docs ?? []) {
        if (doc?.member?.id) await writeMemberDoc(doc.member.id, doc);
      }
      if (body.coach) await writeCoachDoc(user.sub, body.coach);
      return NextResponse.json({ ok: true });
    }

    const doc = body.doc;
    if (!doc?.member) return NextResponse.json({ error: "Missing document" }, { status: 400 });
    // The session decides the key, so a member can only ever overwrite herself.
    await writeMemberDoc(user.sub, { ...doc, member: { ...doc.member, id: user.sub } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[state] write failed", err);
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}
