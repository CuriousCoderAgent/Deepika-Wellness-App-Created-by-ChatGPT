/**
 * The exercise bank the plan generator selects from.
 *
 * This exists so the software can build a week without inventing movements.
 * A model choosing exercises from a curated, tagged list is a different and
 * far safer thing than a model writing exercise prescriptions from nothing:
 * every entry here has been chosen deliberately, has cues written for a
 * beginner, and carries the tags the generator needs to rule it out.
 *
 * Audience assumptions, which shape every entry: women roughly 38–50,
 * exercising at home in India, with a chair, a wall and possibly a resistance
 * band. Nothing requires a gym, a mat, or lying flat on a hard floor. Nothing
 * assumes prior training.
 *
 * Three tags do real safety work and must be kept accurate:
 *
 * - `loads` — the joints and structures a movement stresses. A member who
 *   reported a bad knee has every `knee` entry removed from her selection.
 *   Getting this wrong is how someone gets hurt, so it is deliberately
 *   generous: if a movement meaningfully loads a joint, tag it.
 * - `avoidIf` — conditions where the movement is a poor idea regardless of
 *   how it feels. Readiness answers set these.
 * - `tier` — 1 supported, 2 unsupported bodyweight, 3 loaded or dynamic.
 *   Progression moves up a tier only through `progressesTo`, never by a model
 *   deciding someone looks ready.
 *
 * Media: `media` names a five-frame sequence. Eight exist; the rest are
 * commissioned and fall back to a labelled placeholder until the photographs
 * land. `docs/EXERCISE-MEDIA-BRIEF.md` is the shot list.
 */

export type MovementPattern =
  | "squat"
  | "hinge"
  | "push"
  | "pull"
  | "core"
  | "balance"
  | "calf"
  | "mobility"
  | "breathing";

/** Structures a movement meaningfully loads. Used to honour a stated caution. */
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

/** Conditions from the readiness screen that rule a movement out. */
export type AvoidCondition =
  | "pregnancy"
  | "recent_surgery"
  | "dizziness"
  | "high_blood_pressure"
  | "osteoporosis";

export interface Exercise {
  id: string;
  name: string;
  pattern: MovementPattern;
  /** 1 supported · 2 unsupported bodyweight · 3 loaded or dynamic. */
  tier: 1 | 2 | 3;
  loads: BodyLoad[];
  avoidIf: AvoidCondition[];
  /** Chair, wall, band — never a gym. */
  equipment: ("none" | "chair" | "wall" | "band" | "weight")[];
  /** Roughly, for one working set including the pause after it. */
  minutes: number;
  /** One sentence, in her language, for why this movement is worth doing. */
  why: string;
  /** Shown under the frames. Written to be read once and remembered. */
  cue: string;
  /** The five frame labels shown beneath the sequence. */
  frames: [string, string, string, string, string];
  /** Harder version, when she is finding this easy. Never skipped past. */
  progressesTo?: string;
  /** Easier version, when effort is high or the day is bad. */
  regressesTo?: string;
  /** Key in the mobile media map. Absent means placeholder for now. */
  media?: string;
}

