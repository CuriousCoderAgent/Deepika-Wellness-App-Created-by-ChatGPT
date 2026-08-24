# Response to the product & technical audit

**Audit reviewed:** *Bharosa Wellness — Product, Experience, AI, Safety and Technical Audit*, 24 August 2026, baseline `6618902`.
**This response:** 24 August 2026, work landed between `1a9075e` and `e0221e3`.
**Tests:** 114 → 137, all passing. Mobile and server typecheck clean, `next build` clean.

Every claim was checked against the code before acting, and several against the
live database. Two turned out overstated and are recorded as such — not to
score points, but because a team acting on this document later needs to know
which findings are load-bearing.

---

## The one that mattered most

**P0-01 was real, live, and worse than described.**

`applyAdaptation()` advanced the dose ladder from its *stored* value using a
verdict recomputed from *unchanged* history. Verified by running it rather
than reading it:

```
call 1: verdict=progress  step 0 -> 1
call 2: verdict=progress  step 1 -> 2
...
call 6: verdict=progress  step 5 -> 6
```

Six refreshes moved a member from 1×6 to 3×10 having trained none of them.

The audit says a poll "can" trigger this. It did, unconditionally. The client's
once-a-day guard read `planGeneratedOn`, which the mobile normaliser was
dropping, so the guard never fired — and the Coach tab polled a full refresh
every sixty seconds. **Reading Vera's messages made your exercises harder once
a minute.**

Fixed by recording, per exercise, the session date already folded into the dose
(`doseAdaptedThrough`). Same evidence cannot move it twice; new evidence still
applies immediately. Pain is deliberately exempt and re-applies every pass,
because adding to a paused set is idempotent and a movement that hurt must stay
paused even if that record is lost.

---

## P0 register: disposition

| | Finding | Verdict | Where |
|---|---|---|---|
| P0-01 | Non-idempotent plan generation | **Accepted — confirmed empirically** | `lib/adaptation.ts`, `app/api/plan/generate` |
| P0-02 | Normaliser drops server state | **Accepted; severity overstated** | `mobile/src/normalize.ts` |
| P0-03 | Whole-document writes lose data | **Accepted; remedy changed** | `app/api/state` |
| P0-04 | Unencrypted health cache | **Accepted** | `mobile/src/cache-key.ts`, `storage.ts` |
| P0-05 | Deletion claims false success | **Accepted; remedy scoped down** | `app/api/account` |
| P0-06 | Escalation is not a service | **Partly accepted — see below** | `lib/coach-ai.ts`, onboarding route |
| P0-07 | Privacy notice is untrue | **Accepted in full** | `app/privacy` |
| P0-08 | Dead invite code, lost settings | **Accepted; remedy changed** | `mobile/App.tsx`, `app/api/state` |

### Where the audit overstates

**P0-02 — "silently deletes authoritative server state".** It does not reach
the server. `mergeMemberUpdate` already takes all five fields from its own
copy and never from the client, with a comment saying why: *"otherwise a client
could award itself a heavier dose, or quietly un-pause a movement that hurt."*
Stored state was never at risk. What broke was the app's view of itself — a
coached member rendering as uncoached, a pain pause invisible — and, critically,
the plan guard that caused P0-01. Real bug, wrong severity, fixed anyway.

**P0-06 — the urgent gate already existed.** `matchUrgent()` ran before the
model, from fixed text, with no network call, in Vera. What was genuinely
missing was the same gate in *conversational sign-up*, whose instructions
actively said to note chest pain and carry on. That is now fixed and is the
serious half of this finding. The remaining half — an assignment queue, SLA,
owner — is an operations decision, not code, and is listed as open below.

### Where the remedy was changed deliberately

**P0-03.** The audit prescribes seven command endpoints and a rewrite. The
failure it describes — phone A offline, phone B logs breakfast, breakfast
disappears — is fixed instead by unioning these append-only logs by id. That
*prevents* the loss rather than detecting it, which is what the rewrite would
also achieve, at a fraction of the change and risk.

One caveat is load-bearing and documented in the code: this is correct only
because nothing deleted a pulse, workout log or food entry. Adding meal
deletion in the same session therefore required tombstones (`deletedAt`) rather
than removal, and filtering at all seven read sites. A further deletion feature
must extend that pattern or move to real commands.

