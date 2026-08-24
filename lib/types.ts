/**
 * Domain model for Deepika Wellness V0.
 * Mirrors §13 of the V0 Product Architecture (data model + dual-entry).
 *
 * The rule that shapes everything here: every observed value carries its own
 * provenance. Coach-entered data must never be able to masquerade as
 * member-entered data, at the type level as well as in the UI.
 */

export type EffortLevel = "minimum" | "target" | "stretch";
export type ActionDomain =
  | "movement"
  | "walking"
  | "nutrition"
  | "recovery"
  | "mindset";

export type SourceType =
  | "member_manual"
  | "coach_on_behalf"
  | "wearable"
  | "imported_document"
  | "system_derived";

export type ModuleCategory =
  | "movement"
  | "nutrition"
  | "sleep"
  | "hormonal"
  | "behaviour";

export type RadarBucket = "attention" | "prepare" | "celebrate" | "admin";

export type EngagementState = "strong" | "steady" | "slipping" | "quiet";

/** Every value the system stores about a member carries this envelope. */
export interface Provenance {
  source: SourceType;
  enteredBy: string; // display name — "Radhika", "Deepika", "Apple Health"
  at: string; // ISO date
}

export interface EffortSpec {
  label: string;
  minutes: number;
}

export interface Member {
  id: string;
  name: string;
  age: number;
  city: string;
  initials: string;
  /** Weeks since program start. */
  week: number;
  phase: "Stabilise" | "Build" | "Consolidate";
  lifeStage: string;
  goals: string[];
  constraints: string[];
  /** M05 "what I will not do" — a personalisation input, not decoration. */
  wontDo: string;
  medical: string[];
  medications: string[];
  engagement: EngagementState;
  weeklyFocus: string[];
  activeModuleIds: string[];
  /** Set when the coach republishes a plan; surfaced to the member as a reason. */
  lastPlanChange?: { at: string; rationale: string };
  bodyComp?: {
    label: string;
    value: string;
    at: string;
    provenance: Provenance;
  }[];
  assessmentComplete: number; // 0–100
  /**
   * Asked at the start of onboarding, and used for one thing only: which
   * "where you are right now" question makes sense to ask. The practice is
   * built around women in midlife, but nothing here is restricted to them,
   * and a required screen full of menstrual-cycle options is not answerable
   * by everyone who can usefully be coached. Absent on the seeded cohort and
   * on anyone who onboarded before it existed.
   */
  gender?: "woman" | "man" | "other";
  /**
   * Set when she finishes the first-run flow.
   *
   * What actually routes /onboarding vs Today is `onboarding.completed` on
   * the mobile document, not this field — this one exists so
   * `lib/day-offset.ts`'s `programWeek()` has a real date to count her 12
   * weeks from. It was declared here but never written by anything, which is
   * its own bug: every member's program week silently froze at 1 forever.
   * Absent means either she has never onboarded, or she did before this was
   * wired up — `programWeek()` treats both the same way, by leaving her
   * stored week untouched rather than guessing.
   */
  onboardedAt?: string;
  /**
   * What she agreed to, and when. `health` is required to use the product at
   * all; `reports` is separate and genuinely optional, because uploading blood
   * work is a different decision from logging how you slept.
   */
  consent?: { health: boolean; reports: boolean; at: string };
  /** When she'd rather hear from the app. Shapes notification timing later. */
  checkInPreference?: "morning" | "evening";
  /**
   * Daily protein target in grams, set by Deepika for this member.
   *
   * Deliberately a number she types, not one the app calculates from body
   * weight. Deciding what an individual should eat is a coach's professional
   * judgement about her own client; software generating that target on its
   * own would be the product prescribing, which is a different thing
   * entirely. Absent means she has not set one, and the app just counts.
   */
  proteinTargetG?: number;
  /** Dated, appendable coach log. Private — never surfaced to the member. */
  notes?: CoachNote[];
  /** The published 12-week plan. Falls back to a synthesis of live state — see lib/plan.ts. */
  weekPlans?: WeekPlan[];
  /** Pending edits not yet assigned to the member. Mirrors weekPlans until touched. */
  draftWeekPlans?: WeekPlan[];
}

export interface CoachNote {
  id: string;
  at: string; // ISO date
  text: string;
}

