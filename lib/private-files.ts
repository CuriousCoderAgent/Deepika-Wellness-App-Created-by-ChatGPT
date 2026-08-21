import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import {
  readSessionToken,
  sessionCookieName,
  type SessionUser,
} from "@/lib/auth";

export type PrivateFileKind = "meal-photo" | "report";

type FilePolicy = {
  maxBytes: number;
  mimeTypes: Readonly<Record<string, string>>;
};

const FILE_POLICIES: Record<PrivateFileKind, FilePolicy> = {
  "meal-photo": {
    // Server uploads on Vercel have a 4.5 MB request-body ceiling. Keep room
    // for multipart framing instead of accepting a file the platform rejects.
    maxBytes: 4_000_000,
    mimeTypes: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    },
  },
  report: {
    maxBytes: 4_000_000,
    mimeTypes: {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
    },
  },
};

const FILE_ID_VERSION = "v1";
const FILE_PATH_PREFIX = "bharosa-private";
const MAX_MULTIPART_BYTES = 4_500_000;
const MAX_FILE_ID_LENGTH = 4096;
const MAX_FILE_NAME_LENGTH = 120;

export class PrivateFileRequestError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "PrivateFileRequestError";
  }
}

export class PrivateFileConfigurationError extends Error {
  constructor() {
    super("Private file storage is not configured.");
    this.name = "PrivateFileConfigurationError";
  }
}

export interface ValidatedPrivateUpload {
  kind: PrivateFileKind;
  fileName: string;
  contentType: string;
  size: number;
  body: ArrayBuffer;
}

export interface PrivateFileClaims {
  version: 1;
  ownerId: string;
  pathname: string;
  kind: PrivateFileKind;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
}

function isFileKind(value: unknown): value is PrivateFileKind {
  return value === "meal-photo" || value === "report";
}

function tokenSecret(): Buffer {
  const dedicated = process.env.FILE_TOKEN_SECRET?.trim();
  const value =
    dedicated ||
    (process.env.NODE_ENV !== "production"
      ? process.env.AUTH_SECRET?.trim()
      : undefined);
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new PrivateFileConfigurationError();
  }
  return Buffer.from(value, "utf8");
}

/** Non-reversible lookup key for the durable ownership registry. */
export function privateFileIdHash(fileId: string): string {
  return createHash("sha256").update(fileId).digest("hex");
}

function derivedKey(purpose: "encryption" | "signature"): Buffer {
  return createHmac("sha256", tokenSecret())
    .update(`bharosa-private-files:${FILE_ID_VERSION}:${purpose}`)
    .digest();
}

function sign(value: string): Buffer {
  return createHmac("sha256", derivedKey("signature")).update(value).digest();
}

function safeBase64url(value: string): Buffer | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

function safeFileName(rawName: string, extension: string): string {
  const leaf = rawName.normalize("NFKC").split(/[\\/]/).pop() || "upload";
  const stem = leaf
    .replace(/\.[^.]*$/, "")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_")
    .trim()
    .slice(0, MAX_FILE_NAME_LENGTH - extension.length - 1);
  return `${stem || "upload"}.${extension}`;
}

function hasMagicBytes(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP"
    );
  }
  if (contentType === "application/pdf") {
    return (
      bytes.length >= 5 &&
      new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-"
    );
  }
  return false;
}

export async function authenticatedFileSession(): Promise<SessionUser | null> {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

export async function validatePrivateUpload(
  request: Request,
): Promise<ValidatedPrivateUpload> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;")) {
    throw new PrivateFileRequestError(400, "Invalid upload.");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    throw new PrivateFileRequestError(413, "File is too large.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new PrivateFileRequestError(400, "Invalid upload.");
  }

  let hasUnexpectedField = false;
  form.forEach((_value, key) => {
    if (key !== "file" && key !== "kind") hasUnexpectedField = true;
  });
  if (
    form.getAll("file").length !== 1 ||
    form.getAll("kind").length !== 1 ||
    hasUnexpectedField
  ) {
    throw new PrivateFileRequestError(400, "Invalid upload.");
  }

  const kind = form.get("kind");
  const candidate = form.get("file");
  if (!isFileKind(kind) || !candidate || typeof candidate === "string") {
    throw new PrivateFileRequestError(400, "Invalid upload.");
  }

  const policy = FILE_POLICIES[kind];
  const normalizedType = candidate.type.toLowerCase().split(";", 1)[0].trim();
  const extension = policy.mimeTypes[normalizedType];
  if (!extension) {
    throw new PrivateFileRequestError(415, "Unsupported file type.");
  }
  if (candidate.size < 1 || candidate.size > policy.maxBytes) {
    throw new PrivateFileRequestError(413, "File is too large.");
  }

  const body = await candidate.arrayBuffer();
  if (
    body.byteLength !== candidate.size ||
    !hasMagicBytes(normalizedType, new Uint8Array(body))
  ) {
    throw new PrivateFileRequestError(415, "Unsupported file type.");
  }

  return {
    kind,
    fileName: safeFileName(candidate.name, extension),
    contentType: normalizedType,
    size: candidate.size,
    body,
  };
}

