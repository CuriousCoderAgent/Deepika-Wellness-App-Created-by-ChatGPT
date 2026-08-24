export type EffortLevel = "minimum" | "target" | "stretch";
export type JourneyPhase = "Stabilise" | "Build" | "Consolidate";
export type ActionDomain =
  | "movement"
  | "walking"
  | "nutrition"
  | "recovery"
  | "mindset";

export interface Provenance {
  source:
    | "member_manual"
    | "coach_on_behalf"
    | "wearable"
    | "imported_document"
    | "system_derived";
  enteredBy: string;
  at: string;
}

export interface WeekPlan {
  week: number;
  phase: JourneyPhase;
  focus: string[];
  moduleIds: string[];
  rationale?: string;
}

export interface Member {
  id: string;
  name: string;
  week: number;
  phase: JourneyPhase;
  weeklyFocus: string[];
  goals: string[];
  constraints: string[];
  activeModuleIds: string[];
  weekPlans?: WeekPlan[];
  lastPlanChange?: { at: string; rationale: string };
  /**
   * When she finished the first-run flow. The server derives her program
   * week from this on every read — see lib/day-offset.ts's programWeek() —
   * so week/phase above are a snapshot as of the last sync, not a client
   * calculation. Nothing here recomputes them locally.
   */
  onboardedAt?: string;
}

export interface EffortSpec {
  label: string;
  minutes: number;
}

export interface OutcomeMeasurement {
  kind: "minutes" | "repetitions" | "steps" | "meal" | "serving" | "check_in";
  value: number;
  unit: string;
}

export interface DailyAction {
  id: string;
  memberId: string;
  dayOffset: number;
  moduleId?: string;
  domain: ActionDomain;
  title: string;
  why: string;
  minimum: EffortSpec;
  target: EffortSpec;
  stretch: EffortSpec;
  measurement: OutcomeMeasurement;
  completed: EffortLevel | "rest" | null;
  isPrimary?: boolean;
  coachLimits?: { minimumValue: number; maximumValue: number };
  exercise?: {
    name: string;
    sets: string;
    cue: string;
    frames: string[];
    /** Links back to `lib/exercise-library.ts`; the exact media lookup. */
    exerciseId?: string;
  };
}

export interface WorkoutLog {
  id: string;
  actionId: string;
  memberId: string;
  completedAt: string;
  level: EffortLevel;
  perceivedEffort: 1 | 2 | 3 | 4 | 5;
  pain: boolean;
  painNote?: string;
  coachReviewRequired: boolean;
}

export interface HealthReport {
  id: string;
  memberId: string;
  title: string;
  category: "blood_work" | "body_composition" | "other";
  fileName: string;
  /** Opaque server-issued reference to a private object. */
  fileId?: string;
  /** Legacy/device-local URI. Retained only for older records and demo mode. */
  fileUri?: string;
  uploadedAt: string;
  status: "uploaded" | "coach_reviewed";
}

export interface LearningArticle {
  id: string;
  title: string;
  summary: string;
  readMinutes: number;
  category: "Movement" | "Nutrition" | "Recovery" | "Mindset" | "Body signals";
  body: string[];
}

export interface PulseEntry {
  id: string;
  memberId: string;
  dayOffset: number;
  energy: number;
  sleep: number;
  stress: number;
  partial?: boolean;
  symptoms: string[];
  note?: string;
  provenance: Provenance;
}

export interface Message {
  id: string;
  memberId: string;
  /** "ai" is Vera. Kept distinct from "coach" so a human is never impersonated. */
  from: "coach" | "member" | "system" | "ai";
  kind: "text" | "voice" | "plan_update";
  body: string;
  dayOffset: number;
  time: string;
  read: boolean;
}

export interface Session {
  id: string;
  memberId: string;
  dayOffset: number;
  time: string;
  type: string;
  status: string;
}