export const EXERCISES: Exercise[] = [
  /* ---------------------------------------------------------------- */
  /* Squat — sitting down and standing up, which is the whole point    */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-sit-to-stand",
    name: "Sit to stand",
    pattern: "squat",
    tier: 1,
    loads: ["knee", "hip"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "Getting out of a chair without using your hands is the single most useful strength there is.",
    cue: "Nose over toes, push the floor away, stand tall.",
    frames: ["Sit tall", "Lean forward", "Weight into feet", "Stand up", "Sit down slowly"],
    progressesTo: "ex-chair-squat",
  },
  {
    id: "ex-chair-squat",
    name: "Supported chair squat",
    pattern: "squat",
    tier: 1,
    loads: ["knee", "hip"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 3,
    why: "Builds the strength you use every time you sit, stand, or climb stairs.",
    cue: "Keep your knees tracking over your toes and finish tall.",
    frames: ["Stand tall", "Hips back", "Touch chair", "Drive up", "Finish tall"],
    progressesTo: "ex-bodyweight-squat",
    regressesTo: "ex-sit-to-stand",
    media: "chairSquat",
  },
  {
    id: "ex-bodyweight-squat",
    name: "Bodyweight squat",
    pattern: "squat",
    tier: 2,
    loads: ["knee", "hip"],
    avoidIf: [],
    equipment: ["none"],
    minutes: 3,
    why: "The same movement as the chair squat, now under your own control the whole way.",
    cue: "Sit down between your hips. Chest stays proud.",
    frames: ["Stand tall", "Hips back", "Lower down", "Pause", "Drive up"],
    progressesTo: "ex-split-squat",
    regressesTo: "ex-chair-squat",
  },
  {
    id: "ex-split-squat",
    name: "Supported split squat",
    pattern: "squat",
    tier: 3,
    loads: ["knee", "hip", "balance"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 4,
    why: "One leg at a time builds the strength and steadiness stairs actually ask for.",
    cue: "Back knee drops straight down. Hold the chair as much as you need.",
    frames: ["Split stance", "Hold support", "Lower back knee", "Pause", "Drive up"],
    regressesTo: "ex-bodyweight-squat",
  },
  {
    id: "ex-step-up",
    name: "Step up",
    pattern: "squat",
    tier: 3,
    loads: ["knee", "hip", "balance"],
    avoidIf: ["dizziness", "pregnancy"],
    equipment: ["none"],
    minutes: 4,
    why: "Stairs, buses and kerbs stop being something you think about.",
    cue: "Whole foot on the step. Stand up through the front heel.",
    frames: ["Face the step", "Foot on step", "Drive through heel", "Stand tall", "Step down slowly"],
    regressesTo: "ex-bodyweight-squat",
  },

  /* ---------------------------------------------------------------- */
  /* Hinge — the back-saving pattern                                   */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-hip-hinge",
    name: "Standing hip hinge",
    pattern: "hinge",
    tier: 1,
    loads: ["hip", "lower_back"],
    avoidIf: [],
    equipment: ["none"],
    minutes: 3,
    why: "Teaches you to bend from the hips, which is what protects your back all day.",
    cue: "Push your hips back, not down. Your back stays long.",
    frames: ["Stand tall", "Soft knees", "Hips back", "Feel the stretch", "Stand tall"],
    progressesTo: "ex-good-morning",
    media: "hipHinge",
  },
  {
    id: "ex-glute-bridge",
    name: "Glute bridge",
    pattern: "hinge",
    tier: 1,
    loads: ["hip", "lower_back"],
    // Lying flat on the back is the usual thing to stop after the first
    // trimester, which is why every supine movement here carries this.
    avoidIf: ["pregnancy"],
    equipment: ["none"],
    minutes: 3,
    why: "Wakes up the muscles that sitting all day switches off.",
    cue: "Squeeze at the top. Ribs stay down.",
    frames: ["Lie back, knees bent", "Feet planted", "Lift hips", "Squeeze and hold", "Lower slowly"],
    progressesTo: "ex-single-leg-bridge",
  },
  {
    id: "ex-single-leg-bridge",
    name: "Single-leg glute bridge",
    pattern: "hinge",
    tier: 3,
    loads: ["hip", "lower_back"],
    avoidIf: ["pregnancy"],
    equipment: ["none"],
    minutes: 4,
    why: "One side at a time finds and fixes the difference between your two hips.",
    cue: "Keep your hips level. If they tilt, put the other foot down.",
    frames: ["Lie back, knees bent", "Lift one leg", "Drive through heel", "Hips level", "Lower slowly"],
    regressesTo: "ex-glute-bridge",
  },
  {
    id: "ex-good-morning",
    name: "Standing good morning",
    pattern: "hinge",
    tier: 2,
    loads: ["hip", "lower_back"],
    avoidIf: ["osteoporosis"],
    equipment: ["none"],
    minutes: 3,
    why: "Strengthens the whole back of your body in the position daily life keeps asking for.",
    cue: "Hands on hips, chest leads, hips travel back.",
    frames: ["Stand tall", "Hands on hips", "Hinge forward", "Flat back", "Stand tall"],
    regressesTo: "ex-hip-hinge",
  },

  /* ---------------------------------------------------------------- */
  /* Push                                                              */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-wall-pushup",
    name: "Standing wall push-up",
    pattern: "push",
    tier: 1,
    loads: ["shoulder", "wrist"],
    avoidIf: [],
    equipment: ["wall"],
    minutes: 3,
    why: "Upper-body strength you can build without getting on the floor.",
    cue: "Body stays in one long line from head to heels.",
    frames: ["Face the wall", "Hands at chest height", "Lean in", "Elbows back", "Push away"],
    progressesTo: "ex-incline-pushup",
    media: "wallPushup",
  },
  {
    id: "ex-incline-pushup",
    name: "Incline push-up",
    pattern: "push",
    tier: 2,
    loads: ["shoulder", "wrist"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 3,
    why: "The same movement, lower down, so it asks a little more each time.",
    cue: "Lower until your chest meets the surface, then push away.",
    frames: ["Hands on chair", "Body in line", "Lower chest", "Pause", "Push away"],
    progressesTo: "ex-knee-pushup",
    regressesTo: "ex-wall-pushup",
  },
  {
    id: "ex-knee-pushup",
    name: "Knee push-up",
    pattern: "push",
    tier: 3,
    loads: ["shoulder", "wrist"],
    avoidIf: [],
    equipment: ["none"],
    minutes: 3,
    why: "Real upper-body strength, at a level that is honest about where you are.",
    cue: "Hips stay in line with shoulders. Do not let them sag.",
    frames: ["Kneel, hands wide", "Body in line", "Lower chest", "Pause", "Push up"],
    regressesTo: "ex-incline-pushup",
  },
  {
    id: "ex-band-press",
    name: "Band overhead press",
    pattern: "push",
    tier: 2,
    loads: ["shoulder"],
    avoidIf: ["high_blood_pressure"],
    equipment: ["band"],
    minutes: 3,
    why: "Reaching the top shelf without asking anyone.",
    cue: "Press up, not forward. Ribs stay down.",
    frames: ["Band under feet", "Hands at shoulders", "Press up", "Arms straight", "Lower slowly"],
  },

  /* ---------------------------------------------------------------- */
  /* Pull — the pattern home workouts usually skip                     */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-band-row",
    name: "Seated band row",
    pattern: "pull",
    tier: 1,
    loads: ["shoulder"],
    avoidIf: [],
    equipment: ["chair", "band"],
    minutes: 3,
    why: "Pulling strength is what undoes a day spent leaning over a phone.",
    cue: "Lead with your elbows. Squeeze your shoulder blades together.",
    frames: ["Sit tall", "Band around feet", "Pull to ribs", "Squeeze", "Release slowly"],
    progressesTo: "ex-bent-row",
  },
  {
    id: "ex-bent-row",
    name: "Bent-over row",
    pattern: "pull",
    tier: 3,
    loads: ["shoulder", "lower_back"],
    avoidIf: ["osteoporosis"],
    equipment: ["weight"],
    minutes: 4,
    why: "Builds the upper back that holds you upright without effort.",
    cue: "Hinge first, then row. Your back stays flat throughout.",
    frames: ["Hinge forward", "Arms hanging", "Row to ribs", "Squeeze", "Lower slowly"],
    regressesTo: "ex-band-row",
  },
  {
    id: "ex-wall-slide",
    name: "Standing shoulder wall-slide",
    pattern: "pull",
    tier: 1,
    loads: ["shoulder", "neck"],
    avoidIf: [],
    equipment: ["wall"],
    minutes: 2,
    why: "Opens the shoulders and undoes hours of being hunched forward.",
    cue: "Keep your wrists and elbows touching the wall the whole way.",
    frames: ["Back to wall", "Arms at 90°", "Slide up", "Reach tall", "Slide down"],
    media: "wallSlide",
  },

  /* ---------------------------------------------------------------- */
  /* Core — bracing, not crunching                                     */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-seated-rotation",
    name: "Seated thoracic rotation",
    pattern: "core",
    tier: 1,
    loads: ["lower_back", "neck"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "Turning to look behind you should not be something you plan.",
    cue: "Turn from your ribs, not your neck. Hips stay square.",
    frames: ["Sit tall", "Arms crossed", "Turn right", "Return centre", "Turn left"],
    media: "seatedRotation",
  },
  {
    id: "ex-dead-bug",
    name: "Dead bug",
    pattern: "core",
    tier: 2,
    loads: ["lower_back"],
    avoidIf: ["pregnancy"],
    equipment: ["none"],
    minutes: 3,
    why: "Trains your middle to stay steady while your arms and legs move — which is all day, every day.",
    cue: "Lower back stays pressed down. Move slowly.",
    frames: ["Lie back", "Arms and knees up", "Extend opposite pair", "Pause", "Return"],
    progressesTo: "ex-bird-dog",
  },
  {
    id: "ex-bird-dog",
    name: "Bird dog",
    pattern: "core",
    tier: 2,
    loads: ["lower_back", "shoulder", "wrist"],
    avoidIf: [],
    equipment: ["none"],
    minutes: 3,
    why: "Steadies your back in the position it works hardest in.",
    cue: "Reach long, not high. A glass of water on your back should not spill.",
    frames: ["On hands and knees", "Flat back", "Extend opposite pair", "Hold", "Return"],
    regressesTo: "ex-dead-bug",
  },
  {
    id: "ex-side-plank-knees",
    name: "Side plank from knees",
    pattern: "core",
    tier: 3,
    // Heavy bracing through the middle, which is what a stated pelvic-floor
    // concern is usually about.
    loads: ["shoulder", "lower_back", "pelvic_floor"],
    avoidIf: ["pregnancy"],
    equipment: ["none"],
    minutes: 3,
    why: "Strengthens the sides of your middle, which almost nothing else does.",
    cue: "Push the floor away. Hips stay stacked and lifted.",
    frames: ["Lie on side", "Elbow under shoulder", "Lift hips", "Hold", "Lower slowly"],
    regressesTo: "ex-dead-bug",
  },

  /* ---------------------------------------------------------------- */
  /* Balance — the one that matters most later, started early          */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-supported-balance",
    name: "Supported single-leg balance",
    pattern: "balance",
    tier: 1,
    loads: ["balance", "ankle"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "Balance is trainable, and it is what keeps you steady on uneven ground.",
    cue: "Fingertips on the chair. Look at one point ahead of you.",
    frames: ["Stand by chair", "Fingertips down", "Lift one foot", "Hold steady", "Lower down"],
    progressesTo: "ex-single-leg-stand",
    media: "supportedBalance",
  },
  {
    id: "ex-single-leg-stand",
    name: "Single-leg stand",
    pattern: "balance",
    tier: 2,
    loads: ["balance", "ankle"],
    // Balance changes through pregnancy, and a fall matters more.
    avoidIf: ["dizziness", "pregnancy"],
    equipment: ["none"],
    minutes: 2,
    why: "Every step you take is a moment on one leg. This is practice for it.",
    cue: "Chair within reach, but hands off. Wobbling is the training.",
    frames: ["Stand tall", "Shift weight", "Lift one foot", "Hold steady", "Lower down"],
    regressesTo: "ex-supported-balance",
  },
  {
    id: "ex-supported-march",
    name: "Supported standing march",
    pattern: "balance",
    tier: 1,
    loads: ["balance", "hip"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "Warms up your hips and gets your balance working before anything harder.",
    cue: "Lift the knee to hip height. Stand tall the whole time.",
    frames: ["Stand by chair", "Hold support", "Lift one knee", "Lower slowly", "Other side"],
    media: "supportedMarch",
  },
  {
    id: "ex-heel-toe-walk",
    name: "Heel-to-toe walk",
    pattern: "balance",
    tier: 2,
    loads: ["balance", "ankle"],
    avoidIf: ["dizziness", "pregnancy"],
    equipment: ["wall"],
    minutes: 2,
    why: "Narrow, controlled walking is the balance skill uneven pavements ask for.",
    cue: "One foot directly in front of the other. Wall within reach.",
    frames: ["Stand by wall", "Heel to toe", "Step forward", "Steady", "Continue"],
    regressesTo: "ex-supported-balance",
  },

  /* ---------------------------------------------------------------- */
  /* Calf and foot                                                     */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-calf-raise",
    name: "Supported calf raise",
    pattern: "calf",
    tier: 1,
    loads: ["ankle"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "Strong calves are what push you up stairs and keep you steady walking.",
    cue: "Rise slowly, pause at the top, lower even more slowly.",
    frames: ["Stand by chair", "Fingertips down", "Rise onto toes", "Pause", "Lower slowly"],
    media: "calfRaise",
  },
  {
    id: "ex-ankle-mobility",
    name: "Ankle rocks",
    pattern: "mobility",
    tier: 1,
    loads: ["ankle"],
    avoidIf: [],
    equipment: ["wall"],
    minutes: 2,
    why: "Stiff ankles change how you squat, walk and land. This is the fix.",
    cue: "Knee travels forward over the toes. Heel stays down.",
    frames: ["Face the wall", "One foot forward", "Knee to wall", "Heel down", "Return"],
  },

  /* ---------------------------------------------------------------- */
  /* Mobility — short, and specifically for what sitting does to you   */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-cat-cow",
    name: "Cat cow",
    pattern: "mobility",
    tier: 1,
    loads: ["lower_back", "neck", "wrist"],
    avoidIf: [],
    equipment: ["none"],
    minutes: 2,
    why: "The gentlest way to get a stiff back moving again.",
    cue: "Move with your breath. Nothing here should be forced.",
    frames: ["On hands and knees", "Flat back", "Round up", "Pause", "Arch down"],
  },
  {
    id: "ex-hip-flexor-stretch",
    name: "Kneeling hip-flexor stretch",
    pattern: "mobility",
    tier: 1,
    loads: ["hip", "knee"],
    avoidIf: [],
    equipment: ["none"],
    minutes: 2,
    why: "Undoes the front-of-hip tightness that hours of sitting creates.",
    cue: "Tuck your tailbone first, then ease forward. Stand tall throughout.",
    frames: ["Half kneel", "Tuck tailbone", "Ease forward", "Hold", "Release"],
  },
  {
    id: "ex-figure-four",
    name: "Seated figure-four stretch",
    pattern: "mobility",
    tier: 1,
    loads: ["hip", "knee"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "Reaches the deep hip muscles that ache after a long day.",
    cue: "Sit tall first, then lean forward from the hips.",
    frames: ["Sit tall", "Ankle on knee", "Lean forward", "Hold", "Release"],
  },
  {
    id: "ex-hamstring-stretch",
    name: "Supported hamstring stretch",
    pattern: "mobility",
    tier: 1,
    loads: ["hip", "lower_back"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "Loosens the back of the legs, which changes how your back feels.",
    cue: "Back stays long. Lead with your chest, not your head.",
    frames: ["Heel on chair", "Stand tall", "Hinge forward", "Hold", "Return"],
  },
  {
    id: "ex-chest-doorway",
    name: "Doorway chest opener",
    pattern: "mobility",
    tier: 1,
    loads: ["shoulder"],
    avoidIf: [],
    equipment: ["wall"],
    minutes: 2,
    why: "Opens the front of the shoulders that phones and desks close down.",
    cue: "Step through gently. You should feel a stretch, never a pinch.",
    frames: ["Stand in doorway", "Forearms on frame", "Step through", "Hold", "Release"],
  },
  {
    id: "ex-neck-release",
    name: "Seated neck release",
    pattern: "mobility",
    tier: 1,
    loads: ["neck"],
    avoidIf: [],
    equipment: ["chair"],
    minutes: 2,
    why: "For the tension that sits between your neck and shoulders by evening.",
    cue: "Let the weight of your head do the work. Never pull.",
    frames: ["Sit tall", "Drop one shoulder", "Tilt head away", "Hold", "Return centre"],
  },

  /* ---------------------------------------------------------------- */
  /* Breathing and recovery                                            */
  /* ---------------------------------------------------------------- */
  {
    id: "ex-box-breathing",
    name: "Box breathing",
    pattern: "breathing",
    tier: 1,
    loads: [],
    avoidIf: [],
    equipment: ["none"],
    minutes: 3,
    why: "A way to settle your body that works in ninety seconds and needs nothing.",
    cue: "In for four, hold four, out for four, hold four.",
    frames: ["Sit comfortably", "Breathe in 4", "Hold 4", "Breathe out 4", "Hold 4"],
  },
  {
    id: "ex-legs-up-wall",
    name: "Legs up the wall",
    pattern: "breathing",
    tier: 1,
    loads: [],
    avoidIf: ["high_blood_pressure", "pregnancy"],
    equipment: ["wall"],
    minutes: 5,
    why: "Five minutes here does more for tired legs than almost anything else.",
    cue: "Get comfortable and stay. There is nothing to achieve.",
    frames: ["Sit beside wall", "Swing legs up", "Lie back", "Rest and breathe", "Roll to side"],
  },
  {
    id: "ex-body-scan",
    name: "Body scan",
    pattern: "breathing",
    tier: 1,
    loads: [],
    avoidIf: [],
    equipment: ["none"],
    minutes: 5,
    why: "Noticing where you hold tension is the first step to putting it down.",
    cue: "Move your attention slowly from feet to head. Nothing to fix.",
    frames: ["Settle down", "Notice feet", "Move upward", "Notice shoulders", "Rest"],
  },
];

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/**
 * Everything a member could safely be given today.
 *
 * Both filters are exclusions rather than scores. A movement that loads a joint
 * she has told us hurts is removed, not ranked lower — the generator never gets
 * the chance to pick it because it thought the rest of the fit was good.
 */
export function eligibleExercises(input: {
  avoidLoads?: BodyLoad[];
  conditions?: AvoidCondition[];
  equipment?: Exercise["equipment"][number][];
  maxTier?: 1 | 2 | 3;
}): Exercise[] {
  const avoidLoads = new Set(input.avoidLoads ?? []);
  const conditions = new Set(input.conditions ?? []);
  const available = new Set(input.equipment ?? ["none", "chair", "wall"]);
  const maxTier = input.maxTier ?? 3;
  return EXERCISES.filter((exercise) => {
    if (exercise.tier > maxTier) return false;
    if (exercise.loads.some((load) => avoidLoads.has(load))) return false;
    if (exercise.avoidIf.some((condition) => conditions.has(condition)))
      return false;
    return exercise.equipment.every((item) => available.has(item));
  });
}

/** Free-text cautions, mapped to the loads they rule out. */
const CAUTION_PATTERNS: { pattern: RegExp; loads: BodyLoad[] }[] = [
  { pattern: /\bknee|kneecap|patell/i, loads: ["knee"] },
  { pattern: /\bhip\b|groin/i, loads: ["hip"] },
  { pattern: /\bback\b|spine|slip(ped)?\s*disc|sciatic/i, loads: ["lower_back"] },
  { pattern: /\bshoulder|rotator|frozen\s*shoulder/i, loads: ["shoulder"] },
  { pattern: /\bwrist|carpal/i, loads: ["wrist"] },
  { pattern: /\bneck|cervical/i, loads: ["neck"] },
  { pattern: /\bankle|achilles|plantar/i, loads: ["ankle"] },
  { pattern: /\bdizz|vertigo|balance/i, loads: ["balance"] },
  { pattern: /pelvic|prolapse|incontinen/i, loads: ["pelvic_floor"] },
];

/**
 * Read a member's own words into the loads to avoid.
 *
 * This is deliberately blunt and deliberately over-inclusive: it is better to
 * withhold a movement she could have done than to offer one that hurts. It is
 * also never the only safeguard — what she wrote is shown to her coach if she
 * has one, and anything unmatched still reaches a human rather than being
 * silently discarded.
 */
export function loadsToAvoid(caution: string | undefined): BodyLoad[] {
  if (!caution?.trim()) return [];
  const loads = new Set<BodyLoad>();
  for (const { pattern, loads: matched } of CAUTION_PATTERNS) {
    if (pattern.test(caution)) matched.forEach((load) => loads.add(load));
  }
  return [...loads];
}

/** True when she wrote something we could not interpret. Needs a human. */
export function cautionNeedsReview(caution: string | undefined): boolean {
  return Boolean(caution?.trim()) && loadsToAvoid(caution).length === 0;
}
