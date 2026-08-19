# Deepika Wellness — V0 Vision Prototype

*Internal project codename: **Bharosa**. The app itself stays branded as
Deepika Wellness — that's the founder's real practice name — this codename
is for the repo, package, and internal conversation only.*

A clickable prototype of the member app and coach console described in
*Deepika Wellness V0 Product Architecture*. It exists for one purpose: to put
something in Deepika's hands that she can react to, so that feedback comes from
using a product rather than from answering more questions about one.

**This is not the Pilot MVP.** There is no authentication, no backend, no real
health data, and nothing here is safe to point at a real member. See
[What this deliberately is not](#what-this-deliberately-is-not).

---

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy it

**Vercel** — push this folder to a GitHub repo, then import the repo at
[vercel.com/new](https://vercel.com/new). Framework preset is detected as
Next.js. No environment variables, no build settings to change. Deploys in
about a minute.

**Railway** — create a project from the GitHub repo. Railway detects Next.js
and runs `npm run build` then `npm start`. The start script already reads
Railway's injected `PORT`.

Nothing in this app needs a database, an API key, or a secret. That is
intentional for V0 and stops being true the moment real members are involved.

---

## The two surfaces

| Route | Who it is for | What it answers |
| --- | --- | --- |
| `/member` | One of the twenty women | *What should I do today?* |
| `/coach` | Deepika | *Who needs me today, and why?* |

Six fictional members are seeded. Switch between them using the row of names
above the phone on the member side. State persists in `localStorage`, so edits
survive a refresh — there is a **Reset demo data** button on the home page.

### The demo worth walking through

1. Open `/member` as **Radhika**. She has had a bad week. Read what the app says
   to her about it — particularly the greeting and the plan-change card.
2. Open `/coach`. Radar already knows who needs attention and states the reason
   for every flag in one sentence.
3. Press **Show the rules**. Every rule is readable and individually switchable.
   There is no score and no model.
4. Open Radhika → **Journey builder**. Add or remove a module, rewrite her weekly
   focus, and publish with a reason.
5. Go back to `/member`. The change and your reason are on her Today screen.

---

## Design decisions encoded in the code

**The Effort Ramp is the signature element.** Minimum → Target → Stretch renders
as three segments (`components/ui.tsx`). Reaching the minimum fills a real
colour. It is never grey, never an outline, never a partial-credit treatment,
because a twelve-minute session is not a lesser kind of success. Rest days use a
neutral band. Nothing in this product is red.

**Marigold `#D99A2B` is reserved for Deepika's voice** and appears nowhere else
in the member app. A member can always tell a human from the system at a glance.

**Provenance is visible, not just stored.** Every value carries a chip —
`member`, `coach · on behalf`, `device` — set in monospace. Coach-entered data
can never look member-entered. This is enforced at the type level in
`lib/types.ts` (`Provenance`) and in the store's `submitPulse(…, byCoach)`.

**Radar rules are auditable by construction.** `lib/radar.ts` holds ten rules,
each with a plain-language `trigger`. `evaluateRadar()` computes flags from live
data on every render, so switching a rule off changes the Radar immediately. All
ten fire against the seeded cohort.

**Consistency replaces streaks.** Progress leads with "you did something on N of
the last 14 days". `ConsistencyBand` shows the shape of the fortnight without
implying a chain that can break. `/coach/notifications` includes the streak-risk
notification we are deliberately *not* shipping, with the reason.

**Observe → Coach → Refer is in the copy, not a footnote.** Modules carry
`coachPlaybook.escalation` and `reviewNote`. Assessment screens store and trend
lab values and never interpret them. The hormonal modules educate and prepare a
member for a doctor's appointment; they do not infer a hormonal state from age,
symptoms or a lab value.

---

## Project structure

```
app/
  page.tsx                    Landing / role chooser
  member/
    layout.tsx                Phone shell, persona switcher, five tabs
    page.tsx                  Today            (M06)
    journey/                  Journey          (M09)
    movement/                 Movement week    (M11)
    progress/                 Progress         (M14)
    coach/                    Coach inbox      (M16, M17)
    action/[id]/              Action detail    (M08)
    workout/[id]/             Workout + log    (M12, M13)
    module/[id]/              Module / learn   (M10)
    reflection/               Weekly reflection(M15)
  coach/
    layout.tsx                Sidebar console shell
    page.tsx                  Radar            (C01)
    members/                  Directory        (C02)
    members/[id]/             Member 360 + Assessment + Journey builder
                              + Week planner + Session prep (C03–C08)
    sessions/                 Sessions calendar(C11)
    library/                  Module library   (C12)
    messages/                 Messaging centre (C10)
    notifications/            Notification preview
    feedback/                 Pilot feedback   (C13)
lib/
  types.ts                    Domain model (§13), provenance envelope
  seed.ts                     Six personas, 14 modules, 3 workouts, plans
  radar.ts                    Ten transparent rules + evaluator (§10)
  store.tsx                   React context + localStorage persistence
components/
  ui.tsx                      EffortRamp, ProvenanceChip, ConsistencyBand…
  PulseCard.tsx               Daily Pulse, member and coach-on-behalf modes
```

### Acceptance tests from §17.3, and where they live

| Test | Where |
| --- | --- |
| Daily Pulse completable in under 20s without typing | `components/PulseCard.tsx` — three taps submits |
| Deepika can prepare for a 1:1 from one flow | Member 360 → **Session prep** |
| Replace a 45-minute task with a 10-minute version without rebuilding the module | Member 360 → **Week planner** → *Make today the minimum version* |
| Coach-entered data is distinguishable from member-entered | `ProvenanceChip` throughout |
| A member returning after four inactive days sees no lost-streak messaging | `/member/progress`, Radar rule R08 |
| Deepika can find who deserves attention without scanning 20 profiles | `/coach` |
| Members can decline wearables and still use the program | No wearable dependency exists in V0 |

---

## What this deliberately is not

Per §3 of the architecture, the Vision Prototype omits things that would make
the build look impressive while postponing the learning that actually matters:

- No authentication or role enforcement
- No backend, database, or encryption — state lives in the browser
- No HealthKit / Health Connect integration
- No real messaging, push notifications, or audio recording (voice notes are
  simulated with transcripts)
- No AI, no autonomous recommendations
- No community, payments, or file upload
- No consent flow — the DPDP-compliant version belongs in the Pilot MVP

**Before a single real member touches this**, the Pilot MVP gate in §17.2
applies: real auth, encrypted storage, consent and deletion/export flows, audit
logging on sensitive access, private object storage for reports and audio, and
India DPDP compliance reviewed by someone qualified to review it.

---

## Notes for whoever builds V1

The seed data in `lib/seed.ts` is opinionated on purpose. Radhika has had a
genuinely bad week, Anita has gone quiet, Priya has just come back after five
days. Deepika will react far more usefully to those situations than to
placeholder names — keep that property when you extend it.

`lib/radar.ts` is the piece most worth carrying forward unchanged in spirit. The
temptation in V1 will be to replace the ten rules with a learned risk score. Do
not, until there is enough recorded coach judgement to evaluate one against.
A rule Deepika can read, disagree with, and switch off is worth more right now
than a more accurate number she cannot interrogate.

The `Provenance` type is load-bearing. If V1 introduces wearable data, add a
source type rather than letting device data write into member-reported fields.
System-derived values must never overwrite source data.