export interface WeekPlan {
  week: number; // 1–12
  phase: "Stabilise" | "Build" | "Consolidate";
  focus: string[];
  moduleIds: string[];
  /** Plain-language reason shown when a published week differs from the outline. */
  rationale?: string;
}

export interface DailyAction {
  id: string;
  memberId: string;
  /** Day offset from "today". 0 = today, -1 = yesterday. */
  dayOffset: number;
  moduleId: string;
  /** Added for the holistic mobile Today view; inferred from moduleId for legacy records. */
  domain?: ActionDomain;
  title: string;
  why: string;
  minimum: EffortSpec;
  target: EffortSpec;
  stretch: EffortSpec;
  /** Outcome-first tracking avoids presenting a meal choice as a duration. */
  measurement?: {
    kind: "minutes" | "repetitions" | "steps" | "meal" | "serving" | "check_in";
    value: number;
    unit: string;
  };
  isPrimary?: boolean;
  coachLimits?: { minimumValue: number; maximumValue: number };
  /** null = untouched, "rest" = explicitly not today (never a failure state). */
  completed: EffortLevel | "rest" | null;
  /**
   * Free text, in her own words, shown to a coach in quotation marks.
   * Predates the structured field below and is left alone: the console
   * renders it as something she said, so it must never contain a code.
   */
  skipReason?: string;
  /**
   * Which of the three offered descriptions she chose, for logic rather than
   * display. Sits alongside `completed` rather than widening it, so the dose
   * ladder and every existing reader are untouched. See
   * mobile/src/outcomes.ts.
   */
  skipKind?: "rested" | "no_time" | "unwell";
  provenance?: Provenance;
  /** Links a movement action to a workout definition. */
  workoutId?: string;
  /** A single movement with its cues and frames, as the app renders it. */
  exercise?: {
    name: string;
    sets: string;
    cue: string;
    frames: string[];
    /** Links back to `lib/exercise-library.ts` so progression can find it. */
    exerciseId?: string;
  };
}

export interface PulseEntry {
  id: string;
  memberId: string;
  dayOffset: number;
  energy: number; // 1 drained – 5 energised
  /** 1 poor – 5 restorative. 0 means "not recorded" — see `partial`. */
  sleep: number;
  stress: number; // 1 overwhelmed – 5 calm. Higher is always better, same as the two above.
  /**
   * True when this came from a one-tap mood and nothing else. A mood tap can
   * reasonably imply energy and mental state; it cannot know how she slept.
   * Rather than invent a number, sleep stays 0 and every consumer — the Radar
   * sleep rule, the Progress sparkline — skips it. Guessing here would be
   * worse than missing data: it would quietly feed a fabricated value into a
   * rule that changes what Deepika does.
   */
  partial?: boolean;
  symptoms: string[];
  note?: string;
  provenance: Provenance;
}

/** Selects the line drawing in components/ExerciseFigure.tsx. */
export type MovementFigure =
  | "goblet-squat"
  | "hip-hinge"
  | "incline-push-up"
  | "suitcase-carry"
  | "split-squat"
  | "romanian-deadlift"
  | "half-kneeling-press"
  | "farmer-carry"
  | "cat-cow"
  | "hip-switch"
  | "thoracic-opener"
  | "standing-stretch"
  | "walk"
  | "generic";

export interface ExerciseSet {
  name: string;
  prescription: string;
  cue: string;
  /** Deepika's own repertoire — kept deliberately small in V0. */
  supervisedOnly?: boolean;
  /**
   * Everything below exists so a member can do the movement well on a day
   * Deepika is not standing next to her. Strength work is the centre of this
   * product, not a section of it, and a name plus a rep count is not enough
   * to act on if you have never trained before.
   */
  figure?: MovementFigure;
  /** How to get into position, before the first rep. */
  setup?: string[];
  /** The rep itself, in order. */
  execute?: string[];
  /** The specific things that go wrong, named plainly. */
  watchFor?: string[];
  /** Where it should be felt — the fastest check that it is working. */
  feelItIn?: string;
  /** The honest regression, so "too hard" never means "skip it". */
  easier?: string;
}

export interface Workout {
  id: string;
  name: string;
  intent: string;
  warmup: string[];
  exercises: ExerciseSet[];
  minimum: EffortSpec;
  target: EffortSpec;
  stretch: EffortSpec;
  supervision: "supervised" | "independent" | "check-in";
  stopGuidance: string;
}

