# Bharosa — what is pending, in priority order

**Last updated:** 24 August 2026, after the external audit response
(`docs/AUDIT-RESPONSE-2026-08-24.md`) and a device-testing round.
**State:** 142 tests passing, mobile and server typecheck clean, `next build`
clean. All eight audit P0s closed.

This is the working backlog. It is ordered by what should happen next, not by
how large each item is. Where something is deliberately *not* being done, it
says so and why — an item missing from a backlog reads as forgotten, and most
of these were decisions.

---

## P1 — Small, real, and worth clearing first

Each of these is hours, not days, and three of the four feed the
personalisation work in P2. Doing them first means that work starts on clean
inputs.

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

This is the main line of work and the reason the app feels generic. Ordered
deliberately: the library is the *last* step, not the first.

### The diagnosis

`GeneratorInput` receives exactly this:

```
goals, availableMinutes, activityLevel, movementCaution,
readiness, doseSteps, pausedExerciseIds, signals, coachAuthoredDomains
```

No age. No gender. No equipment. No sport or event goal. `Member.age` and
`Member.gender` exist in the type and never reach the generator at all.

**That is why it feels generic — not the size of the library.** 350 exercises
selected from 5 inputs is still generic; it picks a wall slide from a bigger
hat. 35 well-tagged exercises chosen from 12 real inputs personalises
visibly. The audit says the same thing in Part II Stage 2: the current
onboarding "is insufficient to justify the present degree of holistic
personalisation."

### 2.1 Widen what is collected  ← start here

From the audit's own table, every input tied to an output it changes:

| Input | Changes |
|---|---|
| age | starting tier, progression pace, contraindication defaults |
| gender / life stage | education content and relevance — never diagnosis |
| equipment and access | which movements are even offerable |
| movement limitations | avoid/hold filters (partly exists as free-text caution) |
| activity baseline | starting dose |
| available time **by weekday** | action size and which days carry a session |
| sleep baseline | initial recovery posture |
| nutrition pattern, preferences, allergies | food prompts and estimator context |
| **sport or event goal** | whole training shape — see 2.4 |
| "what I will not do" | excludes modalities outright |
| coaching preference | AI-only, waitlist, or assigned |

Do **not** collect weight, body image, hormone or menstrual data, or
medications unless a shipped feature needs them and the consent basis is
clear.

Onboarding must also **resume** — save after every answer. It currently
cannot, which the audit flags separately.

### 2.2 Thread them through

`GeneratorInput` → `eligibleExercises()` → `selectSession()`. Mostly
mechanical once 2.1 exists, and where the value is realised.

### 2.3 Then widen the library

Only after 2.1 and 2.2, because the tagging depends on knowing which
dimensions actually select.

**The constraint that governs this:** every one of the current 35 movements
carries `loads`, `avoidIf`, `tier`, `equipment`, `progressesTo`/`regressesTo`
and was cleared by a qualified exercise professional. That review is what
makes "rules decide, models phrase" defensible rather than a slogan. 350
movements is 350 sets of contraindication tags and 350 review decisions.

Expand in reviewed batches. An untagged movement must not be reachable by the
generator.

### 2.4 Broader goals, including sport

A member training for Hyrox is a different product from a beginner doing chair
squats — sled pushes and wall balls under load are a materially different risk
profile from anything currently cleared. This needs its own tier, its own
contraindication set, and its own review. Worth doing; not worth folding into
the same library without that.

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
