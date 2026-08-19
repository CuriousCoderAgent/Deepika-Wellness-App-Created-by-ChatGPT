"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as seed from "./seed";
import { evaluateRadar, radarRules, type RadarRule } from "./radar";
import { draftWeekPlansFor, weekPlansFor } from "./plan";
import { emptyStateFor } from "./emptyState";
import {
  extractCoachDoc,
  extractMemberDoc,
  stateFromDocs,
  stateFromMemberDoc,
  type CoachDoc,
  type MemberDoc,
} from "./persist";
import { DEMO_MEMBER_ID, readUserCookie, type ClientSession } from "./session-client";
import type {
  Article,
  FoodEntry,
  FoodItem,
  CoachModule,
  DailyAction,
  EffortLevel,
  Feedback,
  Member,
  Message,
  PulseEntry,
  Report,
  Session,
  WeekPlan,
  Workout,
  WorkoutLog,
} from "./types";

interface State {
  members: Member[];
  modules: CoachModule[];
  workouts: Workout[];
  articles: Article[];
  foodItems: FoodItem[];
  foodEntries: FoodEntry[];
  actions: DailyAction[];
  pulses: PulseEntry[];
  workoutLogs: WorkoutLog[];
  messages: Message[];
  sessions: Session[];
  reports: Report[];
  feedback: Feedback[];
  rules: RadarRule[];
  resolvedRadar: string[];
  activeMemberId: string;
}

const initial: State = {
  members: seed.members,
  modules: seed.modules,
  workouts: seed.workouts,
  articles: seed.articles,
  foodItems: seed.foodItems,
  foodEntries: seed.foodEntries,
  actions: seed.dailyActions,
  pulses: seed.pulses,
  workoutLogs: seed.workoutLogs,
  messages: seed.messages,
  sessions: seed.sessions,
  reports: seed.reports,
  feedback: seed.feedbackItems,
  rules: radarRules,
  resolvedRadar: [],
  activeMemberId: "radhika",
};

// Storage is namespaced per signed-in account, so two people using the same
// browser never see each other's data, and signing out of one does not touch
// the other. The version suffix is bumped when seeded content changes shape.
const KEY_PREFIX = "dw-v0-state-6";
const storageKey = (userId: string) => `${KEY_PREFIX}:${userId}`;

/**
 * Only the demo member carries the seeded history. Everyone else — including
 * every real pilot member — starts from nothing and builds their own.
 */
function initialFor(session: ClientSession | null) {
  if (!session) return initial;
  if (session.role === "coach") return initial;
  if (session.sub === DEMO_MEMBER_ID) return { ...initial, activeMemberId: DEMO_MEMBER_ID };
  return { ...initial, ...emptyStateFor(session.sub, session.name) } as State;
}

interface Ctx extends State {
  radar: ReturnType<typeof evaluateRadar>;
  activeMember: Member;
  /** Who is signed in, or null before the cookie has been read. */
  session: ClientSession | null;
  setActiveMember: (id: string) => void;
  completeAction: (id: string, level: EffortLevel | "rest", reason?: string) => void;
  submitPulse: (
    memberId: string,
    v: {
      energy: number;
      sleep: number;
      stress: number;
      symptoms: string[];
      note?: string;
      partial?: boolean;
    },
    byCoach?: boolean
  ) => void;
  logWorkout: (log: Omit<WorkoutLog, "id">) => void;
  updateAction: (id: string, patch: Partial<DailyAction>) => void;
  addAction: (a: DailyAction) => void;
  removeAction: (id: string) => void;
  updateDraftWeek: (
    memberId: string,
    week: number,
    changes: Partial<Pick<WeekPlan, "focus" | "moduleIds">>
  ) => void;
  publishWeek: (memberId: string, week: number, rationale: string) => void;
  addCoachNote: (memberId: string, text: string) => void;
  addReport: (r: Omit<Report, "id">) => void;
  addFood: (e: Omit<FoodEntry, "id" | "provenance">, byCoach?: boolean) => void;
  removeFood: (id: string) => void;
  setProteinTarget: (memberId: string, grams: number | undefined) => void;
  completeOnboarding: (
    memberId: string,
    data: {
      age: number;
      gender?: "woman" | "man" | "other";
      lifeStage: string;
      goals: string[];
      wontDo: string;
      constraints: string[];
      checkInPreference: "morning" | "evening";
      consent: { health: boolean; reports: boolean };
    }
  ) => void;
  /**
   * False until localStorage has been read. Anything that redirects on stored
   * state has to wait for this, or it will act on the seed defaults for a
   * frame and bounce someone who was already onboarded.
   */
  hydrated: boolean;
  sendMessage: (memberId: string, m: Omit<Message, "id" | "memberId">) => void;
  markRead: (memberId: string) => void;
  toggleRule: (id: string) => void;
  resolveRadar: (id: string) => void;
  addFeedback: (f: Omit<Feedback, "id">) => void;
  updateFeedback: (id: string, patch: Partial<Feedback>) => void;
  saveSessionNotes: (id: string, patch: Partial<Session>) => void;
  replayOnboarding: (memberId: string) => void;
  reset: () => void;
}

