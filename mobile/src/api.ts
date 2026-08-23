import * as SecureStore from "expo-secure-store";
import type { CircleState, MemberDoc } from "./types";
import { createDemoMember } from "./demo";
import { normalizeMemberDoc } from "./normalize";

const TOKEN_KEY = "bharosa_wellness_session";
export const DEMO_TOKEN = "bharosa-local-demo";
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function endpoint(path: string) {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  return `${API_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      body.error || "Something went wrong. Please try again.",
      response.status,
    );
  return body;
}

export async function restoreToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function login(username: string, password: string) {
  const response = await fetch(endpoint("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, client: "mobile" }),
  });
  const body = await parse(response);
  if (!body.token)
    throw new Error("The server did not issue a mobile session.");
  await SecureStore.setItemAsync(TOKEN_KEY, body.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return body.token as string;
}

export async function signup(input: {
  name: string;
  email: string;
  username: string;
  password: string;
  code?: string;
}) {
  const response = await fetch(endpoint("/api/auth/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, client: "mobile" }),
  });
  const body = await parse(response);
  if (!body.token)
    throw new Error("The server did not issue a mobile session.");
  await SecureStore.setItemAsync(TOKEN_KEY, body.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return body.token as string;
}

export interface UploadAsset {
  uri: string;
  name?: string | null;
  type?: string | null;
}

export interface PrivateMemberFile {
  id: string;
  kind: "meal-photo" | "report";
  fileName: string;
  contentType: string;
  size: number;
}

function uploadContentType(
  asset: UploadAsset,
  kind: PrivateMemberFile["kind"],
): string {
  const allowed =
    kind === "meal-photo"
      ? new Set(["image/jpeg", "image/png", "image/webp"])
      : new Set(["application/pdf", "image/jpeg", "image/png"]);
  const declared = asset.type?.toLowerCase().split(";", 1)[0]?.trim();
  if (declared && allowed.has(declared)) return declared;

  const candidates = [asset.name ?? "", asset.uri].map((value) =>
    (value.split(/[?#]/, 1)[0] ?? "").toLowerCase(),
  );
  const hasExtension = (pattern: RegExp) =>
    candidates.some((value) => pattern.test(value));
  const inferred = hasExtension(/\.pdf$/)
    ? "application/pdf"
    : hasExtension(/\.png$/)
      ? "image/png"
      : hasExtension(/\.webp$/)
        ? "image/webp"
        : hasExtension(/\.jpe?g$/)
          ? "image/jpeg"
          : null;
  if (inferred && allowed.has(inferred)) return inferred;
  throw new Error(
    kind === "report"
      ? "Choose a PDF, JPEG or PNG file whose type can be identified."
      : "Choose a JPEG, PNG or WebP photo whose type can be identified.",
  );
}

export async function uploadMemberFile(
  token: string,
  asset: UploadAsset,
  kind: PrivateMemberFile["kind"],
): Promise<PrivateMemberFile | null> {
  if (token === DEMO_TOKEN) return null;
  const contentType = uploadContentType(asset, kind);
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", {
    uri: asset.uri,
    name:
      asset.name ??
      (kind === "meal-photo"
        ? `meal-${Date.now()}.jpg`
        : `report-${Date.now()}`),
    type: contentType,
  } as unknown as Blob);
  const response = await fetch(endpoint("/api/files"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await parse(response);
  if (!body.file?.id) throw new Error("The server did not save this file.");
  return body.file as PrivateMemberFile;
}

export function privateMemberFileSource(token: string, fileId: string) {
  return {
    uri: endpoint(`/api/files/${encodeURIComponent(fileId)}`),
    headers: { Authorization: `Bearer ${token}` },
  };
}

export async function requestPasswordHelp(username: string) {
  const response = await fetch(endpoint("/api/auth/password-help"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return parse(response) as Promise<{ message: string }>;
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function loadMember(token: string): Promise<MemberDoc> {
  if (token === DEMO_TOKEN) return createDemoMember();
  const response = await fetch(endpoint("/api/state"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parse(response);
  if (!body.configured) {
    throw new Error("The production database is not configured yet.");
  }
  if (!body.doc?.member)
    throw new Error("Your member profile is not ready yet.");
  return normalizeMemberDoc(body.doc as MemberDoc);
}

export async function saveMember(token: string, doc: MemberDoc) {
  if (token === DEMO_TOKEN) return;
  const response = await fetch(endpoint("/api/state"), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ doc }),
  });
  await parse(response);
}

export async function generateRecommendation(token: string) {
  if (token === DEMO_TOKEN) return null;
  const response = await fetch(endpoint("/api/recommendations/generate"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(response) as Promise<{
    recommendation: MemberDoc["recommendations"][number];
  }>;
}

/**
 * Everything stored about the signed-in member, as one JSON document.
 *
 * The Privacy card promises an export "at any time"; this is what makes that
 * true without a member having to ask a person and wait.
 */
export async function exportAccount(token: string) {
  if (token === DEMO_TOKEN)
    throw new Error("The demo account has nothing to export.");
  const response = await fetch(endpoint("/api/account/export"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(response) as Promise<Record<string, unknown>>;
}

/**
 * Delete the account and everything stored under it.
 *
 * The password is asked for again at the point of deletion: a signed session
 * proves the phone was unlocked, not that its owner meant to erase her
 * history. The stored token is removed whatever the server says, because a
 * session for a deleted account is worth nothing.
 */
export async function deleteAccount(token: string, password: string) {
  if (token === DEMO_TOKEN)
    throw new Error("The demo account is not stored and cannot be deleted.");
  const response = await fetch(endpoint("/api/account"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password, confirm: "DELETE" }),
  });
  const body = await parse(response);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  return body as { deleted: boolean; credentialRemoved: boolean; message: string };
}

/* ------------------------------------------------------------------ */
/* Circle                                                              */
/* ------------------------------------------------------------------ */

/**
 * Her circle, and what her connections have done today.
 *
 * The server sends a projection built field by field — completion counts,
 * days shown up, optionally steps. No part of anyone's member document
 * crosses this boundary.
 */
export async function loadCircle(token: string): Promise<CircleState | null> {
  if (token === DEMO_TOKEN) return null;
  const response = await fetch(endpoint("/api/circle"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(response) as Promise<CircleState>;
}

export async function saveCircleSettings(
  token: string,
  settings: Partial<CircleState["profile"]>,
) {
  if (token === DEMO_TOKEN) return null;
  const response = await fetch(endpoint("/api/circle"), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });
  return parse(response) as Promise<{ profile: CircleState["profile"] }>;
}

/** Members in the same city who chose to be findable. City is the limit. */
export async function discoverCircle(token: string) {
  if (token === DEMO_TOKEN) return { city: null, members: [] };
  const response = await fetch(endpoint("/api/circle/discover"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(response) as Promise<{
    city: string | null;
    members: { memberId: string; displayName: string; city?: string }[];
    message?: string;
  }>;
}

export async function requestConnection(token: string, memberId: string) {
  const response = await fetch(endpoint("/api/circle/requests"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memberId }),
  });
  return parse(response) as Promise<{ message: string }>;
}

export async function answerConnection(
  token: string,
  memberId: string,
  decision: "accepted" | "declined" | "blocked",
) {
  const response = await fetch(endpoint("/api/circle/requests"), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memberId, decision }),
  });
  return parse(response);
}

export async function removeConnection(token: string, memberId: string) {
  const response = await fetch(endpoint("/api/circle/requests"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memberId }),
  });
  return parse(response);
}

/**
 * Read an uploaded meal photo into an estimate.
 *
 * The photo stays in private storage; the server fetches it with the same
 * ownership checks as the download route and shows it to the model once.
 */
export async function estimateMealPhoto(
  token: string,
  fileId: string,
  description?: string,
) {
  if (token === DEMO_TOKEN) return null;
  const response = await fetch(endpoint("/api/nutrition/estimate"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId, description }),
  });
  return parse(response) as Promise<{
    items: {
      name: string;
      quantity: number;
      unit: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[];
    confident: boolean;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
}

/**
 * Ask the server to build today's plan.
 *
 * Selection and progression happen server-side, from the exercise library and
 * the rules in `lib/adaptation.ts`. The phone asks and re-reads the document;
 * it never decides what she should do.
 *
 * Called once a day. A failure is silent by design — she keeps yesterday's plan,
 * which is a far better outcome than an empty screen.
 */
export async function generatePlan(token: string) {
  if (token === DEMO_TOKEN) return null;
  const response = await fetch(endpoint("/api/plan/generate"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(response) as Promise<{
    generated: number;
    posture: "normal" | "lighter" | "recovery";
    rationale: string;
    movementHeld: { title: string; body: string } | null;
    changes: string[];
  }>;
}

/** Send one of the fixed encouragements to a connected member. */
export async function sendNudge(token: string, memberId: string, kind: string) {
  const response = await fetch(endpoint("/api/circle/nudge"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memberId, kind }),
  });
  return parse(response) as Promise<{ sent: boolean; message: string }>;
}

/** Encouragements sent to her in the last week. */
export async function loadNudges(token: string) {
  if (token === DEMO_TOKEN) return { nudges: [] };
  const response = await fetch(endpoint("/api/circle/nudge"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse(response) as Promise<{
    nudges: { from: string; message: string; at: string }[];
  }>;
}
