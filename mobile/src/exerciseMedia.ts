/**
 * Resolving an exercise to its five-frame sequence.
 *
 * Eight movements are photographed. The library in `lib/exercise-library.ts`
 * is larger than that on purpose — the plan generator needs somewhere to
 * progress to — so most entries have no photography yet.
 *
 * A missing sequence returns null rather than a stand-in photograph of a
 * different movement. Showing a chair squat above the words "glute bridge"
 * would be worse than showing nothing: a member following the picture would do
 * the wrong exercise. The screen falls back to the written frame labels, which
 * are the actual instructions.
 *
 * `docs/EXERCISE-MEDIA-BRIEF.md` is the shot list for the outstanding ones.
 * When a sequence arrives, drop the file in `assets/` and add one line here.
 */

export const EXERCISE_MEDIA = {
  chairSquat: require("../assets/exercise-chair-squat-sequence-v1.png"),
  wallPushup: require("../assets/exercise-wall-pushup-sequence-v1.png"),
  supportedBalance: require("../assets/exercise-supported-balance-sequence-v1.png"),
  calfRaise: require("../assets/exercise-calf-raise-sequence-v1.png"),
  seatedRotation: require("../assets/exercise-seated-rotation-sequence-v1.png"),
  hipHinge: require("../assets/exercise-hip-hinge-sequence-v1.png"),
  supportedMarch: require("../assets/exercise-supported-march-sequence-v1.png"),
  wallSlide: require("../assets/exercise-wall-slide-sequence-v1.png"),
} as const;

export type ExerciseMediaKey = keyof typeof EXERCISE_MEDIA;

/**
 * Names that map to a photographed sequence.
 *
 * Matching is on the exercise name rather than an id because actions published
 * by a coach carry a name and not a library id. Anything unmatched returns
 * null — deliberately, rather than defaulting to the chair squat as this
 * previously did.
 */
const NAME_MATCHES: [RegExp, ExerciseMediaKey][] = [
  [/wall\s*push/i, "wallPushup"],
  [/wall\s*slide|shoulder\s*slide/i, "wallSlide"],
  [/chair\s*squat/i, "chairSquat"],
  [/single-?leg\s*balance|supported\s*balance/i, "supportedBalance"],
  [/calf\s*raise|heel\s*raise/i, "calfRaise"],
  [/thoracic\s*rotation|seated\s*rotation/i, "seatedRotation"],
  [/hip\s*hinge/i, "hipHinge"],
  [/standing\s*march|supported\s*march/i, "supportedMarch"],
];

export function exerciseMediaFor(name: string) {
  for (const [pattern, key] of NAME_MATCHES) {
    if (pattern.test(name)) return EXERCISE_MEDIA[key];
  }
  return null;
}

/** True when this movement is still waiting on photography. */
export function hasExerciseMedia(name: string): boolean {
  return exerciseMediaFor(name) !== null;
}
