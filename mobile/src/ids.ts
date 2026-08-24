/**
 * Identifiers for things the member creates.
 *
 * These were `\`food-${Date.now()}\`` and similar — unique only if no two
 * records are ever created in the same millisecond, on any device, ever. That
 * was survivable while the server replaced whole arrays. It is not now: the
 * merge in `app/api/state` unions these logs *by id* so two phones cannot
 * erase each other's entries, which means two records sharing an id are
 * treated as one record and one of them is silently discarded.
 *
 * Two devices are the realistic case. `Date.now()` is wall-clock time, so two
 * phones logging a meal in the same millisecond is not a fanciful collision —
 * it is the exact scenario the union exists to handle, arriving in a form the
 * union cannot see.
 *
 * ## Why not crypto.randomUUID()
 *
 * It is not reliably present in React Native, and this module must not throw
 * or degrade in a build that lacks it. So: the platform RNG where available,
 * a clearly-marked fallback where not.
 *
 * Unlike the cache key in `./cache-key`, a fallback is acceptable here. An id
 * needs to be *unique*, not unguessable — nothing is protected by not being
 * able to predict it, and these ids are only ever meaningful inside one
 * member's own document.
 */

/** 16 random bytes as hex, from the platform RNG when it exists. */
function randomHex(bytes: number): string | null {
  const webCrypto = (
    globalThis as {
      crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (typeof webCrypto?.getRandomValues !== "function") return null;
  try {
    return Array.from(webCrypto.getRandomValues(new Uint8Array(bytes)))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/**
 * A unique id for a new record, prefixed so it is readable in a log.
 *
 * The prefix is for humans; uniqueness comes entirely from what follows it.
 * Collision resistance without a platform RNG comes from combining the clock
 * with 64 bits of Math.random — far weaker than a real UUID, and still
 * astronomically better than the millisecond alone.
 */
export function newId(prefix: string): string {
  const random = randomHex(16);
  if (random) return `${prefix}-${random}`;

  // No platform RNG. Timestamp plus two independent random components, which
  // makes a same-millisecond collision between two devices vanishingly
  // unlikely rather than certain.
  const fallback =
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${fallback}`;
}
