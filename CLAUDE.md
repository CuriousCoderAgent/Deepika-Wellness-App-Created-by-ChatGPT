# CLAUDE.md

Operational guidance for Claude Code working on this repository.
Read `docs/PROJECT-BRIEF.md` before making product decisions — it holds the
business context, the research the design rests on, and the prioritised backlog.

Internal project codename: **Bharosa** (`package.json` name, repo-facing
references). This is a codename for the codebase only — the product itself
stays branded as Deepika Wellness, the founder's real practice name. Do not
rename in-app branding, page titles, or notification copy to Bharosa without
an explicit decision from the user.

---

## What this is

A **V0 Vision Prototype** for Deepika Wellness: coaching software for a women's
midlife health practice in India. Two surfaces — a member app and a coach
console — built so the founder (Deepika) can use them and react, rather than
answer more discovery questions.

It is **not** the Pilot MVP, but it is no longer only a demo: it has real
sign-in, per-account data, and optional durable storage, because the twenty
pilot members are going to use it. There is still no AI in it — do not add UI
implying otherwise.

**Product thesis:** Deepika provides the intelligence and the human
relationship. The software provides memory, structure, visibility,
reinforcement and continuity.

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

**What I'll hold off building:** a feature that has the *software itself*
generate the interpretation ("AI Summary: your iron levels have improved…")
and hands it to a member without Deepika in the loop. Same for anything UI
that implies AI exists when it doesn't yet — there's no backend in this repo
to hold an API key safely (see Stack below), so a real integration is a
separate scoping conversation, not a checkbox to remove.

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

## Stack and commands

Next.js 14 (App Router) · TypeScript · Tailwind · React context, persisted to
Postgres when `DATABASE_URL` is set and to `localStorage` when it is not.

Storage is per account either way — one document per member, split and
rejoined by `lib/persist.ts`. `lib/db.ts` is server-only; importing it from a
client component would put the connection string in the browser bundle.

Accounts come from two places: the environment (`MEMBERS`, `COACH_PASSWORD`,
`AUTH_SECRET`), all with fallbacks so a deployment with nothing set still
opens on demo credentials; and the database, for members who signed
themselves up. `lib/accounts.ts` handles the second kind and is server-only —
Node's crypto is not available in the Edge middleware, which is why the
middleware imports from `lib/auth.ts` and never from there.
See `docs/DEPLOYMENT.md`.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # must pass before any commit
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
  seed.ts                   6 personas, 14 modules, 3 workouts, plans, messages
  radar.ts                  10 rules + evaluator
  store.tsx                 Context, localStorage, all mutations
components/
  ui.tsx                    EffortRamp, ProvenanceChip, ConsistencyBand, Sparkline
  PulseCard.tsx             Daily Pulse (member + coach-on-behalf modes)
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
- Verify with `npm run build` before committing. It type-checks.
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
