/**
 * Splitting app state into per-member documents, and putting it back together.
 *
 * The store works on one flat State object with global arrays keyed by
 * memberId. Durable storage works on one document per member. This module is
 * the translation between the two, and it is the only place that knows which
 * slices of state belong to a person and which belong to the practice.
 *
 * Per member: her record, and everything she or Deepika has logged about her.
 * Per practice: the Radar rules, what Deepika has dismissed, and the pilot
 * feedback board. Those live on Deepika's own document.
 *
 * Content — modules, workouts, articles, the food table — is never stored.
 * It ships with the code, so an edit to a workout reaches everyone on the next
 * deploy instead of being frozen into twenty stale copies.
 */

import * as seed from "./seed";
import type { ReadinessState } from "./readiness";
import type { MemberProfile } from "./member-profile";
import type { PlanNotice } from "./plan-generator";
import type { CoachingState } from "./types";
import { radarRules, type RadarRule } from "./radar";
import type {
  DailyAction,
  AiRecommendation,
  Feedback,
  FoodEntry,
  HealthConnection,
  HealthSnapshot,
  Member,
  Message,
  PulseEntry,
  Report,
  Session,
  WorkoutLog,
  MobileOnboarding,
  HydrationLog,
  HabitDefinition,
  HabitLog,
} from "./types";

export interface MemberDoc {
  member: Member;
  /**
   * The calendar date this document's relative `dayOffset` values were written
   * from. Set on every write and used by `lib/day-offset.ts` to move them onto
   * today when the document is read. See that module for why.
   */
  dayOffsetAnchor?: string;
  actions: DailyAction[];
  pulses: PulseEntry[];
  workoutLogs: WorkoutLog[];
  messages: Message[];
  sessions: Session[];
  reports: Report[];
  foodEntries: FoodEntry[];
  healthConnection?: HealthConnection;
  healthSnapshots?: HealthSnapshot[];
  recommendations?: AiRecommendation[];
  onboarding?: MobileOnboarding;
  /**
   * Who she is, as far as she has chosen to say. See `lib/member-profile.ts`.
   *
   * Member-owned, and deliberately not inside `onboarding` — she answers the
   * core of it at sign-up but can change any of it afterwards from About you,
   * long after onboarding is finished. Absent for every member who joined
   * before it existed, which the rules are written to handle.
   */
  profile?: MemberProfile;
  /** Date-keyed, so they never need re-basing. See `lib/day-offset.ts`. */
  hydrationLogs?: HydrationLog[];
  habits?: HabitDefinition[];
  habitLogs?: HabitLog[];
  /** Pre-exercise readiness answers and the outcome derived from them. */
  readiness?: ReadinessState;
  /** Where each exercise sits on the dose ladder. See `lib/adaptation.ts`. */
  doseSteps?: Record<string, number>;
  /**
   * Per exercise, the session date already folded into the dose.
   *
   * Makes adaptation idempotent: the generator can run any number of times
   * against unchanged history without walking the ladder up each call. Server
   * derived and never accepted from the phone, exactly like doseSteps.
   */
  doseAdaptedThrough?: Record<string, string>;
  /** Paused after a pain report. Only a person removes an id from here. */
  pausedExerciseIds?: string[];
  planGeneratedOn?: string;
  /**
   * What the app must tell her about this plan. Server-owned.
   *
   * Rebuilt on every generation, so a notice disappears when the reason for
   * it does. Never accepted from the phone.
   */
  planNotices?: PlanNotice[];
  /**
   * Reminder settings, weekly goal and celebrated milestones.
   *
   * Member-owned: the coach console has no editor for any of it, so her copy
   * is authoritative — the same rule hydrationLogs and habits already follow.
   * It was previously mobile-only and absent from this type entirely, so the
   * merge dropped it on every sync and a reminder she had just switched on
   * came back off on the next server read.
   */
  engagement?: Record<string, unknown>;
  /** Absent means un-coached, which is the default. */
  coaching?: CoachingState;
}

type MemberExtensions = Pick<
  MemberDoc,
  | "healthConnection"
  | "healthSnapshots"
  | "recommendations"
  | "onboarding"
  | "hydrationLogs"
  | "habits"
  | "habitLogs"
  | "readiness"
  | "doseSteps"
  | "pausedExerciseIds"
  | "planGeneratedOn"
  | "coaching"
>;

export interface CoachDoc {
  rules: RadarRule[];
  resolvedRadar: string[];
  feedback: Feedback[];
}

/** The shape the store holds. Declared here so this module stays importable
 *  from the server without dragging a React context in with it. */
export interface PersistedState {
  members: Member[];
  actions: DailyAction[];
  pulses: PulseEntry[];
  workoutLogs: WorkoutLog[];
  messages: Message[];
  sessions: Session[];
  reports: Report[];
  foodEntries: FoodEntry[];
  feedback: Feedback[];
  rules: RadarRule[];
  resolvedRadar: string[];
  activeMemberId: string;
  /** Mobile-only document fields preserved while the coach console flattens state. */
  memberExtensions?: Record<string, MemberExtensions>;
}

const byMember = <T extends { memberId: string }>(rows: T[], id: string) =>
  rows.filter((r) => r.memberId === id);

