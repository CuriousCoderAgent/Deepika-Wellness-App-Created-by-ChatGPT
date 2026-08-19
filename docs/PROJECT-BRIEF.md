# Deepika Wellness — Project Brief

Context document for anyone (human or Claude Code) picking this project up.
Operational rules live in `CLAUDE.md` at the repo root; this file holds the
*why* behind them.

---

## 1. The business

**Founder.** Deepika — IIM graduate, ex-corporate, now full-time on this.
Completing ACE health coaching certification. Exceptionally disciplined and
process-driven, which is both her strength and the central product risk: her
own adherence is atypical, and the plans she designs will be executed by people
whose willpower behaves normally.

**Who she serves.** Urban Indian women, roughly 38–50, affluent enough for
premium coaching, English-comfortable. Health-conscious but inconsistent.
Their knowledge comes from Instagram reels, not science. Many are entering or
in perimenopause. Common complaints: low energy, poor sleep, no strength. Many
are metabolically unhealthy even when not visibly overweight.

**The offering.** Personalised 1:1 journeys across four pillars — nutrition,
movement/strength, lifestyle, and hormonal/midlife context — with an explicit
behavioural-psychology layer. Intake includes a 1:1 conversation, health
assessment, blood work, body composition and a lifestyle questionnaire.

**First cohort.** ~20 hand-picked women from her own network, priced below the
eventual premium. Deepika personally acts as both health coach *and* personal
trainer at first, then scales with coaches beneath her.

**Her definition of success.** Not weight loss. Sustained participation past
three months; durable habits; a safe space for women's health; a journey that
is engaging rather than purely clinical.

**Her stated fear.** Members will drop out not because the plans are bad but
because of ordinary human willpower failure, guilt after missing sessions, and
shame about reporting non-compliance.

That fear is the design brief. Everything in the invariants list exists to
answer it.

---

## 2. What the research says (and where it constrains the design)

Findings from a full research pass across behaviour-change literature, product
teardowns, menopause-specific platforms and the Indian market.

**Apps alone barely work.** Meta-analysis of 65 studies (~10,000 participants,
*Obesity Reviews* 2026) puts behavioural weight-loss interventions at Hedges'
g = −0.19 — roughly 3.25 kg over control — with **no significant maintenance
effect**. Human support is the strongest moderator. This is why the thesis puts
Deepika at the centre and the software in a supporting role.

**Supportive accountability is the mechanism.** Mohr's model (JMIR 2011):
adherence flows from accountability to a coach who is trusted, benevolent and
expert. Bond, accountability, legitimacy. The product's job is to make that
relationship visible and continuous between touchpoints.

**Effective techniques**, consistently: self-monitoring, goal-setting, graded
tasks, action planning, feedback, social support. Graded tasks are the direct
justification for Minimum → Target → Stretch.

**Streaks are dangerous here.** The abstinence-violation effect and the
"what-the-hell effect" describe how one lapse, read as total failure, triggers
a shame spiral and full relapse. Duolingo's own data shows streaks work — *and*
that they engineered forgiveness (freezes, low daily bars) to stop them
backfiring. For a shame-prone cohort that has already quit several things,
rigid streaks manufacture exactly the failure Deepika fears. Hence invariant 3.

**Lowering the bar increases return behaviour.** Duolingo found separating the
streak from a lighter achievable daily goal produced a 3.3% lift in D14
retention. Minimum-as-success is well founded.

**Health & fitness apps have the worst retention of any category** —
roughly D30 3–10% self-serve. Noom's *coached* product reported D30 engagement
of 43.6%. Coaching is the differentiator, not the software.

**India specifics that constrain the build:**
- Wearables are dominated by cheap domestic brands (Noise, boAt, Fire-Boltt —
  ~75% of shipments) with little or no API access. Do not architect around
  wearable auto-capture.
- WhatsApp is the dominant channel for this demographic. A WhatsApp-first
  delivery layer may out-retain a native app and is worth testing in V1.
- Pricing anchor: Elda Health's comparable 3-month programme runs
  ₹7,000–12,000. Keep per-cycle charges under ₹15,000 to stay inside UPI
  Autopay's no-additional-auth threshold.
- DPDP Act 2023 + Rules 2025 apply in full to the Pilot MVP: specific
  revocable consent, purpose limitation, access/erasure within 7 days, breach
  notification.

**Scope of practice.** ACE materials are explicit that a health coach may not
diagnose, interpret labs, prescribe nutrition or meal plans, or recommend or
sell supplements. India additionally protects the registered-dietitian title.
This is why invariant 7 exists and why it is non-negotiable.

**Protocol basis for module content.** Resistance training, plyometrics and
protein adequacy in peri/postmenopause draw on Stacy Sims and mainstream
menopause guidance; longevity framing draws on Attia. Both are
evidence-*informed* rather than settled consensus — present module content as
education, never as prescription.

---

## 3. What exists now (V0 Vision Prototype)

Two working surfaces, 18 routes, builds clean.

