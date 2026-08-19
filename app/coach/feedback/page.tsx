"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Feedback } from "@/lib/types";

const STATUSES: Feedback["status"][] = ["new", "triaged", "building", "fixed"];
const STATUS_COPY: Record<Feedback["status"], string> = {
  new: "New",
  triaged: "Looked at",
  building: "Being built",
  fixed: "Done",
};

const CATEGORY_CLS: Record<Feedback["category"], string> = {
  bug: "bg-attention-tint text-attention",
  idea: "bg-effort-tint text-effort-stretch",
  confusing: "bg-marigold-tint text-marigold-deep",
};

export default function FeedbackPage() {
  const { feedback, updateFeedback, addFeedback } = useStore();
  const [text, setText] = useState("");
  const [screen, setScreen] = useState("Radar");
  const [category, setCategory] = useState<Feedback["category"]>("idea");

  const byStatus = (s: Feedback["status"]) => feedback.filter((f) => f.status === s);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-4xl leading-tight">Pilot feedback</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Your reactions and the members&rsquo; reactions, side by side and separately
        labelled. The point of a cohort of twenty is that you can still read every
        single one of these.
      </p>

      <div className="mt-7 card p-5">
        <p className="label">Add something you noticed</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="What felt wrong, missing, or confusing?"
          className="mt-2.5 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={screen}
            onChange={(e) => setScreen(e.target.value)}
            className="tap rounded-xl border border-ink-line bg-paper-card px-3 text-[13px] focus:outline-none"
          >
            {["Radar", "Member 360", "Journey Builder", "Week planner", "Session prep", "Library", "Today", "Movement"].map(
              (s) => (
                <option key={s}>{s}</option>
              )
            )}
          </select>
          {(["idea", "bug", "confusing"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-[13px] capitalize transition-colors ${
                category === c ? "bg-ink text-white" : "bg-paper-sunk text-ink-soft"
              }`}
            >
              {c}
            </button>
          ))}
          <button
            disabled={!text.trim()}
            onClick={() => {
              addFeedback({
                reporter: "Deepika",
                role: "coach",
                screen,
                category,
                severity: "medium",
                text: text.trim(),
                status: "new",
              });
              setText("");
            }}
            className="tap ml-auto rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-30"
          >
            Add
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {STATUSES.map((s) => (
          <div key={s}>
            <div className="flex items-baseline gap-2">
              <p className="label">{STATUS_COPY[s]}</p>
              <span className="font-mono text-[11px] text-ink-faint">{byStatus(s).length}</span>
            </div>
            <div className="mt-2.5 space-y-2.5">
              {byStatus(s).map((f) => (
                <div key={f.id} className="card p-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`chip ${CATEGORY_CLS[f.category]}`}>{f.category}</span>
                    <span className="chip bg-paper-sunk text-ink-faint">{f.screen}</span>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed">{f.text}</p>
                  <p className="mt-2 text-[12px] text-ink-faint">
                    {f.reporter} · {f.role}
                    {f.easeScore ? ` · ease ${f.easeScore}/5` : ""}
                  </p>
                  <select
                    value={f.status}
                    onChange={(e) =>
                      updateFeedback(f.id, { status: e.target.value as Feedback["status"] })
                    }
                    className="mt-2.5 w-full rounded-lg border border-ink-line bg-paper px-2 py-1.5 text-[12px] focus:outline-none"
                  >
                    {STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {STATUS_COPY[x]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {byStatus(s).length === 0 && (
                <p className="rounded-xl border border-dashed border-ink-line p-4 text-center text-[13px] text-ink-faint">
                  Nothing here
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