export interface WorkoutLog {
  id: string;
  memberId: string;
  workoutId: string;
  dayOffset: number;
  completedLevel: EffortLevel;
  rpe: number;
  painFlag: boolean;
  feltLike?: string;
  provenance: Provenance;
}

export interface CoachModule {
  id: string;
  name: string;
  category: ModuleCategory;
  version: string;
  status: "active" | "draft" | "retired";
  purpose: string;
  betterLooksLike: string;
  eligibility: string;
  keyIdeas: string[];
  minimum: EffortSpec;
  target: EffortSpec;
  stretch: EffortSpec;
  tracking: string;
  coachPlaybook: {
    ask: string[];
    barriers: string[];
    escalation: string;
  };
  notificationTemplates: string[];
  progression: string;
  reviewNote?: string;
  reviewedOn?: string;
}

export interface Message {
  id: string;
  memberId: string;
  /** "ai" is Vera. Kept distinct from "coach" so a human is never impersonated. */
  from: "coach" | "member" | "system" | "ai";
  kind: "text" | "voice" | "plan_update";
  body: string;
  seconds?: number;
  dayOffset: number;
  time: string;
  read: boolean;
}

export interface Session {
  id: string;
  memberId: string;
  type: "1:1 coaching" | "Supervised strength" | "Assessment" | "Follow-up";
  dayOffset: number;
  time: string;
  mode: "In person" | "Video";
  status: "scheduled" | "complete";
  memberQuestions: string[];
  agenda: string[];
  privateNotes?: string;
  memberRecap?: string;
  commitments: { text: string; done: boolean }[];
}

export interface WeeklyReflection {
  id: string;
  memberId: string;
  weekOf: string;
  biggestWin: string;
  hardestPart: string;
  feltUnrealistic: string;
  confidenceNextWeek: number; // 1–5
  questions: string;
  provenance: Provenance;
}

export interface RadarEvent {
  id: string;
  memberId: string;
  ruleId: string;
  ruleName: string;
  /** Human-readable trigger. V0 rules must be auditable, never opaque. */
  trigger: string;
  bucket: RadarBucket;
  detail: string;
  suggestedAction: string;
  resolved: boolean;
  snoozed: boolean;
}

/**
 * An uploaded report — blood panel, body composition scan, anything a lab
 * hands back.
 *
 * Values are transcribed and trended. They are never interpreted, scored,
 * flagged as in/out of range, or turned into advice: that is a clinician's
 * job and invariant 7 exists to keep this product on the right side of it.
 * The useful thing the software can do is make her next doctor's appointment
 * a better one.
 *
 * V0 stores the metadata and the values, not the file itself — real documents
 * need private object storage, which is a Pilot MVP gate item (§17.2).
 */
export interface Report {
  id: string;
  memberId: string;
  kind: "blood_panel" | "body_composition" | "other";
  title: string;
  collectedOn: string; // ISO date
  lab?: string;
  fileName?: string;
  /** Opaque server-issued reference to a private object. */
  fileId?: string;
  values: ReportValue[];
  provenance: Provenance;
  note?: string;
}

export interface ReportValue {
  label: string;
  value: string;
  unit?: string;
}

/**
 * A short read matched to a member's stage, goals and constraints.
 *
 * Matching is rule-based and every article carries the plain-language reason
 * it surfaced, for the same reason the Radar rules do: she can read why she
 * is being shown something, and disagree with it.
 */
export interface Article {
  id: string;
  title: string;
  category: ModuleCategory;
  readMinutes: number;
  standfirst: string;
  body: string[];
  match: {
    lifeStage?: string[];
    goal?: string[];
    constraint?: string[];
    medical?: string[];
    moduleIds?: string[];
    minAge?: number;
  };
  /** Shown to the member verbatim: "Because you said …". */
  whyThis: string;
  sourceNote?: string;
}

/**
 * Food logging — protein only, deliberately.
 *
 * This is not a calorie tracker and must never become one. Radhika's own
 * stated boundary is "I will not count calories", and turning her plate into
 * a ledger of everything she ate is the fastest way to lose her. One number,
 * one question: was there protein on the plate.
 *
 * Portions are household measures — katori, roti, glass — because that is how
 * this kitchen actually thinks. Grams-and-scales is the input model that kills
 * food diaries in week two.
 */
