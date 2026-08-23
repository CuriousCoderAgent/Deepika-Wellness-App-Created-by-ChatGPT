# CLAUDE.md

Operational guidance for Claude Code working on this repository.
Read `docs/PROJECT-BRIEF.md` before making product decisions — it holds the
business context, the research the design rests on, and the prioritised backlog.

Product name: **Bharosa Wellness** (`package.json` name, app branding, and
repo-facing references). The user explicitly chose Bharosa Wellness instead
of using Deepika's name for this product. Do not revert the customer-facing
brand to Deepika without another explicit decision from the user.

---

## What this is

A **pilot-stage Bharosa Wellness product** for holistic health coaching in
India. It has two surfaces — a member app and a coach console — and is being
developed locally and on a separate Bharosa staging stack before any public
launch.

It is no longer only a demo: it has real sign-in, per-account data, optional
durable storage, private uploads, password recovery, Health Connect support,
and a bounded server-side recommendations endpoint. AI must remain optional,
explainable, low-risk, and subordinate to coach-approved plans and the safety
rules documented in the code and deployment guide.

**Product thesis (revised 23 Aug 2026 — this replaces the coach-led thesis):**
the software builds and adapts the plan itself. A member signs up, answers a
short set of questions and a readiness screen, and receives a plan sized to her
time, ordered by her goals, and built around whatever she said hurts. It changes
from what she reports back — perceived effort, which version she completed,
pain, sleep and energy.

**A coach is an optional subscription, and outranks the software completely.**
Where someone has one, whatever the coach publishes is what the member sees;
generation fills only the domains the coach has not taken. Where someone does
not — the default — the app is the coach. `doc.coaching` carries this; absent
means un-coached.

The earlier thesis was "Deepika provides the intelligence, the software provides
memory and structure". That is no longer the product. Do not restore it.

**North star:** do not optimise for app opens. Optimise for useful health
behaviour, sustainable adherence, and graceful return after imperfect days.

---

## Product defaults (revised 10 Aug 2026 — no longer hard invariants)

This used to be a numbered list of invariants requiring "an explicit decision
from the user" to touch. The user has now given that decision: this build is
for a small pilot of people Deepika already knows, not a public launch, and
these should be treated as the current starting point, not a fixed constraint.
Change any of them freely. The original reasoning (behavioural-change research,
mostly) is still written up in `docs/PROJECT-BRIEF.md` if useful context, it
just no longer blocks anything.

What used to be here: minimum-as-success styling, no red/no failure-state
colour, no streaks, marigold reserved for Deepika's voice, provenance chips,
Radar rules being plain-language and switchable, no wearable dependency, Today
as a decision screen rather than a dashboard. All open to revisit.

**One item is not on that list — see below.**

## Scope of practice: the one thing I'm holding on

Not a design preference, and not about audience size. Two separate facts, and
"it's a small pilot, not a public launch" doesn't change either of them:

1. Per `docs/PROJECT-BRIEF.md` §1, Deepika is completing **ACE health-coach
   certification**. ACE's own materials are explicit that a health coach may
   not diagnose, interpret labs, or prescribe treatment — that's a rule from
   the certifying body about what the *credential* permits, not a rule about
   deployment scale. Software that auto-generates "your iron levels have
   improved, focus on protein" for her clients puts that credential on the
   line exactly as much in a pilot of 20 as in a public launch.
2. Interpreting diagnostic lab results is regulated as the practice of
   medicine in most jurisdictions, India included. That's independent of
   which certifications a coach holds unless one of them is a medical licence.
   I don't know India's Clinical Establishments rules well enough to say
   precisely where the line sits — which is itself the point: this needs a
   real answer from whoever advises Deepika on her certifications, not a
   guess baked into shipped software.

The 20 pilot members are real women, not a demo audience — the small scale
makes this *more* exposed, if anything: it's Deepika's own network, not
strangers.

**What's already built and not blocked by any of this:** members can upload
blood reports; values are transcribed and trended; Deepika can see them,
message about them, and add coach notes in a 1:1 (`app/coach/members/[id]`
Assessment tab, `app/member/reports`). None of that is a diagnosis pipeline —
it's Deepika, using her own judgement, looking at a client's numbers, which
she's obviously allowed to do as a coach in conversation.

**What remains out of scope:** a feature that has the *software itself*
generate a clinical interpretation ("AI Summary: your iron levels have
improved…") and hands it to a member without a qualified professional in the
loop. The server-side recommendations endpoint may only make the reversible,
low-risk adjustments defined by its guardrails; pain, clinical questions,
unusual trends, and strategic changes require coach review.

If you get a straight answer from her certification body or a lawyer that
auto-generated interpretation is fine for this pilot, tell me and I'll build
it — this isn't me refusing to revisit it, it's me not wanting to guess on
her behalf on the one item here with a real person on the other end of a
wrong guess.

**One more thing worth 30 seconds:** is this prototype still "Deepika reacts
to a demo," or are the 20 pilot members actually going to log in and use it?
That changes whether DPDP genuinely doesn't matter yet (demo) or does (real
health data from real people, consent and deletion flows and all). Worth
being deliberate about which one this is before it ships either way.

---

## How a plan is built

Read `lib/plan-generator.ts` and `lib/adaptation.ts` before changing anything
about what a member is asked to do.

**Rules decide, models phrase.** Selection, progression, dose and every safety
gate are deterministic and tested. A model writes the one sentence explaining
today, and runs the conversational sign-up. This is not caution for its own
sake: it means progression can be tested exhaustively, cannot hallucinate a
forty-percent jump, and still works when the model is unavailable. Do not move a
numeric decision into a prompt.

