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
import { radarRules, type RadarRule } from "./radar";
import type {
  DailyAction,
  Feedback,
  FoodEntry,
  Member,
  Message,
  PulseEntry,
  Report,
  Session,
  WorkoutLog,
} from "./types";

export interface MemberDoc {
  member: Member;
  actions: DailyAction[];
  pulses: PulseEntry[];
  workoutLogs: WorkoutLog[];
  messages: Message[];
  sessions: Session[];
  reports: Report[];
  foodEntries: FoodEntry[];
}

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
}

const byMember = <T extends { memberId: string }>(rows: T[], id: string) =>
  rows.filter((r) => r.memberId === id);

export function extractMemberDoc<S extends PersistedState>(
  state: S,
  memberId: string
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
export function stateFromMemberDoc<S extends PersistedState>(base: S, doc: MemberDoc): S {
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
    activeMemberId: doc.member.id,
  };
}

/** Deepika's console: every member's document, flattened back into the shape
 *  the Radar and the rest of the console already expect. */
export function stateFromDocs<S extends PersistedState>(
  base: S,
  docs: MemberDoc[],
  coach: CoachDoc | null
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