export interface FoodItem {
  id: string;
  name: string;
  category: "dal" | "grain" | "veg" | "dairy" | "protein" | "snack";
  /** How it is counted at the table: "katori", "roti", "glass", "egg". */
  unitLabel: string;
  /**
   * Grams of protein in one of that unit, as actually served at home.
   * Cooked, not raw — a katori of homestyle dal is mostly water, so it lands
   * near 5g rather than the 20g+ a raw-weight table would imply.
   */
  proteinPerUnit: number;
  /** Surfaces in the short list before search. */
  common?: boolean;
}

export interface FoodEntry {
  id: string;
  memberId: string;
  dayOffset: number;
  /** Canonical calendar date. dayOffset remains during the backwards-compatible migration. */
  loggedDate?: string;
  /** Present when picked from the library; absent for a custom entry. */
  itemId?: string;
  name: string;
  qty: number;
  unitLabel: string;
  /** Total grams for this entry, not per unit. */
  protein: number;
  /** Mobile nutrition estimates. The coach protein-only experience can omit them. */
  description?: string;
  calories?: number;
  carbs?: number;
  fat?: number;
  /** Opaque server-issued reference to a privately stored meal photo. */
  photoFileId?: string;
  /** Legacy/device-local URI retained while older documents migrate. */
  photoUri?: string;
  confidence?: "member" | "estimated";
  memberCorrected?: boolean;
  /** Set when the member removes the entry. See mobile/src/types.ts. */
  deletedAt?: string;
  createdAt?: string;
  /** True when she corrected the library's figure — hers wins, and is marked. */
  proteinEdited?: boolean;
  meal: "Breakfast" | "Lunch" | "Snack" | "Dinner";
  provenance: Provenance;
}

export type HealthMetric =
  | "steps"
  | "restingHeartRate"
  | "heartRateVariability"
  | "vo2Max";

export type HealthPermissionState =
  | "not_requested"
  | "requested"
  | "granted"
  | "denied";

export interface HealthSnapshot {
  id: string;
  date: string;
  metric: HealthMetric;
  value: number;
  unit: "count" | "bpm" | "ms" | "ml/kg/min";
  source: string;
  provider?: "android_health_connect" | "apple_health";
  /** Apple Health uses SDNN; Android Health Connect currently uses RMSSD. */
  measurementMethod?: "rmssd" | "sdnn";
  recordedAt: string;
  available: boolean;
  provenance: Provenance;
}

export interface HealthConnection {
  platform: "android_health_connect" | "apple_health" | "none";
  status: "unavailable" | "disconnected" | "partial" | "connected" | "error";
  syncEnabled: boolean;
  permissions: Record<HealthMetric, HealthPermissionState>;
  lastSyncAt?: string;
  message?: string;
}

export interface AiRecommendation {
  id: string;
  createdAt: string;
  kind: /**
   * Something worth knowing about why today looks the way it does.
   *
   * This is what every recommendation actually *is*. The app renders a
   * recommendation's `rationale` and first `evidence` line and nothing
   * else — `kind` and `proposedValue` are never acted on anywhere. So the
   * kinds below that named a concrete change were describing work no code
   * could perform.
   */
  | "observation"
    /** Held for a person. Drives the banner on Today. Real. */
    | "coach_review"
    /** Nothing to change today. Real. */
    | "no_change"
    /**
     * Historical only. These were generated before it was clear nothing
     * applied them, so stored documents contain them and must keep parsing.
     * Nothing produces one now and the model can no longer propose one.
     *
     * If a real preview/apply/undo workflow is ever built, these return with
     * it rather than being resurrected as labels.
     */
    | "reorder_actions"
    | "change_action_level"
    | "adjust_reminder"
    | "reduce_target";
  actionId?: string;
  evidence: string[];
  rationale: string;
  confidence: number;
  previousValue?: string | number;
  proposedValue?: string | number;
  safety: "low_risk" | "coach_review";
  status:
    | "proposed"
    | "applied"
    | "approved"
    | "dismissed"
    | "needs_coach_review";
  source: "openai" | "deterministic";
}

export interface MobileOnboarding {
  completed: boolean;
  currentStep: number;
  goals: string[];
  customGoal?: string;
  activityLevel?: string;
  availableMinutes?: number;
  movementCaution?: string;
  /** True once she answered the caution question either way. See mobile/src/types.ts. */
  movementCautionAnswered?: boolean;
  preferredCheckIn?: "morning" | "evening";
  consent: {
    wellness: boolean;
    healthConnect: boolean;
    aiPersonalisation: boolean;
  };
  primaryGoal?: string;
}

