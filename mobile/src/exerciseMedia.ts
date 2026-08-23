/**
 * Resolving an exercise to its five-frame sequence.
 *
 * All thirty-five movements in the exercise library now have photography.
 * The set is one style, one size and one format: 1200px wide WebP, which took
 * the bundled media from 54MB of PNG to 1.3MB with no visible loss.
 *
 * Two lookups, in order of trustworthiness. An exercise id is exact and is what
 * every generated action carries. A name is the fallback for actions a coach
 * published by hand, and is matched exactly rather than by keyword — an earlier
 * version matched loosely and defaulted to the chair squat, so a member reading
 * "Glute bridge" could be shown a photograph of a squat and do the wrong
 * movement. Anything unmatched returns null and the screen falls back to the
 * written frame labels, which are the real instructions.
 */

export const EXERCISE_MEDIA = {
  sitToStand: require("../assets/exercise-sit-to-stand-sequence-v1.webp"),
  supportedChairSquat: require("../assets/exercise-chair-squat-sequence-v1.webp"),
  bodyweightSquat: require("../assets/exercise-bodyweight-squat-sequence-v1.webp"),
  supportedSplitSquat: require("../assets/exercise-supported-split-squat-sequence-v1.webp"),
  stepUp: require("../assets/exercise-step-up-sequence-v1.webp"),
  standingHipHinge: require("../assets/exercise-hip-hinge-sequence-v1.webp"),
  gluteBridge: require("../assets/exercise-glute-bridge-sequence-v1.webp"),
  singleLegGluteBridge: require("../assets/exercise-single-leg-glute-bridge-sequence-v1.webp"),
  standingGoodMorning: require("../assets/exercise-standing-good-morning-sequence-v1.webp"),
  standingWallPushUp: require("../assets/exercise-wall-pushup-sequence-v1.webp"),
  inclinePushUp: require("../assets/exercise-incline-push-up-sequence-v1.webp"),
  kneePushUp: require("../assets/exercise-knee-push-up-sequence-v1.webp"),
  bandOverheadPress: require("../assets/exercise-band-overhead-press-sequence-v1.webp"),
  seatedBandRow: require("../assets/exercise-seated-band-row-sequence-v1.webp"),
  bentOverRow: require("../assets/exercise-bent-over-row-sequence-v1.webp"),
  standingShoulderWallSlide: require("../assets/exercise-wall-slide-sequence-v1.webp"),
  seatedThoracicRotation: require("../assets/exercise-seated-rotation-sequence-v1.webp"),
  deadBug: require("../assets/exercise-dead-bug-sequence-v1.webp"),
  birdDog: require("../assets/exercise-bird-dog-sequence-v1.webp"),
  sidePlankFromKnees: require("../assets/exercise-side-plank-from-knees-sequence-v1.webp"),
  supportedSingleLegBalance: require("../assets/exercise-supported-balance-sequence-v1.webp"),
  singleLegStand: require("../assets/exercise-single-leg-stand-sequence-v1.webp"),
  supportedStandingMarch: require("../assets/exercise-supported-march-sequence-v1.webp"),
  heelToToeWalk: require("../assets/exercise-heel-to-toe-walk-sequence-v1.webp"),
  supportedCalfRaise: require("../assets/exercise-calf-raise-sequence-v1.webp"),
  ankleRocks: require("../assets/exercise-ankle-rocks-sequence-v1.webp"),
  catCow: require("../assets/exercise-cat-cow-sequence-v1.webp"),
  kneelingHipFlexorStretch: require("../assets/exercise-kneeling-hip-flexor-stretch-sequence-v1.webp"),
  seatedFigureFourStretch: require("../assets/exercise-seated-figure-four-stretch-sequence-v1.webp"),
  supportedHamstringStretch: require("../assets/exercise-supported-hamstring-stretch-sequence-v1.webp"),
  doorwayChestOpener: require("../assets/exercise-doorway-chest-opener-sequence-v1.webp"),
  seatedNeckRelease: require("../assets/exercise-seated-neck-release-sequence-v1.webp"),
  boxBreathing: require("../assets/exercise-box-breathing-sequence-v1.webp"),
  legsUpTheWall: require("../assets/exercise-legs-up-the-wall-sequence-v1.webp"),
  bodyScan: require("../assets/exercise-body-scan-sequence-v1.webp"),
} as const;

export type ExerciseMediaKey = keyof typeof EXERCISE_MEDIA;

