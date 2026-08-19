"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { useStore } from "@/lib/store";

const FIELDS = [
  { key: "biggestWin", label: "What went better than you expected?", ph: "Anything at all. It does not have to be big." },
  { key: "hardestPart", label: "What was hardest?", ph: "Be honest — this is the useful one." },
  { key: "feltUnrealistic", label: "What did I ask for that was never going to happen?", ph: "Deepika would rather know now than pretend." },
  { key: "questions", label: "Anything you want to ask on the call?", ph: "Optional" },
] as const;

export default function Reflection() {
  const { activeMember: m, sendMessage } = useStore();
  const [v, setV] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="animate-rise px-5 pt-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-effort-target text-white">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 font-display text-2xl">Sent to Deepika.</h1>
        <p className="mx-auto mt-2 max-w-[17rem] text-[15px] leading-relaxed text-ink-soft">
          She will read this before your session, so you will not have to explain
          the week from scratch.
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
        href="/member/coach"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Coach
      </Link>

      <h1 className="mt-4 font-display text-[1.55rem] leading-tight">Your week</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        Four questions. There is no score at the end of this and nobody is marking
        it.
      </p>

      <div className="mt-7 space-y-5">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-[15px] font-medium leading-snug">{f.label}</label>
            <textarea
              value={v[f.key] ?? ""}
              onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))}
              rows={2}
              placeholder={f.ph}
              className="mt-2 w-full resize-none rounded-xl border border-ink-line bg-paper-card px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
            />
          </div>
        ))}

        <div>
          <p className="text-[15px] font-medium leading-snug">
            How doable does next week feel?
          </p>
          <div className="mt-2.5 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setConfidence(n)}
                className={`tap h-11 flex-1 rounded-xl text-sm font-medium transition-colors ${
                  confidence === n
                    ? "bg-effort-target text-white"
                    : "bg-paper-sunk text-ink-faint hover:bg-ink-line"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-faint">
            <span>NOT AT ALL</span>
            <span>COMPLETELY</span>
          </div>
          {confidence > 0 && confidence <= 2 && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
              That is worth saying out loud. Deepika will make next week smaller
              rather than asking you to try harder.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          sendMessage(m.id, {
            from: "member",
            kind: "text",
            body: `Weekly reflection — hardest part: ${
              v.hardestPart || "not answered"
            }. Confidence next week: ${confidence || "—"}/5.`,
            dayOffset: 0,
            time: "just now",
            read: false,
          });
          setDone(true);
        }}
        className="tap mt-7 w-full rounded-xl bg-ink text-sm font-medium text-white"
      >
        Send to Deepika
      </button>

      <p className="mt-3 text-center text-[13px] text-ink-faint">
        Or leave it — you can do this together on the call.
      </p>

      <div className="h-8" />
    </div>
  );
}
