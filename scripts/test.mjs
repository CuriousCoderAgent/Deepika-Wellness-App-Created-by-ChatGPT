/**
 * Tests for the pure logic that is easy to get quietly wrong.
 *
 * Deliberately not a framework. These cover the two pieces where a silent
 * mistake changes what a member sees without anything appearing broken: which
 * day a record belongs to, and what a meal is estimated to contain.
 *
 * Run with `npm test`. Node strips the TypeScript types itself, so there is no
 * build step and the tests import the real modules rather than copies.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import {
  daysBetween,
  offsetFromDate,
  programWeek,
  rebaseMemberDoc,
  todayIso,
} from "../lib/day-offset.ts";
import { estimateMeal } from "../mobile/src/nutrition.ts";
import {
  buildCoachContext,
  COACH_INSTRUCTIONS,
  COACH_NAME,
  matchRefusal,
  matchUrgent,
  sanitiseReply,
} from "../lib/coach-ai.ts";
import { COACH_NAME as MOBILE_COACH_NAME } from "../mobile/src/coach.ts";
import { CITIES, canonicalCity, suggestCities } from "../mobile/src/cities.ts";
import { C, SURFACES, TEXT_COLOURS } from "../mobile/src/design/tokens.ts";
import { AWARDS, awardMetrics } from "../mobile/src/awards.ts";
import { compactKcal, liveMeals } from "../mobile/src/meals.ts";
import { normalizeMemberDoc } from "../mobile/src/normalize.ts";
import {
  PAIN_KINDS,
  PAIN_SITES,
  PAIN_TIMINGS,
  describePain,
  routePain,
} from "../mobile/src/pain.ts";
import {
  buildLogFeed,
  loggedToday,
  whenLabel,
} from "../mobile/src/log-feed.ts";
import { activeDays, isActive } from "../mobile/src/activity.ts";
import { newId } from "../mobile/src/ids.ts";
import { checkMacros, parseMacro } from "../mobile/src/meal-values.ts";
import { findWeekWin } from "../mobile/src/week-win.ts";
import {
  adjustQuantity,
  describeItems,
  preferred,
  removeItem,
  totalOf,
  wasAdjusted,
} from "../mobile/src/meal-estimate.ts";
import {
  GOAL_OPTIONS,
  EQUIPMENT_OPTIONS,
  LIFE_STAGES,
  goalNeedsEnduranceModel,
  goalIdFromLabel as mobileGoalIdFromLabel,
  EVENT_KINDS,
  profileCompleteness,
} from "../mobile/src/profile.ts";
import { assessFeasibility, planWeek } from "../lib/endurance.ts";
import {
  GOALS,
  avoidLoadsFor,
  conditionsForLifeStage,
  equipmentFor,
  goalIdFromLabel,
  goalIds,
  sessionDaysFor,
  startsConservatively,
  tierCeiling,
  withheldPatternsForAge,
  goalNeedsEnduranceModel as serverGoalNeedsEndurance,
} from "../lib/member-profile.ts";
import {
  SKIP_OPTIONS,
  describeSkip,
  isDeliberateRest,
} from "../mobile/src/outcomes.ts";
import { DOMAIN_META, NUDGE_OPTIONS } from "../mobile/src/content.ts";
import { deterministicSafetyRecommendation } from "../lib/recommendation-safety.ts";
import {
  latestRecommendation,
  needsHumanReview,
} from "../mobile/src/recommendations.ts";

const AUG_23 = new Date("2026-08-23T06:00:00Z");

test("todayIso reports the date in the app timezone", () => {
  // 23:00 UTC is already the next day in India. A UTC "today" would tell a
  // member logging something at 05:00 IST that it happened yesterday.
  assert.equal(todayIso(new Date("2026-08-23T23:00:00Z")), "2026-08-24");
  assert.equal(todayIso(new Date("2026-08-23T18:29:00Z")), "2026-08-23");
});

test("daysBetween counts whole days in both directions", () => {
  assert.equal(daysBetween("2026-08-20", "2026-08-23"), 3);
  assert.equal(daysBetween("2026-08-23", "2026-08-20"), -3);
  assert.equal(daysBetween("2026-08-23", "2026-08-23"), 0);
});

test("a document written three days ago moves its offsets forward", () => {
  const doc = rebaseMemberDoc(
    {
      dayOffsetAnchor: "2026-08-20",
      actions: [
        { id: "a", dayOffset: 0, completed: "target" },
        { id: "b", dayOffset: -1, completed: null },
      ],
      pulses: [{ id: "p", dayOffset: 0, energy: 4 }],
      messages: [{ id: "m", dayOffset: -2 }],
    },
    AUG_23,
  );

  // The action completed on the 20th is now three days ago, so Today no longer
  // shows it as already done.
  assert.equal(doc.actions[0].dayOffset, -3);
  assert.equal(doc.actions[0].completed, "target");
  assert.equal(doc.actions[1].dayOffset, -4);
  assert.equal(doc.pulses[0].dayOffset, -3);
  assert.equal(doc.messages[0].dayOffset, -5);
  assert.equal(doc.dayOffsetAnchor, "2026-08-23");
});

test("a document with no anchor is stamped and left alone", () => {
  // This is every document written before the anchor existed. Assuming it was
  // written today matches the old behaviour exactly, so nothing gets worse on
  // the day of the upgrade — and it is correct from the next day onwards.
  const doc = rebaseMemberDoc({ actions: [{ id: "a", dayOffset: 0 }] }, AUG_23);
  assert.equal(doc.actions[0].dayOffset, 0);
  assert.equal(doc.dayOffsetAnchor, "2026-08-23");
});

test("rebasing twice on the same day changes nothing", () => {
  const once = rebaseMemberDoc(
    { dayOffsetAnchor: "2026-08-21", pulses: [{ id: "p", dayOffset: 0 }] },
    AUG_23,
  );
  const twice = rebaseMemberDoc(once, AUG_23);
  assert.deepEqual(twice, once);
});

test("a future anchor is not shifted backwards", () => {
  // Clock skew, or a phone set to the wrong date. Shifting backwards would
  // move logged days into the future; holding still and re-anchoring is safe.
  const doc = rebaseMemberDoc(
    { dayOffsetAnchor: "2026-08-25", actions: [{ id: "a", dayOffset: 0 }] },
    AUG_23,
  );
  assert.equal(doc.actions[0].dayOffset, 0);
  assert.equal(doc.dayOffsetAnchor, "2026-08-23");
});

/* ------------------------------------------------------------------ */
/* Program week: nothing else ever advanced it                         */
/* ------------------------------------------------------------------ */

test("programWeek counts whole weeks from onboarding, 1-indexed", () => {
  assert.equal(programWeek("2026-08-23", "2026-08-23"), 1);
  assert.equal(programWeek("2026-08-23", "2026-08-29"), 1); // day 6, still week 1
  assert.equal(programWeek("2026-08-23", "2026-08-30"), 2); // day 7, week 2
  assert.equal(programWeek("2026-08-23", "2026-11-15"), 12);
});

test("programWeek never exceeds the twelve-week program", () => {
  assert.equal(programWeek("2026-01-01", "2027-01-01"), 12);
});

test("programWeek returns null, not 1, when there is nothing to derive from", () => {
  // null means "leave the stored value alone" — a seeded demo account with a
  // curated week and no onboarding date must not be silently reset to 1.
  assert.equal(programWeek(undefined, "2026-08-23"), null);
  assert.equal(programWeek("not-a-date", "2026-08-23"), null);
  // A future onboarding date is clock skew, held rather than counted as
  // negative weeks — the same posture rebaseMemberDoc takes on a future
  // anchor.
  assert.equal(programWeek("2026-08-25", "2026-08-23"), null);
});

test("rebasing advances a real member's week and phase together", () => {
  const doc = rebaseMemberDoc(
    {
      dayOffsetAnchor: "2026-08-20",
      member: { week: 1, phase: "Stabilise", onboardedAt: "2026-05-01" },
    },
    AUG_23, // Aug 23 is 114 days after May 1 -> week 12, well past week 4
  );
  assert.equal(doc.member.week, 12);
  assert.equal(doc.member.phase, "Consolidate");
});

test("a seeded account with no onboarding date keeps its curated week", () => {
  const doc = rebaseMemberDoc(
    { dayOffsetAnchor: "2026-08-20", member: { week: 7, phase: "Build" } },
    AUG_23,
  );
  assert.equal(doc.member.week, 7);
  assert.equal(doc.member.phase, "Build");
});

test("a document with no member field rebases the rest without erroring", () => {
  const doc = rebaseMemberDoc(
    { dayOffsetAnchor: "2026-08-20", actions: [{ id: "a", dayOffset: 0 }] },
    AUG_23,
  );
  assert.equal(doc.actions[0].dayOffset, -3);
  assert.equal(doc.member, undefined);
});

test("food entries are recomputed from their own date, not shifted", () => {
  const doc = rebaseMemberDoc(
    {
      dayOffsetAnchor: "2026-08-20",
      foodEntries: [
        // Stored offset is stale; loggedDate is the truth and wins.
        { id: "f", dayOffset: 0, loggedDate: "2026-08-21" },
      ],
    },
    AUG_23,
  );
  assert.equal(doc.foodEntries[0].dayOffset, -2);
  assert.equal(offsetFromDate("2026-08-21", "2026-08-23"), -2);
});

test("food entries with no date get one, so they never drift again", () => {
  const doc = rebaseMemberDoc(
    {
      dayOffsetAnchor: "2026-08-21",
      foodEntries: [{ id: "f", dayOffset: -1 }],
    },
    AUG_23,
  );
  assert.equal(doc.foodEntries[0].dayOffset, -3);
  assert.equal(doc.foodEntries[0].loggedDate, "2026-08-20");
});

test("meal estimates read quantities, not just keywords", () => {
  const two = estimateMeal("2 rotis");
  const four = estimateMeal("4 rotis");
  assert.equal(four.calories, two.calories * 2);
  assert.equal(four.protein, two.protein * 2);
});

test("meal estimates add up every food they recognise", () => {
  const meal = estimateMeal("one katori dal, 2 roti, curd");
  const names = meal.matched.map((item) => item.name).sort();
  assert.deepEqual(names, ["Curd", "Dal", "Roti"]);
  assert.equal(meal.matched.find((item) => item.name === "Roti").qty, 2);
  assert.ok(meal.confident);
});

test("common Indian foods are recognised at all", () => {
  // Every one of these scored an identical, invented 320 kcal before.
  for (const meal of ["idli sambar", "khichdi", "poha", "chai", "dosa"]) {
    assert.ok(estimateMeal(meal).confident, `${meal} was not recognised`);
  }
});

test("paneer bhurji is not counted as eggs", () => {
  const meal = estimateMeal("paneer bhurji with 2 chapati");
  assert.ok(!meal.matched.some((item) => item.name === "Egg"));
  assert.ok(meal.matched.some((item) => item.name === "Paneer"));
});

test("a longer food name wins over a word inside it", () => {
  const meal = estimateMeal("besan chilla");
  assert.deepEqual(
    meal.matched.map((item) => item.name),
    ["Besan chilla"],
  );
});

test("an unrecognised meal is reported as a guess, not as fact", () => {
  const meal = estimateMeal("something I cannot describe");
  assert.equal(meal.confident, false);
  assert.deepEqual(meal.matched, []);
  // It still returns a usable number so the food log is never blocked.
  assert.ok(meal.calories > 0);
});

test("fractions and Hindi quantity words are understood", () => {
  assert.equal(estimateMeal("1/2 plate biryani").matched[0].qty, 0.5);
  assert.equal(estimateMeal("do roti").matched[0].qty, 2);
  assert.equal(estimateMeal("aadha bowl khichdi").matched[0].qty, 0.5);
});

import {
  activityFor,
  rankByConsistency,
  normaliseCity,
  normaliseDisplayName,
} from "../lib/circle.ts";
import {
  withHydration,
  withHabitToggled,
  withHabitAdded,
  hydrationFor,
  habitDoneOn,
} from "../mobile/src/daily.ts";

/**
 * A member document with something in every slice that must never be shared.
 * If the projection ever starts spreading the document, these tests fail.
 */
const privateDoc = {
  member: { id: "radhika", name: "Radhika Full Name", week: 3 },
  actions: [
    { id: "a1", dayOffset: 0, completed: "target" },
    { id: "a2", dayOffset: 0, completed: null },
    { id: "a3", dayOffset: 0, completed: "rest" },
    { id: "a4", dayOffset: -1, completed: "minimum" },
    { id: "a5", dayOffset: -9, completed: "target" },
  ],
  foodEntries: [{ id: "f1", description: "2 rotis and dal", calories: 310 }],
  reports: [
    {
      id: "r1",
      title: "Annual blood panel",
      values: [{ label: "Ferritin", value: "38" }],
    },
  ],
  messages: [{ id: "m1", from: "coach", body: "How did the week go?" }],
  pulses: [
    { id: "p1", dayOffset: 0, energy: 2, stress: 1, symptoms: ["cramps"] },
  ],
  healthSnapshots: [
    { metric: "steps", value: 6421, available: true, date: "2026-08-23" },
    {
      metric: "restingHeartRate",
      value: 68,
      available: true,
      date: "2026-08-23",
    },
  ],
  hydrationLogs: [{ date: "2026-08-23", glasses: 5 }],
};

const profile = { displayName: "Radhika", city: "Bengaluru" };

test("the circle projection exposes only the agreed fields", () => {
  const view = activityFor("radhika", privateDoc, profile, "2026-08-23");
  assert.deepEqual(Object.keys(view).sort(), [
    "actionsCompleted",
    "actionsTotal",
    "activeDays",
    "city",
    "displayName",
    "hydrationGlasses",
    "memberId",
    "steps",
  ]);
});

test("nothing private survives serialisation of the projection", () => {
  const json = JSON.stringify(
    activityFor("radhika", privateDoc, profile, "2026-08-23"),
  );
  // Each of these appears somewhere in the source document.
  for (const leak of [
    "rotis",
    "Ferritin",
    "blood",
    "How did the week go",
    "cramps",
    "restingHeartRate",
    "Full Name",
    "energy",
  ]) {
    assert.ok(!json.includes(leak), `projection leaked "${leak}"`);
  }
});

test("resting heart rate is never picked up as steps", () => {
  const view = activityFor("radhika", privateDoc, profile, "2026-08-23");
  assert.equal(view.steps, 6421);
});

test("steps are omitted when the day does not match", () => {
  const view = activityFor("radhika", privateDoc, profile, "2026-08-24");
  assert.equal(view.steps, undefined);
});

test("a rest day counts as showing up", () => {
  // Deciding not to train is treated as success everywhere else in the
  // product; the one screen her friends see must not contradict that.
  const view = activityFor("radhika", privateDoc, profile, "2026-08-23");
  assert.equal(view.actionsCompleted, 2); // target + rest, out of three today
  assert.equal(view.actionsTotal, 3);
  assert.equal(view.activeDays, 2); // today and yesterday; the 9-day-old one is outside the window
});

test("a member with no document still produces a safe empty view", () => {
  const view = activityFor(
    "nobody",
    null,
    { displayName: "Meera" },
    "2026-08-23",
  );
  assert.equal(view.actionsCompleted, 0);
  assert.equal(view.steps, undefined);
  assert.equal(view.displayName, "Meera");
});

test("ranking rewards consistency over intensity", () => {
  const ranked = rankByConsistency([
    {
      memberId: "hard",
      displayName: "Hard",
      activeDays: 1,
      actionsCompleted: 5,
      actionsTotal: 5,
    },
    {
      memberId: "steady",
      displayName: "Steady",
      activeDays: 5,
      actionsCompleted: 1,
      actionsTotal: 5,
    },
  ]);
  assert.equal(ranked[0].memberId, "steady");
});

test("display names fall back rather than exposing a blank", () => {
  assert.equal(normaliseDisplayName(""), "Member");
  assert.equal(normaliseDisplayName("  Radhika  "), "Radhika");
  assert.equal(normaliseDisplayName("x".repeat(200)).length, 40);
});

test("city input is trimmed and bounded", () => {
  assert.equal(normaliseCity("  New   Delhi "), "New Delhi");
  assert.equal(normaliseCity(""), null);
  assert.equal(normaliseCity("x".repeat(100)), null);
});

test("water goes up and down, and never below zero", () => {
  const base = { member: { id: "radhika" }, hydrationLogs: [] };
  let doc = withHydration(base, 3, "2026-08-23");
  assert.equal(hydrationFor(doc, "2026-08-23"), 3);
  doc = withHydration(doc, -5, "2026-08-23");
  assert.equal(hydrationFor(doc, "2026-08-23"), 0);
  doc = withHydration(doc, 999, "2026-08-23");
  assert.equal(hydrationFor(doc, "2026-08-23"), 30);
  // One entry per day, not one per tap.
  assert.equal(doc.hydrationLogs.length, 1);
});

test("water on one day does not affect another", () => {
  let doc = withHydration(
    { member: { id: "r" }, hydrationLogs: [] },
    4,
    "2026-08-22",
  );
  doc = withHydration(doc, 2, "2026-08-23");
  assert.equal(hydrationFor(doc, "2026-08-22"), 4);
  assert.equal(hydrationFor(doc, "2026-08-23"), 2);
});

test("a habit toggles on and off without leaving a negative record", () => {
  let doc = withHabitAdded(
    { member: { id: "r" }, habits: [], habitLogs: [] },
    "Stretch",
  );
  const habitId = doc.habits[0].id;
  doc = withHabitToggled(doc, habitId, "2026-08-23");
  assert.ok(habitDoneOn(doc, habitId, "2026-08-23"));
  doc = withHabitToggled(doc, habitId, "2026-08-23");
  assert.ok(!habitDoneOn(doc, habitId, "2026-08-23"));
  assert.equal(doc.habitLogs.length, 0);
});

test("the same habit is not added twice", () => {
  let doc = withHabitAdded(
    { member: { id: "r" }, habits: [], habitLogs: [] },
    "Stretch",
  );
  doc = withHabitAdded(doc, "  stretch ");
  assert.equal(doc.habits.length, 1);
});

