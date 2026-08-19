# V1 Roadmap — from prototype to something 20 real women log into

Written 10 Aug 2026, after the decision that the pilot cohort will actually
use this build rather than watch a demo of it.

`CLAUDE.md` describes what exists today. This file describes what has to be
true before real members have accounts, and the order to build it in.

---

## The gap that matters most

V0 has **no authentication and no server**. Every member is a hardcoded
persona in `lib/seed.ts`, and all state lives in one browser's
`localStorage`. That is completely fine for a prototype and completely
unfit for twenty real women with real health data — today, anyone with the
URL sees everything, and "her data" is really "this laptop's data".

Everything below follows from closing that gap. Until it closes, treat the
deployed build as a demo, not as a place to put anything real.

---

## Sprint A — Accounts and roles

**Goal:** Deepika signs in as herself. Each member signs in as herself. No
one sees anyone else's data.

- Auth provider: Supabase Auth, Clerk and Auth.js are all reasonable. Prefer
  whichever ships with the database choice in Sprint B so there is one
  vendor, one session model and one place identity lives.
- Two roles: `coach` (Deepika, plus future coaches beneath her) and
  `member`. Role lives on the user record, not in the client.
- Sign-in method: email magic link or OTP. This cohort is WhatsApp-first and
  phone-centric; passwords are friction and a support burden for 20 people.
- Invite flow, because the cohort is closed: Deepika creates a member, the
  member gets a link, sets up access, lands in onboarding. No public signup.
- Route protection is server-side. A client-side redirect is decoration.
- The coach console must scope every query by coach, and the member app by
  the signed-in member — the current `activeMemberId` switcheroo disappears
  entirely.

**Ordering note:** this comes first because every later sprint stores real
data, and storing real data without knowing who it belongs to creates a
migration problem and a privacy problem at the same time.

---

## Sprint B — Real persistence

**Goal:** data survives a browser, a device and a reinstall.

- Postgres. Supabase or Neon both fit; Supabase bundles auth, row-level
  security and object storage, which collapses three decisions into one.
- Row-level security so a member row is unreadable without that member's
  session. Enforced at the database, not in application code.
- The domain model in `lib/types.ts` is already close to a schema — it was
  written as a data model rather than as component props. Tables map roughly
  one-to-one: `members`, `daily_actions`, `pulse_entries`, `workout_logs`,
  `messages`, `sessions`, `reports`, `coach_notes`, `week_plans`.
- Keep the `Provenance` envelope. It is the thing that makes coach-entered
  and member-entered data distinguishable forever, and it gets more valuable
  once there is real history rather than less.
- `lib/store.tsx` becomes a data layer over the API instead of over
  `localStorage`. The mutation surface it already exposes is roughly the
  right API surface, which is worth exploiting rather than redesigning.
- Seed the pilot cohort by importing the real 20, not by keeping fictional
  personas alongside them. Radhika and company should exist only in a
  development seed after this point.

---

## Sprint C — Reports, properly

**Goal:** the upload flow already in the app becomes real.

- Private object storage for the actual PDFs and images, with signed,
  expiring URLs. Never public-bucket. This is the single easiest way to
  accidentally publish someone's blood work.
- Keep the original document always. Extracted values are a convenience
  layer over the source, never a replacement for it.
- Extraction: start with the member or Deepika typing the handful of markers
  that matter, which is what the current flow does and what is reliable.
  OCR/parsing of Indian lab PDFs is genuinely messy (every lab formats
  differently) and is a fair candidate for AI assistance in Sprint D — with
  the extracted values shown for confirmation before they are saved, never
  written silently.
- Trend only where units and reference ranges are handled consistently. Two
  labs reporting the same marker in different units and silently trending
  them together is a real correctness bug, not a theoretical one.
- Audit log on report access. Who opened whose report, when.

---

## Sprint D — AI, behind a server

**Goal:** the assistant and report-summary features from the design review,
built so they help without overreaching.

**Prerequisite: Sprints A and B.** An API key cannot live in this app today —
there is no server to hold it, and anything shipped to the browser is public.
This is a hard technical blocker, not a preference.

Shape:

- All model calls go through a server route. The key never reaches the
  client. Rate-limit per user.
- Ground responses in the member's own permitted data plus a controlled
  content library — not open-ended web knowledge. The design review asks for
  exactly this (§10.2) and it is also what makes answers useful rather than
  generic.
- Log the model, version, prompt and output for anything health-related, so
  a surprising answer can be traced back rather than guessed at.
- Label AI-generated text distinctly wherever it appears. A member should
  never have to wonder whether a sentence came from Deepika or from a model —
  that distinction is the product's core relationship, and it is why marigold
  means Deepika and nothing else.
- Always offer the route onward: to Deepika, or to a doctor. Every AI surface
  needs that exit visible, not buried.

Good first uses, in rough order of value-per-risk:

1. **Draft Deepika's messages in her voice, for her to edit and send.** Saves
   real hours every week, and a human approves every word before it reaches
   anyone.
2. **Turn a report into questions for her doctor.** High value, and it points
   the member toward the right expert rather than substituting for one.
3. **Answer general education questions** ("what is perimenopause?"), grounded
   in the article library that already exists in `lib/seed.ts`.
4. **Summarise patterns from her own logged data** ("your energy has been
   lower on travel weeks") — descriptive, drawn from her own entries.
5. **Report interpretation.** Highest value to the member and highest care
   required. Build it with Deepika in the loop by default: the model drafts,
   she reviews and releases, the member sees it attributed. That ordering
   keeps her professional judgement in the product rather than replacing it,
   which is both the safer design and the better one — her judgement is the
   thing members are actually paying for. Whether it can ever go
   member-direct without her review is a question for her certifying body
   and her lawyer, and worth asking them explicitly rather than inferring.

---

## Sprint E — DPDP compliance

Now genuinely load-bearing, because real people's health data is involved.

- Specific, revocable consent at onboarding. Separate consent for storing
  reports, for AI processing and for anything shared with a future coach.
- Access and erasure within the statutory window. In practice: an export
  endpoint and a real delete that also clears object storage and backups.
- Purpose limitation — collected for coaching, used for coaching.
- Breach notification path decided before it is needed.
- Reviewed by someone qualified. This is the one item on this page that
  should not be signed off inside the build team.

---

## Sprint F — Onboarding (M00–M05)

Absent entirely today and unavoidable once people have accounts: invite,
welcome, consent, baseline assessment, goals, preferences, and the "what I
will not do" input that personalises everything downstream.

---

## Sequencing summary

```
A  Accounts and roles          ← blocks everything
B  Real persistence            ← blocks C, D, E
C  Reports, properly
D  AI, behind a server         ← needs A + B
E  DPDP compliance             ← needs B; ship before real members
F  Onboarding                  ← needs A; ship before real members
```

A and B are the two that unblock the rest. E and F are the two that must not
be skipped before the cohort arrives.
