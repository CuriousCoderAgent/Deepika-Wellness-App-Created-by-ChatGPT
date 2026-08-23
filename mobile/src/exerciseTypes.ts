/**
 * The exercise-library vocabulary the app needs, without the library itself.
 *
 * Selection happens on the server, so the phone never needs the 35-entry bank
 * or its metadata. It only needs to speak the same language about what a
 * movement loads and what rules one out, so the readiness screen can be shown
 * and its answers sent.
 *
 * These must match `lib/exercise-library.ts`. They are small, stable, and
 * changing one without the other would be caught by the readiness tests.
 */

export type BodyLoad =
  | "knee"
  | "hip"
  | "lower_back"
  | "shoulder"
  | "wrist"
  | "neck"
  | "ankle"
  | "pelvic_floor"
  | "balance";

export type AvoidCondition =
  | "pregnancy"
  | "recent_surgery"
  | "dizziness"
  | "high_blood_pressure"
  | "osteoporosis";