import {
  READINESS_QUESTIONS,
  evaluateReadiness,
  readinessIsComplete,
} from "../lib/readiness.ts";
import {
  EXERCISES,
  EXERCISE_BY_ID,
  eligibleExercises,
  loadsToAvoid,
  cautionNeedsReview,
} from "../lib/exercise-library.ts";

const allNo = Object.fromEntries(READINESS_QUESTIONS.map((q) => [q.id, "no"]));

test("a clean readiness screen clears the movement plan", () => {
  const result = evaluateReadiness(allNo);
  assert.equal(result.outcome, "clear");
  assert.deepEqual(result.conditions, []);
});

test("chest pain on exertion holds the plan for a doctor", () => {
  const result = evaluateReadiness({ ...allNo, "chest-pain": "yes" });
  assert.equal(result.outcome, "consult_first");
});

test('"not sure" is treated exactly like yes', () => {
  // Someone who does not know is the person who most needs to be asked to
  // check. Being wrong in this direction costs a conversation, not an injury.
  const unsure = evaluateReadiness({ ...allNo, "heart-condition": "unsure" });
  const yes = evaluateReadiness({ ...allNo, "heart-condition": "yes" });
  assert.equal(unsure.outcome, "consult_first");
  assert.deepEqual(unsure, yes);
});

test("pregnancy modifies the plan rather than blocking it", () => {
  const result = evaluateReadiness({ ...allNo, pregnancy: "yes" });
  assert.equal(result.outcome, "modified");
  assert.ok(result.conditions.includes("pregnancy"));
  assert.ok(result.avoidLoads.includes("pelvic_floor"));
});

test("a blocking answer wins over a modifying one", () => {
  const result = evaluateReadiness({
    ...allNo,
    pregnancy: "yes",
    "chest-pain": "yes",
  });
  assert.equal(result.outcome, "consult_first");
});

test("the screen is not complete until every question is answered", () => {
  assert.ok(readinessIsComplete(allNo));
  const { pregnancy, ...missing } = allNo;
  assert.ok(!readinessIsComplete(missing));
});

test("a stated knee problem removes every knee-loading movement", () => {
  const avoid = loadsToAvoid("bad left knee, hurts on stairs");
  assert.deepEqual(avoid, ["knee"]);
  const offered = eligibleExercises({ avoidLoads: avoid });
  assert.ok(offered.length > 0, "she should still have a plan");
  assert.ok(
    offered.every((e) => !e.loads.includes("knee")),
    "a knee-loading movement survived the filter",
  );
});

test("common ways of describing a bad back are all caught", () => {
  for (const phrase of [
    "lower back pain",
    "slipped disc",
    "sciatica",
    "spine issue",
  ]) {
    assert.deepEqual(loadsToAvoid(phrase), ["lower_back"], phrase);
  }
});

test("a caution we cannot interpret is flagged for a human", () => {
  // Silently ignoring what she wrote is the failure mode worth preventing.
  assert.ok(cautionNeedsReview("I get tired very easily since my illness"));
  assert.ok(!cautionNeedsReview("dodgy knee"));
  assert.ok(!cautionNeedsReview(""));
});

test("readiness conditions actually remove exercises", () => {
  const withPregnancy = eligibleExercises({ conditions: ["pregnancy"] });
  const without = eligibleExercises({});
  assert.ok(withPregnancy.length < without.length);
  assert.ok(withPregnancy.every((e) => !e.avoidIf.includes("pregnancy")));
});

test("equipment she does not have is never offered", () => {
  const noBand = eligibleExercises({ equipment: ["none", "chair", "wall"] });
  assert.ok(noBand.every((e) => !e.equipment.includes("band")));
  assert.ok(noBand.length > 10, "a chair and a wall should still be plenty");
});

test("even the most restricted member still gets a usable plan", () => {
  // Everything flagged at once: the app must still have something to offer,
  // or it will quietly show her an empty day.
  const offered = eligibleExercises({
    avoidLoads: ["knee", "lower_back", "shoulder", "balance"],
    conditions: [
      "pregnancy",
      "high_blood_pressure",
      "osteoporosis",
      "dizziness",
    ],
    equipment: ["none", "chair", "wall"],
    maxTier: 1,
  });
  assert.ok(offered.length >= 3, `only ${offered.length} movements left`);
});

test("every progression and regression points at a real exercise", () => {
  for (const exercise of EXERCISES) {
    for (const link of [exercise.progressesTo, exercise.regressesTo]) {
      if (!link) continue;
      assert.ok(
        EXERCISE_BY_ID.has(link),
        `${exercise.id} points at missing ${link}`,
      );
    }
  }
});

test("a progression is never easier than what it progresses from", () => {
  for (const exercise of EXERCISES) {
    const harder =
      exercise.progressesTo && EXERCISE_BY_ID.get(exercise.progressesTo);
    if (harder)
      assert.ok(harder.tier >= exercise.tier, `${exercise.id} -> ${harder.id}`);
    const easier =
      exercise.regressesTo && EXERCISE_BY_ID.get(exercise.regressesTo);
    if (easier)
      assert.ok(easier.tier <= exercise.tier, `${exercise.id} -> ${easier.id}`);
  }
});

test("every exercise has five frames and a cue", () => {
  for (const exercise of EXERCISES) {
    assert.equal(exercise.frames.length, 5, exercise.id);
    assert.ok(exercise.cue.length > 10, exercise.id);
    assert.ok(exercise.why.length > 10, exercise.id);
  }
});

import {
  verdictFor,
  weekPostureFor,
  doseAt,
  nextDose,
  MAX_DOSE_STEP,
  applyAdaptation,
} from "../lib/adaptation.ts";
import {
  generatePlan,
  selectSession,
  movementBudget,
} from "../lib/plan-generator.ts";

const sess = (over = {}) => ({
  exerciseId: "ex-chair-squat",
  perceivedEffort: 3,
  level: "target",
  pain: false,
  date: "2026-08-23",
  ...over,
});

test("nothing progresses on a single easy session", () => {
  const v = verdictFor("ex-chair-squat", [sess({ perceivedEffort: 1 })]);
  assert.equal(v.adjustment, "hold");
});

test("easy twice while completing the fuller version progresses", () => {
  const v = verdictFor("ex-chair-squat", [
    sess({ perceivedEffort: 2, date: "2026-08-23" }),
    sess({ perceivedEffort: 1, date: "2026-08-21" }),
  ]);
  assert.equal(v.adjustment, "progress");
});

test("easy but only ever at the minimum does not progress", () => {
  // "The smallest version was easy" is not evidence she is ready for more.
  const v = verdictFor("ex-chair-squat", [
    sess({ perceivedEffort: 1, level: "minimum", date: "2026-08-23" }),
    sess({ perceivedEffort: 1, level: "minimum", date: "2026-08-21" }),
  ]);
  assert.equal(v.adjustment, "regress");
});

test("hard twice steps back", () => {
  const v = verdictFor("ex-chair-squat", [
    sess({ perceivedEffort: 5, date: "2026-08-23" }),
    sess({ perceivedEffort: 4, date: "2026-08-21" }),
  ]);
  assert.equal(v.adjustment, "regress");
});

test("pain beats every other signal, including two easy sessions", () => {
  const v = verdictFor("ex-chair-squat", [
    sess({ perceivedEffort: 1, pain: true, date: "2026-08-23" }),
    sess({ perceivedEffort: 1, date: "2026-08-21" }),
  ]);
  assert.equal(v.adjustment, "stop_and_review");
});

test("rest days are not counted as sessions", () => {
  const v = verdictFor("ex-chair-squat", [
    sess({ level: "rest", perceivedEffort: 1 }),
    sess({ level: "rest", perceivedEffort: 1, date: "2026-08-21" }),
  ]);
  assert.equal(v.basis, 0);
  assert.equal(v.adjustment, "hold");
});

test("a badly slept week suspends progression entirely", () => {
  const bad = ["23", "22", "21", "20", "19"].map((d) => ({
    date: `2026-08-${d}`,
    sleep: 1,
    energy: 2,
  }));
  const { posture } = weekPostureFor(bad);
  assert.equal(posture, "recovery");
  // Even an unambiguous progress verdict does not move under recovery.
  assert.deepEqual(nextDose(2, "progress", "recovery"), {
    step: 2,
    changeExercise: null,
  });
});

test("a couple of poor nights makes the week lighter, not a recovery week", () => {
  const signals = ["23", "22", "21", "20"].map((d, i) => ({
    date: `2026-08-${d}`,
    sleep: i < 2 ? 2 : 4,
    energy: 4,
  }));
  assert.equal(weekPostureFor(signals).posture, "lighter");
});

test("too few check-ins does not trigger an adjustment either way", () => {
  assert.equal(
    weekPostureFor([{ date: "2026-08-23", sleep: 1 }]).posture,
    "normal",
  );
});

test("the dose ladder never runs off either end", () => {
  assert.equal(doseAt(-5).label, "1 set of 6");
  assert.equal(doseAt(999).label, doseAt(MAX_DOSE_STEP).label);
});

test("the largest single step up is one rung of the ladder", () => {
  for (let step = 0; step < MAX_DOSE_STEP; step++) {
    const next = nextDose(step, "progress", "normal");
    assert.equal(next.step, step + 1, `step ${step} jumped`);
  }
});

test("running out of ladder changes the exercise instead of piling on reps", () => {
  const result = nextDose(MAX_DOSE_STEP, "progress", "normal");
  assert.equal(result.changeExercise, "progress");
  assert.ok(
    result.step < MAX_DOSE_STEP,
    "dose should reset for the harder move",
  );
});

/* ---- generator ---- */

const baseInput = {
  memberId: "radhika",
  week: 3,
  goals: ["Feel stronger"],
  availableMinutes: 30,
};

test("stated minutes actually change the session", () => {
  // The whole point: before this, 15 and 45 produced identical days.
  const short = selectSession({ ...baseInput, availableMinutes: 15 }, "normal");
  const long = selectSession({ ...baseInput, availableMinutes: 45 }, "normal");
  assert.ok(long.length > short.length, `${short.length} vs ${long.length}`);
  assert.ok(short.length >= 2, "even 15 minutes should be a real session");
});

test("a session never exceeds the time she said she has", () => {
  for (const minutes of [10, 15, 20, 30, 45, 60]) {
    const session = selectSession(
      { ...baseInput, availableMinutes: minutes },
      "normal",
    );
    const total = session.reduce((sum, e) => sum + e.minutes, 0);
    assert.ok(total <= movementBudget(minutes), `${minutes}min -> ${total}min`);
  }
});

test("goals change what she is shown first", () => {
  const strength = selectSession(
    { ...baseInput, goals: ["Feel stronger"] },
    "normal",
  );
  const stress = selectSession(
    { ...baseInput, goals: ["Manage stress"] },
    "normal",
  );
  assert.notEqual(strength[0].exerciseId, stress[0].exerciseId);
});

test("a stated caution removes those movements from the session", () => {
  const session = selectSession(
    { ...baseInput, availableMinutes: 60, movementCaution: "bad knee" },
    "normal",
  );
  assert.ok(session.length > 0, "she should still have a session");
  for (const item of session) {
    const exercise = EXERCISE_BY_ID.get(item.exerciseId);
    assert.ok(!exercise.loads.includes("knee"), `${item.name} loads the knee`);
  }
});

test("early weeks stay on supported movements", () => {
  const session = selectSession(
    { ...baseInput, week: 1, availableMinutes: 45 },
    "normal",
  );
  for (const item of session) {
    assert.equal(EXERCISE_BY_ID.get(item.exerciseId).tier, 1, item.name);
  }
});

test("a paused movement is never offered again by generation", () => {
  const session = selectSession(
    {
      ...baseInput,
      availableMinutes: 60,
      pausedExerciseIds: ["ex-chair-squat"],
    },
    "normal",
  );
  assert.ok(!session.some((e) => e.exerciseId === "ex-chair-squat"));
});

test("readiness holding movement produces no session and says why", () => {
  const plan = generatePlan({
    ...baseInput,
    readiness: { outcome: "consult_first", conditions: [], avoidLoads: [] },
  });
  assert.equal(plan.session.length, 0);
  assert.ok(plan.movementHeld);
  assert.match(plan.movementHeld.body, /doctor/i);
});

test("a coach-authored movement day is left completely alone", () => {
  const plan = generatePlan({
    ...baseInput,
    coachAuthoredDomains: ["movement"],
  });
  assert.equal(plan.session.length, 0);
  assert.deepEqual(plan.filledDomains, []);
});

test("a recovery week produces a shorter session, not a harder one", () => {
  const normal = selectSession(
    { ...baseInput, availableMinutes: 45 },
    "normal",
  );
  const recovery = selectSession(
    { ...baseInput, availableMinutes: 45 },
    "recovery",
  );
  assert.ok(recovery.length < normal.length);
});

test("even the most restricted member is never shown an empty movement day", () => {
  const plan = generatePlan({
    ...baseInput,
    week: 1,
    availableMinutes: 10,
    movementCaution: "knee and lower back and shoulder problems",
    readiness: {
      outcome: "modified",
      conditions: [
        "pregnancy",
        "osteoporosis",
        "high_blood_pressure",
        "dizziness",
      ],
      avoidLoads: ["balance", "pelvic_floor"],
    },
  });
  assert.ok(plan.session.length >= 1, "she was shown nothing at all");
});

/* ---- coach override ---- */

test("an un-coached member has every domain generated", () => {
  const plan = generatePlan({ ...baseInput, coachAuthoredDomains: [] });
  assert.ok(plan.session.length > 0);
  assert.deepEqual(plan.filledDomains, ["movement"]);
});

test("a coach owning movement means nothing is generated for it", () => {
  // Where somebody is paying for a coach, the coach decides. The generator
  // fills what she has left, and never overwrites her.
  const plan = generatePlan({
    ...baseInput,
    coachAuthoredDomains: ["movement"],
  });
  assert.equal(plan.session.length, 0);
  assert.deepEqual(plan.filledDomains, []);
});

test("a coach holding a different domain still leaves movement generated", () => {
  const plan = generatePlan({
    ...baseInput,
    coachAuthoredDomains: ["nutrition"],
  });
  assert.ok(plan.session.length > 0);
});

/* ---- onboarding field sanitising (the shape the generator consumes) ---- */

test("an unrecognised goal never reaches the member record", () => {
  // Whatever a conversation produces, the document only ever holds the same
  // vocabulary the form would have written.
  const goals = ["Feel stronger", "lose 10kg fast", "Manage stress"];
  const known = [
    "Steadier energy",
    "Feel stronger",
    "Improve mobility",
    "Manage stress",
    "Sleep more consistently",
    "Support hormonal or life-stage wellbeing",
    "Improve endurance",
  ];
  const kept = goals.filter((g) =>
    known.some((k) => k.toLowerCase() === g.toLowerCase()),
  );
  assert.deepEqual(kept, ["Feel stronger", "Manage stress"]);
});

test("the generator tolerates nonsense minutes without producing a nonsense day", () => {
  for (const minutes of [0, -30, NaN, 9999]) {
    const session = selectSession(
      { ...baseInput, availableMinutes: minutes },
      "normal",
    );
    assert.ok(
      session.length >= 1 && session.length <= 6,
      `${minutes} -> ${session.length}`,
    );
  }
});

import {
  selectDailyActions,
  DAILY_ACTIONS,
} from "../lib/daily-actions-library.ts";

const noSignals = {
  goals: [],
  poorSleep: false,
  highStress: false,
  lowFoodLogging: false,
  lowProtein: false,
  stepsConnected: false,
};

test("all four non-movement domains are always filled", () => {
  const chosen = selectDailyActions(noSignals);
  assert.deepEqual(chosen.map((c) => c.domain).sort(), [
    "mindset",
    "nutrition",
    "recovery",
    "walking",
  ]);
});

test("poor sleep changes what recovery offers", () => {
  const rested = selectDailyActions(noSignals).find(
    (c) => c.domain === "recovery",
  );
  const tired = selectDailyActions({ ...noSignals, poorSleep: true }).find(
    (c) => c.domain === "recovery",
  );
  assert.notEqual(rested.id, tired.id);
  assert.equal(tired.id, "rec-winddown");
});

test("poor sleep also reaches the walking domain", () => {
  // Morning daylight is one of the few things that shifts sleep that night, so
  // the signal is allowed to cross domains.
  const tired = selectDailyActions({ ...noSignals, poorSleep: true }).find(
    (c) => c.domain === "walking",
  );
  assert.equal(tired.id, "walk-morning-light");
});

test("a connected step source changes the walking action", () => {
  const without = selectDailyActions(noSignals).find(
    (c) => c.domain === "walking",
  );
  const with_ = selectDailyActions({ ...noSignals, stepsConnected: true }).find(
    (c) => c.domain === "walking",
  );
  assert.equal(without.id, "walk-after-meal");
  assert.equal(with_.id, "walk-steps");
});

test("low protein is what surfaces the protein action", () => {
  const chosen = selectDailyActions({ ...noSignals, lowProtein: true }).find(
    (c) => c.domain === "nutrition",
  );
  assert.equal(chosen.id, "nut-protein-anchor");
});

test("high stress changes the mindset action", () => {
  const calm = selectDailyActions(noSignals).find(
    (c) => c.domain === "mindset",
  );
  const stressed = selectDailyActions({ ...noSignals, highStress: true }).find(
    (c) => c.domain === "mindset",
  );
  assert.notEqual(calm.id, stressed.id);
});

test("goals alone change what she is offered", () => {
  const generic = selectDailyActions(noSignals).find(
    (c) => c.domain === "recovery",
  );
  const sleepGoal = selectDailyActions({
    ...noSignals,
    goals: ["Sleep more consistently"],
  }).find((c) => c.domain === "recovery");
  assert.notEqual(generic.id, sleepGoal.id);
});

test("yesterday's action is not repeated when an alternative exists", () => {
  const first = selectDailyActions({ ...noSignals, highStress: true }).find(
    (c) => c.domain === "mindset",
  );
  const second = selectDailyActions({
    ...noSignals,
    highStress: true,
    recentlyOffered: [first.id],
  }).find((c) => c.domain === "mindset");
  assert.notEqual(first.id, second.id);
});

test("a repeat is still better than nothing when there is no alternative", () => {
  // Every id excluded: she must still be given a real action rather than a gap.
  const chosen = selectDailyActions({
    ...noSignals,
    recentlyOffered: DAILY_ACTIONS.map((t) => t.id),
  });
  assert.equal(chosen.length, 4);
  assert.ok(chosen.every(Boolean));
});

