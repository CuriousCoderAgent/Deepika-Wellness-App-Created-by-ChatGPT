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

import type { MemberDoc } from "./types";

const DOC_KEY = "bharosa_cached_doc";
const PENDING_KEY = "bharosa_pending_doc";

interface KeyValueStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
}

/**
 * AsyncStorage throws while it is being imported when the native module is not
 * in the running binary — a top-level `throw`, not a failed call — so a static
 * import would red-screen the whole app on a build made before this dependency
 * was added. It is required lazily instead, and its absence disables the cache
 * rather than the app.
 *
 * Without it the app behaves exactly as it did before offline support existed:
 * it needs a connection to open, and an unsent change is reported rather than
 * held. That is a real loss, and it is still much better than not starting.
 */
let resolved = false;
let store: KeyValueStore | null = null;

function storage(): KeyValueStore | null {
  if (resolved) return store;
  resolved = true;
  try {
    const mod = require("@react-native-async-storage/async-storage");
    const candidate = (mod?.default ?? mod) as KeyValueStore | undefined;
    store = typeof candidate?.getItem === "function" ? candidate : null;
  } catch {
    store = null;
  }
  if (!store)
    console.warn(
      "[bharosa] AsyncStorage is unavailable in this build; the offline cache is disabled. Rebuild the development client to restore it.",
    );
  return store;
}

/** True when this build can cache anything at all. */
export function offlineCacheIsAvailable(): boolean {
  return storage() !== null;
}

export interface CachedDoc {
  doc: MemberDoc;
  /** When this copy was last confirmed by the server. */
  savedAt: string;
}

async function readJson<T>(key: string): Promise<T | null> {
  const s = storage();
  if (!s) return null;
  try {
    const raw = await s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A corrupt or unreadable cache is not worth an error in the member's
    // face. Treat it as absent; the next successful load replaces it.
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const s = storage();
  if (!s) return;
  try {
    await s.setItem(key, JSON.stringify(value));
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
  const s = storage();
  if (!s) return;
  try {
    await s.removeItem(PENDING_KEY);
  } catch {
    // Nothing useful to do; a duplicate replay is harmless because the server
    // merge is idempotent for the fields a member can write.
  }
}

/** Sign-out removes the member's health data from the device. */
export async function clearCache(): Promise<void> {
  const s = storage();
  if (!s) return;
  try {
    await s.multiRemove([DOC_KEY, PENDING_KEY]);
  } catch {
    // Best effort. The token is gone either way, so the data is unreachable.
  }
}
