import { del, get } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  isConfigured,
  markPrivateFileDeleted,
  readPrivateFileRecord,
  type PrivateFileRecord,
} from "@/lib/db";
import {
  authenticatedFileSession,
  canAccessPrivateFile,
  PrivateFileConfigurationError,
  type PrivateFileClaims,
  privateFileIdHash,
  privateFileContentDisposition,
  readPrivateFileId,
} from "@/lib/private-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const NO_STORE = { "Cache-Control": "private, no-store" };

function notFound() {
  return NextResponse.json(
    { error: "File not found" },
    { status: 404, headers: NO_STORE },
  );
}

function recordMatchesClaims(
  record: PrivateFileRecord | null,
  claims: PrivateFileClaims,
): boolean {
  return Boolean(
    record &&
      record.ownerId === claims.ownerId &&
      record.pathname === claims.pathname &&
      record.kind === claims.kind &&
      record.fileName === claims.fileName &&
      record.contentType === claims.contentType &&
      record.size === claims.size,
  );
}

export async function GET(_request: Request, props: RouteContext) {
  const params = await props.params;
  const user = await authenticatedFileSession();
  if (!user) {
    return NextResponse.json(
      { error: "Not signed in" },
      { status: 401, headers: NO_STORE },
    );
  }
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "File storage is unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const claims = readPrivateFileId(params.id);
    if (!claims || !canAccessPrivateFile(user, claims)) return notFound();
    const record = await readPrivateFileRecord(privateFileIdHash(params.id));
    if (!recordMatchesClaims(record, claims)) return notFound();

    const result = await get(claims.pathname, {
      access: "private",
      abortSignal: AbortSignal.timeout(20_000),
    });
    if (
      !result ||
      result.statusCode !== 200 ||
      !result.stream ||
      result.blob.pathname !== claims.pathname ||
      result.blob.contentType !== claims.contentType ||
      result.blob.size !== claims.size
    ) {
      return notFound();
    }

    const responseHeaders = new Headers({
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": privateFileContentDisposition(claims),
      "Content-Type": claims.contentType,
      "Cross-Origin-Resource-Policy": "same-origin",
      Pragma: "no-cache",
      Vary: "Authorization, Cookie",
      "X-Content-Type-Options": "nosniff",
    });
    responseHeaders.set("Content-Length", String(claims.size));
    return new Response(result.stream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof PrivateFileConfigurationError) {
      return NextResponse.json(
        { error: "File storage is unavailable" },
        { status: 503, headers: NO_STORE },
      );
    }
    console.error(
      "[files] download failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "File storage is temporarily unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
}

export async function DELETE(_request: Request, props: RouteContext) {
  const params = await props.params;
  const user = await authenticatedFileSession();
  if (!user) {
    return NextResponse.json(
      { error: "Not signed in" },
      { status: 401, headers: NO_STORE },
    );
  }
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "File storage is unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const claims = readPrivateFileId(params.id);
    if (!claims || !canAccessPrivateFile(user, claims)) return notFound();
    const idHash = privateFileIdHash(params.id);
    const record = await readPrivateFileRecord(idHash);
    if (!recordMatchesClaims(record, claims)) return notFound();

    await del(claims.pathname, { abortSignal: AbortSignal.timeout(20_000) });
    await markPrivateFileDeleted(idHash);
    return new Response(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    if (error instanceof PrivateFileConfigurationError) {
      return NextResponse.json(
        { error: "File storage is unavailable" },
        { status: 503, headers: NO_STORE },
      );
    }
    console.error(
      "[files] delete failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "File storage is temporarily unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
}
