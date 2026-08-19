"use client";

import { AlertTriangle, ArrowDownRight, Sparkle } from "lucide-react";
import BottomSheet from "./BottomSheet";
import ExerciseFigure from "./ExerciseFigure";
import type { ExerciseSet } from "@/lib/types";

/**
 * Everything a member needs to do one movement well without Deepika present:
 * what it looks like, how to set up, how the rep goes, what usually goes
 * wrong, where it should be felt, and the honest easier version so that
 * "too hard" never has to mean "skipped".
 */
export default function ExerciseSheet({
  exercise,
  onClose,
}: {
  exercise: ExerciseSet | null;
  onClose: () => void;
}) {
  const e = exercise;

  return (
    <BottomSheet open={Boolean(e)} onClose={onClose} title={e?.name ?? ""}>
      {e && (
        <div>
          <div className="flex items-center gap-4 rounded-2xl bg-paper-sunk/60 p-3.5">
            <ExerciseFigure figure={e.figure} size={76} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[13px] text-ink">{e.prescription}</p>
              {e.feelItIn && (
                <p className="mt-1 text-[13px] leading-snug text-ink-soft">
                  <span className="text-ink-faint">Feel it in: </span>
                  {e.feelItIn}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-marigold/25 bg-marigold-tint/50 p-3">
            <p className="text-[13px] leading-relaxed text-ink">
              <span className="font-medium">Deepika&rsquo;s cue: </span>
              {e.cue}
            </p>
          </div>

          {e.setup && e.setup.length > 0 && (
            <Section title="Set up">
              {e.setup.map((s, i) => (
                <Step key={i} n={i + 1} text={s} />
              ))}
            </Section>
          )}

          {e.execute && e.execute.length > 0 && (
            <Section title="The movement">
              {e.execute.map((s, i) => (
                <Step key={i} n={i + 1} text={s} />
              ))}
            </Section>
          )}

          {e.watchFor && e.watchFor.length > 0 && (
            <Section title="Watch for">
              {e.watchFor.map((s, i) => (
                <div key={i} className="flex gap-2.5 py-1.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-attention" />
                  <p className="text-[14px] leading-relaxed text-ink-soft">{s}</p>
                </div>
              ))}
            </Section>
          )}

          {e.easier && (
            <div className="mt-4 rounded-xl bg-effort-tint/60 p-3.5">
              <div className="flex items-center gap-2">
                <ArrowDownRight size={14} className="text-effort-stretch" />
                <p className="text-[13px] font-medium text-effort-stretch">
                  If that&rsquo;s too much today
                </p>
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{e.easier}</p>
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
            If anything here hurts rather than feels hard, stop and tell Deepika.
            Sharp, one-sided, or still there two days later is always worth a message.
          </p>
        </div>
      )}
    </BottomSheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="label">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-2.5 py-1.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper-sunk font-mono text-[10px] text-ink-soft">
        {n}
      </span>
      <p className="text-[14px] leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}
