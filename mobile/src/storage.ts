/**
 * Working without a connection.
 *
 * Members log a meal on a train, tick an action in a lift, record a pulse in a
 * building with one bar. Before this existed, any of those moments produced
 * "Not saved. Please try again." and the entry was gone — which is exactly the
 * kind of small punishment that makes someone stop opening an app.
 *
 * So: the last known document is cached on the device, and a save that cannot
 * reach the server is kept and retried instead of discarded.
 *
 * The queue deliberately holds only the most recent document rather than a log
 * of individual edits. Saves are whole-document and the server merges
 * field-scoped (`mergeMemberUpdate` in `app/api/state/route.ts`), so the newest
 * copy already contains every earlier change, and replaying an older one could
 * undo a newer edit.
 *
 * Cached health data is a copy of the member's own record, kept on her own
 * device and cleared on sign-out.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MemberDoc } from "./types";

const DOC_KEY = "bharosa_cached_doc";
const PENDING_KEY = "bharosa_pending_doc";

export interface CachedDoc {
  doc: MemberDoc;
  /** When this copy was last confirmed by the server. */
  savedAt: string;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A corrupt or unreadable cache is not worth an error in the member's
    // face. Treat it as absent; the next successful load replaces it.
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Out of space or storage unavailable. The app still works online.
  }
}

export async function readCachedDoc(): Promise<CachedDoc | null> {
  return readJson<CachedDoc>(DOC_KEY);
}

export async function writeCachedDoc(doc: MemberDoc): Promise<void> {
  await writeJson(DOC_KEY, { doc, savedAt: new Date().toISOString() });
}

/** A document that still has to reach the server. */
export async function readPendingDoc(): Promise<MemberDoc | null> {
  const pending = await readJson<{ doc: MemberDoc }>(PENDING_KEY);
  return pending?.doc ?? null;
}

export async function writePendingDoc(doc: MemberDoc): Promise<void> {
  await writeJson(PENDING_KEY, { doc, queuedAt: new Date().toISOString() });
}

export async function clearPendingDoc(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing useful to do; a duplicate replay is harmless because the server
    // merge is idempotent for the fields a member can write.
  }
}

/** Sign-out removes the member's health data from the device. */
export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([DOC_KEY, PENDING_KEY]);
  } catch {
    // Best effort. The token is gone either way, so the data is unreachable.
  }
}
