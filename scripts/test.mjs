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