**Nothing is invented.** Every movement comes from `lib/exercise-library.ts`,
35 entries, each tagged with what it loads, what rules it out, and its
progression. The library and its safety tags are under review by a qualified
exercise professional — see `docs/EXERCISE-MEDIA-BRIEF.md` and the published
review document. Until that review lands, treat the tags as provisional and do
not loosen one.

**The safety gates, in order:** readiness outcome (can hold movement entirely) →
loads ruled out by her stated caution → conditions from readiness → equipment →
tier. All exclusions, all absolute. A movement removed is not available to be
picked no matter how well the rest of it fits.

**Pain stops a movement and does not substitute another.** It is added to
`pausedExerciseIds` and only a person removes it.

**Progression state is server-derived.** `doseSteps` and `pausedExerciseIds`
are computed from logged sessions and are never accepted from the client, or an
app could award itself a heavier dose and un-pause something that hurt.

## Stack and commands

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · React context,
persisted to a dedicated Postgres database when `BHAROSA_DATABASE_URL` is set.
The web demo can use `localStorage` without a database; production deliberately
ignores generic `DATABASE_URL` and `POSTGRES_URL` values to avoid sharing the
protected Deepika stack.

Storage is per account either way — one document per member, split and
rejoined by `lib/persist.ts`. `lib/db.ts` is server-only; importing it from a
client component would put the connection string in the browser bundle.

Accounts come from two places: the environment (`MEMBERS`, `COACH_PASSWORD`,
`AUTH_SECRET`) and the database for members who sign themselves up.
Development-only demo fallbacks are available locally; production fails closed
when signing, database, or invitation configuration is missing.
`lib/accounts.ts` handles database accounts and password recovery server-side.
Private uploads use a separate private Blob store and opaque owner-bound file
references. See `docs/DEPLOYMENT.md` for the complete environment contract.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # must pass before any commit
npm test         # 70 tests: rollover, meals, circle privacy, readiness, progression
```

Deploys to Vercel (import repo, zero config) or Railway (`npm start` reads
injected `PORT`).

Fonts load via `<link>` in `app/layout.tsx`, deliberately not `next/font` —
build-time font fetching turns a transient network blip into a failed deploy.
Keep it that way.

---

## Code map

```
app/
  page.tsx                  Landing / role chooser
  member/                   Mobile-first, phone shell, 5 tabs, persona switcher
    page.tsx                Today (M06) — the most important screen
    journey|movement|progress|coach/
    action/[id]/            Minimum→Target→Stretch completion
    workout/[id]/           Session + RPE + pain flag
    module/[id]/  reflection/
  coach/                    Sidebar console
    page.tsx                Radar (C01) — the screen that makes this valuable
    members/[id]/           Member 360 + Assessment + Journey builder
                            + Week planner + Session prep (C03–C08)
    sessions|library|messages|notifications|feedback/
lib/
  types.ts                  Domain model + Provenance envelope
  day-offset.ts             Re-bases relative dayOffsets onto today, on read
  seed.ts                   6 personas, 14 modules, 3 workouts, plans, messages
  radar.ts                  10 rules + evaluator
  store.tsx                 Context, localStorage, all mutations
components/
  ui.tsx                    EffortRamp, ProvenanceChip, ConsistencyBand, Sparkline
  PulseCard.tsx             Daily Pulse (member + coach-on-behalf modes)
mobile/src/
  storage.ts                Offline cache + queued save
  notifications.ts          Local daily reminder and coach-reply alerts
  nutrition.ts              Meal estimation (quantity-aware, Indian food table)
scripts/
  test.mjs                  npm test — day-offset and nutrition logic
```

**Design tokens** live in `tailwind.config.ts` with comments explaining what
each colour means semantically. Read those comments before adding a colour.

---

## Conventions

- **Copy is product surface, not filler.** Write in the member's language, not
  the system's. "Not today" not "Skipped". "Needs attention" not
  "Non-compliant". Never write copy that makes a woman feel behind.
- **Seed data is opinionated on purpose.** Radhika has had a genuinely bad
  week, Anita has gone quiet, Priya has just returned after five days. Deepika
  reacts far more usefully to real situations than to placeholder names.
  Preserve that property when extending.
- **Accessibility floor:** 17px base, `.tap` class for 44px targets, visible
  keyboard focus, `prefers-reduced-motion` respected. The audience is 38–50.
- Verify with `npm run build` and `npm test` before committing. The build
  type-checks; `npm run mobile:typecheck` covers the Expo app separately.
- **`dayOffset` is relative and is re-based on read** by `lib/day-offset.ts`,
  called from `lib/db.ts`. Anything new that stores a day must either join that
  module's collection list or carry its own calendar date. A relative offset
  that nothing re-bases rots silently — that was the bug it exists to fix.
- After changing `lib/radar.ts` or `lib/seed.ts`, confirm all ten rules still
  fire — the four Radar buckets should all be populated.

---

## Working with Deepika's feedback

Feedback will arrive as reactions, not specifications. When she says something
feels wrong:

1. Log it in the in-app Pilot Feedback board (`/coach/feedback`) so the trail
   survives the conversation.
2. Check it against Scope of practice above before building — that's the one
   item still worth pausing on. Everything else in Product defaults is fair
   game to change on request.
3. Prefer changing seed data or copy over adding features. Most "this feels
   wrong" reactions at V0 stage are about tone and content, not structure.

Current backlog and priorities: `docs/PROJECT-BRIEF.md` §Backlog.