**P0-05.** No durable outbox with a state machine — that is infrastructure, and
this is a five-account pilot. Instead: retry each failed blob once, complete the
erasure regardless (a storage bug of ours must not become a reason someone
cannot leave), retain the registry rows for anything still in storage so it
remains discoverable, and say so honestly in the response. The failure path also
no longer claims "nothing was removed", which was a guess and often the wrong one.

**P0-08.** Referral tokens and universal links are a real feature. What shipped
is the honest version of what exists: the shared code `BHAROSA-{ID}` resolved to
nothing, so the invite now shares the member's username, which is the mechanism
that actually works today.

---

## Beyond P0

Accepted and landed:

- **Security headers** — CSP, nosniff, DENY framing, referrer and permissions
  policy, `no-store` on `/api`, `X-Powered-By` off. The CSP still permits
  `unsafe-inline` for scripts; that is stated in the file rather than hidden,
  because removing it needs nonces threaded through every route.
- **Contrast** — the audit's figures were exact. `faint` 2.71:1 and `marigold`
  2.60:1, both used at 11pt and below. Fixed, and asserted by a test that reads
  the real palette.
- **Text floor** — 47 styles at 7–9pt raised to 11; tab labels 9 → 11.
- **Award honesty** — rest no longer counts as an active day; a "session" is a
  day trained rather than an exercise finished (thirty sessions was reachable in
  a fortnight); the unsupported claim *"Very few people who start ever reach
  this"* is gone, and a test now rejects population claims in award copy.
- **Health freshness** — a stale reading rendered identically to a current one,
  because `detail` was computed for every tile and never rendered. Readings now
  carry their age and are visually demoted when not from today.
- **VO₂ window** — queried 90 days while permitted 30, since
  `READ_HEALTH_DATA_HISTORY` is not declared. Constrained rather than requesting
  it; that permission needs its own Play Store justification and a year of
  someone's health history is a poor trade for one sparse tile.
- **Module names** — the Plan screen showed `mv-strength-a` as "mv strength a".
  Every module already had a proper name.
- **Gendered prompts** — `Member.gender` accepts "man" and "other", while both
  AI prompts said "she" throughout. Rewritten in the second person.
- **Meal deletion**, **`1650k` → `1.7k`**, **the invented 20g protein
  threshold**, **`runSync` with no `catch`/`finally`**.

### Decomposition

`App.tsx` 8,274 → 5,853 lines, extracting `design/tokens`, `design/styles`,
`awards`, `meals`, `activity` and `content`. This was done deliberately *before*
any UI redesign: measured across this work, 21 files changed and one was
screens, so a redesign discards presentation and keeps everything else. Logic
still inside the screen file is logic a screen rewrite can take with it by
accident.

It also bought coverage that was previously impossible — the award rules could
not be tested at all while they lived in a file importing React Native.

---

## Open, and honestly so

**Needs a decision, not code:**

- **A staffed escalation route.** Uncoached members are now told to see a
  clinician rather than promised a review that nobody owns, which is honest but
  is not a service. Case ownership, SLA and coverage are a business decision.
- **A contact route for the privacy notice.** The policy has a marked
  placeholder. DPDP requires a real grievance contact and an address that
  bounces is worse than a visible gap. **This blocks opening beyond the pilot.**
- **Legal review.** The notice is now accurate, which is the precondition for a
  lawyer reviewing it usefully. It has not had one.

**Accepted, not yet done:**

- React Navigation, feature-module decomposition of the remaining components,
  a full design-token system.
- Component, E2E, native and AI-eval test layers. The 137 tests cover pure
  logic well and nothing else.
- Crash reporting and observability.
- Store declarations, App Privacy / Data Safety, accessibility audit with
  VoiceOver and TalkBack.
- The five golden journeys. **No end-to-end run has ever happened**, which
  remains the largest untested risk in the product.

**Not adopted:**

- A single "Holistic Health Score" — the audit advises against it and we agree.
- Event-sourced command endpoints, for now. Revisit when a second write surface
  or a second coach exists.

---

## Verification note

One change is mechanical and unverified on a device: raising 47 styles to an
11pt floor. It typechecks and cannot fail at runtime, but tight chips are where
it could overflow, and that needs eyes on a build.