export function createPrivatePathname(kind: PrivateFileKind): string {
  return `${FILE_PATH_PREFIX}/${kind}/${randomBytes(32).toString("base64url")}`;
}

function claimsAreValid(value: unknown): value is PrivateFileClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Partial<PrivateFileClaims>;
  if (
    claims.version !== 1 ||
    typeof claims.ownerId !== "string" ||
    claims.ownerId.length < 1 ||
    claims.ownerId.length > 128 ||
    !isFileKind(claims.kind) ||
    typeof claims.pathname !== "string" ||
    typeof claims.fileName !== "string" ||
    claims.fileName.length < 1 ||
    claims.fileName.length > MAX_FILE_NAME_LENGTH ||
    typeof claims.contentType !== "string" ||
    typeof claims.size !== "number" ||
    !Number.isSafeInteger(claims.size) ||
    typeof claims.createdAt !== "string" ||
    !Number.isFinite(Date.parse(claims.createdAt))
  ) {
    return false;
  }

  const policy = FILE_POLICIES[claims.kind];
  const escapedKind = claims.kind.replace("-", "\\-");
  const pathnamePattern = new RegExp(
    `^${FILE_PATH_PREFIX}/${escapedKind}/[A-Za-z0-9_-]{43}$`,
  );
  return (
    pathnamePattern.test(claims.pathname) &&
    Boolean(policy.mimeTypes[claims.contentType]) &&
    claims.size >= 1 &&
    claims.size <= policy.maxBytes &&
    !/[\u0000-\u001f\u007f\\/]/.test(claims.fileName)
  );
}

/**
 * Encrypt-then-MAC keeps the ID opaque while the HMAC binds every claim.
 * Callers receive neither a Blob URL nor its internal pathname.
 */
export function createPrivateFileId(claims: PrivateFileClaims): string {
  if (!claimsAreValid(claims)) throw new Error("Invalid private file claims.");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey("encryption"), iv);
  cipher.setAAD(Buffer.from(FILE_ID_VERSION, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const unsigned = [
    FILE_ID_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
  return `${unsigned}.${sign(unsigned).toString("base64url")}`;
}

export function readPrivateFileId(fileId: string): PrivateFileClaims | null {
  if (!fileId || fileId.length > MAX_FILE_ID_LENGTH) return null;
  const parts = fileId.split(".");
  if (parts.length !== 5 || parts[0] !== FILE_ID_VERSION) return null;

  const iv = safeBase64url(parts[1]);
  const ciphertext = safeBase64url(parts[2]);
  const tag = safeBase64url(parts[3]);
  const suppliedSignature = safeBase64url(parts[4]);
  if (
    !iv ||
    iv.length !== 12 ||
    !ciphertext ||
    ciphertext.length < 1 ||
    !tag ||
    tag.length !== 16 ||
    !suppliedSignature ||
    suppliedSignature.length !== 32
  ) {
    return null;
  }

  const unsigned = parts.slice(0, 4).join(".");
  const expectedSignature = sign(unsigned);
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      derivedKey("encryption"),
      iv,
    );
    decipher.setAAD(Buffer.from(FILE_ID_VERSION, "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const claims: unknown = JSON.parse(plaintext);
    return claimsAreValid(claims) ? claims : null;
  } catch {
    return null;
  }
}

export function canAccessPrivateFile(
  user: SessionUser,
  claims: PrivateFileClaims,
): boolean {
  // The current coach role can already read and edit every member document.
  // A member remains strictly scoped to the owner embedded in the signed ID.
  return user.role === "coach" || user.sub === claims.ownerId;
}

export function privateFileContentDisposition(
  claims: PrivateFileClaims,
): string {
  const mode = claims.kind === "meal-photo" ? "inline" : "attachment";
  const ascii = claims.fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(claims.fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
