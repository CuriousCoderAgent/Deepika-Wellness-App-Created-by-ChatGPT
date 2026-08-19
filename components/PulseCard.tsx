"use client";

import { useState } from "react";
import { Check, Smile, Meh, Moon, Frown } from "lucide-react";
import { useStore } from "@/lib/store";
import { ProvenanceChip } from "./ui";
import BottomSheet from "./BottomSheet";

// All three scales run the same direction: 1 is the hard end, 5 is good.
// (An earlier version had Mental load running backwards — Light→Heavy, so 1
// was "good" here but "bad" on the other two scales. Design review caught it.)
const SCALES = [
  { key: "energy", label: "Energy", low: "Drained", high: "Energised" },
  { key: "sleep", label: "Sleep", low: "Poor", high: "Restorative" },
  { key: "stress", label: "Mental state", low: "Overwhelmed", high: "Calm" },
] as const;

/**
 * One-tap mood. Saves immediately — the whole point is that a check-in is a
 * two-second act of self-awareness, not a form to complete.
 *
 * A mood tap sets energy and mental state, and deliberately leaves sleep at 0
 * ("not recorded"). It cannot know how she slept, and inventing a number would
 * quietly feed a fabricated value into the Radar sleep rule.
 *
 * Icons, not emoji faces — one icon family throughout. No true red: that is
 * reserved for genuine system errors, never for how a woman says she feels.
 */
const MOODS = [
  { key: "good", label: "Good", energy: 4, stress: 4, icon: Smile, cls: "bg-effort-tint text-effort-stretch" },
  { key: "okay", label: "Okay", energy: 3, stress: 3, icon: Meh, cls: "bg-paper-sunk text-ink-soft" },
  { key: "tired", label: "Tired", energy: 2, stress: 3, icon: Moon, cls: "bg-calm-tint text-calm" },
  { key: "stressed", label: "Stressed", energy: 2, stress: 2, icon: Frown, cls: "bg-attention-tint text-attention" },
] as const;

const SYMPTOMS = ["Hot flush", "Night waking", "Bloating", "Joint aches", "Low mood", "Cramping"];

export default function PulseCard({
  memberId,
  asCoach = false,
}: {
  memberId: string;
  asCoach?: boolean;
}) {
  const { pulses, submitPulse } = useStore();
  const existing = pulses.find((p) => p.memberId === memberId && p.dayOffset === 0);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [v, setV] = useState({
    energy: existing?.energy ?? 0,
    sleep: existing?.sleep ?? 0,
    stress: existing?.stress ?? 0,
  });
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const openSheet = () => {
    setV({
      energy: existing?.energy ?? 0,
      sleep: existing?.sleep ?? 0,
      stress: existing?.stress ?? 0,
    });
    setSymptoms(existing?.symptoms ?? []);
    setNote(existing?.note ?? "");
    setSheetOpen(true);
  };

  /** One tap, saved. Sleep stays unrecorded rather than guessed. */
  const tapMood = (mo: (typeof MOODS)[number]) => {
    submitPulse(
      memberId,
      {
        energy: mo.energy,
        sleep: existing?.sleep ?? 0,
        stress: mo.stress,
        symptoms: existing?.symptoms ?? [],
        note: existing?.note,
        partial: !existing?.sleep,
      },
      asCoach
    );
    setJustSaved(mo.key);
    window.setTimeout(() => setJustSaved(null), 2200);
  };

  const ready = v.energy > 0 && v.sleep > 0 && v.stress > 0;
  const sleepMissing = existing && !existing.sleep;

  const detailForm = (
    <>
      <div className="space-y-4">
        {SCALES.map((s) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between">
              <p className="text-[14px] font-medium">{s.label}</p>
              <p className="text-[11px] text-ink-faint">
                {s.low} → {s.high}
              </p>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = v[s.key] === n;
                return (
                  <button
                    key={n}
                    onClick={() => setV((p) => ({ ...p, [s.key]: n }))}
                    aria-label={`${s.label} ${n} out of 5`}
                    className={`tap h-12 flex-1 rounded-xl text-sm font-medium transition-all ${
                      on
                        ? "bg-effort-stretch text-white"
                        : "bg-paper-sunk text-ink-soft hover:bg-ink-line"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-[14px] font-medium">Any symptoms?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s);
            return (
              <button
                key={s}
                onClick={() => setSymptoms((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                className={`rounded-full px-3 py-2 text-[13px] transition-colors ${
                  on ? "bg-ink text-white" : "bg-paper-sunk text-ink-soft hover:bg-ink-line"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[14px] font-medium">Anything Deepika should know?</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — a sentence is plenty."
          rows={3}
          className="mt-2 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
        />
      </div>

      <button
        disabled={!ready}
        onClick={() => {
          submitPulse(
            memberId,
            { ...v, symptoms, note: note || undefined, partial: false },
            asCoach
          );
          setSheetOpen(false);
        }}
        className="tap mt-5 w-full rounded-xl bg-effort-stretch text-sm font-medium text-white transition-opacity disabled:opacity-30"
      >
        {asCoach ? "Save on her behalf" : "Done"}
      </button>

      {asCoach && (
        <p className="mt-2 text-[12px] text-marigold-deep">
          This will be recorded as coach-entered, not member-entered.
        </p>
      )}
      {!ready && (
        <p className="mt-2 text-center text-[12px] text-ink-faint">
          All three help Deepika read the week properly.
        </p>
      )}
    </>
  );

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">How are you feeling?</p>
        {existing && !justSaved && (
          <span className="inline-flex items-center gap-1 text-[11px] text-effort-stretch">
            <Check size={12} strokeWidth={3} /> Saved
          </span>
        )}
        {justSaved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-effort-stretch">
            <Check size={12} strokeWidth={3} /> Got it
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {MOODS.map((mo) => {
          const Icon = mo.icon;
          // Reflect what's stored, so a saved mood still reads as chosen tomorrow.
          const on = existing
            ? existing.energy === mo.energy && existing.stress === mo.stress
            : false;
          return (
            <button
              key={mo.key}
              onClick={() => tapMood(mo)}
              className="tap flex flex-col items-center gap-1.5"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                  on ? mo.cls : "bg-paper-sunk text-ink-faint hover:bg-ink-line"
                } ${justSaved === mo.key ? "scale-110" : "scale-100"}`}
              >
                <Icon size={19} strokeWidth={on ? 2.2 : 1.7} />
              </span>
              <span className={`text-[11px] ${on ? "font-medium text-ink" : "text-ink-faint"}`}>
                {mo.label}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={openSheet}
        className="tap mt-3 text-[13px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
      >
        + Add details
      </button>

      {existing && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-line pt-2.5 text-[12px] text-ink-soft">
          <span>Energy {existing.energy}/5</span>
          <span>
            Sleep{" "}
            {existing.sleep ? (
              `${existing.sleep}/5`
            ) : (
              <button onClick={openSheet} className="text-effort-stretch underline underline-offset-2">
                add
              </button>
            )}
          </span>
          <span>Calm {existing.stress}/5</span>
          <span className="ml-auto">
            <ProvenanceChip p={existing.provenance} />
          </span>
        </div>
      )}

      {sleepMissing && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
          Sleep isn&rsquo;t recorded today — a mood tap can&rsquo;t know that one.
        </p>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="How are you today?">
        {detailForm}
      </BottomSheet>
    </div>
  );
}
