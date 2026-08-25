import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { rateLimitKey } from "@/lib/accounts";
import {
  consumeRateLimit,
  isConfigured,
  markPrivateFileDeleted,
  registerPrivateFile,
} from "@/lib/db";
import {
  authenticatedFileSession,
  createPrivateFileId,
  createPrivatePathname,
  privateFileIdHash,
  PrivateFileConfigurationError,
  PrivateFileRequestError,
  validatePrivateUpload,
} from "@/lib/private-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function clientAddress(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const user = await authenticatedFileSession();
  if (!user || user.role !== "member") {
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
    const addressAllowed = await consumeRateLimit({
      scope: "file-upload-address",
      keyHash: rateLimitKey("file-upload-address", clientAddress(request)),
      limit: 60,
      windowSeconds: 15 * 60,
    });
    if (!addressAllowed) {
      return NextResponse.json(
        { error: "Too many uploads. Try again later." },
        { status: 429, headers: NO_STORE },
      );
    }
    const ownerAllowed = await consumeRateLimit({
      scope: "file-upload-owner",
      keyHash: rateLimitKey("file-upload-owner", user.sub),
      limit: 30,
      windowSeconds: 15 * 60,
    });
    if (!ownerAllowed) {
      return NextResponse.json(
        { error: "Too many uploads. Try again later." },
        { status: 429, headers: NO_STORE },
      );
    }

    const upload = await validatePrivateUpload(request);
    const pathname = createPrivatePathname(upload.kind);
    const id = createPrivateFileId({
      version: 1,
      ownerId: user.sub,
      pathname,
      kind: upload.kind,
      fileName: upload.fileName,
      contentType: upload.contentType,
      size: upload.size,
      createdAt: new Date().toISOString(),
    });

    const idHash = privateFileIdHash(id);
    const registered = await registerPrivateFile({
      idHash,
      ownerId: user.sub,
      pathname,
      kind: upload.kind,
      fileName: upload.fileName,
      contentType: upload.contentType,
      size: upload.size,
    });
    if (!registered) {
      return NextResponse.json(
        { error: "Your private-file allowance has been reached." },
        { status: 409, headers: NO_STORE },
      );
    }

    try {
      await put(pathname, upload.body, {
        access: "private",
        contentType: upload.contentType,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
        abortSignal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      await del(pathname, { abortSignal: AbortSignal.timeout(20_000) }).catch(
        () => undefined,
      );
      await markPrivateFileDeleted(idHash).catch(() => undefined);
      throw error;
    }

    return NextResponse.json(
      {
        file: {
          id,
          kind: upload.kind,
          fileName: upload.fileName,
          contentType: upload.contentType,
          size: upload.size,
        },
      },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof PrivateFileRequestError) {
      return NextResponse.json(
        { error: error.publicMessage },
        { status: error.status, headers: NO_STORE },
      );
    }
    if (error instanceof PrivateFileConfigurationError) {
      return NextResponse.json(
        { error: "File storage is unavailable" },
        { status: 503, headers: NO_STORE },
      );
    }
    console.error(
      "[files] upload failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "File storage is temporarily unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
}