/** Exact, and what every generated action carries. */
const BY_ID: Record<string, ExerciseMediaKey> = {
  "ex-sit-to-stand": "sitToStand",
  "ex-chair-squat": "supportedChairSquat",
  "ex-bodyweight-squat": "bodyweightSquat",
  "ex-split-squat": "supportedSplitSquat",
  "ex-step-up": "stepUp",
  "ex-hip-hinge": "standingHipHinge",
  "ex-glute-bridge": "gluteBridge",
  "ex-single-leg-bridge": "singleLegGluteBridge",
  "ex-good-morning": "standingGoodMorning",
  "ex-wall-pushup": "standingWallPushUp",
  "ex-incline-pushup": "inclinePushUp",
  "ex-knee-pushup": "kneePushUp",
  "ex-band-press": "bandOverheadPress",
  "ex-band-row": "seatedBandRow",
  "ex-bent-row": "bentOverRow",
  "ex-wall-slide": "standingShoulderWallSlide",
  "ex-seated-rotation": "seatedThoracicRotation",
  "ex-dead-bug": "deadBug",
  "ex-bird-dog": "birdDog",
  "ex-side-plank-knees": "sidePlankFromKnees",
  "ex-supported-balance": "supportedSingleLegBalance",
  "ex-single-leg-stand": "singleLegStand",
  "ex-supported-march": "supportedStandingMarch",
  "ex-heel-toe-walk": "heelToToeWalk",
  "ex-calf-raise": "supportedCalfRaise",
  "ex-ankle-mobility": "ankleRocks",
  "ex-cat-cow": "catCow",
  "ex-hip-flexor-stretch": "kneelingHipFlexorStretch",
  "ex-figure-four": "seatedFigureFourStretch",
  "ex-hamstring-stretch": "supportedHamstringStretch",
  "ex-chest-doorway": "doorwayChestOpener",
  "ex-neck-release": "seatedNeckRelease",
  "ex-box-breathing": "boxBreathing",
  "ex-legs-up-wall": "legsUpTheWall",
  "ex-body-scan": "bodyScan",
};

/** For coach-authored actions, which carry a name but no library id. */
const BY_NAME: Record<string, ExerciseMediaKey> = {
  "sit to stand": "sitToStand",
  "supported chair squat": "supportedChairSquat",
  "bodyweight squat": "bodyweightSquat",
  "supported split squat": "supportedSplitSquat",
  "step up": "stepUp",
  "standing hip hinge": "standingHipHinge",
  "glute bridge": "gluteBridge",
  "single-leg glute bridge": "singleLegGluteBridge",
  "standing good morning": "standingGoodMorning",
  "standing wall push-up": "standingWallPushUp",
  "incline push-up": "inclinePushUp",
  "knee push-up": "kneePushUp",
  "band overhead press": "bandOverheadPress",
  "seated band row": "seatedBandRow",
  "bent-over row": "bentOverRow",
  "standing shoulder wall-slide": "standingShoulderWallSlide",
  "seated thoracic rotation": "seatedThoracicRotation",
  "dead bug": "deadBug",
  "bird dog": "birdDog",
  "side plank from knees": "sidePlankFromKnees",
  "supported single-leg balance": "supportedSingleLegBalance",
  "single-leg stand": "singleLegStand",
  "supported standing march": "supportedStandingMarch",
  "heel-to-toe walk": "heelToToeWalk",
  "supported calf raise": "supportedCalfRaise",
  "ankle rocks": "ankleRocks",
  "cat cow": "catCow",
  "kneeling hip-flexor stretch": "kneelingHipFlexorStretch",
  "seated figure-four stretch": "seatedFigureFourStretch",
  "supported hamstring stretch": "supportedHamstringStretch",
  "doorway chest opener": "doorwayChestOpener",
  "seated neck release": "seatedNeckRelease",
  "box breathing": "boxBreathing",
  "legs up the wall": "legsUpTheWall",
  "body scan": "bodyScan",
};

/**
 * The sequence for an exercise, or null.
 *
 * Null is a real answer: showing the wrong movement is worse than showing
 * none, because a member follows the picture rather than the words.
 */
export function exerciseMediaFor(
  nameOrId: string | undefined,
  exerciseId?: string,
) {
  const key =
    (exerciseId && BY_ID[exerciseId]) ||
    (nameOrId && BY_ID[nameOrId]) ||
    (nameOrId && BY_NAME[nameOrId.trim().toLowerCase()]);
  return key ? EXERCISE_MEDIA[key] : null;
}

/** True when this movement has photography. */
export function hasExerciseMedia(
  nameOrId: string | undefined,
  exerciseId?: string,
): boolean {
  return exerciseMediaFor(nameOrId, exerciseId) !== null;
}
