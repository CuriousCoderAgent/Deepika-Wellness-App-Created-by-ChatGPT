import * as SecureStore from "expo-secure-store";
import type { MemberDoc } from "./types";

const TOKEN_KEY = "bharosa_wellness_session";
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function endpoint(path: string) {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  return `${API_URL}${path}`;
}

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
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
  if (!body.token) throw new Error("The server did not issue a mobile session.");
  await SecureStore.setItemAsync(TOKEN_KEY, body.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return body.token as string;
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function loadMember(token: string): Promise<MemberDoc> {
  const response = await fetch(endpoint("/api/state"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parse(response);
  if (!body.configured) {
    throw new Error("The production database is not configured yet.");
  }
  if (!body.doc?.member) throw new Error("Your member profile is not ready yet.");
  return body.doc;
}

export async function saveMember(token: string, doc: MemberDoc) {
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
