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
  rebaseMemberDoc,
  todayIso,
} from "../lib/day-offset.ts";
import { estimateMeal } from "../mobile/src/nutrition.ts";

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

import { activityFor, rankByConsistency, normaliseCity, normaliseDisplayName } from "../lib/circle.ts";
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
  reports: [{ id: "r1", title: "Annual blood panel", values: [{ label: "Ferritin", value: "38" }] }],
  messages: [{ id: "m1", from: "coach", body: "How did the week go?" }],
  pulses: [{ id: "p1", dayOffset: 0, energy: 2, stress: 1, symptoms: ["cramps"] }],
  healthSnapshots: [
    { metric: "steps", value: 6421, available: true, date: "2026-08-23" },
    { metric: "restingHeartRate", value: 68, available: true, date: "2026-08-23" },
  ],
  hydrationLogs: [{ date: "2026-08-23", glasses: 5 }],
};

const profile = { displayName: "Radhika", city: "Bengaluru" };

test("the circle projection exposes only the agreed fields", () => {
  const view = activityFor("radhika", privateDoc, profile, "2026-08-23");
  assert.deepEqual(
    Object.keys(view).sort(),
    [
      "actionsCompleted",
      "actionsTotal",
      "activeDays",
      "city",
      "displayName",
      "hydrationGlasses",
      "memberId",
      "steps",
    ],
  );
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
  const view = activityFor("nobody", null, { displayName: "Meera" }, "2026-08-23");
  assert.equal(view.actionsCompleted, 0);
  assert.equal(view.steps, undefined);
  assert.equal(view.displayName, "Meera");
});

test("ranking rewards consistency over intensity", () => {
  const ranked = rankByConsistency([
    { memberId: "hard", displayName: "Hard", activeDays: 1, actionsCompleted: 5, actionsTotal: 5 },
    { memberId: "steady", displayName: "Steady", activeDays: 5, actionsCompleted: 1, actionsTotal: 5 },
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
  let doc = withHydration({ member: { id: "r" }, hydrationLogs: [] }, 4, "2026-08-22");
  doc = withHydration(doc, 2, "2026-08-23");
  assert.equal(hydrationFor(doc, "2026-08-22"), 4);
  assert.equal(hydrationFor(doc, "2026-08-23"), 2);
});

test("a habit toggles on and off without leaving a negative record", () => {
  let doc = withHabitAdded({ member: { id: "r" }, habits: [], habitLogs: [] }, "Stretch");
  const habitId = doc.habits[0].id;
  doc = withHabitToggled(doc, habitId, "2026-08-23");
  assert.ok(habitDoneOn(doc, habitId, "2026-08-23"));
  doc = withHabitToggled(doc, habitId, "2026-08-23");
  assert.ok(!habitDoneOn(doc, habitId, "2026-08-23"));
  assert.equal(doc.habitLogs.length, 0);
});

test("the same habit is not added twice", () => {
  let doc = withHabitAdded({ member: { id: "r" }, habits: [], habitLogs: [] }, "Stretch");
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

test("\"not sure\" is treated exactly like yes", () => {
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
  for (const phrase of ["lower back pain", "slipped disc", "sciatica", "spine issue"]) {
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
    conditions: ["pregnancy", "high_blood_pressure", "osteoporosis", "dizziness"],
    equipment: ["none", "chair", "wall"],
    maxTier: 1,
  });
  assert.ok(offered.length >= 3, `only ${offered.length} movements left`);
});

test("every progression and regression points at a real exercise", () => {
  for (const exercise of EXERCISES) {
    for (const link of [exercise.progressesTo, exercise.regressesTo]) {
      if (!link) continue;
      assert.ok(EXERCISE_BY_ID.has(link), `${exercise.id} points at missing ${link}`);
    }
  }
});

test("a progression is never easier than what it progresses from", () => {
  for (const exercise of EXERCISES) {
    const harder = exercise.progressesTo && EXERCISE_BY_ID.get(exercise.progressesTo);
    if (harder) assert.ok(harder.tier >= exercise.tier, `${exercise.id} -> ${harder.id}`);
    const easier = exercise.regressesTo && EXERCISE_BY_ID.get(exercise.regressesTo);
    if (easier) assert.ok(easier.tier <= exercise.tier, `${exercise.id} -> ${easier.id}`);
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
  assert.equal(weekPostureFor([{ date: "2026-08-23", sleep: 1 }]).posture, "normal");
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
  assert.ok(result.step < MAX_DOSE_STEP, "dose should reset for the harder move");
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
    const session = selectSession({ ...baseInput, availableMinutes: minutes }, "normal");
    const total = session.reduce((sum, e) => sum + e.minutes, 0);
    assert.ok(total <= movementBudget(minutes), `${minutes}min -> ${total}min`);
  }
});

test("goals change what she is shown first", () => {
  const strength = selectSession({ ...baseInput, goals: ["Feel stronger"] }, "normal");
  const stress = selectSession({ ...baseInput, goals: ["Manage stress"] }, "normal");
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
  const session = selectSession({ ...baseInput, week: 1, availableMinutes: 45 }, "normal");
  for (const item of session) {
    assert.equal(EXERCISE_BY_ID.get(item.exerciseId).tier, 1, item.name);
  }
});

test("a paused movement is never offered again by generation", () => {
  const session = selectSession(
    { ...baseInput, availableMinutes: 60, pausedExerciseIds: ["ex-chair-squat"] },
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
  const plan = generatePlan({ ...baseInput, coachAuthoredDomains: ["movement"] });
  assert.equal(plan.session.length, 0);
  assert.deepEqual(plan.filledDomains, []);
});

test("a recovery week produces a shorter session, not a harder one", () => {
  const normal = selectSession({ ...baseInput, availableMinutes: 45 }, "normal");
  const recovery = selectSession({ ...baseInput, availableMinutes: 45 }, "recovery");
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
      conditions: ["pregnancy", "osteoporosis", "high_blood_pressure", "dizziness"],
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
  const plan = generatePlan({ ...baseInput, coachAuthoredDomains: ["movement"] });
  assert.equal(plan.session.length, 0);
  assert.deepEqual(plan.filledDomains, []);
});

test("a coach holding a different domain still leaves movement generated", () => {
  const plan = generatePlan({ ...baseInput, coachAuthoredDomains: ["nutrition"] });
  assert.ok(plan.session.length > 0);
});

/* ---- onboarding field sanitising (the shape the generator consumes) ---- */

test("an unrecognised goal never reaches the member record", () => {
  // Whatever a conversation produces, the document only ever holds the same
  // vocabulary the form would have written.
  const goals = ["Feel stronger", "lose 10kg fast", "Manage stress"];
  const known = [
    "Steadier energy", "Feel stronger", "Improve mobility", "Manage stress",
    "Sleep more consistently", "Support hormonal or life-stage wellbeing",
    "Improve endurance",
  ];
  const kept = goals.filter((g) =>
    known.some((k) => k.toLowerCase() === g.toLowerCase()),
  );
  assert.deepEqual(kept, ["Feel stronger", "Manage stress"]);
});

test("the generator tolerates nonsense minutes without producing a nonsense day", () => {
  for (const minutes of [0, -30, NaN, 9999]) {
    const session = selectSession({ ...baseInput, availableMinutes: minutes }, "normal");
    assert.ok(session.length >= 1 && session.length <= 6, `${minutes} -> ${session.length}`);
  }
});
