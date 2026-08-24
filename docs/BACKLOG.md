# Bharosa — what is pending, in priority order

**Last updated:** 24 August 2026, after the external audit response
(`docs/AUDIT-RESPONSE-2026-08-24.md`) and a device-testing round.
**State:** 226 tests passing, mobile and server typecheck clean, `next build`
clean. All eight audit P0s closed; P1 and P2 closed. Every movement in the
library has photography.

This is the working backlog. It is ordered by what should happen next, not by
how large each item is. Where something is deliberately *not* being done, it
says so and why — an item missing from a backlog reads as forgotten, and most
of these were decisions.

---

## P1 — Small, real, and worth clearing first

**Done.** Each fed the personalisation work in P2, which is why they went
first — that work needed clean inputs.

### 1.1 Food macros accept impossible values

`saveCorrection` in the Food screen does `Number(editValues.calories) || 0`
with no bounds, so `-500` and `999999` both save.

Corrupts her own totals, and also the `lowProtein` / `lowFoodLogging` signals
the plan generator reads — so a mistyped correction silently changes what she
is offered tomorrow.

Fix: plausible bounds, and ask rather than clamp silently.

### 1.2 The caution question can be skipped without answering

Onboarding step 3 asks "Anything your coach should respect?" and
`canContinue` returns `true` regardless. A blank answer is therefore
ambiguous: nothing to declare, or did not engage with the question?

`plan-generator.ts` treats an absent caution as no restrictions. Requiring an
explicit "Nothing to add" makes the two distinguishable, which matters more
once more of the plan keys off this field.

### 1.3 "Notable win" is a count, not a win

Renders "7 planned actions completed" under a heading promising something
meaningful. Hollow praise is the kind of thing that costs trust the first time
someone notices, and this product's whole claim is that it reads her honestly.

Either reference a real event — first time at a dose, a movement that
progressed, a week she trained on a day she usually does not — or drop the
card.

### 1.4 Three recommendation kinds cannot be acted on

`reorder_actions`, `adjust_reminder` and `reduce_target` exist in
`AiRecommendation["kind"]` and nothing anywhere can apply them. They are
generated, stored, and inert.

Either build a preview/apply/undo path or remove the kinds. Leaving them is
how a state machine rots.

---

## P2 — Making the plan genuinely personal

**Done, 2026-08-24.** Kept here because the diagnosis is worth not
re-deriving, and because what is *not* done is at the bottom.

### The diagnosis, as it stood

`GeneratorInput` received goals, availableMinutes, activityLevel,
movementCaution, readiness, doseSteps, pausedExerciseIds, signals and
coachAuthoredDomains. No age, no equipment, no event goal.

Two of those were worse than missing — they were collected and ignored:

- **activityLevel** was stored, passed into the generator, and never read.
  The screen asking for it says it "establishes a starting point".
- More seriously, `pickForPattern` sorted ascending by tier and took the
  first match. Everything upstream that narrowed the candidate list was
  therefore decorative: the ceiling was computed and then reached past for
  the gentlest movement in the pattern. **This, not the size of the library,
  is why every member saw the same wall push-up.**

The point stands and is worth repeating: 350 exercises chosen by 5 inputs is
still generic. 55 well-tagged movements chosen by 12 real inputs is not.

### What now exists

`lib/member-profile.ts` — the rules. One tier ramp shifted by age band and by
prior activity, so an older member starts lower and still arrives; equipment
defaulting to the home set; life stage; free-text "won't do" read through the
same matcher as a medical caution; training days; sleep baseline.

Goals are matched by **id**, not by display label. Four labels changed when
the list grew to ten, and the old strings are carried as `legacy` so a member
who chose "Feel stronger" in June keeps her pattern ordering. A test holds the
app's table and the rules' table together — they are separate files on
purpose, and nothing but that test stops them drifting.

Onboarding asks age and goal in the core flow, then **asks permission** before
the more personal questions. Declining ends the flow there and costs nothing;
**About you** in the You tab answers or changes any of it later, which is the
promise that makes the gate honest.

Event goals route to `lib/endurance.ts`, with distance, date and honest
current volume asked alongside the goal. An event goal that cannot be planned
says so rather than quietly producing a strength week.

### Two things found while wiring it

- `movementHeld` — including "speak to a doctor before beginning a movement
  plan" — was returned from a route whose response the app discards. A member
  whose readiness answers held movement saw an empty movement section and no
  explanation anywhere. Notices now live on the document and render on Today.