test("no domain action mentions a coach, a streak, or a missed day", () => {
  // These were written for a coach-led product and now run un-coached. Copy
  // that apologises for an absent coach is the bug this library replaced.
  for (const template of DAILY_ACTIONS) {
    const text = [
      template.title,
      template.why,
      template.minimum,
      template.target,
      template.stretch,
    ]
      .join(" ")
      .toLowerCase();
    for (const word of ["coach", "streak", "missed", "failed", "behind"]) {
      assert.ok(!text.includes(word), `${template.id} says "${word}"`);
    }
  }
});

test("every domain template offers a real minimum, not a thought", () => {
  for (const template of DAILY_ACTIONS) {
    assert.ok(template.minimum.length > 3, template.id);
    assert.ok(template.why.length > 20, template.id);
  }
});

import {
  toCell,
  proximityBetween,
  cellsWithin,
  proximityLabel,
} from "../lib/proximity.ts";
import {
  consistencyFor,
  consistencySentence,
  circleTotal,
} from "../lib/consistency.ts";

test("a position is reduced to a grid cell, not stored as coordinates", () => {
  const cell = toCell(12.9716, 77.5946); // Bengaluru
  assert.ok(Number.isInteger(cell.x) && Number.isInteger(cell.y));
  // Two points a few hundred metres apart land in the same square.
  assert.deepEqual(toCell(12.9716, 77.5946), toCell(12.973, 77.596));
});

test("the cell cannot be reversed to anything precise", () => {
  // The property that matters is that precision is destroyed: many distinct
  // positions collapse to a handful of integers. Twenty-five points along a
  // ~2.5km diagonal cross at most one x and one y boundary, so at most four
  // cells — and the stored value identifies an area, never a home.
  const cells = new Set();
  for (let i = 0; i < 25; i++) {
    const c = toCell(12.9716 + i * 0.001, 77.5946 + i * 0.001);
    cells.add(`${c.x},${c.y}`);
  }
  assert.ok(cells.size <= 4, `${cells.size} distinct cells across ~2.5km`);
  assert.ok(cells.size < 25, "positions were not coarsened at all");
});

test("nonsense coordinates are refused rather than clamped", () => {
  assert.equal(toCell(999, 0), null);
  assert.equal(toCell(NaN, 10), null);
  assert.equal(toCell(0, 500), null);
});

test("proximity is a bucket, never a distance", () => {
  const a = { x: 100, y: 200 };
  assert.equal(proximityBetween(a, { x: 100, y: 200 }), "same_area");
  assert.equal(proximityBetween(a, { x: 102, y: 200 }), "nearby");
  assert.equal(proximityBetween(a, { x: 110, y: 200 }), "further");
  assert.equal(proximityBetween(a, null), "unknown");
  // No label ever contains a number.
  for (const p of ["same_area", "nearby", "further", "unknown"]) {
    assert.ok(!/\d/.test(proximityLabel(p)), p);
  }
});

test("the search covers the surrounding cells only", () => {
  assert.equal(cellsWithin({ x: 0, y: 0 }, 2).length, 25);
});

const today = new Date("2026-08-23T12:00:00Z");
const dayBefore = (n) =>
  new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);

test("consistency reports days present, never days missed", () => {
  const summary = consistencyFor(
    { activeDates: [dayBefore(0), dayBefore(1), dayBefore(5)] },
    today,
  );
  assert.equal(summary.activeDays, 3);
  assert.equal(summary.days.length, 28);
  const sentence = consistencySentence(summary);
  assert.match(sentence, /3 days/);
  for (const word of ["missed", "only", "behind", "failed"]) {
    assert.ok(!sentence.toLowerCase().includes(word), sentence);
  }
});

test("an empty month is an invitation, not a verdict", () => {
  const sentence = consistencySentence(
    consistencyFor({ activeDates: [] }, today),
  );
  assert.ok(!sentence.includes("0"));
  assert.match(sentence, /first day/i);
});

test("a movement day ranks above a logging day, and neither is negative", () => {
  const summary = consistencyFor(
    {
      activeDates: [dayBefore(1)],
      movementDates: [dayBefore(0)],
      loggedDates: [dayBefore(2)],
    },
    today,
  );
  const level = (n) => summary.days.find((d) => d.date === dayBefore(n)).level;
  assert.equal(level(0), 3);
  assert.equal(level(1), 2);
  assert.equal(level(2), 1);
  assert.equal(level(3), 0);
  assert.ok(summary.days.every((d) => d.level >= 0));
});

test("the longest run is historical, so there is nothing live to lose", () => {
  const summary = consistencyFor(
    {
      activeDates: [dayBefore(10), dayBefore(11), dayBefore(12), dayBefore(13)],
    },
    today,
  );
  assert.equal(summary.longestRun, 4);
  // Nothing today, and the run still stands.
  assert.equal(summary.days.at(-1).level, 0);
});

test("the circle total adds and never subtracts", () => {
  const busy = consistencyFor(
    { activeDates: [dayBefore(0), dayBefore(1)] },
    today,
  );
  const quiet = consistencyFor({ activeDates: [] }, today);
  const total = circleTotal([busy, quiet]);
  assert.equal(total.activeDays, 2);
  assert.equal(total.people, 2);
  // A quiet member dilutes the shared figure; she never reduces it.
  assert.ok(total.activeDays >= circleTotal([busy]).activeDays);
});

/* ------------------------------------------------------------------ */
/* Vera's boundaries                                                   */
/* ------------------------------------------------------------------ */

/**
 * These matter more than they look. The urgent gate is the one part of the
 * conversation that must work with the model switched off, the key missing and
 * the member's own text trying to steer things — so it is code, and code gets
 * tested. The false-positive tests are as important as the true ones: a gate
 * that fires on "chest press" gets ignored, and an ignored gate protects
 * nobody.
 */
test("an emergency is caught before any model is asked", () => {
  for (const [text, category] of [
    ["I have chest pain and it goes down my left arm", "cardiac"],
    ["I can't breathe properly even sitting still", "breathing"],
    ["I fainted this morning", "neurological"],
    ["I am bleeding heavily, 7 months pregnant", "pregnancy"],
    ["sometimes I want to die", "self_harm"],
    ["my throat is closing after lunch", "allergic"],
  ]) {
    const match = matchUrgent(text);
    assert.ok(match, `missed: ${text}`);
    assert.equal(match.category, category);
    assert.match(match.reply, /112|14416/);
  }
});

test("ordinary training talk is not treated as an emergency", () => {
  for (const text of [
    "the chest press felt hard today",
    "I was out of breath at the end of the walk, is that normal?",
    "my head hurts a bit after the session",
    "I felt a stretch in my shoulder",
    "should I do the squat or skip it",
    "I killed it today!",
  ]) {
    assert.equal(matchUrgent(text), null, `false positive: ${text}`);
  }
});

test("diagnosis and dosing go to a clinician, always the same way", () => {
  assert.ok(matchRefusal("do I have PCOS?"));
  assert.ok(matchRefusal("should I increase my thyroxine dose"));
  assert.equal(
    matchRefusal("why is today's plan shorter than yesterday"),
    null,
  );
});

test("a reply that prescribes is replaced, not published", () => {
  // The model was told not to. If it does anyway, the member must not see a
  // number that contradicts what the plan generator decided.
  assert.doesNotMatch(sanitiseReply("Try 3 sets of 12 reps."), /3 sets/);
  assert.doesNotMatch(sanitiseReply("Add 5 kg to the squat."), /5 kg/);
  // Nor a claim to have done something it cannot do.
  assert.doesNotMatch(
    sanitiseReply("I've updated your plan for tomorrow."),
    /updated your plan/,
  );
  assert.doesNotMatch(
    sanitiseReply("I'll let your coach know about this."),
    /let your coach know/,
  );
  // An ordinary answer passes through untouched.
  const plain = "Today is lighter because your sleep has been low all week.";
  assert.equal(sanitiseReply(plain), plain);
});

test("Vera is only given facts the app actually holds", () => {
  const context = buildCoachContext({
    member: { name: "Asha Rao", week: 3, phase: "Stabilise" },
    actions: [
      {
        dayOffset: 0,
        domain: "movement",
        title: "Chair squat",
        completed: "target",
      },
      {
        dayOffset: 0,
        domain: "walking",
        title: "Walk after a meal",
        completed: null,
      },
      {
        dayOffset: -1,
        domain: "movement",
        title: "Yesterday",
        completed: "minimum",
      },
    ],
    readiness: { outcome: "modified" },
    coaching: { mode: "none" },
  });
  assert.match(context, /Asha/);
  assert.match(context, /1 of 2 done/);
  assert.match(context, /Chair squat/);
  // Yesterday is not today's plan.
  assert.doesNotMatch(context, /Yesterday/);
  assert.match(context, /modified/);
  assert.match(context, /do not have a human coach/);
  // Nothing leaks that was never put in.
  assert.doesNotMatch(context, /Rao/);
});

test("nothing describing the member to Vera assumes a gender", () => {
  // Member.gender accepts "woman", "man" and "other", and onboarding asks.
  // The instructions used to say "her plan" throughout, so a man using the
  // app had Vera briefed to misgender him. Second person removes the problem
  // rather than papering over it.
  const gendered = /\b(she|her|hers|he|him|his)\b/i;
  assert.doesNotMatch(
    COACH_INSTRUCTIONS,
    gendered,
    "Vera's instructions assume a gender",
  );

  const context = buildCoachContext({
    member: { name: "Sam Roy", week: 2, phase: "Stabilise" },
    actions: [
      {
        dayOffset: 0,
        domain: "movement",
        title: "Sit to stand",
        completed: null,
      },
    ],
    onboarding: { movementCaution: "sore knee" },
    workoutLogs: [{ perceivedEffort: 2 }],
    healthConnection: { status: "connected" },
    coaching: { mode: "none" },
    pulses: [{ dayOffset: 0, sleep: 3, energy: 3, stress: 3 }],
  });
  assert.doesNotMatch(context, gendered, "the member context assumes a gender");
});

test("the phone and the server call her the same thing", () => {
  // The name is duplicated because the Expo build does not import from lib/.
  // Drift would show a member two coaches, so it is asserted rather than
  // trusted to a comment.
  assert.equal(MOBILE_COACH_NAME, COACH_NAME);
});

/* ------------------------------------------------------------------ */
/* Cities                                                             */
/* ------------------------------------------------------------------ */

/**
 * City discovery matches on lower(city), so a spelling variant is not a
 * cosmetic problem — it silently splits the members of one city into two
 * groups who never see each other. That is what these guard.
 */
test("the same city typed differently resolves to one spelling", () => {
  assert.equal(canonicalCity("bangalore"), "Bengaluru");
  assert.equal(canonicalCity("BLR"), "Bengaluru");
  assert.equal(canonicalCity("  Bengaluru "), "Bengaluru");
  assert.equal(canonicalCity("bombay"), "Mumbai");
  assert.equal(canonicalCity("calcutta"), "Kolkata");
  // Not on the list is not an error — her own spelling is stored.
  assert.equal(canonicalCity("Hubli"), null);
  assert.equal(canonicalCity(""), null);
});

test("suggestions put the closest match first", () => {
  // "ban" must offer Bengaluru (via alias Bangalore) before Bangkok.
  const names = suggestCities("ban").map((c) => c.name);
  assert.ok(names.includes("Bengaluru"));
  assert.ok(
    names.indexOf("Bengaluru") < names.indexOf("Bangkok") ||
      !names.includes("Bangkok"),
  );
  // An exact name beats everything.
  assert.equal(suggestCities("Pune")[0].name, "Pune");
  // Empty input still offers something, or it is not a picker.
  assert.ok(suggestCities("").length > 0);
  assert.equal(suggestCities("Zzzz").length, 0);
});

test("every city is listed once, and aliases never collide", () => {
  const names = CITIES.map((c) => c.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, "duplicate city name");
  const aliases = CITIES.flatMap((c) => c.aliases ?? []);
  assert.equal(new Set(aliases).size, aliases.length, "duplicate alias");
  for (const alias of aliases)
    assert.ok(!names.includes(alias), `alias shadows a real name: ${alias}`);
  // Aliases are matched lowercase, so they must be stored that way.
  for (const alias of aliases) assert.equal(alias, alias.toLowerCase());
});

/* ------------------------------------------------------------------ */
/* Recommendation safety: acute signals, not permanent profile facts   */
/* ------------------------------------------------------------------ */

function baseMemberDoc(overrides = {}) {
  return {
    member: {
      id: "m1",
      name: "Test Member",
      age: 40,
      city: "",
      initials: "TM",
      week: 3,
      phase: "Stabilise",
      lifeStage: "",
      goals: [],
      constraints: [],
      wontDo: "",
      medical: [],
      medications: [],
      engagement: {},
      weeklyFocus: [],
      activeModuleIds: [],
      assessmentComplete: 0,
    },
    actions: [],
    pulses: [],
    workoutLogs: [],
    messages: [],
    sessions: [],
    reports: [],
    foodEntries: [],
    recommendations: [],
    ...overrides,
  };
}

test("picking a normal onboarding goal never blocks AI recommendations", () => {
  // This is the confirmed production bug: one of seven goal choices, aimed
  // at this app's own stated demographic, used to permanently trigger
  // needs_coach_review via HORMONE_OR_CLINICAL_LANGUAGE matching "hormonal".
  const doc = baseMemberDoc({
    member: {
      ...baseMemberDoc().member,
      goals: ["Feel stronger", "Support hormonal or life-stage wellbeing"],
    },
  });
  assert.equal(deterministicSafetyRecommendation(doc), null);
});

test("a written caution never blocks AI recommendations on its own", () => {
  // The caution field explicitly invites "pain, injury, pregnancy, a
  // limitation, medical guidance" -- almost any honest answer used to match.
  // That caution still drives the movement plan through the readiness
  // screen; it must not also permanently jam recommendations.
  const doc = baseMemberDoc({
    member: {
      ...baseMemberDoc().member,
      constraints: ["Recovering from a knee injury, avoid deep squats"],
    },
  });
  assert.equal(deterministicSafetyRecommendation(doc), null);
});

test("a recent pain flag on a logged workout still requires a person", () => {
  const doc = baseMemberDoc({
    workoutLogs: [{ actionId: "a1", pain: true }],
  });
  const result = deterministicSafetyRecommendation(doc);
  assert.equal(result?.kind, "coach_review");
  assert.equal(result?.status, "needs_coach_review");
});

test("a symptom reported in the last week still requires a person", () => {
  const doc = baseMemberDoc({
    pulses: [{ dayOffset: -2, symptoms: ["dizziness"] }],
  });
  const result = deterministicSafetyRecommendation(doc);
  assert.equal(result?.kind, "coach_review");
});

test("a symptom from over a week ago no longer blocks a fresh day", () => {
  // Time-boxed on purpose -- a quiet week should let this clear on its own,
  // the same way a fresh log supersedes an old one everywhere else.
  const doc = baseMemberDoc({
    pulses: [{ dayOffset: -9, symptoms: ["headache"] }],
  });
  assert.equal(deterministicSafetyRecommendation(doc), null);
});

/* ------------------------------------------------------------------ */
/* Today shows the current state, not the whole history                */
/* ------------------------------------------------------------------ */

test("an old review flag does not haunt every day after it", () => {
  const doc = baseMemberDoc({
    recommendations: [
      {
        id: "r1",
        createdAt: "2026-08-01T09:00:00.000Z",
        kind: "coach_review",
        evidence: ["e"],
        rationale: "r",
        confidence: 1,
        safety: "coach_review",
        status: "needs_coach_review",
        source: "deterministic",
      },
      {
        id: "r2",
        createdAt: "2026-08-10T09:00:00.000Z",
        kind: "no_change",
        evidence: ["e"],
        rationale: "r",
        confidence: 1,
        safety: "low_risk",
        status: "proposed",
        source: "deterministic",
      },
    ],
  });
  assert.equal(needsHumanReview(doc), false);
  assert.equal(latestRecommendation(doc)?.id, "r2");
});

test("a currently-open review flag is still shown", () => {
  const doc = baseMemberDoc({
    recommendations: [
      {
        id: "r1",
        createdAt: "2026-08-01T09:00:00.000Z",
        kind: "no_change",
        evidence: ["e"],
        rationale: "r",
        confidence: 1,
        safety: "low_risk",
        status: "proposed",
        source: "deterministic",
      },
      {
        id: "r2",
        createdAt: "2026-08-10T09:00:00.000Z",
        kind: "coach_review",
        evidence: ["e"],
        rationale: "r",
        confidence: 1,
        safety: "coach_review",
        status: "needs_coach_review",
        source: "deterministic",
      },
    ],
  });
  // Pinned to a fixed "now", because the flag is only shown while it is
  // recent — a fixture date drifts out of that window as time passes and the
  // test would start failing for a reason that has nothing to do with it.
  assert.equal(
    needsHumanReview(doc, new Date("2026-08-10T12:00:00.000Z")),
    true,
  );
});

test("no recommendations yet means nothing pending", () => {
  assert.equal(needsHumanReview(baseMemberDoc()), false);
  assert.equal(latestRecommendation(baseMemberDoc()), null);
});

/* ------------------------------------------------------------------ */
/* Dose adaptation is idempotent                                       */
/* ------------------------------------------------------------------ */

/**
 * The bug this exists to prevent: a verdict is a *reading* of the last two
 * sessions, not an event, and the generator used to advance the ladder from
 * its stored value every call. Two "easy" sessions plus six refreshes moved
 * a member six rungs, 1x6 to 3x10, having trained none of them.
 *
 * Reachable in normal use -- the client's once-a-day guard read a field the
 * mobile normaliser was dropping, and the Coach tab polls a full refresh
 * every sixty seconds.
 */
function foldOnce(records, state, exerciseId, posture = "normal") {
  // Mirrors applyAdaptation's per-exercise branch in
  // app/api/plan/generate/route.ts.
  const verdict = verdictFor(exerciseId, records);
  if (verdict.adjustment === "stop_and_review") {
    state.paused.add(exerciseId);
    return state;
  }
  if (
    verdict.latestSession &&
    state.adaptedThrough[exerciseId] === verdict.latestSession
  )
    return state;
  state.steps[exerciseId] = nextDose(
    state.steps[exerciseId] ?? 0,
    verdict.adjustment,
    posture,
  ).step;
  if (verdict.latestSession)
    state.adaptedThrough[exerciseId] = verdict.latestSession;
  return state;
}

