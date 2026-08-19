"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Moon,
  Shield,
  Sprout,
  Sunrise,
} from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * First run — M00–M05 from the brief, compressed into six screens.
 *
 * Design rules it follows: one question per screen, tap over type wherever
 * possible, and nothing asked that the product does not actually use. Every
 * answer here shows up somewhere she can see it later, which is the honest
 * test of whether an onboarding question deserves to exist.
 *
 * Fields are pre-filled from what is already on her record, so a coach
 * clicking through a demo never blanks out good data by accident.
 */

/**
 * "Where you are right now" depends on who is answering.
 *
 * This step is required, and every option used to be a menstrual-cycle state —
 * which meant a man could create an account and then hit a screen he could not
 * truthfully answer or skip past. The practice is still built around women in
 * midlife and that set stays exactly as it was; the others are a genuine
 * question about life stage rather than a watered-down version of this one.
 */
const LIFE_STAGES_WOMEN = [
  "My cycle is regular",
  "My cycle has become irregular",
  "I think I'm in perimenopause",
  "My periods have stopped",
  "I'm not sure",
];

const LIFE_STAGES_GENERAL = [
  "I'm starting from scratch",
  "I used to be active and stopped",
  "I train, but something has changed",
  "I'm managing a health condition",
  "I'm not sure",
];

const GENDERS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "other", label: "Prefer to self-describe or not say" },
] as const;

type Gender = (typeof GENDERS)[number]["value"];

const GOAL_SUGGESTIONS = [
  "Stop feeling wiped out by the afternoon",
  "Get my strength back",
  "Sleep through the night",
  "Build a habit that survives a bad week",
  "Understand what's happening to my body",
  "Feel like myself again",
];

const CONSTRAINT_SUGGESTIONS = [
  "I travel often",
  "No gym — home only",
  "Evenings are unpredictable",
  "Vegetarian",
  "Early mornings don't work",
  "Long commute",
];

const TOTAL_STEPS = 6;