const StoreContext = createContext<Ctx | null>(null);

/** Content always comes from source, so an edit to a workout or an article
 *  reaches everyone on the next deploy instead of being frozen into whatever
 *  copy each person happens to have stored. */
const withLiveContent = (s: State): State => ({
  ...s,
  modules: seed.modules,
  workouts: seed.workouts,
  articles: seed.articles,
  foodItems: seed.foodItems,
});

/** Records what the server already holds, so the first save after a load is a
 *  no-op instead of a full rewrite. */
function primeSaved(
  saved: Map<string, string>,
  state: State,
  who: ClientSession,
  opts: { hadDoc: boolean }
) {
  saved.clear();
  if (!opts.hadDoc) return;
  if (who.role === "coach") {
    for (const m of state.members) {
      const doc = extractMemberDoc(state, m.id);
      if (doc) saved.set(m.id, JSON.stringify(doc));
    }
    saved.set("__coach__", JSON.stringify(extractCoachDoc(state)));
    return;
  }
  const doc = extractMemberDoc(state, who.sub);
  if (doc) saved.set(who.sub, JSON.stringify(doc));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);
  /** True once the server has answered that a database is configured. Until
   *  then this is a browser-storage prototype, which is a real mode and not a
   *  failure — see lib/db.ts. */
  const [serverBacked, setServerBacked] = useState(false);
  /**
   * The last thing known to be on the server, per document. A save compares
   * against this and sends only what differs.
   *
   * It is primed from the load, which matters most for Deepika: without that,
   * her first render would look like twenty edited members and write the whole
   * cohort straight back, stamping her page-load copy over anyone who logged
   * something in between.
   */
  const savedDocs = useRef<Map<string, string>>(new Map());

  // Identity is read on the client from the readable companion cookie rather
  // than threaded down from the server, so there is one code path and no
  // chance of the server and client disagreeing about who is signed in.
  useEffect(() => {
    let cancelled = false;
    const who = readUserCookie();
    setSession(who);
    const base = initialFor(who);

    // Browser storage first, so the app paints from local data immediately
    // rather than holding a blank screen for a network round trip.
    let next = base;
    try {
      const raw = window.localStorage.getItem(storageKey(who?.sub ?? "anon"));
      if (raw) next = withLiveContent({ ...base, ...JSON.parse(raw) });
    } catch {
      /* first run, or storage unavailable */
    }

    (async () => {
      if (who) {
        try {
          const res = await fetch("/api/state", { cache: "no-store" });
          const body = await res.json();
          if (res.ok && body.configured) {
            next = withLiveContent(
              who.role === "coach"
                ? stateFromDocs(base, body.docs ?? [], body.coach ?? null)
                : body.doc
                  ? stateFromMemberDoc(base, body.doc)
                  : base
            );
            primeSaved(savedDocs.current, next, who, {
              /* A member with no document yet is deliberately left unprimed,
                 so her first save creates the row and Deepika can see her in
                 the console before she has logged anything. */
              hadDoc: who.role === "coach" || Boolean(body.doc),
            });
            if (!cancelled) setServerBacked(true);
          }
        } catch {
          // Offline, or the database is having a moment. The local copy is
          // already loaded and writes will sync when it comes back.
        }
      }
      if (cancelled) return;
      setState(next);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const key = storageKey(session?.sub ?? "anon");

  // Browser storage stays written either way: it is the only store when there
  // is no database, and an offline mirror when there is one.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage full or blocked — the prototype still works in memory */
    }
  }, [state, hydrated, key]);

  // Server writes are debounced and send only what changed. A member sends her
  // own document. Deepika sends the members she has actually edited, so her
  // copy of the cohort never lands on top of someone who logged something
  // while the console was open.
  useEffect(() => {
    if (!hydrated || !serverBacked || !session) return;

    const timer = setTimeout(() => {
      const body: { doc?: MemberDoc; docs?: MemberDoc[]; coach?: CoachDoc } = {};

      if (session.role === "coach") {
        const changed: MemberDoc[] = [];
        for (const m of state.members) {
          const doc = extractMemberDoc(state, m.id);
          if (!doc) continue;
          const json = JSON.stringify(doc);
          if (savedDocs.current.get(m.id) !== json) {
            savedDocs.current.set(m.id, json);
            changed.push(doc);
          }
        }
        body.coach = extractCoachDoc(state);
        if (changed.length) body.docs = changed;
        if (!changed.length && savedDocs.current.get("__coach__") === JSON.stringify(body.coach)) {
          return;
        }
        savedDocs.current.set("__coach__", JSON.stringify(body.coach));
      } else {
        const doc = extractMemberDoc(state, session.sub);
        if (!doc) return;
        const json = JSON.stringify(doc);
        if (savedDocs.current.get(session.sub) === json) return;
        savedDocs.current.set(session.sub, json);
        body.doc = doc;
      }

      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {
        // Failed writes drop their cached signature so the next change retries
        // this content rather than skipping it as already saved.
        savedDocs.current.clear();
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [state, hydrated, serverBacked, session]);

  const patch = (fn: (s: State) => State) => setState((s) => fn(s));

  const value: Ctx = useMemo(() => {
    const activeMember =
      state.members.find((m) => m.id === state.activeMemberId) ?? state.members[0];

    const radar = evaluateRadar(
      state.members,
      state.actions,
      state.pulses,
      state.messages,
      state.sessions,
      state.rules,
      state.resolvedRadar
    );

    return {
      ...state,
      radar,
      activeMember,
      session,
      hydrated,

      setActiveMember: (id) => patch((s) => ({ ...s, activeMemberId: id })),

      completeAction: (id, level, reason) =>
        patch((s) => ({
          ...s,
          actions: s.actions.map((a) =>
            a.id === id
              ? {
                  ...a,
                  completed: level,
                  skipReason: level === "rest" ? reason : undefined,
                  provenance: {
                    source: "member_manual",
                    enteredBy: s.members.find((m) => m.id === a.memberId)?.name.split(" ")[0] ?? "Member",
                    at: new Date().toISOString().slice(0, 10),
                  },
                }
              : a
          ),
        })),

      submitPulse: (memberId, v, byCoach) =>
        patch((s) => {
          const existing = s.pulses.find((x) => x.memberId === memberId && x.dayOffset === 0);
          const entry: PulseEntry = {
            id: existing?.id ?? `p-${memberId}-${Date.now()}`,
            memberId,
            dayOffset: 0,
            ...v,
            provenance: {
              source: byCoach ? "coach_on_behalf" : "member_manual",
              enteredBy: byCoach
                ? "Deepika"
                : s.members.find((m) => m.id === memberId)?.name.split(" ")[0] ?? "Member",
              at: new Date().toISOString().slice(0, 10),
            },
          };
          return {
            ...s,
            pulses: existing
              ? s.pulses.map((x) => (x.id === existing.id ? entry : x))
              : [entry, ...s.pulses],
          };
        }),

      logWorkout: (log) =>
        patch((s) => ({ ...s, workoutLogs: [{ ...log, id: `wl-${Date.now()}` }, ...s.workoutLogs] })),

      updateAction: (id, p) =>
        patch((s) => ({ ...s, actions: s.actions.map((a) => (a.id === id ? { ...a, ...p } : a)) })),

      addAction: (a) => patch((s) => ({ ...s, actions: [a, ...s.actions] })),

      removeAction: (id) => patch((s) => ({ ...s, actions: s.actions.filter((a) => a.id !== id) })),

      updateDraftWeek: (memberId, week, changes) =>
        patch((s) => ({
          ...s,
          members: s.members.map((m) => {
            if (m.id !== memberId) return m;
            const draftWeekPlans = draftWeekPlansFor(m).map((w) =>
              w.week === week ? { ...w, ...changes } : w
            );
            return { ...m, draftWeekPlans };
          }),
        })),

      // Publishing a week is the only way a plan change reaches the member,
      // and it always carries a reason. Publishing the *current* week also
      // mirrors into the live fields every other screen reads, and lands a
      // plan-change card on her Today screen.
      publishWeek: (memberId, week, rationale) =>
        patch((s) => {
          let announce: string | null = null;
          const members = s.members.map((m) => {
            if (m.id !== memberId) return m;
            const rawTarget = draftWeekPlansFor(m).find((w) => w.week === week);
            if (!rawTarget) return m;
            const target = { ...rawTarget, focus: rawTarget.focus.filter(Boolean) };
            const weekPlans = weekPlansFor(m).map((w) => (w.week === week ? target : w));
            const isCurrent = week === m.week;
            if (isCurrent) announce = `Deepika changed your week. ${rationale}`;
            return {
              ...m,
              weekPlans,
              draftWeekPlans: weekPlans,
              ...(isCurrent
                ? {
                    activeModuleIds: target.moduleIds,
                    weeklyFocus: target.focus,
                    lastPlanChange: { at: "just now", rationale },
                  }
                : {}),
            };
          });
          return {
            ...s,
            members,
            messages: announce
              ? [
                  {
                    id: `m-${Date.now()}`,
                    memberId,
                    from: "system",
                    kind: "plan_update",
                    body: announce,
                    dayOffset: 0,
                    time: "just now",
                    read: false,
                  },
                  ...s.messages,
                ]
              : s.messages,
          };
        }),

      // Stores what a report says. Nothing here interprets it — see types.ts.
      addReport: (r) =>
        patch((s) => ({
          ...s,
          reports: [{ ...r, id: `rep-${Date.now()}` }, ...s.reports],
        })),

      addFood: (e, byCoach) =>
        patch((s) => ({
          ...s,
          foodEntries: [
            {
              ...e,
              id: `fe-${Date.now()}`,
              provenance: {
                source: byCoach ? "coach_on_behalf" : "member_manual",
                enteredBy: byCoach
                  ? "Deepika"
                  : s.members.find((m) => m.id === e.memberId)?.name.split(" ")[0] ?? "Member",
                at: new Date().toISOString().slice(0, 10),
              },
            },
            ...s.foodEntries,
          ],
        })),

      removeFood: (id) =>
        patch((s) => ({ ...s, foodEntries: s.foodEntries.filter((x) => x.id !== id) })),

      setProteinTarget: (memberId, grams) =>
        patch((s) => ({
          ...s,
          members: s.members.map((m) =>
            m.id === memberId ? { ...m, proteinTargetG: grams } : m
          ),
        })),

      addCoachNote: (memberId, text) =>
        patch((s) => ({
          ...s,
          members: s.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  notes: [
                    { id: `note-${Date.now()}`, at: new Date().toISOString().slice(0, 10), text },
                    ...(m.notes ?? []),
                  ],
                }
              : m
          ),
        })),

      sendMessage: (memberId, m) =>
        patch((s) => ({
          ...s,
          messages: [{ ...m, id: `m-${Date.now()}`, memberId }, ...s.messages],
        })),

      markRead: (memberId) =>
        patch((s) => ({
          ...s,
          messages: s.messages.map((m) => (m.memberId === memberId ? { ...m, read: true } : m)),
        })),

      toggleRule: (id) =>
        patch((s) => ({
          ...s,
          rules: s.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
        })),

      resolveRadar: (id) =>
        patch((s) => ({
          ...s,
          resolvedRadar: s.resolvedRadar.includes(id)
            ? s.resolvedRadar.filter((x) => x !== id)
            : [...s.resolvedRadar, id],
        })),

      addFeedback: (f) =>
        patch((s) => ({ ...s, feedback: [{ ...f, id: `f-${Date.now()}` }, ...s.feedback] })),

      updateFeedback: (id, p) =>
        patch((s) => ({ ...s, feedback: s.feedback.map((f) => (f.id === id ? { ...f, ...p } : f)) })),

      saveSessionNotes: (id, p) =>
        patch((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...p } : x)) })),

      completeOnboarding: (memberId, d) =>
        patch((s) => ({
          ...s,
          members: s.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  age: d.age,
                  gender: d.gender ?? m.gender,
                  lifeStage: d.lifeStage,
                  goals: d.goals.filter(Boolean),
                  wontDo: d.wontDo,
                  constraints: d.constraints.filter(Boolean),
                  checkInPreference: d.checkInPreference,
                  consent: { ...d.consent, at: new Date().toISOString().slice(0, 10) },
                  onboardedAt: new Date().toISOString().slice(0, 10),
                }
              : m
          ),
        })),

      reset: () => {
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
        setState(initialFor(session));
      },

      /**
       * Clears the onboarded flag so the first-run flow can be walked again.
       * Everything else — her history, logs and messages — is left alone, so
       * the demo member can be shown the welcome journey without losing the
       * five weeks of history that make the rest of the app worth looking at.
       */
      replayOnboarding: (memberId) =>
        patch((s) => ({
          ...s,
          members: s.members.map((m) =>
            m.id === memberId ? { ...m, onboardedAt: undefined } : m
          ),
        })),
    };
  }, [state, session, hydrated, key]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