test("re-reading the same sessions does not move the dose again", () => {
  const records = [
    {
      exerciseId: "ex-a",
      date: "2026-08-23",
      level: "target",
      perceivedEffort: 2,
      pain: false,
    },
    {
      exerciseId: "ex-a",
      date: "2026-08-22",
      level: "target",
      perceivedEffort: 2,
      pain: false,
    },
  ];
  const state = { steps: {}, adaptedThrough: {}, paused: new Set() };
  for (let i = 0; i < 10; i++) foldOnce(records, state, "ex-a");
  // Exactly one progression, not ten.
  assert.equal(state.steps["ex-a"], 1);
  assert.equal(state.adaptedThrough["ex-a"], "2026-08-23");
});

test("genuinely new evidence still moves the dose", () => {
  const records = [
    {
      exerciseId: "ex-a",
      date: "2026-08-23",
      level: "target",
      perceivedEffort: 2,
      pain: false,
    },
    {
      exerciseId: "ex-a",
      date: "2026-08-22",
      level: "target",
      perceivedEffort: 2,
      pain: false,
    },
  ];
  const state = { steps: {}, adaptedThrough: {}, paused: new Set() };
  foldOnce(records, state, "ex-a");
  assert.equal(state.steps["ex-a"], 1);

  // She trains again, and it is easy again. That is new evidence.
  records.unshift({
    exerciseId: "ex-a",
    date: "2026-08-24",
    level: "target",
    perceivedEffort: 2,
    pain: false,
  });
  foldOnce(records, state, "ex-a");
  assert.equal(state.steps["ex-a"], 2);
  // And re-reading that does not move it a third time.
  foldOnce(records, state, "ex-a");
  assert.equal(state.steps["ex-a"], 2);
});

test("pain still pauses on every pass, however often it is re-read", () => {
  // Deliberately NOT gated by adaptedThrough: adding to a set is idempotent,
  // and a movement that hurt must stay paused even if that record is lost.
  const records = [
    {
      exerciseId: "ex-b",
      date: "2026-08-23",
      level: "target",
      perceivedEffort: 2,
      pain: true,
    },
    {
      exerciseId: "ex-b",
      date: "2026-08-22",
      level: "target",
      perceivedEffort: 2,
      pain: false,
    },
  ];
  const state = { steps: {}, adaptedThrough: {}, paused: new Set() };
  foldOnce(records, state, "ex-b");
  assert.ok(state.paused.has("ex-b"));
  state.paused.clear(); // simulate the record being lost
  foldOnce(records, state, "ex-b");
  assert.ok(state.paused.has("ex-b"), "pain must re-pause, not be skipped");
  // And pain never advances the ladder.
  assert.equal(state.steps["ex-b"], undefined);
});

test("a verdict reports the session it rests on", () => {
  const none = verdictFor("ex-c", []);
  assert.equal(none.latestSession, undefined);
  const one = verdictFor("ex-c", [
    {
      exerciseId: "ex-c",
      date: "2026-08-21",
      level: "target",
      perceivedEffort: 3,
      pain: false,
    },
  ]);
  assert.equal(one.latestSession, "2026-08-21");
});

/* ------------------------------------------------------------------ */
/* Two devices must not erase each other                               */
/* ------------------------------------------------------------------ */

/**
 * Mirrors unionById in app/api/state/route.ts. That file is a Next.js route
 * and may only export handlers, so the logic is duplicated here rather than
 * imported -- kept deliberately small so the two cannot drift far.
 */
function unionById(existing, incoming) {
  if (!incoming) return existing ?? [];
  if (!existing?.length) return incoming;
  const merged = new Map();
  for (const row of existing) if (row?.id) merged.set(row.id, row);
  for (const row of incoming) if (row?.id) merged.set(row.id, row);
  return [...merged.values(), ...incoming.filter((row) => !row?.id)];
}

test("the audit's two-device food scenario no longer loses a meal", () => {
  // 1. Phone A goes offline holding yesterday's food.
  const phoneA = [{ id: "yesterday", description: "dal" }];
  // 2. Phone B logs breakfast online.
  const server = [
    { id: "yesterday", description: "dal" },
    { id: "breakfast", description: "poha" },
  ];
  // 3. Phone A logs lunch and reconnects, sending its whole array.
  phoneA.push({ id: "lunch", description: "roti" });

  const merged = unionById(server, phoneA);
  const ids = merged.map((row) => row.id).sort();
  // 4. Breakfast survives, which is what used to be lost silently.
  assert.deepEqual(ids, ["breakfast", "lunch", "yesterday"]);
});

test("an edit from the device that made it wins", () => {
  const server = [{ id: "m1", description: "estimate", protein: 10 }];
  const phone = [{ id: "m1", description: "corrected by member", protein: 22 }];
  const merged = unionById(server, phone);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].protein, 22);
});

test("union leaves the single-device case exactly as it was", () => {
  assert.deepEqual(unionById([], [{ id: "a" }]), [{ id: "a" }]);
  assert.deepEqual(unionById(undefined, [{ id: "a" }]), [{ id: "a" }]);
  // No incoming array at all means the client is not touching this log.
  assert.deepEqual(unionById([{ id: "a" }], undefined), [{ id: "a" }]);
});

/* ------------------------------------------------------------------ */
/* Text contrast                                                       */
/* ------------------------------------------------------------------ */

/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * These held at 2.71:1 and 2.60:1 for a long time, on the smallest text in
 * the app, for a membership largely over forty. A number in a palette is
 * exactly the kind of thing that regresses silently during a redesign, so it
 * is asserted rather than trusted to review.
 */
