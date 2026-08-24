/**
 * The key that encrypts the offline copy of a member's record.
 *
 * The cache on the device holds symptoms, check-ins, meals, messages and
 * report metadata. App-private storage keeps other *apps* out, which is real
 * protection, but it is not encryption: a lost, rooted, backed-up or
 * forensically imaged phone gives up that file as readable JSON. OWASP MASVS
 * treats storage of sensitive data at rest as a baseline control, and health
 * data is squarely that.
 *
 * So the cache is encrypted with a key that exists only in the platform
 * keystore — Keychain on iOS, the Android Keystore-backed store — generated
 * once per install and never written anywhere else. Copying the app's data
 * directory off the device therefore yields ciphertext, and the key does not
 * come with it.
 *
 * Two deliberate limits, because it is worth being honest about what this does
 * and does not achieve:
 *
 * - It protects data **at rest**. It does nothing against malware running as
 *   this app on an unlocked device, which can simply ask for the key.
 * - `expo-secure-store` is required lazily, exactly like the storage and
 *   network modules, because a build made before this dependency existed would
 *   otherwise throw during import and red-screen the whole app. Without it
 *   there is no key, and the caller declines to cache rather than writing
 *   plaintext — a missing dependency must degrade to "no offline mode", never
 *   to "offline mode without the encryption".
 */

const KEY_NAME = "bharosa_cache_key_v1";

interface SecureStoreModule {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: unknown;
}

let resolvedSecureStore = false;
let secureStore: SecureStoreModule | null = null;

function keystore(): SecureStoreModule | null {
  if (resolvedSecureStore) return secureStore;
  resolvedSecureStore = true;
  try {
    const mod = require("expo-secure-store");
    const candidate = (mod?.default ?? mod) as SecureStoreModule | undefined;
    secureStore =
      typeof candidate?.getItemAsync === "function" ? candidate : null;
  } catch {
    secureStore = null;
  }
  return secureStore;
}

interface CryptoModule {
  AES: {
    encrypt: (message: string, key: string) => { toString: () => string };
    decrypt: (
      ciphertext: string,
      key: string,
    ) => { toString: (encoder: unknown) => string };
  };
  enc: { Utf8: unknown };
}

/**
 * 32 random bytes as hex, from the platform's cryptographic RNG only.
 *
 * Deliberately not `crypto-js`'s own `WordArray.random`. That helper looks
 * like a secure source and mostly is one in a browser, but when it cannot
 * find `crypto.getRandomValues` it silently falls back to `Math.random` — and
 * React Native does not universally provide one. A key from `Math.random` is
 * guessable, and an encryption scheme with a guessable key is worse than no
 * encryption, because it invites us to describe the data as encrypted.
 *
 * So this returns null rather than a weak key, and every caller treats null as
 * "do not cache". If a build genuinely lacks a secure RNG the app loses
 * offline mode, which is visible and fixable, instead of quietly protecting
 * health records with a number generated from the clock.
 */
function randomKey(): string | null {
  const webCrypto = (
    globalThis as {
      crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (typeof webCrypto?.getRandomValues !== "function") return null;
  try {
    const bytes = webCrypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

let resolvedCrypto = false;
let cryptoLib: CryptoModule | null = null;

function crypto(): CryptoModule | null {
  if (resolvedCrypto) return cryptoLib;
  resolvedCrypto = true;
  try {
    const mod = require("crypto-js");
    const candidate = (mod?.default ?? mod) as CryptoModule | undefined;
    cryptoLib =
      typeof candidate?.AES?.encrypt === "function" ? candidate : null;
  } catch {
    cryptoLib = null;
  }
  return cryptoLib;
}

/** In-memory, so a session does not hit the keystore on every write. */
let cached: string | null = null;

/**
 * The device's cache key, creating one on first use.
 *
 * Returns null when the platform keystore is unavailable, which the caller
 * must treat as "do not cache" rather than "cache in the clear".
 */
export async function cacheKey(): Promise<string | null> {
  if (cached) return cached;
  const store = keystore();
  const lib = crypto();
  if (!store || !lib) return null;

  try {
    const existing = await store.getItemAsync(KEY_NAME);
    if (existing) {
      cached = existing;
      return cached;
    }
    const created = randomKey();
    if (!created) {
      console.warn(
        "[bharosa] No cryptographic random source in this build; the offline cache is disabled rather than encrypted with a weak key.",
      );
      return null;
    }
    await store.setItemAsync(KEY_NAME, created, {
      // Never leaves this device, and is not needed while the phone is locked
      // — the app only reads its cache in the foreground.
      keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    cached = created;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Forget the key, making every existing cached blob permanently unreadable.
 *
 * This is what makes sign-out and account deletion a real erasure rather than
 * a file removal that a later forensic tool could undo: the ciphertext may
 * linger in a backup, but nothing can decrypt it again.
 */
export async function destroyCacheKey(): Promise<void> {
  cached = null;
  const store = keystore();
  if (!store) return;
  try {
    await store.deleteItemAsync(KEY_NAME);
  } catch {
    // Nothing useful to do. The cached payloads are removed separately.
  }
}

/** Encrypt for storage. Returns null when encryption is not possible. */
export async function seal(plaintext: string): Promise<string | null> {
  const key = await cacheKey();
  const lib = crypto();
  if (!key || !lib) return null;
  try {
    return lib.AES.encrypt(plaintext, key).toString();
  } catch {
    return null;
  }
}

/** Decrypt from storage. Returns null for anything unreadable. */
export async function unseal(ciphertext: string): Promise<string | null> {
  const key = await cacheKey();
  const lib = crypto();
  if (!key || !lib) return null;
  try {
    const plaintext = lib.AES.decrypt(ciphertext, key).toString(lib.enc.Utf8);
    return plaintext || null;
  } catch {
    // Wrong key (reinstall), truncated write, or a plaintext cache written by
    // a build from before this existed. All mean the same thing: unusable.
    return null;
  }
}
