/**
 * Vera, on the phone.
 *
 * The mobile app deliberately does not import from `lib/` — that directory is
 * typed for the Next.js server and pulling it into the Expo build drags the
 * whole coach console's types along with it. The app already keeps its own
 * copy of the shared types for the same reason.
 *
 * So the name lives in two places, and a test in `scripts/test.mjs` asserts
 * the two agree. The rules themselves are not duplicated: every safety
 * decision happens on the server in `lib/coach-ai.ts`, because a check the
 * phone performs is a check an old build can skip.
 */

/** Must match `COACH_NAME` in `lib/coach-ai.ts`. Tested. */
export const COACH_NAME = "Vera";

/**
 * Openers, so she never faces an empty box.
 *
 * A blank message field with a cursor in it is the most reliable way to make
 * someone close a chat. These are the questions members actually have in the
 * first fortnight, phrased the way they would ask them.
 */
export const COACH_OPENERS = [
  "Why is today's plan what it is?",
  "I have no energy today. What should I do?",
  "Is it normal to ache the next day?",
  "I missed a few days. Where do I start?",
];
