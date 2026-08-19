"use client";

import Link from "next/link";
import { ChevronRight, Dumbbell, ShieldCheck, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { EffortRamp } from "@/components/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Movement() {
  const { activeMember: m, actions, workouts, workoutLogs } = useStore();

  const week = actions
    .filter((a) => a.memberId === m.id && a.dayOffset >= -6 && a.dayOffset <= 0 && a.workoutId)
    .sort((a, b) => a.dayOffset - b.dayOffset);

  const upcoming = actions.filter(
    (a) => a.memberId === m.id && a.dayOffset === 0 && a.workoutId && !a.completed
  );

  const logs = workoutLogs.filter((l) => l.memberId === m.id).slice(0, 4);

  return (
    <div className="animate-rise px-5 pt-6">
      <h1 className="font-display text-[1.55rem] leading-tight">Movement</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        Only what Deepika has assigned you. There is no library to get lost in.
      </p>

      {upcoming.length > 0 && (
        <div className="mt-5">
          <p className="label">Today</p>
          <div className="mt-2.5 space-y-2">
            {upcoming.map((a) => {
              const w = workouts.find((x) => x.id === a.workoutId);
              return (
                <Link
                  key={a.id}
                  href={`/member/workout/${a.workoutId}`}
                  className="card flex items-center gap-3 px-4 py-3.5 transition-shadow hover:shadow-lift"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk">
                    <Dumbbell size={15} className="text-ink-faint" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{w?.name ?? a.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-faint">
                      {a.minimum.minutes}–{a.stretch.minutes} min ·{" "}
                      {w?.supervision === "supervised"
                        ? "With Deepika"
                        : w?.supervision === "check-in"
                        ? "Form check this week"
                        : "On your own"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-ink-faint" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Week one, before Deepika has assigned anything. Says what happens
          next rather than showing a blank screen and letting her assume
          something is broken. */}
      {upcoming.length === 0 && week.length === 0 && logs.length === 0 && (
        <div className="card mt-5 p-5 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-paper-sunk">
            <Dumbbell size={19} className="text-ink-faint" />
          </span>
          <p className="mt-3 text-[15px] font-medium">Nothing assigned yet</p>
          <p className="mx-auto mt-1.5 max-w-[17rem] text-[13px] leading-relaxed text-ink-soft">
            Deepika builds your first sessions after she has read your answers.
            They will appear here — you don&rsquo;t need to pick anything yourself.
          </p>
        </div>
      )}

      {/* The week, as a row. Not a calendar. */}
      <div className="mt-5">
        <p className="label">Your week</p>
        <div className="mt-2.5 flex gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => {
            const offset = i - 6;
            const a = week.find((x) => x.dayOffset === offset);
            const isToday = offset === 0;
            return (
              <div key={i} className="flex-1 text-center">
                <div
                  className={`flex h-14 flex-col items-center justify-center gap-1.5 rounded-xl ${
                    isToday
                      ? "border border-effort-target/30 bg-paper-card"
                      : "bg-paper-sunk/60"
                  }`}
                >
                  {a ? (
                    <>
                      <EffortRamp
                        level={a.completed === "rest" ? null : (a.completed as any)}
                        rest={a.completed === "rest"}
                        size="sm"
                      />
                      <span className="text-[10px] text-ink-faint">
                        {a.completed === "rest" ? "rest" : a.completed ? "done" : "planned"}
                      </span>
                    </>
                  ) : (
                    <span className="h-1 w-4 rounded-full bg-paper-sunk" />
                  )}
                </div>
                <p
                  className={`mt-1 text-[11px] ${
                    isToday ? "font-medium text-ink" : "text-ink-faint"
                  }`}
                >
                  {DAYS[(new Date().getDay() + 6 + offset) % 7]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {logs.length > 0 && (
        <div className="mt-6">
          <p className="label">What you have lifted</p>
          {/* Flat rows with separators rather than a stack of cards — this is a
              list, and giving every entry its own floating surface just makes
              the screen noisier without making it clearer. */}
          <div className="card mt-2.5 divide-y divide-ink-line px-4">
            {logs.map((l) => {
              const w = workouts.find((x) => x.id === l.workoutId);
              return (
                <div key={l.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-snug">{w?.name}</p>
                    <p className="text-[12px] leading-snug text-ink-faint">
                      Effort {l.rpe}/10
                      {l.feltLike ? ` · “${l.feltLike}”` : ""}
                    </p>
                  </div>
                  <EffortRamp level={l.completedLevel} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-dashed border-ink-line p-3.5">
        <p className="text-[12px] leading-relaxed text-ink-soft">
          If anything hurts — sharp, one-sided, or still there after two days — stop
          and tell Deepika. She will look at it before your next session, and refer
          you on if it needs a physiotherapist.
        </p>
      </div>

      <div className="h-8" />
    </div>
  );
}