export function extractMemberDoc<S extends PersistedState>(
  state: S,
  memberId: string,
): MemberDoc | null {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return null;
  return {
    member,
    actions: byMember(state.actions, memberId),
    pulses: byMember(state.pulses, memberId),
    workoutLogs: byMember(state.workoutLogs, memberId),
    messages: byMember(state.messages, memberId),
    sessions: byMember(state.sessions, memberId),
    reports: byMember(state.reports, memberId),
    foodEntries: byMember(state.foodEntries, memberId),
    ...(state.memberExtensions?.[memberId] ?? {}),
  };
}

export function extractCoachDoc<S extends PersistedState>(state: S): CoachDoc {
  return {
    rules: state.rules,
    resolvedRadar: state.resolvedRadar,
    feedback: state.feedback,
  };
}

/** One member's app: her document and nothing else. She never holds anyone
 *  else's record, on the server or in her browser. */
export function stateFromMemberDoc<S extends PersistedState>(
  base: S,
  doc: MemberDoc,
): S {
  return {
    ...base,
    members: [doc.member],
    actions: doc.actions,
    pulses: doc.pulses,
    workoutLogs: doc.workoutLogs,
    messages: doc.messages,
    sessions: doc.sessions,
    reports: doc.reports,
    foodEntries: doc.foodEntries,
    memberExtensions: {
      ...(base.memberExtensions ?? {}),
      [doc.member.id]: {
        healthConnection: doc.healthConnection,
        healthSnapshots: doc.healthSnapshots,
        recommendations: doc.recommendations,
        onboarding: doc.onboarding,
        hydrationLogs: doc.hydrationLogs,
        habits: doc.habits,
        habitLogs: doc.habitLogs,
        readiness: doc.readiness,
        doseSteps: doc.doseSteps,
        pausedExerciseIds: doc.pausedExerciseIds,
        planGeneratedOn: doc.planGeneratedOn,
        coaching: doc.coaching,
      },
    },
    activeMemberId: doc.member.id,
  };
}

/** Deepika's console: every member's document, flattened back into the shape
 *  the Radar and the rest of the console already expect. */
export function stateFromDocs<S extends PersistedState>(
  base: S,
  docs: MemberDoc[],
  coach: CoachDoc | null,
): S {
  return {
    ...base,
    members: docs.map((d) => d.member),
    actions: docs.flatMap((d) => d.actions ?? []),
    pulses: docs.flatMap((d) => d.pulses ?? []),
    workoutLogs: docs.flatMap((d) => d.workoutLogs ?? []),
    messages: docs.flatMap((d) => d.messages ?? []),
    sessions: docs.flatMap((d) => d.sessions ?? []),
    reports: docs.flatMap((d) => d.reports ?? []),
    foodEntries: docs.flatMap((d) => d.foodEntries ?? []),
    memberExtensions: Object.fromEntries(
      docs.map((doc) => [
        doc.member.id,
        {
          healthConnection: doc.healthConnection,
          healthSnapshots: doc.healthSnapshots,
          recommendations: doc.recommendations,
          onboarding: doc.onboarding,
          hydrationLogs: doc.hydrationLogs,
          habits: doc.habits,
          habitLogs: doc.habitLogs,
          readiness: doc.readiness,
          doseSteps: doc.doseSteps,
          pausedExerciseIds: doc.pausedExerciseIds,
          planGeneratedOn: doc.planGeneratedOn,
          coaching: doc.coaching,
        },
      ]),
    ),
    rules: coach?.rules?.length ? coach.rules : base.rules,
    resolvedRadar: coach?.resolvedRadar ?? base.resolvedRadar,
    feedback: coach?.feedback ?? base.feedback,
    activeMemberId: docs[0]?.member.id ?? base.activeMemberId,
  };
}

/**
 * The demo cohort, as documents.
 *
 * These are the six fictional personas the console has always been built
 * around — Radhika mid-programme, Anita gone quiet, Priya just back after five
 * days. They are written into an empty database once, so the Radar has all
 * four buckets populated on the day it is switched on and Deepika is not
 * looking at an empty console while she waits for real members to log
 * something. Real members are added alongside them and are not distinguishable
 * in the console by anything except being real.
 */
export function seedMemberDocs(): MemberDoc[] {
  const source = {
    members: seed.members,
    actions: seed.dailyActions,
    pulses: seed.pulses,
    workoutLogs: seed.workoutLogs,
    messages: seed.messages,
    sessions: seed.sessions,
    reports: seed.reports,
    foodEntries: seed.foodEntries,
    feedback: seed.feedbackItems,
    rules: radarRules,
    resolvedRadar: [],
    activeMemberId: seed.members[0]?.id ?? "",
  };
  return seed.members
    .map((m) => extractMemberDoc(source, m.id))
    .filter((d): d is MemberDoc => d !== null);
}

export function seedCoachDoc(): CoachDoc {
  return { rules: radarRules, resolvedRadar: [], feedback: seed.feedbackItems };
}

/** Usernames already taken by the demo cohort. Handing one of these to a real
 *  member would drop her into a fictional woman's history. */
export const RESERVED_USERNAMES = seed.members.map((m) => m.id);
