/**
 * Resolving an exercise to its five-frame sequence.
 *
 * All fifty-five movements in the exercise library have photography. The set
 * is one size and one format throughout: 1200px wide WebP, which keeps the
 * whole library under 2.5MB where the source PNGs were more than 90MB.
 *
 * It is deliberately *not* one style. The original thirty-five were shot with
 * a model in her fifties, which suits the home movements most members are
 * offered; the twenty event and gym movements were shot with a younger model,
 * because a sled push demonstrated by someone who plainly would not be given
 * one teaches the wrong thing. Within any one sequence the model, wardrobe
 * and setting never change, which is the consistency that actually matters.
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

  /* The twenty added with the event and gym movements. Same five-panel
     format and the same 1200px WebP encode as everything above; a different
     model, because the previous set skews older than several of these
     movements suit. */
  inclineMarch: require("../assets/exercise-incline-march-sequence-v1.webp"),
  bodyweightLunge: require("../assets/exercise-bodyweight-lunge-sequence-v1.webp"),
  stepBackBurpee: require("../assets/exercise-step-back-burpee-sequence-v1.webp"),
  nordicHamstringEased: require("../assets/exercise-nordic-hamstring-eased-sequence-v1.webp"),
  sideLyingAbduction: require("../assets/exercise-side-lying-abduction-sequence-v1.webp"),
  sidePlankLift: require("../assets/exercise-side-plank-lift-sequence-v1.webp"),
  splitStanceHold: require("../assets/exercise-split-stance-hold-sequence-v1.webp"),
  seatedHinge: require("../assets/exercise-seated-hinge-sequence-v1.webp"),
  singleLegCalfRaise: require("../assets/exercise-single-leg-calf-raise-sequence-v1.webp"),
  bandLatPulldown: require("../assets/exercise-band-lat-pulldown-sequence-v1.webp"),
  suitcaseCarry: require("../assets/exercise-suitcase-carry-sequence-v1.webp"),
  medicineBallSquatPress: require("../assets/exercise-medicine-ball-squat-press-sequence-v1.webp"),
  wallBall: require("../assets/exercise-wall-ball-sequence-v1.webp"),
  skiErg: require("../assets/exercise-ski-erg-sequence-v1.webp"),
  rowErg: require("../assets/exercise-row-erg-sequence-v1.webp"),
  burpeeBroadJump: require("../assets/exercise-burpee-broad-jump-sequence-v1.webp"),
  farmersCarry: require("../assets/exercise-farmers-carry-sequence-v1.webp"),
  sledPush: require("../assets/exercise-sled-push-sequence-v1.webp"),
  sledPull: require("../assets/exercise-sled-pull-sequence-v1.webp"),
  sandbagLunge: require("../assets/exercise-sandbag-lunge-sequence-v1.webp"),
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
  "ex-incline-march": "inclineMarch",
  "ex-bodyweight-lunge": "bodyweightLunge",
  "ex-step-back-burpee": "stepBackBurpee",
  "ex-side-lying-abduction": "sideLyingAbduction",
  "ex-side-plank-lift": "sidePlankLift",
  "ex-split-stance-hold": "splitStanceHold",
  "ex-suitcase-carry": "suitcaseCarry",
  "ex-medicine-ball-squat-press": "medicineBallSquatPress",
  "ex-wall-ball": "wallBall",
  "ex-ski-erg": "skiErg",
  "ex-row-erg": "rowErg",
  "ex-burpee-broad-jump": "burpeeBroadJump",
  "ex-farmers-carry": "farmersCarry",
  "ex-sled-push": "sledPush",
  "ex-sled-pull": "sledPull",
  "ex-sandbag-lunge": "sandbagLunge",
  "ex-single-leg-calf-raise": "singleLegCalfRaise",
  "ex-nordic-hamstring-eased": "nordicHamstringEased",
  "ex-seated-hinge": "seatedHinge",
  "ex-band-lat-pulldown": "bandLatPulldown",
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
  "incline march": "inclineMarch",
  "bodyweight lunge": "bodyweightLunge",
  "step-back burpee": "stepBackBurpee",
  "side-lying leg raise": "sideLyingAbduction",
  "side plank with lift": "sidePlankLift",
  "split stance hold": "splitStanceHold",
  "suitcase carry": "suitcaseCarry",
  "ball squat and press": "medicineBallSquatPress",
  "wall ball": "wallBall",
  "ski erg": "skiErg",
  "rowing": "rowErg",
  "burpee broad jump": "burpeeBroadJump",
  "farmers carry": "farmersCarry",
  "sled push": "sledPush",
  "sled pull": "sledPull",
  "sandbag lunge": "sandbagLunge",
  "single-leg calf raise": "singleLegCalfRaise",
  "assisted hamstring lower": "nordicHamstringEased",
  "seated hinge": "seatedHinge",
  "band pulldown": "bandLatPulldown",
};


/**
 * Movements whose photography exists but is not shown.
 *
 * Empty, and kept rather than deleted: this module's rule is that showing the
 * wrong movement is worse than showing none, because a member follows the
 * picture rather than the words. When a sequence is delivered whose frames do
 * not match the labels printed beneath them, it belongs here with the defect
 * written down, not in BY_ID.
 *
 * Four sequences sat here on 2026-08-24 — a calf raise with no heel rise, a
 * Nordic with unanchored ankles, a seated hinge with no hinge, and a pulldown
 * whose frames ran out of order. All four were regenerated and now match.
 */
export const WITHHELD_MEDIA: Record<string, string> = {};

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