export interface FoodEntry {
  id: string;
  memberId: string;
  dayOffset: number;
  loggedDate: string;
  meal: "Breakfast" | "Lunch" | "Snack" | "Dinner";
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Opaque server-issued reference to a privately stored meal photo. */
  photoFileId?: string;
  /** Legacy/device-local URI. Retained only for older records and demo mode. */
  photoUri?: string;
  confidence: "member" | "estimated";
  memberCorrected?: boolean;
  /**
   * Set when she removes the entry. A tombstone rather than a deletion,
   * because the server merges these logs by union — a row that simply
   * vanished from the phone would be restored from the server copy on the
   * next sync. Everything reading foodEntries must filter these out.
   */
  deletedAt?: string;
  createdAt: string;
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
  /** Native source used to read this snapshot. */
  provider?: "android_health_connect" | "apple_health";
  /** HRV methods differ by platform and must never be compared as equivalents. */
  measurementMethod?: "rmssd" | "sdnn";
  /** When the native health store says the measurement or aggregate occurred. */
  observedAt?: string;
  /** When Bharosa most recently read this value from the native health store. */
  syncedAt?: string;
  /** How the stored value was selected from the provider's records. */
  aggregation?: "daily_sum" | "latest_record";
  /** Present for windowed aggregates such as a calendar day's step total. */
  windowStart?: string;
  windowEnd?: string;
  /** Every native source included in an aggregate. */
  sourceOrigins?: string[];
  /** Legacy timestamp retained while older member documents are migrated. */
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

export type RecommendationKind =
  | "reorder_actions"
  | "change_action_level"
  | "adjust_reminder"
  | "reduce_target"
  | "coach_review"
  | "no_change";

export interface AiRecommendation {
  id: string;
  createdAt: string;
  kind: RecommendationKind;
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

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  goals: string[];
  customGoal?: string;
  activityLevel?: string;
  availableMinutes?: number;
  movementCaution?: string;
  preferredCheckIn?: "morning" | "evening";
  consent: {
    wellness: boolean;
    healthConnect: boolean;
    aiPersonalisation: boolean;
  };
  /** Legacy single-goal field, read during migration only. */
  primaryGoal?: string;
}

/**
 * Hydration and habits carry a calendar `date` and no `dayOffset`.
 *
 * Relative offsets have to be re-based on read and rot silently when nothing
 * does it — that was a real bug. Anything added from here on stores the day it
 * happened and derives the rest.
 */
export interface HydrationLog {
  id: string;
  memberId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Glasses of roughly 250ml. A member counts glasses, not millilitres. */
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

/** Her own circle settings. Both sharing switches start off. */
export interface CircleProfile {
  displayName: string;
  /** A short self-description. Support needs a person, not a row in a table. */
  bio?: string;
  /** Whether she has shared a coarse area. The cell itself never comes back. */
  hasLocation?: boolean;
  /** Write-only: the coarsened cell the device sends. Never returned. */
  cell?: { x: number; y: number };
  city?: string;
  discoverable: boolean;
  shareActivity: boolean;
  shareSteps: boolean;
}

/**
 * Everything one member may see about another.
 *
 * Built server-side in `lib/circle.ts` field by field. Meals, photos, reports,
 * mood, symptoms and coach messages are never part of it.
 */
export interface CircleActivity {
  memberId: string;
  displayName: string;
  bio?: string;
  /** The last 28 days as a pattern, not a position. */
  consistency?: ConsistencySummary;
  /** A bucket — "Nearby", "In your area". Never a distance. */
  proximity?: string;
  actionsCompleted: number;
  actionsTotal: number;
  activeDays: number;
  steps?: number;
  hydrationGlasses?: number;
  city?: string;
}

export interface CircleRequest {
  memberId: string;
  displayName: string;
  city?: string;
  requestedAt: string;
}

export interface CircleState {
  profile: CircleProfile;
  me: CircleActivity;
  circle: CircleActivity[];
  /** The circle's shared figure. Everyone adds; nobody subtracts. */
  together?: { activeDays: number; possibleDays: number; people: number };
  requests: { incoming: CircleRequest[]; outgoing: CircleRequest[] };
}

import type { ReadinessState } from "./readiness";
import type { ConsistencySummary } from "./consistency";

export interface MemberDoc {
  member: Member;
  actions: DailyAction[];
  pulses: PulseEntry[];
  messages: Message[];
  sessions: Session[];
  workoutLogs: WorkoutLog[];
  reports: HealthReport[];
  foodEntries: FoodEntry[];
  healthConnection: HealthConnection;
  healthSnapshots: HealthSnapshot[];
  recommendations: AiRecommendation[];
  onboarding: OnboardingState;
  /** Pre-exercise readiness answers. The server recomputes the outcome. */
  readiness?: ReadinessState;
  /** Set by the server the day a plan was last built. */
  planGeneratedOn?: string;
  /** Absent means un-coached, which is the default. A coach outranks Vera. */
  coaching?: { mode: "none" | "coached"; ownedDomains?: ActionDomain[] };
  doseSteps?: Record<string, number>;
  /** Session dates already folded into the dose. Server-owned; read-only here. */
  doseAdaptedThrough?: Record<string, string>;
  pausedExerciseIds?: string[];
  hydrationLogs?: HydrationLog[];
  habits?: HabitDefinition[];
  habitLogs?: HabitLog[];
  engagement?: {
    weeklyGoal: number;
    activeChallenge?: {
      id: string;
      title: string;
      description: string;
      targetDays: number;
    };
    circle: {
      inviteCode: string;
      memberCount: number;
    };
    reminders: {
      enabled: boolean;
      time: string;
    };
    celebratedMilestones: string[];
  };
}