export interface Feedback {
  id: string;
  reporter: string;
  role: "member" | "coach";
  screen: string;
  category: "confusing" | "idea" | "bug";
  severity: "low" | "medium" | "high";
  text: string;
  easeScore?: number;
  status: "new" | "triaged" | "building" | "fixed";
}

export interface NotificationTemplate {
  id: string;
  trigger: string;
  copy: string;
  voice: "coach" | "system";
  timing: string;
  /** Notification rules from §11.2 — enforced, not aspirational. */
  capped: boolean;
}

/* ------------------------------------------------------------------ */
/* Hydration and small daily habits                                    */
/* ------------------------------------------------------------------ */

/**
 * These carry a calendar `date` and no `dayOffset`.
 *
 * Relative offsets have to be re-based on read (see `lib/day-offset.ts`) and
 * rot silently when nothing does it. Anything added from here on stores the day
 * it happened and derives the rest.
 */
export interface HydrationLog {
  id: string;
  memberId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Glasses of roughly 250ml. Whole numbers; a member counts glasses. */
  glasses: number;
}

export interface HabitDefinition {
  id: string;
  memberId: string;
  label: string;
  createdAt: string;
  /** Kept rather than deleted, so past completions stay meaningful. */
  archived?: boolean;
}

export interface HabitLog {
  id: string;
  memberId: string;
  habitId: string;
  /** YYYY-MM-DD. */
  date: string;
}

/* ------------------------------------------------------------------ */
/* Circle — member-to-member connections                               */
/* ------------------------------------------------------------------ */

export type ConnectionStatus = "pending" | "accepted" | "declined" | "blocked";

/**
 * What a member chooses to expose to other members.
 *
 * Both switches default off. Sharing activity and being discoverable are
 * separate decisions: joining a friend's circle should not put someone on a
 * city-wide list.
 */
export interface CircleProfile {
  displayName: string;
  city?: string;
  /** Appear in city-level discovery. Never exposes anything more precise. */
  discoverable: boolean;
  /** Share the activity projection with accepted connections. */
  shareActivity: boolean;
  /** Share today's step count, when a health source is connected. */
  shareSteps: boolean;
}

export interface CircleConnection {
  /** The other member. */
  memberId: string;
  displayName: string;
  city?: string;
  status: ConnectionStatus;
  /** Who asked whom, from the reading member's point of view. */
  direction: "incoming" | "outgoing";
  requestedAt: string;
  respondedAt?: string;
}

/** Everything one member may see about another. Built in `lib/circle.ts`. */
export interface CircleActivity {
  memberId: string;
  displayName: string;
  /** A short self-description. Support needs a person, not a row in a table. */
  bio?: string;
  /** The last 28 days as a pattern. Dates only, never content. */
  consistency?: import("./consistency").ConsistencySummary;
  /** A bucket, never a distance. See `lib/proximity.ts`. */
  proximity?: import("./proximity").Proximity;
  actionsCompleted: number;
  actionsTotal: number;
  activeDays: number;
  steps?: number;
  hydrationGlasses?: number;
  city?: string;
}

/* ------------------------------------------------------------------ */
/* Coaching — optional, and authoritative when present                 */
/* ------------------------------------------------------------------ */

/**
 * Whether a human coach is involved, and what that means for the plan.
 *
 * The product's default is now that nobody has a coach: the app builds the plan
 * itself from the sign-up answers and adapts it from what she reports. A coach
 * is a subscription on top, and where one exists she outranks the generator
 * completely — not as a suggestion the software weighs, but as the answer.
 *
 * `none` and an absent field mean the same thing, so every document written
 * before this existed reads correctly as un-coached.
 */
export interface CoachingState {
  mode: "none" | "coached";
  /** The coach's account id, when coached. */
  coachId?: string;
  since?: string;
  /**
   * Domains the coach has taken over. The generator fills only what is not
   * listed here, so she can own movement while the app still handles the rest.
   * An empty list with mode "coached" means she owns everything she publishes,
   * decided per-day by what she has actually written.
   */
  ownedDomains?: ActionDomain[];
}