**Member app** — mobile-first with a phone shell on desktop, six switchable
personas. Today (adaptive greeting, coach voice note, focus actions, Daily
Pulse, next session, consistency cue); Journey (phase ribbon, goals, "what I
will not do", assigned modules); Movement week + workout step-through with RPE
and pain flag; Progress led by consistency rather than weight; Coach inbox with
voice notes and plan-update cards; weekly reflection.

**Coach console** — Radar with four buckets and a readable rules panel;
member directory; Member 360 with Overview / Assessment / Journey Builder /
Week Planner / Session Prep; Module Library with coach playbooks and referral
notes; Sessions with capacity maths; Messages; Notification preview centre
(including the streak notification we deliberately do not ship, with the
reason); Pilot feedback triage board.

**The engine.** `lib/radar.ts` computes ten rules from live data on every
render. All ten fire against the seeded cohort. Publishing a plan change
requires a written rationale and pushes it to the member's Today screen.

**Signature element.** The Effort Ramp — three segments, Minimum → Target →
Stretch, where reaching the minimum fills a genuine colour.

**Demo path to walk Deepika through:** member app as Radhika → coach Radar →
Show the rules → Radhika's Journey Builder → publish a change → back to the
member app to see it land with the reason attached.

---

## 4. Review of the external design comps (August 2026)

A second consultant produced five high-fidelity screens (Journey Builder,
Member 360, Radar, member Journey, member Today). Assessment:

**Adopt — structural, and better than what is built:**

| Idea | Why |
| --- | --- |
| Week 1–12 tabs in Journey Builder with phase ranges | Current Week Planner only edits *today*. Largest gap in the build. |
| Radar as four side-by-side columns rather than a vertical stack | Gives Celebrate equal visual weight. Deepika's own logged feedback asks for exactly this. |
| A sparkline inside each Radar card | Shows the *evidence* that triggered the flag, not just the assertion. Strongest idea in the set and perfectly aligned with the auditability principle. |
| One-tap mood row as the first rung of the check-in | Lower friction than three 1–5 scales. Layer it: one tap, optional expand — Radar rules R03/R04 still need energy and sleep separately, so a pure emoji pulse would break them. |
| 12-week progress ring + "Upcoming milestones" on member Journey | Real orientation gap. |
| Dated coach-notes log as its own tab | Currently only a private notes field with no history. |
| Save draft vs Assign to member | Draft state does not exist yet. |
| Day letters under the consistency dots | More legible than an unlabelled band. |
| All three effort levels visible on the Today card | Currently truncated to two. |
| Member constraints as chips inside the builder header | Already logged as feedback item f-1. |
| Category icons on modules and actions | Helps a 38–50 audience scan. |

**Reject — with reasons:**

- **The visual identity.** Cream / sage / lavender / thin-line botanical
  illustration with a serif logo is the current default look for AI-generated
  wellness design; it is not distinctive to this practice. More importantly it
  is semantically loose: purple there signals Deepika's voice, "why this
  matters", Phase 2, the stress metric and the notification dot. In this build
  marigold means exactly one thing. Keep the current token system.
- **"7-day streak 🎉"** — violates invariant 3, and on a coach screen it becomes
  the coach's vocabulary.
- **"Reinforce protein goal 1.0–1.2 g/kg/day"** — an individualised nutrition
  prescription with a numeric target. Outside ACE scope. Compliance issue, not
  a preference. (Also below what midlife literature suggests.)
- **"Suggested next actions ✨"** — the sparkle implies AI that does not exist
  and that §18 defers.
- **No provenance treatment anywhere** — dual-entry is a hard requirement.
- **"Sleep 5h 45m ↓45m"** — implies wearable data this cohort's devices will
  not supply.
- **Adherence shown as a single 72% grade** — acceptable on the coach side with
  care; it must not reach the member, where it becomes a report card.
- **Stock photographs of real women's faces** attached to fictional members with
  health data. Use initials.
- Numbered section markers on Member 360 where the sections are not a sequence.
- Mixed scales (stress /10, everything else /5).

---

## 5. Backlog

**Now — adopt from the comps, in this order**

1. Week 1–12 navigation in Journey Builder, with phase ranges and per-week
   assignment editing. Extend the `DailyAction` model from `dayOffset` to a
   week/day addressing scheme.
2. Radar four-column layout with per-card sparklines drawn from the same data
   the rule evaluated.
3. One-tap mood entry on Today that expands into the full three-scale Pulse.
   Preserve energy and sleep as separate values or R03/R04 break.
4. 12-week progress ring and Upcoming milestones on member Journey.
5. Coach notes as a dated, appendable log with its own tab.
6. Draft vs published plan state.

**Next — gaps in the current build**

7. Member M00–M05 onboarding: invite, welcome, consent, baseline assessment,
   goals and preferences. Currently absent entirely.
8. Module versioning UI — the model supports versions; nothing surfaces them.
   Editing a module must not silently rewrite assigned journeys.
9. Coach-side capacity analytics (§16): retention, minimum-action adherence,
   comeback rate, coach hours per member.
10. Reports and body-composition upload flow (store and trend only, never
    interpret).

**Pilot MVP gate — required before any real member touches this (§17.2)**

Real authentication and role-based access · consent and deletion/export flows ·
encrypted storage · private object storage for reports and audio · audit
logging on sensitive access · real messaging with push and quiet hours ·
DPDP compliance reviewed by someone qualified · a referral network (registered
dietitian, gynaecologist/menopause physician) wired into the refer pathway.

**Deliberately deferred (§18)** — exact 12-week clinical sequence, PT session
cadence, nutrition depth, community design, AI assistance, pricing, multi-coach
operations, validated questionnaire licensing.

**Open question worth testing early:** whether a WhatsApp-first delivery layer
beats the native app for this demographic. The research leans yes. If member
check-in completion via WhatsApp beats app opens, the native app becomes
optional and the build gets dramatically cheaper.

---

## 6. Metrics that matter for the pilot

Track these; ignore app opens.

- 12-week active participation (not installs)
- Minimum-action adherence (not perfect completion)
- Comeback rate after a 3+ day lapse (not streak length)
- Weekly coaching continuity — did the review happen and produce a next-week plan
- Coach hours per member per week — the number that decides when to hire
- Plan adaptation frequency *and reason* — this is the raw material that later
  becomes Deepika's systematised methodology
- Member self-efficacy over time

**Threshold to act on:** if fewer than 60–70% of the cohort is actively
participating at 12 weeks, the problem is engagement design — check-in cadence
and lapse recovery — not the plans themselves.