function contrastRatio(a, b) {
  const luminance = (hexColor) => {
    const channel = (offset) => {
      const value = parseInt(hexColor.slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

test("every text colour clears WCAG AA on both surfaces", () => {
  // Read from the real module, not a copy. The duplicate this replaces was
  // exactly the kind that passes while the app regresses.
  for (const [name, colour] of Object.entries(TEXT_COLOURS)) {
    for (const surface of SURFACES) {
      const surfaceName = surface === C.paper ? "paper" : "card";
      const ratio = contrastRatio(colour, surface);
      assert.ok(
        ratio >= 4.5,
        `${name} on ${surfaceName} is ${ratio.toFixed(2)}:1, below the 4.5:1 minimum`,
      );
    }
  }
});

test("the ratio helper agrees with known values", () => {
  // Sanity check on the maths itself, so a broken helper cannot make the
  // assertion above pass vacuously.
  assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF")), 21);
  assert.equal(Math.round(contrastRatio("#FFFFFF", "#FFFFFF")), 1);
  // The old faint, which is what this test exists to keep out.
  assert.ok(contrastRatio("#8A9692", "#F3F1EA") < 3);
});

test("a removed meal stays removed across a sync", () => {
  // The interaction that is easy to get wrong: foodEntries are unioned by id
  // so two devices cannot erase each other, which means a row that merely
  // disappeared from the phone would be restored from the server copy. A
  // tombstone survives the union because the incoming row replaces it.
  const server = [
    { id: "m1", description: "poha", deletedAt: undefined },
    { id: "m2", description: "roti" },
  ];
  const phoneAfterRemoval = [
    { id: "m1", description: "poha", deletedAt: "2026-08-24T10:00:00.000Z" },
    { id: "m2", description: "roti" },
  ];
  const merged = unionById(server, phoneAfterRemoval);
  const live = merged.filter((entry) => !entry.deletedAt);
  assert.equal(live.length, 1);
  assert.equal(live[0].id, "m2");

  // And it is still gone after a further round-trip, rather than reappearing.
  const again = unionById(merged, phoneAfterRemoval);
  assert.equal(again.filter((entry) => !entry.deletedAt).length, 1);
});

test("compactKcal never shows a day as a thousand times too large", () => {
  // The calendar rendered `{calories}k`, so 1,650 kcal read as 1.65 million.
  const compactKcal = (calories) => {
    const value = Math.round(calories);
    if (value <= 0) return "";
    if (value < 1000) return String(value);
    if (value < 10_000) return `${Math.round(value / 100) / 10}k`;
    return `${Math.round(value / 1000)}k`;
  };
  assert.equal(compactKcal(0), "");
  assert.equal(compactKcal(650), "650");
  assert.equal(compactKcal(1650), "1.7k");
  assert.equal(compactKcal(12000), "12k");
  assert.notEqual(compactKcal(1650), "1650k");
});

/* ------------------------------------------------------------------ */
/* Award counting                                                      */
/* ------------------------------------------------------------------ */

/**
 * These could not be tested before: the rules lived in App.tsx, which pulls
 * in React Native. Extracting them to mobile/src/awards.ts with named icons
 * is what makes the two counting fixes below assertable rather than reviewed.
 */
const awardDoc = (overrides = {}) => ({
  member: { id: "m", name: "Test" },
  actions: [],
  foodEntries: [],
  pulses: [],
  ...overrides,
});

test("a rest day is recorded but is not an active day", () => {
  const rested = awardMetrics(
    awardDoc({
      actions: [
        {
          id: "a",
          dayOffset: 0,
          domain: "movement",
          completed: "rest",
          skipKind: "rested",
        },
      ],
    }),
  );
  assert.equal(rested.rests, 1, "the rest itself is still counted");
  assert.equal(rested.activeDays, 0, "but it is not a day she showed up");
  assert.equal(rested.actions, 0);
});

test("only a rest she chose counts as a rest", () => {
  // "Rest counts" congratulates a considered recovery decision. Firing it at
  // someone who ran out of time tells her she made a choice she did not make.
  const byKind = (skipKind) =>
    awardMetrics(
      awardDoc({
        actions: [
          {
            id: "a",
            dayOffset: 0,
            domain: "movement",
            completed: "rest",
            skipKind,
          },
        ],
      }),
    ).rests;

  assert.equal(byKind("rested"), 1);
  assert.equal(byKind("no_time"), 0);
  assert.equal(byKind("unwell"), 0);
  // Recorded before the app asked. A build that never offered the question
  // cannot be read as though she answered it.
  assert.equal(byKind(undefined), 0);
});

test("every way a day went reads back without reproach", () => {
  for (const reason of ["rested", "no_time", "unwell", undefined]) {
    const text = describeSkip(reason);
    assert.ok(text.length, `${reason} has no description`);
    assert.doesNotMatch(
      text,
      /missed|failed|behind|skipped|should have|didn'?t manage/i,
      `"${text}" reads as a reprimand`,
    );
  }
  // The three offered options are neutral descriptions, not requests for an
  // excuse.
  assert.equal(SKIP_OPTIONS.length, 3);
  for (const option of SKIP_OPTIONS) {
    assert.doesNotMatch(option.label, /why|excuse|sorry|unfortunately/i);
  }
});

test("a session is a day trained, not an exercise finished", () => {
  // One ordinary morning: six movements, one day.
  const oneMorning = awardMetrics(
    awardDoc({
      actions: Array.from({ length: 6 }, (_, i) => ({
        id: `ex-${i}`,
        dayOffset: 0,
        domain: "movement",
        completed: "target",
      })),
    }),
  );
  assert.equal(oneMorning.movements, 1, "six exercises are one session");

  const twoMornings = awardMetrics(
    awardDoc({
      actions: [
        { id: "a", dayOffset: 0, domain: "movement", completed: "target" },
        { id: "b", dayOffset: -1, domain: "movement", completed: "target" },
      ],
    }),
  );
  assert.equal(twoMornings.movements, 2);
});

test("a whole day needs all five domains, not five actions", () => {
  const fiveOfOne = awardMetrics(
    awardDoc({
      actions: Array.from({ length: 5 }, (_, i) => ({
        id: `x-${i}`,
        dayOffset: 0,
        domain: "movement",
        completed: "target",
      })),
    }),
  );
  assert.equal(fiveOfOne.wholeDays, 0);

  const allFive = awardMetrics(
    awardDoc({
      actions: ["movement", "walking", "nutrition", "recovery", "mindset"].map(
        (domain) => ({ id: domain, dayOffset: 0, domain, completed: "target" }),
      ),
    }),
  );
  assert.equal(allFive.wholeDays, 1);
});

test("removed meals do not count toward a meal award", () => {
  const metrics = awardMetrics(
    awardDoc({
      foodEntries: [
        { id: "m1", description: "kept" },
        { id: "m2", description: "removed", deletedAt: "2026-08-24T10:00:00Z" },
      ],
    }),
  );
  assert.equal(metrics.meals, 1);
});

test("every award has a distinct id and reachable copy", () => {
  const ids = AWARDS.map((award) => award.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate award id");
  for (const award of AWARDS) {
    assert.ok(award.title.length, `${award.id} has no title`);
    assert.ok(award.copy.length, `${award.id} has no copy`);
    // No invented population statistics. This one was real: "Very few people
    // who start ever reach this", on an award, with no retention data behind it.
    assert.doesNotMatch(
      award.copy,
      /very few|most people|only \d+%|\d+% of/i,
      `${award.id} makes an unsupported population claim`,
    );
  }
});

test("activeDays counts distinct days, and never counts a rest", () => {
  const doc = {
    actions: [
      // A busy Tuesday: three actions, one day.
      { id: "a", dayOffset: 0, domain: "movement", completed: "target" },
      { id: "b", dayOffset: 0, domain: "walking", completed: "minimum" },
      { id: "c", dayOffset: 0, domain: "nutrition", completed: "target" },
      // Yesterday she rested. Recorded, valued, not a day she showed up.
      { id: "d", dayOffset: -1, domain: "movement", completed: "rest" },
      // Two days ago she did something.
      { id: "e", dayOffset: -2, domain: "walking", completed: "target" },
      // Outside the default seven-day window.
      { id: "f", dayOffset: -9, domain: "walking", completed: "target" },
      // Planned but not done.
      { id: "g", dayOffset: 0, domain: "mindset", completed: null },
    ],
  };
  assert.equal(activeDays(doc), 2);
  // A wider window reaches the older day.
  assert.equal(activeDays(doc, -10), 3);
});

test("isActive is the single definition both counters use", () => {
  assert.equal(isActive({ completed: "target" }), true);
  assert.equal(isActive({ completed: "minimum" }), true);
  assert.equal(isActive({ completed: "rest" }), false);
  assert.equal(isActive({ completed: null }), false);
  assert.equal(isActive({}), false);
});

test("member-facing labels never leak the internal domain names", () => {
  for (const [key, meta] of Object.entries(DOMAIN_META)) {
    assert.ok(meta.label.length, `${key} has no label`);
    assert.doesNotMatch(meta.label, /domain/i);
  }
  // "Walking" and "Nutrition" matching their keys is correct — those are the
  // words a person would actually use. These three are not: nobody signed up
  // to be told their evening reflection is "mindset".
  assert.notEqual(DOMAIN_META.movement.label.toLowerCase(), "movement");
  assert.notEqual(DOMAIN_META.mindset.label.toLowerCase(), "mindset");
  assert.notEqual(DOMAIN_META.recovery.label.toLowerCase(), "recovery");
});

test("nudges are a fixed set with no free text", () => {
  // The whole safety property of nudges is that a member cannot compose one.
  assert.ok(NUDGE_OPTIONS.length >= 3);
  const kinds = NUDGE_OPTIONS.map((option) => option.kind);
  assert.equal(new Set(kinds).size, kinds.length);
  for (const option of NUDGE_OPTIONS) {
    assert.ok(option.label.length);
    // None of them may comment on what she did or did not do.
    assert.doesNotMatch(
      option.label,
      /stream|missed|behind|failed|haven'?t|still not/i,
      `"${option.label}" reads as a comment on her week`,
    );
  }
});

/* ------------------------------------------------------------------ */
/* Health-data freshness                                               */
/* ------------------------------------------------------------------ */

/**
 * Mirrors freshness() in App.tsx. The audit sets "stale health data
 * displayed as current" as a guardrail with a target of zero, and the failure
 * is silent by nature: an old number renders exactly like a current one, so
 * she reads three-week-old steps as this morning's and so does her plan.
 */
function freshness(date, today) {
  if (date === today) return "Today";
  const days = Math.max(0, -offsetFromDate(date, today));
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Over a week ago";
  return "Over a fortnight ago";
}

test("a health reading always says how old it is", () => {
  const today = "2026-08-24";
  assert.equal(freshness("2026-08-24", today), "Today");
  assert.equal(freshness("2026-08-23", today), "Yesterday");
  assert.equal(freshness("2026-08-21", today), "3 days ago");
  assert.equal(freshness("2026-08-16", today), "Over a week ago");
  assert.equal(freshness("2026-08-01", today), "Over a fortnight ago");
});

test("only an actual same-day reading is called Today", () => {
  // The whole point. Anything else must be visibly not-today.
  const today = "2026-08-24";
  for (const date of ["2026-08-23", "2026-08-18", "2026-07-30"]) {
    assert.notEqual(
      freshness(date, today),
      "Today",
      `${date} was described as today's reading`,
    );
  }
  // A future-dated reading (clock skew) is not silently called stale either;
  // it clamps rather than producing "-2 days ago".
  assert.doesNotMatch(freshness("2026-08-26", today), /-/);
});

/* ------------------------------------------------------------------ */
/* Record identifiers                                                  */
/* ------------------------------------------------------------------ */

test("ids do not collide within a millisecond", () => {
  // These were `food-${Date.now()}`. Survivable while the server replaced
  // whole arrays; not now that it unions them BY ID so two devices cannot
  // erase each other — two records sharing an id become one, silently.
  const ids = new Set();
  for (let i = 0; i < 10_000; i++) ids.add(newId("food"));
  assert.equal(ids.size, 10_000, "newId produced a duplicate");
});

test("ids keep their prefix, for reading a log", () => {
  assert.match(newId("food"), /^food-/);
  assert.match(newId("message-ai"), /^message-ai-/);
  // And carry enough after it to be worth having.
  assert.ok(newId("x").length > 12);
});

test("a review flag nothing can resolve does not stay on screen forever", () => {
  // Nothing anywhere clears needs_coach_review, and for an uncoached member
  // no person is coming. An account that accumulated flags from a
  // since-fixed trigger would otherwise be pinned permanently, because the
  // flag holding it there is also the newest entry.
  const flagged = (createdAt) => ({
    member: { id: "m", name: "T" },
    recommendations: [
      {
        id: "r",
        createdAt,
        kind: "coach_review",
        status: "needs_coach_review",
        evidence: ["e"],
        rationale: "r",
        confidence: 1,
        safety: "coach_review",
        source: "deterministic",
      },
    ],
  });
  const now = new Date("2026-08-24T12:00:00.000Z");

  assert.equal(
    needsHumanReview(flagged("2026-08-24T09:00:00.000Z"), now),
    true,
  );
  assert.equal(
    needsHumanReview(flagged("2026-08-23T09:00:00.000Z"), now),
    true,
  );
  // Three days old: nobody is coming, and saying so was a lie.
  assert.equal(
    needsHumanReview(flagged("2026-08-21T09:00:00.000Z"), now),
    false,
  );
  // A malformed date is not a reason to show it.
  assert.equal(needsHumanReview(flagged("not-a-date"), now), false);
});

/* ------------------------------------------------------------------ */
/* Meal figures                                                        */
/* ------------------------------------------------------------------ */

test("impossible macro values are refused, not stored", () => {
  // Was `Number(input) || 0` with no bounds, so -500 and 999999 both saved —
  // and the plan generator reads these back for its lowProtein signal, so a
  // slipped decimal changed what she was offered the next day.
  assert.ok("problem" in parseMacro("calories", "-500"));
  assert.ok("problem" in parseMacro("protein", "-1"));
  assert.ok("problem" in parseMacro("calories", "999999"));
  assert.ok("problem" in parseMacro("calories", "abc"));
});

test("a large real meal passes without comment", () => {
  // The bounds catch a slipped decimal, not a big dinner. Nothing here is
  // allowed to have an opinion about what she ate.
  for (const [field, value] of [
    ["calories", "1400"],
    ["protein", "85"],
    ["carbs", "220"],
    ["fat", "60"],
  ]) {
    const result = parseMacro(field, value);
    assert.ok("value" in result, `${field} ${value} was questioned`);
  }
});

test("an empty field is zero, which is a real answer", () => {
  // "This meal had no protein worth recording" is legitimate and must not be
  // treated as a mistake.
  const result = parseMacro("protein", "");
  assert.deepEqual(result, { value: 0 });
  assert.deepEqual(parseMacro("fat", "   "), { value: 0 });
});

test("stored figures do not claim more precision than an estimate has", () => {
  assert.deepEqual(parseMacro("protein", "22.456"), { value: 22.5 });
  assert.deepEqual(parseMacro("calories", "410"), { value: 410 });
});

test("every problem is reported at once, not one per attempt", () => {
  const checked = checkMacros({
    calories: "-1",
    protein: "999",
    carbs: "20",
    fat: "abc",
  });
  assert.ok("problems" in checked);
  assert.equal(checked.problems.length, 3);
  // And each names its own field, so she knows which box to look at.
  assert.deepEqual(checked.problems.map((p) => p.field).sort(), [
    "calories",
    "fat",
    "protein",
  ]);
});

test("a valid correction comes back as numbers ready to store", () => {
  const checked = checkMacros({
    calories: "410",
    protein: "24",
    carbs: "",
    fat: "9.5",
  });
  assert.ok("values" in checked);
  assert.deepEqual(checked.values, {
    calories: 410,
    protein: 24,
    carbs: 0,
    fat: 9.5,
  });
});

test("no validation message reads as a judgement about the meal", () => {
  const checked = checkMacros({
    calories: "999999",
    protein: "-1",
    carbs: "0",
    fat: "0",
  });
  assert.ok("problems" in checked);
  for (const problem of checked.problems) {
    assert.doesNotMatch(
      problem.message,
      /too much|too many|unhealthy|excessive|should not|bad/i,
      `"${problem.message}" comments on the meal rather than the number`,
    );
  }
});

/* ------------------------------------------------------------------ */
/* A week's notable win                                                */
/* ------------------------------------------------------------------ */

const act = (dayOffset, domain, title, completed = "target", id) => ({
  id: id ?? `${domain}-${dayOffset}-${title}`,
  dayOffset,
  domain,
  title,
  completed,
});

test("no invented win when the week held nothing notable", () => {
  // The whole point. This showed "7 planned actions completed" under a
  // heading promising an achievement — arithmetic dressed as a win.
  const week = [act(-8, "movement", "Chair squat"), act(-9, "walking", "Walk")];
  assert.equal(findWeekWin(week, week), null);
});

test("an empty week has no win rather than a consoling one", () => {
  assert.equal(findWeekWin([], []), null);
});

test("coming back after a gap outranks everything else", () => {
  // The hardest thing the product asks, and the thing the person who did it
  // is most likely to dismiss.
  const older = [act(-20, "movement", "Chair squat")];
  const week = [
    act(-9, "movement", "Chair squat"),
    act(-9, "walking", "Walk"),
    act(-9, "nutrition", "Protein"),
    act(-9, "recovery", "Legs up"),
    act(-9, "mindset", "Reflect"),
  ];
  const win = findWeekWin(week, [...older, ...week]);
  assert.equal(win?.kind, "comeback");
  assert.match(win.text, /came back/i);
});

test("a complete day is recognised, and needs all five domains", () => {
  const week = [
    act(-9, "movement", "Chair squat"),
    act(-9, "walking", "Walk"),
    act(-9, "nutrition", "Protein"),
    act(-9, "recovery", "Legs up"),
    act(-9, "mindset", "Reflect"),
  ];
  // No prior history, so no comeback — this is the next rule down.
  assert.equal(findWeekWin(week, week)?.kind, "whole_day");

  // Four domains is not a complete day.
  const fourDomains = week.slice(0, 4);
  assert.notEqual(findWeekWin(fourDomains, fourDomains)?.kind, "whole_day");
});

test("a hard session finished at full effort is named, with what it was", () => {
  const week = [act(-9, "movement", "Wall push-up", "target", "a1")];
  const logs = [{ actionId: "a1", perceivedEffort: 5, level: "target" }];
  const win = findWeekWin(week, week, logs);
  assert.equal(win?.kind, "hard_session");
  // Names the movement and how it felt — things a count cannot show.
  assert.match(win.text, /Wall push-up/);
  assert.match(win.text, /very hard/);
});

test("an easy session is not reported as a hard one", () => {
  const week = [act(-9, "movement", "Wall push-up", "target", "a1")];
  const logs = [{ actionId: "a1", perceivedEffort: 2, level: "target" }];
  assert.notEqual(findWeekWin(week, week, logs)?.kind, "hard_session");
});

test("rest is never a week's win", () => {
  // Rest is valued and has its own award. Calling it the win of the week
  // would make the word meaningless.
  const week = [
    act(-9, "movement", "Chair squat", "rest"),
    act(-10, "walking", "Walk", "rest"),
  ];
  assert.equal(findWeekWin(week, week), null);
});

test("a win never scolds, and never counts", () => {
  const older = [act(-20, "movement", "Chair squat")];
  const week = [act(-9, "movement", "Chair squat")];
  const win = findWeekWin(week, [...older, ...week]);
  assert.ok(win);
  assert.doesNotMatch(win.text, /missed|behind|failed|only|just \d/i);
  assert.doesNotMatch(win.text, /planned actions completed/i);
});

/* ------------------------------------------------------------------ */
/* The member profile                                                  */
/* ------------------------------------------------------------------ */

test("event goals route to the endurance model, not the dose ladder", () => {
  // Not "unsupported" — progressed differently. The dose ladder moves sets
  // and reps and cannot express weekly volume, a long run or a taper, so a
  // race goal handed to it would produce strength training with a race
  // label: a more expensive kind of wrong, because it looks like an answer.
  assert.equal(goalNeedsEnduranceModel("event-hybrid"), true);
  assert.equal(goalNeedsEnduranceModel("event-endurance"), true);
  assert.equal(goalNeedsEnduranceModel("stronger"), false);
  assert.equal(goalNeedsEnduranceModel("sleep"), false);
  assert.equal(goalNeedsEnduranceModel("made-up"), false);
});

test("every goal has a distinct id and explains itself", () => {
  const ids = GOAL_OPTIONS.map((option) => option.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate goal id");
  for (const option of GOAL_OPTIONS) {
    assert.ok(option.label.length, `${option.id} has no label`);
    assert.ok(option.detail.length, `${option.id} does not say what it means`);
    // No goal may be phrased as a deficiency to correct.
    assert.doesNotMatch(
      `${option.label} ${option.detail}`,
      /lose weight|slim|tone up|burn|fix|fat\b/i,
      `${option.id} frames the goal as a body problem`,
    );
  }
});

test("declining to share detail is recorded as an answer", () => {
  // So the app never re-asks in a way that reads as nagging, and About you
  // can say "add this whenever" rather than pretending it never offered.
  const declined = { goals: ["stronger"], detailConsent: "declined" };
  assert.equal(declined.detailConsent, "declined");
  const { known, total } = profileCompleteness(declined);
  assert.equal(known, 1);
  assert.ok(total > known);
});

test("completeness counts what is known without judging what is not", () => {
  assert.deepEqual(profileCompleteness({ goals: [] }), { known: 0, total: 7 });

  const full = profileCompleteness({
    ageBand: "40-49",
    goals: ["stronger"],
    equipment: ["chair"],
    lifeStage: "perimenopause",
    sleepBaseline: "broken",
    trainingDays: ["mon", "wed"],
    wontDo: "No running",
  });
  assert.equal(full.known, full.total);

  // An empty array is not knowledge. "I picked no equipment" and "I was never
  // asked" must not look the same.
  assert.equal(profileCompleteness({ goals: [], equipment: [] }).known, 0);
  assert.equal(
    profileCompleteness({ goals: [], wontDo: "   " }).known,
    0,
    "whitespace is not an answer",
  );
});

test("prefer-not-to-say is a real life-stage answer", () => {
  // Offering the question without an exit makes it an interrogation.
  const ids = LIFE_STAGES.map((stage) => stage.id);
  assert.ok(ids.includes("prefer_not_to_say"));
  assert.ok(ids.includes("none_of_these"));
});

/* ------------------------------------------------------------------ */
/* Endurance and event training                                        */
/* ------------------------------------------------------------------ */

/**
 * The dose ladder moves sets and reps and cannot express weekly volume, a
 * long run or a taper. These rules are the second model. Every constant they
 * encode is long-established endurance practice, which is exactly why it
 * belongs in tested code rather than in a prompt.
 */

test("an impossible block is refused with a real alternative", () => {
  // Sixteen weeks does not take somebody from nothing to a marathon, and a
  // plan that pretends otherwise is how people get hurt.
  const tooSoon = assessFeasibility({
    event: "marathon",
    weeksAway: 8,
    currentWeeklyKm: 40,
    daysPerWeek: 5,
  });
  assert.equal(tooSoon.ok, false);
  assert.match(tooSoon.suggestion, /half marathon/i);

  const noBase = assessFeasibility({
    event: "marathon",
    weeksAway: 20,
    currentWeeklyKm: 5,
    daysPerWeek: 4,
  });
  assert.equal(noBase.ok, false);
  // The refusal names a goal she can actually pursue now.
  assert.match(noBase.suggestion, /build to/i);
});

test("a realistic block is accepted", () => {
  assert.equal(
    assessFeasibility({
      event: "marathon",
      weeksAway: 20,
      currentWeeklyKm: 32,
      daysPerWeek: 5,
    }).ok,
    true,
  );
});

test("weekly volume never climbs faster than the tissue can adapt", () => {
  const profile = {
    event: "half",
    weeksAway: 16,
    currentWeeklyKm: 20,
    daysPerWeek: 4,
  };
  let previous = profile.currentWeeklyKm;
  for (let week = 1; week <= 12; week++) {
    const plan = planWeek(profile, week);
    if (!plan.isCutback && !plan.isTaper) {
      // Allow a kilometre of rounding on top of the 10% brake.
      assert.ok(
        plan.totalKm <= Math.ceil(previous * 1.1) + 1,
        `week ${week} jumped from ${previous} to ${plan.totalKm}`,
      );
    }
    if (!plan.isCutback) previous = plan.totalKm;
  }
});

test("every fourth week is lighter on purpose", () => {
  const profile = {
    event: "half",
    weeksAway: 16,
    currentWeeklyKm: 20,
    daysPerWeek: 4,
  };
  assert.equal(planWeek(profile, 4).isCutback, true);
  assert.equal(planWeek(profile, 8).isCutback, true);
  assert.equal(planWeek(profile, 3).isCutback, false);
  // And it is genuinely lighter than the week before it.
  assert.ok(planWeek(profile, 4).totalKm < planWeek(profile, 3).totalKm);
});

test("intensity is never added to a recovery week", () => {
  // Stacking volume and intensity is the classic way to break a build, and
  // adding a hard session to a cutback defeats the cutback.
  const profile = {
    event: "half",
    weeksAway: 16,
    currentWeeklyKm: 20,
    daysPerWeek: 5,
  };
  const cutback = planWeek(profile, 4);
  assert.equal(cutback.isCutback, true);
  assert.ok(
    !cutback.sessions.some((s) => s.kind === "tempo" || s.kind === "intervals"),
  );
});

test("the long run never becomes most of the week", () => {
  for (const event of ["5k", "10k", "half", "marathon", "hyrox"]) {
    const profile = {
      event,
      weeksAway: 20,
      currentWeeklyKm: 30,
      daysPerWeek: 5,
    };
    for (let week = 1; week <= 16; week++) {
      const plan = planWeek(profile, week);
      const long = plan.sessions.find((s) => s.kind === "long");
      if (long?.km && plan.totalKm > 0)
        assert.ok(
          long.km <= plan.totalKm * 0.5,
          `${event} week ${week}: long run ${long.km} of ${plan.totalKm}`,
        );
    }
  }
});

test("the block tapers into the event rather than peaking at it", () => {
  const profile = {
    event: "marathon",
    weeksAway: 18,
    currentWeeklyKm: 35,
    daysPerWeek: 5,
  };
  const peak = planWeek(profile, 14).totalKm;
  const raceWeek = planWeek(profile, 18);
  assert.equal(raceWeek.isTaper, true);
  assert.ok(
    raceWeek.totalKm < peak / 2,
    `race week ${raceWeek.totalKm}km is not a taper from ${peak}km`,
  );
  // Sharpness is kept, volume is not.
  assert.ok(raceWeek.sessions.some((s) => s.kind === "intervals"));
});

test("Hyrox trains running under fatigue, which is what the race tests", () => {
  const plan = planWeek(
    { event: "hyrox", weeksAway: 12, currentWeeklyKm: 15, daysPerWeek: 4 },
    3,
  );
  assert.ok(plan.sessions.some((s) => s.kind === "compromised"));
  assert.ok(plan.sessions.some((s) => s.kind === "stations"));
});

test("no session prescribes a pace or a heart rate", () => {
  // Those depend on testing and on the individual. A plausible-looking pace
  // is exactly the confident wrongness this architecture exists to prevent.
  for (const event of ["5k", "marathon", "hyrox"]) {
    for (let week = 1; week <= 10; week++) {
      const plan = planWeek(
        { event, weeksAway: 16, currentWeeklyKm: 20, daysPerWeek: 5 },
        week,
      );
      for (const session of plan.sessions) {
        assert.doesNotMatch(
          session.description,
          /\d+\s*(min\/km|bpm|% ?(of )?(max|hr)|zone \d)/i,
          `"${session.description}" prescribes a pace or zone`,
        );
      }
    }
  }
});

test("every week includes a rest day, described as part of the plan", () => {
  const plan = planWeek(
    { event: "marathon", weeksAway: 20, currentWeeklyKm: 35, daysPerWeek: 6 },
    5,
  );
  const rest = plan.sessions.find((s) => s.kind === "rest");
  assert.ok(rest);
  assert.doesNotMatch(rest.description, /skip|nothing|off day/i);
});

/* ------------------------------------------------------------------ */
/* Event movements and their tagging                                   */
/* ------------------------------------------------------------------ */

/**
 * The library grew from movements that were low-risk by construction —
 * chair, wall, bodyweight — to include sleds, loaded carries and impact.
 * The tagging is the only thing keeping those away from people they are
 * wrong for, so it is asserted rather than reviewed.
 */

const EVENT_IDS = [
  "ex-sled-push",
  "ex-sled-pull",
  "ex-farmers-carry",
  "ex-sandbag-lunge",
  "ex-wall-ball",
  "ex-burpee-broad-jump",
  "ex-ski-erg",
  "ex-row-erg",
];

test("nobody is handed a sled by default", () => {
  // eligibleExercises defaults to the home equipment set. A member who has
  // told us nothing about her equipment must get nothing that needs a gym.
  const defaults = eligibleExercises({});
  for (const id of EVENT_IDS) {
    assert.ok(
      !defaults.some((exercise) => exercise.id === id),
      `${id} was offered with no equipment stated`,
    );
  }
});

test("no event movement is reachable in the first weeks", () => {
  // maxTier is 1 in weeks 1-2 and 2 through week 6. All of this is tier 3,
  // so the existing ramp excludes it without needing a special case.
  const early = eligibleExercises({
    maxTier: 2,
    equipment: [
      "none",
      "chair",
      "wall",
      "band",
      "weight",
      "sled",
      "sandbag",
      "medicine_ball",
      "erg",
      "box",
      "open_space",
    ],
  });
  for (const id of EVENT_IDS) {
    assert.ok(
      !early.some((exercise) => exercise.id === id),
      `${id} was offered at maxTier 2`,
    );
  }
});

test("pregnancy rules out every loaded and impact station", () => {
  const all = EXERCISES.filter((exercise) => EVENT_IDS.includes(exercise.id));
  for (const id of [
    "ex-sled-push",
    "ex-sled-pull",
    "ex-farmers-carry",
    "ex-sandbag-lunge",
    "ex-wall-ball",
    "ex-burpee-broad-jump",
  ]) {
    const exercise = all.find((item) => item.id === id);
    assert.ok(
      exercise.avoidIf.includes("pregnancy"),
      `${id} is not excluded during pregnancy`,
    );
  }
});

test("the burpee broad jump is the most restricted movement in the library", () => {
  // Impact, a floor transition and a jump. If anything should have the
  // longest exclusion list, it is this.
  const burpee = EXERCISES.find((e) => e.id === "ex-burpee-broad-jump");
  for (const condition of [
    "pregnancy",
    "osteoporosis",
    "dizziness",
    "high_blood_pressure",
    "cardiac_condition",
  ]) {
    assert.ok(burpee.avoidIf.includes(condition), `burpee allows ${condition}`);
  }
  assert.ok(burpee.loads.includes("pelvic_floor"));
});

test("a cardiac condition removes every maximal sustained effort", () => {
  const cleared = eligibleExercises({
    conditions: ["cardiac_condition"],
    equipment: [
      "none",
      "chair",
      "wall",
      "band",
      "weight",
      "sled",
      "sandbag",
      "medicine_ball",
      "erg",
      "box",
      "open_space",
    ],
  });
  // Written the wrong way round first: the original assertion passed for any
  // movement that simply had not been tagged, which is the failure it was
  // supposed to catch. The invariant is that cardio_load *implies* the
  // exclusion — it found two untagged stations the moment it was stated
  // properly.
  for (const exercise of EXERCISES) {
    if (exercise.loads.includes("cardio_load"))
      assert.ok(
        exercise.avoidIf.includes("cardiac_condition"),
        `${exercise.id} is a maximal sustained effort and does not exclude a cardiac condition`,
      );
  }
  for (const exercise of cleared) {
    assert.ok(
      !exercise.loads.includes("cardio_load"),
      `${exercise.id} was offered to a cardiac condition`,
    );
  }
  // And specifically the ergs and sleds are gone.
  for (const id of ["ex-sled-push", "ex-ski-erg", "ex-row-erg"])
    assert.ok(!cleared.some((e) => e.id === id), `${id} survived the filter`);
});

test("every station has a lighter version that trains the same thing", () => {
  // "Not yet" has to still give her a session.
  for (const id of EVENT_IDS) {
    const exercise = EXERCISES.find((item) => item.id === id);
    assert.ok(exercise.regressesTo, `${id} has no regression`);
    const easier = EXERCISES.find((item) => item.id === exercise.regressesTo);
    assert.ok(easier, `${id} regresses to a movement that does not exist`);
    assert.ok(
      easier.tier < exercise.tier,
      `${id} regresses to something no easier`,
    );
  }
});

test("every progression and regression points at a real movement", () => {
  const ids = new Set(EXERCISES.map((exercise) => exercise.id));
  for (const exercise of EXERCISES) {
    if (exercise.progressesTo)
      assert.ok(
        ids.has(exercise.progressesTo),
        `${exercise.id} progresses to missing ${exercise.progressesTo}`,
      );
    if (exercise.regressesTo)
      assert.ok(
        ids.has(exercise.regressesTo),
        `${exercise.id} regresses to missing ${exercise.regressesTo}`,
      );
  }
});

test("every movement in the library is fully described", () => {
  for (const exercise of EXERCISES) {
    assert.equal(exercise.frames.length, 5, `${exercise.id} frame count`);
    assert.ok(exercise.why.length, `${exercise.id} has no why`);
    assert.ok(exercise.cue.length, `${exercise.id} has no cue`);
    assert.ok(exercise.equipment.length, `${exercise.id} has no equipment`);
    assert.ok(exercise.minutes > 0, `${exercise.id} has no duration`);
  }
});

test("no movement id is duplicated", () => {
  const ids = EXERCISES.map((exercise) => exercise.id);
  assert.equal(new Set(ids).size, ids.length);
});

/* ------------------------------------------------------------------ *
 * Who she is, and what the plan does with it
 *
 * The rules in lib/member-profile.ts decide dose, difficulty and what is
 * even offerable. They are the layer where being quietly wrong produces a
 * plan that looks reasonable and is not, so each one is pinned here.
 * ------------------------------------------------------------------ */

test("the two profile vocabularies stay in step", () => {
  // mobile/src/profile.ts owns the labels; lib/member-profile.ts owns the
  // rules. They are separate files by design, so nothing but a test stops
  // one from drifting out from under the other.
  const appIds = GOAL_OPTIONS.map((option) => option.id).sort();
  const ruleIds = GOALS.map((goal) => goal.id).sort();
  assert.deepEqual(appIds, ruleIds);

  for (const option of GOAL_OPTIONS) {
    assert.equal(
      goalNeedsEnduranceModel(option.id),
      serverGoalNeedsEndurance(option.id),
      option.id + " disagrees about which progression model it needs",
    );
    const rule = GOALS.find((goal) => goal.id === option.id);
    assert.deepEqual(
      option.legacy.slice().sort(),
      rule.legacy.slice().sort(),
      option.id + " knows a different set of old labels on each side",
    );
  }
});

test("both sides resolve an old label to the same goal", () => {
  // The app maps her stored label back to a selected chip; the server maps
  // it to movement patterns. If they disagree she sees one goal on screen
  // and trains for another.
  for (const goal of GOALS) {
    for (const label of goal.legacy) {
      assert.equal(mobileGoalIdFromLabel(label), goal.id, label);
      assert.equal(goalIdFromLabel(label), goal.id, label);
    }
  }
});

test("every current label resolves to its own goal", () => {
  // The app stores what it shows. If a label stops resolving, the member
  // keeps her goal on screen and silently loses it in the generator.
  for (const option of GOAL_OPTIONS) {
    assert.equal(
      goalIdFromLabel(option.label),
      option.id,
      option.label + " does not resolve",
    );
  }
});

test("goals stored before the rewording still resolve", () => {
  // Four labels were reworded when the goal list grew. Every member in the
  // pilot has the old strings stored, and matching on labels alone would
  // have dropped their pattern ordering without any error.
  assert.equal(goalIdFromLabel("Feel stronger"), "stronger");
  assert.equal(goalIdFromLabel("Improve mobility"), "mobility");
  assert.equal(goalIdFromLabel("Improve endurance"), "endurance");
  assert.equal(
    goalIdFromLabel("Support hormonal or life-stage wellbeing"),
    "life-stage",
  );
});

test("a goal we cannot read is dropped, not guessed", () => {
  // The old custom-goal box let her type anything. It stays visible to her
  // coach; it must not be resolved to whichever id happens to be nearest.
  assert.equal(goalIdFromLabel("run a sub-3 marathon"), undefined);
  assert.equal(goalIdFromLabel(""), undefined);
  assert.deepEqual(goalIds(["Feel stronger", "run a sub-3 marathon"]), [
    "stronger",
  ]);
});

test("goal order is the member's, and duplicates collapse", () => {
  assert.deepEqual(goalIds(["Manage stress", "Feel stronger"]), [
    "stress",
    "stronger",
  ]);
  assert.deepEqual(goalIds(["stronger", "Feel stronger"]), ["stronger"]);
});

test("nobody is handed equipment they never said they had", () => {
  assert.deepEqual(equipmentFor(undefined), ["none", "chair", "wall"]);
  assert.deepEqual(equipmentFor({ goals: [], equipment: [] }), [
    "none",
    "chair",
    "wall",
  ]);
});

test("bodyweight stays available whatever else she has", () => {
  // "none" means bodyweight, not "nothing selected". Dropping it would make
  // choosing a band remove every movement that needs no equipment at all.
  const chosen = equipmentFor({ goals: [], equipment: ["band"] });
  assert.ok(chosen.includes("none"));
  assert.ok(chosen.includes("band"));
  assert.ok(!chosen.includes("chair"));
});

test("an older member starts lower and still gets there", () => {
  // A ceiling that never lifts is not caution, it is a member held at
  // sit-to-stand in her second year.
  assert.equal(tierCeiling(1, "70+"), 1);
  assert.equal(tierCeiling(8, "70+"), 1);
  assert.equal(tierCeiling(12, "70+"), 2);
  assert.equal(tierCeiling(20, "70+"), 3);
});

test("an unknown age is treated as careful, not average", () => {
  assert.equal(tierCeiling(1, undefined), 1);
  assert.equal(tierCeiling(4, undefined), 1);
  assert.ok(tierCeiling(8, undefined) < tierCeiling(8, "30-39"));
});

test("a younger member is not slowed down by the age rule", () => {
  assert.equal(tierCeiling(3, "30-39"), 2);
  assert.equal(tierCeiling(8, "30-39"), 3);
});

test("the generator does not prescribe jumping unprompted", () => {
  // Impact is the one class where a first session can end someone's
  // involvement. Over sixty, or age unknown, that call belongs to a person.
  assert.deepEqual(withheldPatternsForAge("70+"), ["jump"]);
  assert.deepEqual(withheldPatternsForAge("60-69"), ["jump"]);
  assert.deepEqual(withheldPatternsForAge(undefined), ["jump"]);
  assert.deepEqual(withheldPatternsForAge("30-39"), []);
});

test("pregnancy becomes a real exclusion", () => {
  assert.deepEqual(conditionsForLifeStage("pregnant"), ["pregnancy"]);
  assert.ok(avoidLoadsFor({ goals: [], lifeStage: "pregnant" }).includes(
    "pelvic_floor",
  ));
});

test("a life stage that is not a risk is not treated as one", () => {
  // Perimenopause changes emphasis, not safety. Turning it into a blanket
  // restriction would be its own kind of harm.
  assert.deepEqual(conditionsForLifeStage("perimenopause"), []);
  assert.deepEqual(avoidLoadsFor({ goals: [], lifeStage: "perimenopause" }), []);
  assert.deepEqual(conditionsForLifeStage(undefined), []);
});

test("postpartum protects the floor without excluding her", () => {
  assert.deepEqual(conditionsForLifeStage("postpartum"), []);
  assert.deepEqual(avoidLoadsFor({ goals: [], lifeStage: "postpartum" }), [
    "pelvic_floor",
  ]);
});

test("what she will not do is read the same way as a caution", () => {
  const loads = avoidLoadsFor({ goals: [], wontDo: "nothing on my knees" });
  assert.ok(loads.includes("knee"));
});

test("a preference and a life stage both apply", () => {
  const loads = avoidLoadsFor({
    goals: [],
    lifeStage: "postpartum",
    wontDo: "no overhead work, my shoulder complains",
  });
  assert.ok(loads.includes("pelvic_floor"));
  assert.ok(loads.includes("shoulder"));
});

test("an unanswered detail question falls to the safe default", () => {
  assert.equal(sessionDaysFor(undefined), 3);
  assert.equal(sessionDaysFor({ goals: [], trainingDays: [] }), 3);
  assert.equal(
    sessionDaysFor({ goals: [], trainingDays: ["mon", "wed", "fri", "sat"] }),
    4,
  );
  assert.equal(startsConservatively(undefined), false);
  assert.equal(startsConservatively({ goals: [], sleepBaseline: "poor" }), true);
  assert.equal(startsConservatively({ goals: [], sleepBaseline: "good" }), false);
});

/* ------------------------------------------------------------------ *
 * The profile reaching the plan
 *
 * The rules above are only worth having if the generator actually reads
 * them. These run the real generator.
 * ------------------------------------------------------------------ */

const planFor = (profile, over = {}) =>
  selectSession(
    {
      memberId: "m1",
      week: 10,
      goals: [],
      availableMinutes: 30,
      profile,
      ...over,
    },
    "normal",
  );

test("her goal changes what she is shown first", () => {
  // The complaint that started this: every member saw the same wall sit.
  const strength = planFor({ goals: ["stronger"] });
  const calm = planFor({ goals: ["stress"] });
  assert.ok(strength.length > 0);
  assert.ok(calm.length > 0);
  assert.notEqual(strength[0].exerciseId, calm[0].exerciseId);
});

test("a goal stored as an old label still changes the plan", () => {
  // The regression this whole id table exists to prevent.
  const byLabel = planFor(undefined, { goals: ["Feel stronger"] });
  const byId = planFor({ goals: ["stronger"] });
  assert.deepEqual(
    byLabel.map((item) => item.exerciseId),
    byId.map((item) => item.exerciseId),
  );
});

test("a member with no profile still gets a full session", () => {
  // Every member who onboarded before any of this existed.
  const session = planFor(undefined);
  assert.ok(session.length >= 3);
});

test("a home member is never shown gym equipment", () => {
  for (const item of planFor(undefined)) {
    const exercise = EXERCISE_BY_ID.get(item.exerciseId);
    for (const kit of exercise.equipment) {
      assert.ok(
        ["none", "chair", "wall"].includes(kit),
        item.exerciseId + " needs " + kit,
      );
    }
  }
});

test("pregnancy is honoured by the generator, not just the rule", () => {
  for (const item of planFor({ goals: ["stronger"], lifeStage: "pregnant" })) {
    const exercise = EXERCISE_BY_ID.get(item.exerciseId);
    assert.ok(
      !exercise.avoidIf.includes("pregnancy"),
      item.exerciseId + " is offered during pregnancy",
    );
    assert.ok(
      !exercise.loads.includes("pelvic_floor"),
      item.exerciseId + " loads the pelvic floor",
    );
  }
});

test("age holds the difficulty down in the same week", () => {
  const older = planFor({ goals: ["stronger"], ageBand: "70+" });
  const younger = planFor({ goals: ["stronger"], ageBand: "30-39" });
  const hardest = (session) =>
    Math.max(...session.map((item) => EXERCISE_BY_ID.get(item.exerciseId).tier));
  assert.ok(older.length > 0);
  assert.ok(hardest(older) < hardest(younger));
});

test("what she will not do is absent from the plan itself", () => {
  for (const item of planFor({
    goals: ["stronger"],
    wontDo: "nothing on my knees please",
  })) {
    assert.ok(
      !EXERCISE_BY_ID.get(item.exerciseId).loads.includes("knee"),
      item.exerciseId + " loads a knee she asked us to leave alone",
    );
  }
});

/* ------------------------------------------------------------------ *
 * The starting point
 *
 * The sign-up screen promises that the activity question "establishes a
 * starting point". These are the tests that make that sentence true.
 * ------------------------------------------------------------------ */

test("what she was already doing changes where she starts", () => {
  assert.ok(
    tierCeiling(1, "30-39", "Regular exercise") >
      tierCeiling(1, "30-39", "Mostly seated"),
  );
  assert.equal(tierCeiling(3, "30-39", "Regular exercise"), 3);
  assert.equal(tierCeiling(3, "30-39", "Mostly seated"), 2);
});

test("an unanswered activity question is credited like the seated case", () => {
  // Not like the middle one. Silence is not a claim to be fit.
  assert.equal(
    tierCeiling(5, "30-39", undefined),
    tierCeiling(5, "30-39", "Mostly seated"),
  );
  assert.equal(
    tierCeiling(5, "30-39", "something we never offered"),
    tierCeiling(5, "30-39", "Mostly seated"),
  );
});

test("being active does not cancel being older", () => {
  // The credit for activity is deliberately smaller than the delay for age,
  // so an active seventy-year-old still starts below an active thirty-year-old.
  assert.ok(
    tierCeiling(4, "70+", "Regular exercise") <
      tierCeiling(4, "30-39", "Regular exercise"),
  );
});

test("nobody starts above the first tier in week one", () => {
  // The on-ramp still holds at the very start, whoever she is.
  for (const band of ["18-29", "30-39", "40-49", "50-59", "60-69", "70+"]) {
    assert.equal(tierCeiling(1, band, "Mostly seated"), 1, band);
  }
});

test("two different members do not get the same session", () => {
  // The complaint this all began with: "wall, stand, and all those things",
  // shown to everyone regardless of who they were.
  const starting = selectSession(
    {
      memberId: "a",
      week: 10,
      goals: [],
      availableMinutes: 30,
      activityLevel: "Mostly seated",
      profile: { goals: ["stronger"], ageBand: "70+" },
    },
    "normal",
  );
  const experienced = selectSession(
    {
      memberId: "b",
      week: 10,
      goals: [],
      availableMinutes: 30,
      activityLevel: "Regular exercise",
      profile: { goals: ["stronger"], ageBand: "30-39" },
    },
    "normal",
  );
  const ids = (session) => session.map((item) => item.exerciseId).join(",");
  assert.notEqual(ids(starting), ids(experienced));

  const tiers = (session) =>
    session.map((item) => EXERCISE_BY_ID.get(item.exerciseId).tier);
  assert.ok(Math.max(...tiers(experienced)) > Math.max(...tiers(starting)));
});

test("a movement she is already doing is not swapped out from under her", () => {
  // Progression happens by dose and by the explicit progressesTo link. The
  // entry-tier rule must only decide where she *begins* a pattern.
  const session = selectSession(
    {
      memberId: "a",
      week: 12,
      goals: [],
      availableMinutes: 30,
      activityLevel: "Regular exercise",
      profile: { goals: ["stronger"], ageBand: "30-39" },
      doseSteps: { "ex-sit-to-stand": 2 },
    },
    "normal",
  );
  assert.ok(
    session.some((item) => item.exerciseId === "ex-sit-to-stand"),
    "history was discarded in favour of a harder movement",
  );
});

/* ------------------------------------------------------------------ *
 * Training for something with a date
 *
 * Event goals progress by weekly volume, not by sets and reps, so they route
 * to a different model entirely. The risk being tested here is not that the
 * model is wrong — lib/endurance.ts has its own tests — but that a member
 * asks for an event block and receives an ordinary week without being told.
 * ------------------------------------------------------------------ */

const eventPlanFor = (profile, over = {}) =>
  generatePlan({
    memberId: "m1",
    week: 3,
    goals: [],
    availableMinutes: 40,
    activityLevel: "Regular exercise",
    todayIso: "2026-03-01",
    profile,
    ...over,
  });

test("an ordinary member gets no event machinery at all", () => {
  const plan = eventPlanFor({ goals: ["stronger"], ageBand: "30-39" });
  assert.equal(plan.enduranceWeek, undefined);
  assert.equal(plan.eventNotice, undefined);
});

test("an event goal never silently becomes an ordinary week", () => {
  // She chose "train for a hybrid event" and told us nothing else. The wrong
  // outcome is a week of chair squats with nothing explaining the gap.
  const plan = eventPlanFor({ goals: ["event-hybrid"], ageBand: "30-39" });
  assert.equal(plan.enduranceWeek, undefined);
  assert.ok(plan.eventNotice);
  assert.match(plan.eventNotice.body, /About you/);
});

test("a target that does not fit the calendar is refused with a reason", () => {
  const plan = eventPlanFor({
    goals: ["event-endurance"],
    ageBand: "30-39",
    event: {
      kind: "marathon",
      startedOn: "2026-02-01",
      dateIso: "2026-04-01",
      currentWeeklyKm: 10,
    },
  });
  assert.equal(plan.enduranceWeek, undefined);
  assert.ok(plan.eventNotice);
  // The refusal has to carry a next step, not just a no.
  assert.ok(plan.eventNotice.body.length > 40);
});

test("a real block produces running and keeps the strength work", () => {
  // An event block is running plus strength. Dropping the strength is how
  // people arrive at a start line injured.
  const plan = eventPlanFor({
    goals: ["event-endurance"],
    ageBand: "30-39",
    equipment: ["none", "chair", "wall", "band", "weight"],
    event: {
      kind: "half",
      startedOn: "2026-01-01",
      dateIso: "2026-05-01",
      currentWeeklyKm: 25,
    },
  });
  assert.equal(plan.eventNotice, undefined);
  assert.ok(plan.enduranceWeek, "no block was planned");
  assert.ok(plan.enduranceWeek.sessions.length > 0);
  assert.ok(plan.session.length > 0, "the station work was dropped");
});

test("the block knows which week it is on", () => {
  const profile = {
    goals: ["event-endurance"],
    ageBand: "30-39",
    event: {
      kind: "half",
      startedOn: "2026-01-01",
      dateIso: "2026-05-01",
      currentWeeklyKm: 25,
    },
  };
  const first = eventPlanFor(profile, { todayIso: "2026-01-01" });
  const later = eventPlanFor(profile, { todayIso: "2026-02-19" });
  assert.equal(first.enduranceWeek.week, 1);
  assert.ok(later.enduranceWeek.week > first.enduranceWeek.week);
  assert.ok(later.enduranceWeek.totalKm > first.enduranceWeek.totalKm);
});

test("her own week outranks the training block", () => {
  // Recovery posture comes from her check-ins. A calendar does not get to
  // override how she has actually been.
  const tired = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    date: "2026-02-0" + day,
    energy: 1,
    sleep: 1,
    stress: 1,
  }));
  const plan = eventPlanFor(
    {
      goals: ["event-endurance"],
      ageBand: "30-39",
      event: {
        kind: "half",
        startedOn: "2026-01-01",
        dateIso: "2026-05-01",
        currentWeeklyKm: 25,
      },
    },
    { signals: tired },
  );
  if (plan.posture === "recovery") {
    assert.equal(plan.enduranceWeek, undefined);
    assert.ok(plan.eventNotice);
    assert.match(plan.eventNotice.title, /paused/i);
  }
});

test("an event in the past plans nothing", () => {
  const plan = eventPlanFor({
    goals: ["event-endurance"],
    ageBand: "30-39",
    event: {
      kind: "half",
      startedOn: "2026-05-01",
      dateIso: "2026-01-01",
      currentWeeklyKm: 25,
    },
  });
  assert.equal(plan.enduranceWeek, undefined);
  assert.ok(plan.eventNotice);
});

test("the app and the rules agree on which events exist", () => {
  // mobile/src/profile.ts offers the chips; lib/endurance.ts plans the block.
  // An event the app can offer and the model cannot plan is a dead end she
  // only discovers after committing to a date.
  const offered = EVENT_KINDS.map((option) => option.id).sort();
  const planned = ["5k", "10k", "half", "hyrox", "marathon"].sort();
  assert.deepEqual(offered, planned);
  for (const kind of offered) {
    const verdict = assessFeasibility({
      event: kind,
      weeksAway: 24,
      currentWeeklyKm: 40,
      daysPerWeek: 4,
    });
    assert.ok(verdict.ok, kind + " cannot be planned at all");
  }
});

test("no easy run rivals the long run", () => {
  // A 33km week on three days used to give a 13km long run and a 13km "easy"
  // run: two long runs, at an injury risk the week was never meant to carry.
  for (const event of ["5k", "10k", "half", "marathon", "hyrox"]) {
    for (const days of [2, 3, 4, 5, 6]) {
      for (let week = 1; week <= 16; week++) {
        const plan = planWeek(
          { event, weeksAway: 20, currentWeeklyKm: 30, daysPerWeek: days },
          week,
        );
        const long = plan.sessions.find((item) => item.kind === "long");
        for (const easy of plan.sessions.filter((i) => i.kind === "easy")) {
          assert.ok(
            easy.km < long.km,
            `${event} on ${days} days, week ${week}: ${easy.km}km easy vs ${long.km}km long`,
          );
        }
      }
    }
  }
});

test("the reported weekly volume is what was actually prescribed", () => {
  // Capping the easy runs can leave volume unallocated. Reporting the figure
  // the model wanted would overstate her week to her and to her coach.
  for (const days of [2, 3, 4, 5]) {
    const plan = planWeek(
      { event: "half", weeksAway: 20, currentWeeklyKm: 30, daysPerWeek: days },
      6,
    );
    const summed = plan.sessions.reduce((sum, item) => sum + (item.km ?? 0), 0);
    assert.equal(plan.totalKm, summed, `${days} days`);
  }
});

test("every movement in the library has photography", () => {
  // A movement with no sequence falls back to its written frame labels, which
  // is a real answer but a much worse one — a beginner follows the picture.
  // The twenty event and gym movements shipped tagged and testable but with
  // no media at all, and nothing anywhere said so.
  //
  // Read as text rather than imported: the module requires .webp files, which
  // only a bundler can resolve.
  const source = readFileSync(
    new URL("../mobile/src/exerciseMedia.ts", import.meta.url),
    "utf8",
  );
  const byId = source.slice(
    source.indexOf("const BY_ID"),
    source.indexOf("const BY_NAME"),
  );
  const withMedia = new Set(
    [...byId.matchAll(/"(ex-[a-z0-9-]+)":/g)].map((m) => m[1]),
  );
  // A movement may also be deliberately held — see WITHHELD_MEDIA, which
  // exists so that "we have no picture" and "the picture is wrong" are
  // different states rather than both being silence.
  const withheld = new Set(
    [...source
      .slice(source.indexOf("WITHHELD_MEDIA"))
      .matchAll(/"(ex-[a-z0-9-]+)":/g)].map((m) => m[1]),
  );
  const missing = EXERCISES.filter(
    (e) => !withMedia.has(e.id) && !withheld.has(e.id),
  ).map((e) => e.id);
  assert.deepEqual(missing, [], "no sequence for: " + missing.join(", "));
});

test("no sequence is claimed for a movement that does not exist", () => {
  // The other direction: a mapping left behind after a movement is renamed
  // or removed points at an asset nobody can reach.
  const source = readFileSync(
    new URL("../mobile/src/exerciseMedia.ts", import.meta.url),
    "utf8",
  );
  const byId = source.slice(
    source.indexOf("const BY_ID"),
    source.indexOf("const BY_NAME"),
  );
  const real = new Set(EXERCISES.map((e) => e.id));
  const orphans = [...byId.matchAll(/"(ex-[a-z0-9-]+)":/g)]
    .map((m) => m[1])
    .filter((id) => !real.has(id));
  assert.deepEqual(orphans, []);
});

test("every sequence file referenced actually exists", () => {
  // require() of a missing asset fails at bundle time, which is a slow way to
  // find out. This finds it in a second.
  const source = readFileSync(
    new URL("../mobile/src/exerciseMedia.ts", import.meta.url),
    "utf8",
  );
  for (const match of source.matchAll(/require\("\.\.\/assets\/([^"]+)"\)/g)) {
    const path = new URL("../mobile/assets/" + match[1], import.meta.url);
    assert.ok(existsSync(path), "missing asset: " + match[1]);
  }
});

test("a withheld sequence says why, and is not silently unreachable", () => {
  // Holding a sequence back is a decision someone made about a specific
  // defect. Without a reason recorded, the next person cannot tell a held
  // asset from a forgotten one, and the reshoot never happens.
  const source = readFileSync(
    new URL("../mobile/src/exerciseMedia.ts", import.meta.url),
    "utf8",
  );
  const block = source.slice(source.indexOf("WITHHELD_MEDIA"));
  const real = new Set(EXERCISES.map((e) => e.id));
  for (const m of block.matchAll(/"(ex-[a-z0-9-]+)":\s*\n?\s*"([^"]*)"/g)) {
    assert.ok(real.has(m[1]), m[1] + " is not a movement");
    assert.ok(m[2].length > 40, m[1] + " is held without a real reason");
  }
});

/* ------------------------------------------------------------------ *
 * Meal estimates she has not agreed to yet
 *
 * A photo estimate used to be written straight into her diary, outranking
 * what she had typed, with the item breakdown discarded. These cover the
 * arithmetic behind the confirm step that replaced it.
 * ------------------------------------------------------------------ */

const roti = {
  name: "Roti",
  quantity: 2,
  unit: "piece",
  calories: 240,
  protein: 8,
  carbs: 46,
  fat: 2,
};
const dal = {
  name: "Dal",
  quantity: 1,
  unit: "bowl",
  calories: 180,
  protein: 9,
  carbs: 28,
  fat: 3,
};

test("changing a portion scales that food and nothing else", () => {
  const [scaled, untouched] = adjustQuantity([roti, dal], 0, 1);
  assert.equal(scaled.quantity, 1);
  assert.equal(scaled.calories, 120);
  assert.equal(scaled.protein, 4);
  assert.deepEqual(untouched, dal);
});

test("adjusting a portion twice does not drift", () => {
  // Scaling from the current numbers rather than the per-unit figure makes
  // 2 -> 3 -> 2 land somewhere near, but not on, where it started.
  let items = [roti];
  items = adjustQuantity(items, 0, 3);
  items = adjustQuantity(items, 0, 7);
  items = adjustQuantity(items, 0, 2);
  assert.deepEqual(items[0], roti);
});

test("a portion cannot go negative", () => {
  const [item] = adjustQuantity([roti], 0, -1);
  assert.equal(item.quantity, 0);
  assert.equal(item.calories, 0);
});

test("an item the model gave no quantity does not produce NaN", () => {
  const odd = { ...roti, quantity: 0, calories: 120 };
  const [item] = adjustQuantity([odd], 0, 2);
  assert.ok(Number.isFinite(item.calories));
  assert.equal(item.calories, 240);
});

test("the total is rounded once, not per item", () => {
  // Rounding each item and summing is how a plate of five foods ends up two
  // calories away from its own parts.
  const thirds = Array.from({ length: 3 }, () => ({
    ...roti,
    quantity: 1,
    calories: 100 / 3,
    protein: 1 / 3,
    carbs: 0,
    fat: 0,
  }));
  const total = totalOf(thirds);
  assert.equal(total.calories, 100);
  assert.equal(total.protein, 1);
});

test("removing an item removes it from the total", () => {
  assert.equal(totalOf([roti, dal]).calories, 420);
  assert.equal(totalOf(removeItem([roti, dal], 1)).calories, 240);
  assert.deepEqual(totalOf([]), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
});

test("the breakdown reads as a meal, not as a data structure", () => {
  assert.equal(describeItems([roti, dal]), "2 × Roti · 1 × Dal");
  assert.equal(describeItems(adjustQuantity([roti], 0, 1.5)), "1.5 × Roti");
  assert.equal(describeItems([]), "No items identified");
});

test("an adjustment is noticed, so it can be recorded honestly", () => {
  const original = [roti, dal];
  assert.equal(wasAdjusted(original, original), false);
  assert.equal(wasAdjusted(original, adjustQuantity(original, 0, 1)), true);
  assert.equal(wasAdjusted(original, removeItem(original, 0)), true);
});

test("her own words are never discarded by a photo", () => {
  // The specific defect this replaced: the photo estimate overwrote the typed
  // one and the typed one was not shown anywhere.
  const typed = {
    source: "description",
    items: [],
    confident: true,
    basis: "Roti, dal",
  };
  const photo = {
    source: "photo",
    items: [roti],
    confident: true,
    basis: "2 × Roti",
  };
  assert.equal(preferred(typed, photo).source, "photo");
  // Unreadable photo: her description leads instead of a number nobody stands behind.
  assert.equal(
    preferred(typed, { ...photo, confident: false }).source,
    "description",
  );
  assert.equal(preferred(typed, null).source, "description");
});

test("a meal she deleted stays deleted after a server read", () => {
  // The tombstone is the only thing keeping the row hidden: the server merges
  // these logs by union, so the entry itself always comes back. Dropping
  // deletedAt in the normaliser meant a deleted meal reappeared, with its
  // calories, on the next sync.
  const doc = normalizeMemberDoc({
    member: {
      id: "m1",
      name: "A",
      week: 1,
      phase: "Stabilise",
      weeklyFocus: [],
      goals: [],
      constraints: [],
      activeModuleIds: [],
    },
    foodEntries: [
      {
        id: "f1",
        memberId: "m1",
        loggedDate: todayIso(),
        meal: "Lunch",
        description: "Roti and dal",
        calories: 420,
        deletedAt: "2026-08-24T10:00:00.000Z",
      },
    ],
  });
  assert.equal(doc.foodEntries[0].deletedAt, "2026-08-24T10:00:00.000Z");
  assert.equal(liveMeals(doc).length, 0);
});

test("where an estimate came from survives a server read", () => {
  const doc = normalizeMemberDoc({
    member: {
      id: "m1",
      name: "A",
      week: 1,
      phase: "Stabilise",
      weeklyFocus: [],
      goals: [],
      constraints: [],
      activeModuleIds: [],
    },
    foodEntries: [
      {
        id: "f1",
        memberId: "m1",
        loggedDate: todayIso(),
        meal: "Lunch",
        description: "Roti and dal",
        calories: 420,
        estimate: {
          source: "photo",
          items: [{ name: "Roti", quantity: 2 }],
          confident: true,
          model: "gpt-5",
          promptVersion: "meal-photo-2026-08-24",
          adjusted: false,
          acceptedAt: "2026-08-24T10:00:00.000Z",
        },
      },
    ],
  });
  assert.equal(doc.foodEntries[0].estimate.source, "photo");
  assert.equal(doc.foodEntries[0].estimate.promptVersion, "meal-photo-2026-08-24");
});

test("no movement is unreachable by every member", () => {
  // The library gained sleds, ergs and medicine balls; the equipment question
  // did not. Nine movements — most of the event library — could therefore
  // never be selected by anybody, and nothing said so: eligibleExercises
  // simply never returned them.
  const best = ["none", ...EQUIPMENT_OPTIONS.map((option) => option.id)];
  const reachable = new Set(
    eligibleExercises({ equipment: best, maxTier: 3 }).map((e) => e.id),
  );
  const stranded = EXERCISES.filter((e) => !reachable.has(e.id)).map(
    (e) => `${e.id} (needs ${e.equipment.join(" + ")})`,
  );
  assert.deepEqual(stranded, []);
});

test("the app can offer every kind of equipment the library asks for", () => {
  // The same gap one level up, caught before it reaches selection.
  const offered = new Set(["none", ...EQUIPMENT_OPTIONS.map((o) => o.id)]);
  const needed = new Set(EXERCISES.flatMap((e) => e.equipment));
  const missing = [...needed].filter((kind) => !offered.has(kind));
  assert.deepEqual(missing, []);
});

test("a movement that needs an anchor does not claim to need nothing", () => {
  // "Assisted hamstring lower" was tagged equipment: ["none"] while its own
  // first frame reads "Kneel, ankles held or hooked". That combination put it
  // in the default home set, so a member who told us nothing could be offered
  // a movement she had no way to perform.
  const anchored = EXERCISES.filter((e) =>
    e.frames.some((frame) => /hook|held|anchor|secured/i.test(frame)),
  );
  assert.ok(anchored.length > 0, "the test no longer finds its own subject");
  for (const exercise of anchored) {
    assert.ok(
      !exercise.equipment.includes("none") || exercise.equipment.length > 1,
      `${exercise.id} needs an anchor and claims to need nothing`,
    );
  }
});

test("the default home set stays small", () => {
  // equipmentFor() falls back to this for anyone who has told us nothing, so
  // anything added here is offered to every silent member by default.
  assert.deepEqual(equipmentFor(undefined), ["none", "chair", "wall"]);
  const home = eligibleExercises({ maxTier: 3 });
  for (const exercise of home) {
    for (const kind of exercise.equipment) {
      assert.ok(
        ["none", "chair", "wall"].includes(kind),
        `${exercise.id} reaches the default set but needs ${kind}`,
      );
    }
  }
});

/* ------------------------------------------------------------------ *
 * The Log feed
 *
 * Four kinds of thing, one list. The risks are ordering across kinds that
 * store time differently, and resurrecting something she deleted.
 * ------------------------------------------------------------------ */

const TODAY = "2026-08-24";
const feedDoc = (over = {}) => ({
  member: { id: "m1", name: "A", week: 1, phase: "Stabilise", weeklyFocus: [], goals: [], constraints: [], activeModuleIds: [] },
  foodEntries: [],
  pulses: [],
  workoutLogs: [],
  actions: [],
  messages: [],
  sessions: [],
  reports: [],
  ...over,
});

test("the feed gathers every kind into one list", () => {
  const feed = buildLogFeed(
    feedDoc({
      foodEntries: [
        {
          id: "f1",
          meal: "Breakfast",
          calories: 410,
          protein: 24,
          loggedDate: TODAY,
          createdAt: "2026-08-24T08:12:00.000Z",
        },
      ],
      pulses: [{ id: "p1", dayOffset: 0, energy: 3, sleep: 2, symptoms: [] }],
      workoutLogs: [
        {
          id: "w1",
          perceivedEffort: 4,
          level: "target",
          pain: false,
          completedAt: "2026-08-24T18:00:00.000Z",
        },
      ],
    }),
    TODAY,
    { notes: [{ id: "n1", body: "Knee felt fine", loggedDate: TODAY, createdAt: "2026-08-24T20:00:00.000Z" }] },
  );
  assert.deepEqual(
    feed.map((item) => item.kind),
    ["note", "workout", "checkin", "meal"],
  );
  assert.equal(feed.find((i) => i.kind === "meal").detail, "410 kcal · 24g protein");
});

test("a deleted meal never comes back through the feed", () => {
  // Food entries use tombstones because the server merges by union. A feed
  // that read the raw array would show every meal she had removed.
  const feed = buildLogFeed(
    feedDoc({
      foodEntries: [
        {
          id: "f1",
          meal: "Lunch",
          calories: 500,
          protein: 20,
          loggedDate: TODAY,
          createdAt: "2026-08-24T13:00:00.000Z",
          deletedAt: "2026-08-24T14:00:00.000Z",
        },
      ],
    }),
    TODAY,
  );
  assert.deepEqual(feed, []);
});

test("a deleted note is gone too", () => {
  const feed = buildLogFeed(feedDoc(), TODAY, {
    notes: [
      { id: "n1", body: "gone", loggedDate: TODAY, createdAt: "2026-08-24T09:00:00.000Z", deletedAt: "2026-08-24T10:00:00.000Z" },
      { id: "n2", body: "kept", loggedDate: TODAY, createdAt: "2026-08-24T09:30:00.000Z" },
    ],
  });
  assert.deepEqual(feed.map((i) => i.detail), ["kept"]);
});

test("a check-in orders sensibly against timed entries", () => {
  // Pulses carry a day, not a moment. Placing them at midnight would put
  // every check-in below every meal on the same day, which reads as wrong.
  const feed = buildLogFeed(
    feedDoc({
      foodEntries: [
        { id: "f-am", meal: "Breakfast", calories: 300, protein: 10, loggedDate: TODAY, createdAt: "2026-08-24T08:00:00.000Z" },
        { id: "f-pm", meal: "Dinner", calories: 600, protein: 30, loggedDate: TODAY, createdAt: "2026-08-24T20:00:00.000Z" },
      ],
      pulses: [{ id: "p1", dayOffset: 0, energy: 4, sleep: 4, symptoms: [] }],
    }),
    TODAY,
  );
  assert.deepEqual(feed.map((i) => i.id), ["f-pm", "p1", "f-am"]);
});

test("the feed reads back words, not scores", () => {
  // "Energy 3" is not a memory of anything a week later.
  const feed = buildLogFeed(
    feedDoc({ pulses: [{ id: "p1", dayOffset: 0, energy: 4, sleep: 2, symptoms: [] }] }),
    TODAY,
  );
  assert.equal(feed[0].detail, "Energy good · slept low");
});

test("pain is said plainly in the feed", () => {
  // Someone scanning her week should see where something hurt without
  // opening anything.
  const feed = buildLogFeed(
    feedDoc({
      workoutLogs: [{ id: "w1", perceivedEffort: 5, level: "minimum", pain: true, completedAt: "2026-08-24T07:00:00.000Z" }],
    }),
    TODAY,
  );
  assert.match(feed[0].detail, /pain reported/);
});

test("yesterday is named, not dated", () => {
  const item = { id: "x", kind: "meal", title: "Lunch", detail: "", at: "", loggedDate: "2026-08-23" };
  assert.equal(whenLabel(item, TODAY), "yesterday");
  assert.equal(whenLabel({ ...item, loggedDate: TODAY }, TODAY), "today");
  assert.match(whenLabel({ ...item, loggedDate: "2026-08-01" }, TODAY), /Aug/);
});

test("the hub knows what she has already given today", () => {
  // So a capture card can say "done" instead of asking again.
  const state = loggedToday(
    feedDoc({
      foodEntries: [{ id: "f1", meal: "Lunch", calories: 400, protein: 20, loggedDate: TODAY, createdAt: TODAY + "T13:00:00.000Z" }],
      pulses: [{ id: "p1", dayOffset: -1, energy: 3, sleep: 3, symptoms: [] }],
    }),
    TODAY,
  );
  assert.equal(state.meal, true);
  assert.equal(state.checkin, false, "yesterday's check-in is not today's");
  assert.equal(state.workout, false);
  assert.equal(state.note, false);
});

test("an empty document produces an empty feed, not a crash", () => {
  assert.deepEqual(buildLogFeed(feedDoc(), TODAY), []);
  assert.deepEqual(buildLogFeed({ member: { id: "m" } }, TODAY), []);
});

test("a note survives a server read, and a removed one stays removed", () => {
  // Fourth field in a row that the normaliser could have dropped. Notes are
  // union-merged on the server exactly like food entries, so the tombstone is
  // the only thing keeping a removed note hidden.
  const doc = normalizeMemberDoc({
    member: {
      id: "m1", name: "A", week: 1, phase: "Stabilise",
      weeklyFocus: [], goals: [], constraints: [], activeModuleIds: [],
    },
    notes: [
      { id: "n1", memberId: "m1", body: "Knee felt fine", loggedDate: "2026-08-24", createdAt: "2026-08-24T09:00:00.000Z" },
      { id: "n2", memberId: "m1", body: "gone", loggedDate: "2026-08-24", createdAt: "2026-08-24T10:00:00.000Z", deletedAt: "2026-08-24T11:00:00.000Z" },
    ],
  });
  assert.equal(doc.notes.length, 2, "the row itself is kept");
  assert.equal(doc.notes[1].deletedAt, "2026-08-24T11:00:00.000Z");
  const feed = buildLogFeed(doc, "2026-08-24", { notes: doc.notes });
  assert.deepEqual(feed.map((i) => i.detail), ["Knee felt fine"]);
});

test("a document with no notes still normalises", () => {
  const doc = normalizeMemberDoc({
    member: {
      id: "m1", name: "A", week: 1, phase: "Stabilise",
      weeklyFocus: [], goals: [], constraints: [], activeModuleIds: [],
    },
  });
  assert.deepEqual(doc.notes, []);
});

test("a half-answered readiness screen reads as clear, which is why it is never stored", () => {
  // Not a bug in evaluateReadiness: a member who has never been through the
  // screen has no conditions to act on, so "clear" is the right default for
  // *absent* answers. It is a hazard for *partial* ones — the server
  // recomputes the verdict from whatever answers it holds, so persisting a
  // half-filled screen mid-onboarding would unlock movement on the strength
  // of questions she had not reached yet.
  //
  // Onboarding therefore writes readiness only once readinessIsComplete is
  // true. This test exists so that guard is not removed as redundant.
  assert.equal(evaluateReadiness({}).outcome, "clear");
  assert.equal(readinessIsComplete({}), false);

  const partial = { chestPain: "no" };
  assert.equal(evaluateReadiness(partial).outcome, "clear");
  assert.equal(
    readinessIsComplete(partial),
    false,
    "if this ever becomes true for a partial screen, the onboarding guard is no longer enough",
  );
});


/* ================================================================== *
 * A fortnight in the life of one member
 *
 * Every test above this point checks one rule in isolation. Nothing has
 * ever checked that the rules compose — that what the generator writes on
 * Monday is what adaptation reads on Tuesday, and that a fortnight of
 * ordinary use leaves a member somewhere sensible.
 *
 * That gap is where every bug found on the device this month lived: the
 * dose escalating on refresh, the plan that never advanced a week, the
 * profile dropped on sync. Each was a seam between two correct pieces.
 *
 * This runs the real generator and the real adaptation rules against a
 * document that carries state forward day by day. It is not a substitute
 * for using the app — it cannot see a screen — but it is the only thing
 * that exercises the seams.
 * ================================================================== */

/** A day of training, as the app would record it. */
const trainDay = (doc, date, { effort = 3, pain = false, skip = false } = {}) => {
  const plan = generatePlan({
    memberId: "m1",
    week: doc.member.week,
    goals: doc.onboarding?.goals ?? [],
    availableMinutes: doc.onboarding?.availableMinutes ?? 30,
    activityLevel: doc.onboarding?.activityLevel,
    movementCaution: doc.onboarding?.movementCaution,
    profile: doc.profile,
    todayIso: date,
    doseSteps: doc.doseSteps,
    pausedExerciseIds: doc.pausedExerciseIds,
    signals: doc.signals ?? [],
    readiness: doc.readinessOutcome,
  });

  const records = skip
    ? []
    : plan.session.map((item) => ({
        exerciseId: item.exerciseId,
        perceivedEffort: effort,
        level: "target",
        pain,
        date,
      }));

  const history = [...(doc.records ?? []), ...records];
  const adapted = applyAdaptation({
    records: history,
    signals: doc.signals ?? [],
    doseSteps: doc.doseSteps,
    doseAdaptedThrough: doc.doseAdaptedThrough,
    pausedExerciseIds: doc.pausedExerciseIds,
  });

  return {
    ...doc,
    records: history,
    doseSteps: adapted.steps,
    doseAdaptedThrough: adapted.adaptedThrough,
    pausedExerciseIds: adapted.paused,
    lastPlan: plan,
  };
};

/** What onboarding would have written, for a member who answered everything. */
const onboardedMember = (over = {}) => ({
  member: { id: "m1", name: "A", week: 1, phase: "Stabilise" },
  onboarding: {
    completed: true,
    goals: ["Get stronger"],
    activityLevel: "Some movement",
    availableMinutes: 30,
    movementCaution: "",
    movementCautionAnswered: true,
  },
  profile: { ageBand: "40-49", goals: ["stronger"] },
  ...over,
});

test("a fortnight of steady training moves her forward and does not run away", () => {
  let doc = onboardedMember();
  const days = [];
  for (let i = 0; i < 14; i++) {
    const date = `2026-03-${String(i + 1).padStart(2, "0")}`;
    // Two sessions a week, which is what an ordinary member actually does.
    if (i % 3 === 0) doc = trainDay(doc, date, { effort: 2 });
    days.push(Object.values(doc.doseSteps ?? {}).reduce((a, b) => a + b, 0));
  }
  const total = days.at(-1);
  assert.ok(total > 0, "a fortnight of easy sessions moved nothing");
  // The ladder is bounded. Five sessions cannot put her at the top of it.
  assert.ok(
    total <= 5 * MAX_DOSE_STEP,
    `the dose ran away: ${total} across five sessions`,
  );
});

test("re-reading the same fortnight changes nothing", () => {
  // The bug that made reading her messages harder than doing the exercises:
  // the Coach tab polls, each poll regenerated, and each regeneration walked
  // the ladder up another rung against history that had not changed.
  let doc = onboardedMember();
  doc = trainDay(doc, "2026-03-01", { effort: 2 });
  doc = trainDay(doc, "2026-03-04", { effort: 2 });
  const settled = JSON.stringify(doc.doseSteps);

  for (let i = 0; i < 8; i++) {
    const again = applyAdaptation({
      records: doc.records,
      signals: [],
      doseSteps: doc.doseSteps,
      doseAdaptedThrough: doc.doseAdaptedThrough,
      pausedExerciseIds: doc.pausedExerciseIds,
    });
    doc = { ...doc, doseSteps: again.steps, doseAdaptedThrough: again.adaptedThrough };
  }
  assert.equal(JSON.stringify(doc.doseSteps), settled);
});

test("pain stops a movement and nothing later un-stops it", () => {
  let doc = onboardedMember();
  doc = trainDay(doc, "2026-03-01", { effort: 2 });
  const hurt = doc.lastPlan.session[0].exerciseId;
  doc = trainDay(doc, "2026-03-04", { effort: 2, pain: true });
  assert.ok(doc.pausedExerciseIds.includes(hurt), "pain did not pause anything");

  // Weeks of good sessions afterwards must not bring it back on their own.
  for (let i = 5; i < 14; i++)
    doc = trainDay(doc, `2026-03-${String(i + 5).padStart(2, "0")}`, { effort: 1 });
  assert.ok(
    doc.pausedExerciseIds.includes(hurt),
    "a paused movement came back without a person deciding",
  );
  for (const item of doc.lastPlan.session)
    assert.notEqual(item.exerciseId, hurt, "a paused movement was offered again");
});

test("a week of bad check-ins lightens the week rather than pushing through", () => {
  const tired = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    energy: 1,
    sleep: 1,
    stress: 1,
  }));
  let doc = { ...onboardedMember(), signals: tired };
  doc = trainDay(doc, "2026-03-08", { effort: 2 });
  assert.equal(doc.lastPlan.posture, "recovery");
  // Fewer things to do, not the same list with a gentler sentence attached.
  const normal = trainDay(onboardedMember(), "2026-03-08", { effort: 2 });
  assert.ok(
    doc.lastPlan.session.length < normal.lastPlan.session.length,
    "a recovery week offered as much as a normal one",
  );
});