export default function Onboarding() {
  const router = useRouter();
  const { activeMember: m, completeOnboarding, hydrated, session } = useStore();

  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender | "">("");
  /**
   * A string, not a number, and empty to begin with.
   *
   * It was `type="number"` coerced with `Number(e.target.value)`, and
   * `Number("")` is 0 — so the moment she cleared the pre-filled age to type
   * her own, the field showed a 0 she then had to delete. Holding the raw
   * string lets empty stay empty. The pre-fill is gone too: guessing someone's
   * age and making her correct it is a poor first question.
   */
  const [age, setAge] = useState<string>("");
  const [lifeStage, setLifeStage] = useState<string>("");
  const [goals, setGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [wontDo, setWontDo] = useState("");
  const [constraints, setConstraints] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState<"morning" | "evening">("morning");
  const [consentHealth, setConsentHealth] = useState(false);
  const [consentReports, setConsentReports] = useState(false);

  // Someone who has already been through this should not be able to land back
  // on it by typing the URL. Nor should Deepika: these are the member's own
  // answers, and a coach filling them in on the member's record — even by
  // accident, from a stray URL — is not a thing this product should allow.
  useEffect(() => {
    if (!hydrated) return;
    if (session?.role === "coach") router.replace("/member");
    else if (m.onboardedAt) router.replace("/member");
  }, [hydrated, session?.role, m.onboardedAt, router]);

  // Age gets a sensible starting number. Goals, boundaries and constraints
  // deliberately start empty: this is a first run, and pre-ticking boxes from
  // seed data both makes it feel pre-decided and leaves her with entries she
  // cannot see — a seeded goal that is not one of the suggestions below would
  // stay selected and invisible. Her activity history is untouched either way,
  // so the app is still populated when she comes out the other side.
  useEffect(() => {
    if (hydrated && m.age) setAge(String(m.age));
  }, [hydrated, m.age]);

  const lifeStages = gender === "woman" ? LIFE_STAGES_WOMEN : LIFE_STAGES_GENERAL;
  const ageNumber = Number(age);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const canAdvance = () => {
    switch (step) {
      case 1:
        return consentHealth;
      case 2:
        return Boolean(gender) && Boolean(lifeStage) && ageNumber >= 18 && ageNumber <= 99;
      case 3:
        return goals.length > 0 || customGoal.trim().length > 0;
      default:
        return true;
    }
  };

  const finish = () => {
    completeOnboarding(m.id, {
      age: ageNumber,
      gender: gender || undefined,
      lifeStage: lifeStage || m.lifeStage,
      goals: customGoal.trim() ? [...goals, customGoal.trim()] : goals,
      wontDo: wontDo.trim(),
      constraints,
      checkInPreference: checkIn,
      consent: { health: consentHealth, reports: consentReports },
    });
    router.replace("/member");
  };

  const next = () => (step === TOTAL_STEPS - 1 ? finish() : setStep((s) => s + 1));

  return (
    <div className="flex h-full flex-col">
      {/* Progress. Six dots rather than a percentage — a percentage on a
          six-step flow just invites arithmetic. */}
      <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-5">
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            aria-label="Back"
            className="tap -ml-2 flex items-center justify-center rounded-lg px-2 text-ink-faint hover:text-ink"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-effort-target" : "bg-paper-sunk"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="scroll-hide min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {/* 0 — Welcome */}
        {step === 0 && (
          <div className="animate-rise pt-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-effort-tint text-effort-stretch">
              <Sprout size={22} strokeWidth={1.8} />
            </span>
            <h1 className="mt-5 font-display text-[1.75rem] leading-tight">
              Welcome, {m.name.split(" ")[0]}.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Over the next twelve weeks Deepika will build a plan around your
              actual life — not around an ideal version of it.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              A few questions first. It takes about two minutes, and every answer
              changes something you&rsquo;ll see in the app.
            </p>
            <div className="mt-6 rounded-2xl bg-effort-tint/60 p-4">
              <p className="text-[14px] leading-relaxed text-effort-stretch">
                There are no wrong answers here, and nothing you say locks you in.
                All of it can change as you go.
              </p>
            </div>
          </div>
        )}

        {/* 1 — Consent */}
        {step === 1 && (
          <div className="animate-rise pt-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-paper-sunk text-ink-soft">
              <Shield size={20} strokeWidth={1.8} />
            </span>
            <h1 className="mt-4 font-display text-[1.6rem] leading-tight">
              What we keep, and why
            </h1>

            <div className="mt-4 space-y-2.5 text-[14px] leading-relaxed text-ink-soft">
              <p>
                <span className="font-medium text-ink">What&rsquo;s stored:</span> what
                you log each day, anything you upload, and your conversations with
                Deepika.
              </p>
              <p>
                <span className="font-medium text-ink">Who sees it:</span> you and
                Deepika. Nobody else. It is never sold or shared.
              </p>
              <p>
                <span className="font-medium text-ink">Your control:</span> ask for a
                copy, or ask for all of it to be deleted, at any time.
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => setConsentHealth((v) => !v)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  consentHealth
                    ? "border-effort-target/40 bg-effort-tint/50"
                    : "border-ink-line bg-paper-card"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    consentHealth
                      ? "border-effort-stretch bg-effort-stretch text-white"
                      : "border-ink-line"
                  }`}
                >
                  {consentHealth && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">
                    Store what I log, so Deepika can coach me
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-faint">
                    Required — the app can&rsquo;t do anything useful without this.
                  </span>
                </span>
              </button>

              <button
                onClick={() => setConsentReports((v) => !v)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  consentReports
                    ? "border-effort-target/40 bg-effort-tint/50"
                    : "border-ink-line bg-paper-card"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    consentReports
                      ? "border-effort-stretch bg-effort-stretch text-white"
                      : "border-ink-line"
                  }`}
                >
                  {consentReports && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">
                    Let me upload blood reports and scans
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-faint">
                    Optional, and separate — you can turn this on later instead.
                  </span>
                </span>
              </button>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
              This is an early build being tested with a small group. Deepika is a
              health coach — she does not diagnose conditions or advise on
              medication, and nothing here replaces your doctor.
            </p>
          </div>
        )}

        {/* 2 — About you */}
        {step === 2 && (
          <div className="animate-rise pt-6">
            <h1 className="font-display text-[1.6rem] leading-tight">A little about you</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              This shapes what Deepika suggests and what you get to read.
            </p>

            {/* Asked first, because it decides what the rest of this screen
                should even ask. */}
            <p className="label mt-5">You are</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => {
                    setGender(g.value);
                    // The options below change with the answer, so a selection
                    // made under the old set would no longer mean anything.
                    setLifeStage("");
                  }}
                  className={`tap rounded-xl border px-4 text-[14px] transition-colors ${
                    gender === g.value
                      ? "border-effort-target/40 bg-effort-tint/50 font-medium"
                      : "border-ink-line bg-paper-card hover:bg-paper-sunk/50"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {/* `block` matters: .label carries no display of its own, and a
                  <label> is inline by default, so the input's top margin was
                  pulling it up over the text. Every other use of .label is on
                  a <p>, which is why this is the only place it showed. */}
              <label htmlFor="age" className="label block">
                Your age
              </label>
              <input
                id="age"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="—"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                className="tap mt-1.5 w-24 rounded-xl border border-ink-line bg-paper-card px-3.5 text-[16px] focus:border-effort-target focus:outline-none"
              />
            </div>

            <p className="label mt-5">Where you are right now</p>
            <div className="mt-2 space-y-2">
              {lifeStages.map((s) => (
                <button
                  key={s}
                  onClick={() => setLifeStage(s)}
                  className={`w-full rounded-xl border p-3.5 text-left text-[14px] transition-colors ${
                    lifeStage === s
                      ? "border-effort-target/40 bg-effort-tint/50 font-medium"
                      : "border-ink-line bg-paper-card hover:bg-paper-sunk/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
              However you describe it is fine. This isn&rsquo;t a diagnosis and
              nothing is inferred from it.
            </p>
          </div>
        )}

        {/* 3 — Goals */}
        {step === 3 && (
          <div className="animate-rise pt-6">
            <h1 className="font-display text-[1.6rem] leading-tight">
              What would make this worth it?
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              Pick as many as you like. These appear on your Journey screen, and
              Deepika builds your weeks around them.
            </p>

            <div className="mt-4 space-y-2">
              {GOAL_SUGGESTIONS.map((g) => {
                const on = goals.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggle(goals, setGoals, g)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-[14px] transition-colors ${
                      on
                        ? "border-effort-target/40 bg-effort-tint/50 font-medium"
                        : "border-ink-line bg-paper-card hover:bg-paper-sunk/50"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                        on ? "border-effort-stretch bg-effort-stretch text-white" : "border-ink-line"
                      }`}
                    >
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    {g}
                  </button>
                );
              })}
            </div>

            <label htmlFor="customGoal" className="label mt-5 block">
              Something else, in your own words
            </label>
            <input
              id="customGoal"
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="Optional"
              className="tap mt-1.5 w-full rounded-xl border border-ink-line bg-paper-card px-3.5 text-[16px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
            />
          </div>
        )}

        {/* 4 — Boundaries and constraints */}
        {step === 4 && (
          <div className="animate-rise pt-6">
            <h1 className="font-display text-[1.6rem] leading-tight">
              What you won&rsquo;t do
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              Genuinely — the thing you already know you&rsquo;re not going to give
              up, or start. Deepika builds around it instead of arguing with it.
            </p>

            <textarea
              value={wontDo}
              onChange={(e) => setWontDo(e.target.value)}
              rows={3}
              placeholder="e.g. I will not give up my evening chai, and I will not count calories."
              className="mt-3 w-full resize-none rounded-xl border border-ink-line bg-paper-card px-3.5 py-3 text-[15px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
            />

            <p className="label mt-5">Anything that gets in the way?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONSTRAINT_SUGGESTIONS.map((c) => {
                const on = constraints.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggle(constraints, setConstraints, c)}
                    className={`rounded-full px-3.5 py-2.5 text-[13px] transition-colors ${
                      on ? "bg-ink text-white" : "bg-paper-sunk text-ink-soft hover:bg-ink-line"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5 — Rhythm, then done */}
        {step === 5 && (
          <div className="animate-rise pt-6">
            <h1 className="font-display text-[1.6rem] leading-tight">
              When suits you best?
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              For your daily check-in. One tap, most days.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {(
                [
                  { key: "morning", label: "Mornings", icon: Sunrise, hint: "Start the day with it" },
                  { key: "evening", label: "Evenings", icon: Moon, hint: "Look back on the day" },
                ] as const
              ).map((o) => {
                const Icon = o.icon;
                const on = checkIn === o.key;
                return (
                  <button
                    key={o.key}
                    onClick={() => setCheckIn(o.key)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      on
                        ? "border-effort-target/40 bg-effort-tint/50"
                        : "border-ink-line bg-paper-card hover:bg-paper-sunk/50"
                    }`}
                  >
                    <Icon size={20} className={on ? "text-effort-stretch" : "text-ink-faint"} />
                    <p className="mt-2 text-[15px] font-medium">{o.label}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">{o.hint}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-marigold/25 bg-marigold-tint/60 p-4">
              <p className="text-[14px] font-medium">What happens next</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                Deepika reads this before your first session and builds your opening
                week around it. You&rsquo;ll see it on your Today screen, with her
                reason attached to anything she changes.
              </p>
            </div>

            {consentReports && (
              <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-paper-sunk/60 p-3.5">
                <FileText size={15} className="mt-0.5 shrink-0 text-ink-faint" />
                <p className="text-[13px] leading-relaxed text-ink-soft">
                  You can add blood work any time from Insights → Health Data. Your
                  numbers are stored and trended, never interpreted — that
                  conversation belongs with your doctor.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="safe-bottom shrink-0 border-t border-ink-line bg-paper-card px-5 py-3">
        <button
          onClick={next}
          disabled={!canAdvance()}
          className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-effort-stretch text-sm font-medium text-white transition-opacity disabled:opacity-30"
        >
          {step === TOTAL_STEPS - 1 ? "Start my journey" : "Continue"}
          {step < TOTAL_STEPS - 1 && <ArrowRight size={15} />}
        </button>
        {step === 1 && !consentHealth && (
          <p className="mt-2 text-center text-[12px] text-ink-faint">
            The first one is needed to continue.
          </p>
        )}
      </div>
    </div>
  );
}
