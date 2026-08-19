"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, AlertTriangle, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import ExerciseFigure from "@/components/ExerciseFigure";
import ExerciseSheet from "@/components/ExerciseSheet";
import type { EffortLevel, ExerciseSet } from "@/lib/types";

export default function WorkoutDetail({ params }: { params: { id: string } }) {
  const { workouts, activeMember, logWorkout, actions, completeAction } = useStore();
  const w = workouts.find((x) => x.id === params.id);

  const [openExercise, setOpenExercise] = useState<ExerciseSet | null>(null);
  const [stage, setStage] = useState<"view" | "finish" | "done">("view");
  const [level, setLevel] = useState<EffortLevel>("target");
  const [rpe, setRpe] = useState(6);
  const [pain, setPain] = useState(false);
  const [felt, setFelt] = useState("");

  if (!w) {
    return (
      <div className="px-5 pt-10">
        <p className="text-sm text-ink-soft">That session is not on your plan.</p>
      </div>
    );
  }

  const linked = actions.find(
    (a) => a.memberId === activeMember.id && a.dayOffset === 0 && a.workoutId === w.id
  );

  if (stage === "done") {
    return (
      <div className="animate-rise px-5 pt-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-effort-target text-white">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 font-display text-2xl">Logged.</h1>
        <p className="mx-auto mt-2 max-w-[17rem] text-[15px] leading-relaxed text-ink-soft">
          {pain
            ? "You flagged discomfort, so Deepika will see this before anything else today. Do not do the next session until she has replied."
            : "Deepika will see your effort rating when she plans next week."}
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

  if (stage === "finish") {
    return (
      <div className="animate-rise px-5 pt-6">
        <button
          onClick={() => setStage("view")}
          className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <h1 className="mt-4 font-display text-2xl">How did that go?</h1>

        <div className="mt-6">
          <p className="label">What did you get through?</p>
          <div className="mt-2.5 space-y-2">
            {(["minimum", "target", "stretch"] as EffortLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`tap flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-colors ${
                  level === l ? "bg-ink text-white" : "bg-paper-card shadow-card"
                }`}
              >
                <span
                  className={`h-8 w-1.5 rounded-full ${
                    l === "minimum"
                      ? "bg-effort-min"
                      : l === "target"
                      ? "bg-effort-target"
                      : "bg-effort-stretch"
                  }`}
                />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium capitalize">{l}</span>
                  <span
                    className={`block text-[13px] ${
                      level === l ? "text-white/70" : "text-ink-soft"
                    }`}
                  >
                    {w[l].label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <p className="label">How hard did it feel?</p>
            <span className="font-mono text-[11px] text-ink-soft">{rpe} / 10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            className="mt-3 w-full accent-[#3F6B57]"
            aria-label="Perceived effort"
          />
          <div className="mt-1 flex justify-between text-[11px] text-ink-faint">
            <span>Easy</span>
            <span>Could not do one more</span>
          </div>
        </div>

        <button
          onClick={() => setPain((p) => !p)}
          className={`tap mt-6 flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-colors ${
            pain ? "bg-attention-tint ring-1 ring-attention/30" : "bg-paper-card shadow-card"
          }`}
        >
          <AlertTriangle size={17} className={pain ? "text-attention" : "text-ink-faint"} />
          <span className="flex-1 text-[14px]">
            Something hurt — not just hard, actually hurt
          </span>
          <span
            className={`h-5 w-5 rounded-md border ${
              pain ? "border-attention bg-attention" : "border-ink-line"
            }`}
          />
        </button>

        <textarea
          value={felt}
          onChange={(e) => setFelt(e.target.value)}
          placeholder="Anything you want to say about it? (optional)"
          rows={2}
          className="mt-4 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
        />

        <button
          onClick={() => {
            logWorkout({
              memberId: activeMember.id,
              workoutId: w.id,
              dayOffset: 0,
              completedLevel: level,
              rpe,
              painFlag: pain,
              feltLike: felt || undefined,
              provenance: {
                source: "member_manual",
                enteredBy: activeMember.name.split(" ")[0],
                at: new Date().toISOString().slice(0, 10),
              },
            });
            if (linked) completeAction(linked.id, level);
            setStage("done");
          }}
          className="tap mt-5 w-full rounded-xl bg-ink text-sm font-medium text-white"
        >
          Save it
        </button>

        <div className="h-8" />
      </div>
    );
  }

  return (
    <div className="animate-rise px-5 pt-6">
      <Link
        href="/member/movement"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Movement
      </Link>

      <h1 className="mt-3 font-display text-[1.55rem] leading-tight">{w.name}</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{w.intent}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["minimum", "target", "stretch"] as EffortLevel[]).map((l) => (
          <div key={l} className="rounded-xl bg-paper-sunk/70 p-2.5">
            <span
              className={`block h-1 w-6 rounded-full ${
                l === "minimum"
                  ? "bg-effort-min"
                  : l === "target"
                  ? "bg-effort-target"
                  : "bg-effort-stretch"
              }`}
            />
            <p className="mt-1.5 text-[11px] capitalize text-ink-soft">{l}</p>
            <p className="font-mono text-[13px]">{w[l].minutes} min</p>
          </div>
        ))}
      </div>

      {w.warmup.length > 0 && (
        <div className="mt-5">
          <p className="label">Warm up</p>
          <ul className="mt-1.5 space-y-1">
            {w.warmup.map((x, i) => (
              <li key={i} className="text-[13px] text-ink-soft">
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <p className="label">The session</p>
          <span className="text-[11px] text-ink-faint">Tap any move to see how</span>
        </div>
        <div className="mt-2.5 space-y-2">
          {w.exercises.map((e, i) => (
            <button
              key={i}
              onClick={() => setOpenExercise(e)}
              className="card flex w-full items-center gap-3 px-3.5 py-3 text-left transition-shadow hover:shadow-lift"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper-sunk/70">
                <ExerciseFigure figure={e.figure} size={46} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-medium leading-snug">{e.name}</span>
                  <span className="shrink-0 font-mono text-[12px] text-ink-soft">
                    {e.prescription}
                  </span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-faint">
                  {e.cue}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <ExerciseSheet exercise={openExercise} onClose={() => setOpenExercise(null)} />

      <div className="mt-6 rounded-2xl border border-attention/25 bg-attention-tint/60 p-4">
        <p className="label mb-1">When to stop</p>
        <p className="text-[13px] leading-relaxed text-ink-soft">{w.stopGuidance}</p>
      </div>

      <button
        onClick={() => setStage("finish")}
        className="tap mt-6 w-full rounded-xl bg-ink text-sm font-medium text-white"
      >
        I have finished
      </button>

      <div className="h-8" />
    </div>
  );
}