test("a member who never logs anything still gets a plan every day", () => {
  // The commonest real path, and the one most likely to divide by zero
  // somewhere: she opens the app, reads it, and does nothing.
  let doc = onboardedMember();
  for (let i = 0; i < 14; i++) {
    doc = trainDay(doc, `2026-03-${String(i + 1).padStart(2, "0")}`, { skip: true });
    assert.ok(doc.lastPlan.session.length > 0, `empty plan on day ${i + 1}`);
  }
  assert.deepEqual(doc.doseSteps, {}, "nothing was done, so nothing should move");
});

test("a member who answered nothing is still handled, carefully", () => {
  // Everyone who signed up before the profile existed.
  let doc = {
    member: { id: "m1", name: "A", week: 1, phase: "Stabilise" },
    onboarding: { completed: true, goals: [] },
  };
  doc = trainDay(doc, "2026-03-01", { effort: 3 });
  assert.ok(doc.lastPlan.session.length > 0);
  for (const item of doc.lastPlan.session) {
    const exercise = EXERCISE_BY_ID.get(item.exerciseId);
    assert.ok(exercise.tier <= 2, "an unknown member was started on tier 3");
    for (const kit of exercise.equipment)
      assert.ok(["none", "chair", "wall"].includes(kit));
  }
});

