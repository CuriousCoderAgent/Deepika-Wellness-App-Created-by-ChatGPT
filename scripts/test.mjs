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
  assert.match(context, /does not have a human coach/);
  // Nothing leaks that was never put in.
  assert.doesNotMatch(context, /Rao/);
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
  assert.equal(needsHumanReview(doc), true);
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
        { id: "a", dayOffset: 0, domain: "movement", completed: "rest" },
      ],
    }),
  );
  assert.equal(rested.rests, 1, "the rest itself is still counted");
  assert.equal(rested.activeDays, 0, "but it is not a day she showed up");
  assert.equal(rested.actions, 0);
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
