"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mic, Play, CalendarClock, ChevronRight, RefreshCw, Check, Apple } from "lucide-react";
import { useStore } from "@/lib/store";
import { CategoryIcon, ConsistencyBand } from "@/components/ui";
import PulseCard from "@/components/PulseCard";
import { DEMO_MEMBER_ID } from "@/lib/session-client";
import type { EffortLevel } from "@/lib/types";

/**
 * Time of day, from her phone's clock.
 *
 * The greeting used to say "Good morning" at eleven at night. Everything else
 * in this prototype runs on dayOffset from a fixed seeded "today", which is
 * what keeps the sample history coherent — but the time of day is the one
 * thing that has to come from the real clock in her hand, because she is the
 * one reading it.
 */
function partOfDay(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Greeting adapts to what the last few days actually looked like. */
function greetingFor(
  energy: number | null,
  poorSleep: boolean,
  name: string,
  hour: number | null
) {
  // Null until the clock has been read on the client. Rendering a time-based
  // greeting on the server would bake the server's hour into the HTML and
  // then visibly swap it a moment later.
  const hi = hour === null ? `Hello, ${name}.` : `${partOfDay(hour)}, ${name}.`;

  if (poorSleep)
    return {
      hi,
      line: "Your sleep was more disrupted than usual last night. We've made today lighter.",
    };
  if (energy !== null && energy >= 4)
    return { hi, line: "You have had a good run. Today can be a bigger one if you want it." };
  return { hi, line: "One thing done today keeps the week intact." };
}

/** A single glanceable status, not a ramp of dots plus a text label plus a chevron. */
function FocusStatus({ level, rest }: { level: EffortLevel | null; rest?: boolean }) {
  if (rest) {
    return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-rest" aria-label="Rest day" />;
  }
  if (!level) {
    return (
      <span
        className="h-6 w-6 shrink-0 rounded-full border-2 border-ink-line"
        aria-label="Not done yet"
      />
    );
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-effort-stretch text-white"
      aria-label="Done"
    >
      <Check size={13} strokeWidth={3} />
    </span>
  );
}

export default function Today() {
  // Read after mount, not during render: the server has no idea what time it
  // is where she is.
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);

  const {
    activeMember: m,
    actions,
    pulses,
    messages,
    sessions,
    modules,
    foodEntries,
    replayOnboarding,
  } = useStore();
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);

  const first = m.name.split(" ")[0];
  const todays = actions.filter((a) => a.memberId === m.id && a.dayOffset === 0);
  const doneCount = todays.filter((a) => a.completed && a.completed !== "rest").length;
  const recent = pulses
    .filter((p) => p.memberId === m.id && p.dayOffset >= -3)
    .sort((a, b) => b.dayOffset - a.dayOffset);
  const poorSleep = recent.filter((p) => p.sleep <= 2).length >= 2;
  const greeting = greetingFor(recent[0]?.energy ?? null, poorSleep, first, hour);

  const voiceNote = messages.find(
    (x) => x.memberId === m.id && x.from === "coach" && x.kind === "voice" && x.dayOffset >= -1
  );
  const nextSession = sessions
    .filter((s) => s.memberId === m.id && s.status === "scheduled" && s.dayOffset >= 0)
    .sort((a, b) => a.dayOffset - b.dayOffset)[0];

  // Progress cue — a count, deliberately not a streak.
  const last14days = Array.from({ length: 14 }).map((_, i) => {
    const off = i - 13;
    const day = actions.filter((a) => a.memberId === m.id && a.dayOffset === off);
    const level = day.find((a) => a.completed === "stretch")
      ? "stretch"
      : day.find((a) => a.completed === "target")
      ? "target"
      : day.find((a) => a.completed === "minimum")
      ? "minimum"
      : day.find((a) => a.completed === "rest")
      ? "rest"
      : null;
    return { level: level as any, dayOffset: off };
  });
  const activeDays = last14days.filter((d) => d.level && d.level !== "rest").length;

  const proteinTarget = m.proteinTargetG;
  const proteinToday = foodEntries
    .filter((e) => e.memberId === m.id && e.dayOffset === 0)
    .reduce((s, e) => s + e.protein, 0);

  return (
    <div className="animate-rise px-5 pt-6">
      {/* 1 — Contextual greeting. Kept as the one serif "hero" moment on the
          whole screen — every other heading here is plain sans-serif. The
          profile control is the only chrome, and it is how you leave: no
          "viewing as" banner anywhere in the member surface. */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[1.55rem] leading-tight">{greeting.hi}</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{greeting.line}</p>
        </div>
        {/* An initial in a circle means "profile" in every other app on her
            phone, so as a sign-out button it was invisible — someone looking
            at this screen asked where the sign-out was while it was on it.
            The word does the work now; the initial keeps it hers. */}
        <form action="/api/auth/logout" method="post" className="shrink-0">
          <button
            type="submit"
            title="Sign out"
            className="tap flex items-center gap-1.5 rounded-full bg-paper-sunk pl-1 pr-3 text-[12px] text-ink-soft transition-colors hover:bg-ink-line hover:text-ink"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-effort-tint font-medium text-effort-stretch">
              {first.charAt(0)}
            </span>
            Sign out
          </button>
        </form>
      </div>

      {/* 2 — Plan adjusted. Compact by default; the full reason is one tap
          away, not printed in full every single day. */}
      {m.lastPlanChange && (
        <div className="mt-4 rounded-2xl bg-effort-tint/50 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-effort-tint text-effort-stretch">
              <RefreshCw size={12} />
            </span>
            <p className="text-[13px] font-medium text-effort-stretch">Plan adjusted</p>
            <span className="ml-auto font-mono text-[10px] text-ink-faint">{m.lastPlanChange.at}</span>
          </div>
          <p
            className={`mt-1.5 text-[13px] leading-relaxed text-ink-soft ${
              planExpanded ? "" : "line-clamp-1"
            }`}
          >
            {m.lastPlanChange.rationale}
          </p>
          {!planExpanded && (
            <button
              onClick={() => setPlanExpanded(true)}
              className="mt-0.5 text-[12px] font-medium text-effort-stretch"
            >
              Why?
            </button>
          )}
        </div>
      )}

      {/* 3 — Deepika's note. Marigold appears nowhere else in the member app. */}
      {voiceNote && (
        <div className="mt-3 rounded-2xl border border-marigold/25 bg-marigold-tint/70 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marigold text-white">
              <Mic size={12} />
            </span>
            <p className="text-[13px] font-medium">A note from Deepika</p>
            <span className="ml-auto font-mono text-[10px] text-marigold-deep">
              {voiceNote.seconds}s
            </span>
          </div>

          <button
            onClick={() => setPlaying((v) => !v)}
            className="tap mt-2.5 flex w-full items-center gap-2.5 rounded-xl bg-white/70 px-2.5 text-left"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marigold-deep text-white">
              <Play size={12} fill="currentColor" />
            </span>
            <span className="flex flex-1 items-center gap-[3px] py-2.5">
              {Array.from({ length: 22 }).map((_, i) => (
                <span
                  key={i}
                  className="w-full rounded-full bg-marigold/50"
                  style={{ height: `${5 + Math.abs(Math.sin(i * 1.7)) * 12}px` }}
                />
              ))}
            </span>
          </button>

          {playing ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
              &ldquo;{voiceNote.body}&rdquo;
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-marigold-deep/70">Tap to read the transcript</p>
          )}
        </div>
      )}

      {/* 4 — One-tap mood, above the day's actions per the Aug 2026 design
          review: how she's feeling should register before what's being asked
          of her. */}
      <div className="mt-3">
        <PulseCard memberId={m.id} />
      </div>

      {/* 5 — Focus today. Compact rows, full text always, never an ellipsis
          on the one thing that actually matters: what the minimum is. */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p className="label">Your focus today</p>
          {todays.length > 0 && (
            <span className="font-mono text-[11px] text-ink-faint">
              {doneCount} of {todays.length}
            </span>
          )}
        </div>
        <div className="mt-2.5 space-y-2">
          {todays.length === 0 && (
            <div className="card p-4 text-center">
              <p className="text-sm text-ink-soft">Nothing scheduled today. That is intentional.</p>
            </div>
          )}
          {todays.map((a) => {
            const mod = modules.find((x) => x.id === a.moduleId);
            const level = a.completed === "rest" ? null : (a.completed as EffortLevel | null);
            const secondary =
              a.completed && a.completed !== "rest"
                ? a.completed === "minimum"
                  ? a.minimum.label
                  : a.completed === "target"
                  ? a.target.label
                  : a.stretch.label
                : a.minimum.minutes > 0
                ? `Minimum ${a.minimum.minutes} min · Target ${a.target.minutes} min`
                : `Minimum: ${a.minimum.label}`;
            return (
              <Link
                key={a.id}
                href={`/member/action/${a.id}`}
                className="card flex items-center gap-3 px-4 py-3.5 transition-shadow hover:shadow-lift"
              >
                {mod && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk">
                    <CategoryIcon category={mod.category} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{a.title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-faint">{secondary}</p>
                </div>
                <FocusStatus level={level} rest={a.completed === "rest"} />
                <ChevronRight size={16} className="shrink-0 text-ink-faint" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* 6 — Protein. One number, tappable, never a scoreboard. */}
      <Link
        href="/member/food"
        className="card mt-4 flex items-center gap-3 p-3.5 transition-shadow hover:shadow-lift"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk">
          <Apple size={16} className="text-ink-faint" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium leading-snug">
            Protein today
            {proteinTarget ? (
              <span className="ml-1.5 font-mono text-[12px] font-normal text-ink-soft">
                {proteinToday}g of {proteinTarget}
              </span>
            ) : (
              <span className="ml-1.5 font-mono text-[12px] font-normal text-ink-soft">
                {proteinToday}g
              </span>
            )}
          </p>
          {proteinTarget ? (
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-sunk">
              <span
                className="block h-full rounded-full bg-effort-target transition-all duration-500"
                style={{ width: `${Math.min(100, (proteinToday / proteinTarget) * 100)}%` }}
              />
            </span>
          ) : (
            <p className="text-[12px] text-ink-faint">Log what you ate</p>
          )}
        </div>
        <ChevronRight size={16} className="shrink-0 text-ink-faint" />
      </Link>

      {/* 7 — Next human touchpoint */}
      {nextSession && (
        <Link
          href="/member/coach"
          className="card mt-4 flex items-center gap-3 p-3.5 transition-shadow hover:shadow-lift"
        >
          <CalendarClock size={16} className="shrink-0 text-ink-soft" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">
              {nextSession.type} {nextSession.dayOffset === 0 ? "today" : "tomorrow"},{" "}
              {nextSession.time}
            </p>
            <p className="text-[12px] text-ink-faint">Add a question for Deepika</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-ink-faint" />
        </Link>
      )}

      {/* 7 — One progress cue. A count, never a streak. In week one there is
          nothing to count yet, so it says what it is for instead of showing
          fourteen empty squares and reading as a scoreboard she is losing. */}
      <div className="mt-4 rounded-2xl bg-effort-tint px-4 py-3">
        {activeDays === 0 ? (
          <p className="text-[13px] leading-relaxed text-effort-stretch">
            This is where your consistency will show — any day with at least one
            healthy action counts. Nothing to catch up on yet.
          </p>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-effort-stretch">
              You&rsquo;re building consistency —{" "}
              <span className="font-medium">{activeDays} of the last 14 days</span> included
              at least one healthy action.
            </p>
            <div className="mt-2.5">
              <ConsistencyBand days={last14days} showDayLetters />
            </div>
          </>
        )}
      </div>

      {/* Demo control, only on the seeded account. Lets the welcome flow be
          walked again for someone watching, without resetting the five weeks
          of history that make the rest of the app worth looking at. */}
      {m.id === DEMO_MEMBER_ID && (
        <button
          onClick={() => {
            replayOnboarding(m.id);
            router.push("/onboarding");
          }}
          className="tap mt-5 w-full rounded-xl border border-dashed border-ink-line text-[12px] text-ink-faint hover:bg-paper-sunk hover:text-ink"
        >
          Replay the welcome flow (demo only — keeps your history)
        </button>
      )}

      <div className="h-6" />
    </div>
  );
}