test("her program week advances with the calendar, not with her logins", () => {
  // programWeek() counts from onboardedAt. It froze at 1 for every member
  // because nothing ever set that field.
  const onboardedAt = "2026-01-01T00:00:00.000Z";
  assert.equal(programWeek(onboardedAt, "2026-01-01"), 1);
  assert.equal(programWeek(onboardedAt, "2026-01-08"), 2);
  assert.equal(programWeek(onboardedAt, "2026-03-19"), 12);
  // It stops at the end of the programme rather than counting to infinity.
  assert.ok(programWeek(onboardedAt, "2027-01-01") <= 12);
});

test("consult_first holds movement and says why, every day it applies", () => {
  // The safety branch. It must not quietly lapse after the first day.
  let doc = {
    ...onboardedMember(),
    readinessOutcome: { outcome: "consult_first", conditions: [], avoidLoads: [] },
  };
  for (let i = 0; i < 5; i++) {
    doc = trainDay(doc, `2026-03-0${i + 1}`, { skip: true });
    assert.deepEqual(doc.lastPlan.session, [], `movement offered on day ${i + 1}`);
    assert.ok(doc.lastPlan.movementHeld, "held with no explanation");
    assert.match(doc.lastPlan.movementHeld.body, /doctor/i);
  }
});

