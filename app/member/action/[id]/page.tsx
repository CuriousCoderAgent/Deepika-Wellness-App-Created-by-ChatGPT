"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Check, MessageCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import ExerciseFigure from "@/components/ExerciseFigure";
import type { EffortLevel } from "@/lib/types";

const LEVELS: { key: EffortLevel; name: string; cls: string; ring: string }[] = [
  { key: "minimum", name: "Minimum", cls: "bg-effort-min", ring: "ring-effort-min" },
  { key: "target", name: "Target", cls: "bg-effort-target", ring: "ring-effort-target" },
  { key: "stretch", name: "Stretch", cls: "bg-effort-stretch", ring: "ring-effort-stretch" },
];

const REASONS = ["Ran out of time", "Too tired", "Not feeling well", "Family came first", "Travelling"];

export default function ActionDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { actions, modules, workouts, completeAction } = useStore();
  const a = actions.find((x) => x.id === params.id);
  const [restOpen, setRestOpen] = useState(false);
  const [done, setDone] = useState<EffortLevel | null>(null);

  if (!a) {
    return (
      <div className="px-5 pt-10">
        <p className="text-sm text-ink-soft">That action is no longer on your plan.</p>
        <Link href="/member" className="mt-3 inline-block text-sm text-effort-stretch underline">
          Back to Today
        </Link>
      </div>
    );
  }

  const mod = modules.find((m) => m.id === a.moduleId);
  const workout = a.workoutId ? workouts.find((w) => w.id === a.workoutId) : undefined;

  const record = (level: EffortLevel | "rest", reason?: string) => {
    completeAction(a.id, level, reason);
    if (level === "rest") {
      router.push("/member");
    } else {
      setDone(level);
    }
  };

  /* Completion state — reinforce the behaviour, not moral worth. */
  if (done) {
    return (
      <div className="animate-rise px-5 pt-16 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white ${
            LEVELS.find((l) => l.key === done)!.cls
          }`}
        >
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 font-display text-2xl">Recorded.</h1>
        <p className="mx-auto mt-2 max-w-[16rem] text-[15px] leading-relaxed text-ink-soft">
          {done === "minimum"
            ? "That is a complete day. The minimum was designed to be enough, and it was."
            : done === "target"
            ? "Exactly what the plan asked for."
            : "More than the plan asked for. Deepika will see this before your next session."}
        </p>
        <Link
          href="/member"
          className="tap mt-8 inline-flex items-center rounded-xl bg-ink px-5 text-sm font-medium text-white"
        >
          Back to Today
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-rise px-5 pt-6">
      <Link
        href="/member"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Today
      </Link>

      <h1 className="mt-3 font-display text-[1.55rem] leading-tight">{a.title}</h1>

      <div className="mt-3.5 rounded-2xl bg-paper-sunk/70 p-3.5">
        <p className="label">Why this, today</p>
        <p className="mt-1.5 text-[14px] leading-relaxed">{a.why}</p>
      </div>

      {/* For a movement action, show what the session actually contains before
          asking her to commit to a size. Deciding "can I do this today" is much
          easier when you can see the four movements than when you cannot. */}
      {workout && (
        <Link
          href={`/member/workout/${workout.id}`}
          className="card mt-3 block p-3.5 transition-shadow hover:shadow-lift"
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] font-medium">{workout.name}</p>
            <span className="text-[12px] text-ink-faint">
              {workout.exercises.length} movements
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            {workout.exercises.slice(0, 5).map((e, i) => (
              <span
                key={i}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper-sunk/70"
              >
                <ExerciseFigure figure={e.figure} size={38} />
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-effort-stretch">
            Open the session for form and cues
          </p>
        </Link>
      )}

      {mod && mod.keyIdeas.length > 0 && (
        <div className="mt-5">
          <p className="label">Worth knowing</p>
          <ul className="mt-2 space-y-2">
            {mod.keyIdeas.slice(0, 3).map((k, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-effort-target" />
                {k}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The mechanic itself. Three genuine options, presented as equals. */}
      <div className="mt-7">
        <p className="label">Choose the size of today</p>
        <div className="mt-3 space-y-2.5">
          {LEVELS.map((l) => {
            const spec = a[l.key];
            return (
              <button
                key={l.key}
                onClick={() => record(l.key)}
                className="card tap flex w-full items-center gap-3.5 p-4 text-left transition-shadow hover:shadow-lift"
              >
                <span className={`h-10 w-1.5 shrink-0 rounded-full ${l.cls}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-medium">{l.name}</span>
                    {spec.minutes > 0 && (
                      <span className="font-mono text-[10px] text-ink-faint">
                        {spec.minutes} MIN
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink-soft">{spec.label}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
          All three count. Minimum is not a lesser version of the day — it is the
          version designed for the days that fight back.
        </p>
      </div>


      {/* Rest — neutral, never a failure state, always with a reason we can learn from */}
      <div className="mt-6 border-t border-ink-line pt-5">
        {!restOpen ? (
          <button
            onClick={() => setRestOpen(true)}
            className="tap text-[14px] text-ink-faint underline underline-offset-2 hover:text-ink"
          >
            Not today
          </button>
        ) : (
          <div>
            <p className="text-[14px]">What got in the way?</p>
            <p className="mt-1 text-[13px] text-ink-faint">
              This is not a confession. It tells Deepika what to change.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => record("rest", r)}
                  className="rounded-full bg-paper-sunk px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-ink-line"
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => record("rest")}
                className="rounded-full bg-paper-sunk px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-ink-line"
              >
                Rather not say
              </button>
            </div>
          </div>
        )}
      </div>

      <Link
        href="/member/coach"
        className="tap mt-5 inline-flex items-center gap-2 text-[14px] text-ink-soft hover:text-ink"
      >
        <MessageCircle size={15} /> Ask Deepika about this
      </Link>

      <div className="h-8" />
    </div>
  );
}