- An endurance week on three training days put all leftover volume into a
  single easy run: a 13km "easy" run beside a 13km long run. Easy runs are now
  capped against the long run, and the reported weekly total is what was
  actually prescribed rather than what the model wanted.

### Still open from this section

- **Onboarding does not resume.** Nothing is saved until `finish()`, so
  closing the app mid-flow loses every answer. The audit flags this
  separately and it is now the largest remaining gap in this area.
- **Nutrition inputs** — pattern, preferences, allergies — are still not
  collected, so food prompts and the estimator have no personal context.
- **Available time by weekday.** She picks which days, not how long on each.
- **Coaching preference** (AI-only, waitlist, assigned) is not asked.
- **Professional review of the 21 event movements.** They are tagged and
  tested but not cleared by a qualified professional, which is the standard
  the other 34 were held to. Until that happens the event goals should be
  treated as internal.
- ~~Photography for 47 movements~~ — **done 2026-08-24.** All 55 movements
  have sequences; 51 are wired and 4 are held pending a reshoot. See
  `WITHHELD_MEDIA` in `mobile/src/exerciseMedia.ts` for what is wrong with
  each, and `EXERCISE-MEDIA-BRIEF.md` for the review note.
- **Reshoot four sequences.** `ex-single-leg-calf-raise` (no heel rise),
  `ex-nordic-hamstring-eased` (ankles never anchored), `ex-seated-hinge` (no
  hinge), `ex-band-lat-pulldown` (frame order, and frame 3 is the wrong
  movement). Two or three frames each rather than new sequences.

---

## P3 — Audit items that matter, after the core is personal

- **Confirmation-first meal estimates.** Today a photo estimate saves
  immediately and silently outranks the typed description. The audit wants
  propose → confirm → save, with item-level portions.
- **Estimate provenance.** Model, prompt version, item breakdown and
  confidence are not stored, so a later screen cannot explain where a number
  came from. The breakdown is shown once and lost with component state.
- **Movement session model.** Session-level RPE captured once rather than per
  exercise; rest timer; set checkboxes; "stop workout" without completing
  every card; swap within coach-approved alternatives.
- **Pain capture detail.** Location, severity, sudden or gradual, during or
  after. Used to *route*, never to prescribe.
- **Vera's rate limit is in memory**, per instance, and resets on deploy.
  Adequate for a pilot; not an abuse boundary.
- **Message pagination.** The last 20 are loaded with no way back.
- **Reports lifecycle** — or rename it "private document wallet", since
  nothing reviews an upload and the current framing implies something does.
- **Learning content citations** — author, source, review date, and a visible
  line between general education and Bharosa's own guidance.
- **A stale server comment** still says food is "protein only, not a calorie
  tracker", which the UI has contradicted for some time.

---

## P4 — Release engineering

None of this is needed to keep building; all of it is needed to ship.

- Crash reporting and observability, with health-data redaction. Currently
  none.
- Test layers beyond unit: contract, integration, component, E2E, native
  health, AI evals. The 142 tests cover pure logic well and nothing else.
- Store declarations — App Privacy, Data Safety, Health Connect
  justifications — from one data inventory.
- Accessibility pass with VoiceOver and TalkBack, 200% text, tap targets.
- React Navigation, replacing manual tab state (no back stack, no deep links,
  no restoration).
- Continue the `App.tsx` decomposition. 8,274 → 5,853 so far; components
  themselves are untouched.

---

## Blocked on a decision, not on code

These cannot be closed by writing anything.

- **A privacy contact that reaches a person.** `app/privacy` has a marked
  placeholder. DPDP requires a real grievance route, and an address that
  bounces is worse than a visible gap. **This blocks opening beyond the
  current pilot.**
- **Legal review** of that notice. It is now accurate, which is the
  precondition for a lawyer being able to review it usefully.
- **A staffed escalation route.** Uncoached members are now told honestly to
  see a clinician rather than promised a review nobody owns — but that is
  honesty, not a service. Ownership, SLA and coverage are a business decision.
- **Professional review of the 27 generated exercise photographs.** They have
  never passed one, and it is a release gate.

---

## The largest untested risk

**No end-to-end member journey has ever been run.** Sign up → onboarding →
readiness → first plan → complete a session → log a meal → check in → return
the next day and find the app remembered correctly.

Every bug found on the device this week — Vera's vanishing replies, the
permanently stuck review banner, the dose escalating on refresh — would have
been caught by one careful two-day run. This is worth more than any single
item above.