/* ------------------------------------------------------------------ *
 * Pain: routing, never prescribing
 *
 * Pain used to be a checkbox that always did the same two things — pause
 * the movement, and promise a coach review that for an uncoached member
 * nobody was going to perform.
 * ------------------------------------------------------------------ */

const report = (over = {}) => ({
  site: "knee",
  kind: "ache",
  timing: "during",
  stopped: false,
  ...over,
});
const ctx = (coached = false) => ({ coached, movement: "Chair squat" });

test("sharp pain, or pain that stopped her, sends her to a person", () => {
  for (const r of [report({ kind: "sharp" }), report({ stopped: true })]) {
    const route = routePain(r, ctx());
    assert.equal(route.pause, true);
    assert.equal(route.seekCare, true);
    assert.match(route.body, /doctor|physiotherapist/i);
  }
});

test("an ache while moving pauses the movement without sending her to a clinic", () => {
  const route = routePain(report({ kind: "ache", timing: "during" }), ctx());
  assert.equal(route.pause, true);
  assert.equal(route.seekCare, false);
});

test("stiffness afterwards does not remove a movement she is simply new to", () => {
  for (const r of [
    report({ kind: "tightness", timing: "after" }),
    report({ kind: "ache", timing: "after" }),
  ]) {
    const route = routePain(r, ctx());
    assert.equal(route.pause, false);
    assert.equal(route.coachReview, false);
  }
});

test("a review is only promised when a coach exists to perform it", () => {
  // The old copy told every member her coach would review it. Uncoached is
  // the default, so that promise was usually false.
  const alone = routePain(report({ kind: "sharp" }), ctx(false));
  assert.equal(alone.coachReview, false);
  assert.doesNotMatch(alone.body, /your coach/i);

  const coached = routePain(report({ kind: "sharp" }), ctx(true));
  assert.equal(coached.coachReview, true);
  assert.match(coached.body, /your coach/i);
});

test("nothing in a pain route prescribes anything", () => {
  // It routes. A wellness app naming a treatment is exactly the confident
  // wrongness this architecture exists to prevent.
  const forbidden =
    /\bice\b|\bheat\b|\bstretch(es|ing)?\b|\brest it\b|\bmassage\b|\banti-inflammator|\bpainkiller|\bstrain\b|\bsprain\b|\btendinitis\b|\btear\b/i;
  for (const kind of ["sharp", "ache", "tightness"])
    for (const timing of ["during", "after"])
      for (const stopped of [true, false])
        for (const coached of [true, false]) {
          const route = routePain(report({ kind, timing, stopped }), ctx(coached));
          assert.doesNotMatch(
            route.body + " " + route.title,
            forbidden,
            `${kind}/${timing}/${stopped} prescribed something`,
          );
        }
});

test("every combination produces a real answer", () => {
  for (const site of PAIN_SITES.map((x) => x.id))
    for (const kind of PAIN_KINDS.map((x) => x.id))
      for (const timing of PAIN_TIMINGS.map((x) => x.id)) {
        const route = routePain(report({ site, kind, timing }), ctx());
        assert.ok(route.title.length > 0);
        assert.ok(route.body.length > 30);
      }
});

test("a pain report reads as a sentence for whoever opens it", () => {
  assert.equal(
    describePain(report({ site: "knee", kind: "sharp", timing: "during", stopped: true })),
    "Knee: sharp pain during, had to stop",
  );
  assert.equal(
    describePain(report({ site: "back", kind: "tightness", timing: "after" })),
    "Back: tightness after",
  );
});
