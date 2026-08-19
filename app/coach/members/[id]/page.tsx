"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  Mic,
  Send,
  Plus,
  Minus,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  EffortRamp,
  ProvenanceChip,
  Sparkline,
  ScopeNotice,
  ConsistencyBand,
  CategoryIcon,
} from "@/components/ui";
import PulseCard from "@/components/PulseCard";
import { draftWeekPlansFor, PHASE_WEEKS } from "@/lib/plan";
import { memberLabel } from "@/lib/display";
import type { EffortLevel, WeekPlan } from "@/lib/types";

const TABS = [
  "Overview",
  "Assessment",
  "Journey builder",
  "Week planner",
  "Notes",
  "Session prep",
] as const;
type Tab = (typeof TABS)[number];

const PHASE_ORDER: WeekPlan["phase"][] = ["Stabilise", "Build", "Consolidate"];

export default function Member360({ params }: { params: { id: string } }) {
  const store = useStore();
  const {
    members,
    modules,
    actions,
    pulses,
    messages,
    sessions,
    radar,
    reports,
    updateDraftWeek,
    publishWeek,
    addCoachNote,
    setProteinTarget,
    sendMessage,
    updateAction,
    saveSessionNotes,
  } = store;

  const m = members.find((x) => x.id === params.id);
  const [tab, setTab] = useState<Tab>("Overview");
  const [rationale, setRationale] = useState("");
  const [published, setPublished] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [privateNotes, setPrivateNotes] = useState("");
  const [recap, setRecap] = useState("");
  const [newNote, setNewNote] = useState("");

  if (!m) {
    return (
      <div className="px-6 py-10">
        <p className="text-sm text-ink-soft">No such member.</p>
      </div>
    );
  }

  const mine = actions.filter((a) => a.memberId === m.id);
  const myPulses = pulses
    .filter((p) => p.memberId === m.id)
    .sort((a, b) => a.dayOffset - b.dayOffset);
  const flags = radar.filter((r) => r.memberId === m.id && !r.resolved);
  const nextSession = sessions
    .filter((s) => s.memberId === m.id && s.status === "scheduled")
    .sort((a, b) => a.dayOffset - b.dayOffset)[0];
  const lastSession = sessions
    .filter((s) => s.memberId === m.id && s.status === "complete")
    .sort((a, b) => b.dayOffset - a.dayOffset)[0];
  const week = selectedWeek ?? m.week;
  const draftPlans = draftWeekPlansFor(m);
  const weekDraft = draftPlans.find((w) => w.week === week) ?? draftPlans[0];
  const weekActive = modules.filter((x) => weekDraft.moduleIds.includes(x.id));
  const weekAvailable = modules.filter((x) => !weekDraft.moduleIds.includes(x.id));
  const myNotes = m.notes ?? [];
  const myReports = reports
    .filter((r) => r.memberId === m.id)
    .sort((a, b) => b.collectedOn.localeCompare(a.collectedOn));

  const days14 = Array.from({ length: 14 }).map((_, i) => {
    const off = i - 13;
    const day = mine.filter((a) => a.dayOffset === off);
    return {
      dayOffset: off,
      level: (day.find((a) => a.completed === "stretch")
        ? "stretch"
        : day.find((a) => a.completed === "target")
        ? "target"
        : day.find((a) => a.completed === "minimum")
        ? "minimum"
        : day.find((a) => a.completed === "rest")
        ? "rest"
        : null) as any,
    };
  });

  const todays = mine.filter((a) => a.dayOffset === 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/coach/members"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={15} /> Members
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-medium leading-tight">{memberLabel(m)}</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">
            {m.age} · {m.city} · Week {m.week} · {m.phase} phase
          </p>
          <p className="mt-1 text-[14px] text-ink-faint">{m.lifeStage}</p>
        </div>
        <Link
          href="/member"
          onClick={() => store.setActiveMember(m.id)}
          className="tap inline-flex items-center gap-1.5 rounded-xl bg-paper-sunk px-3 text-sm text-ink-soft hover:bg-ink-line hover:text-ink"
        >
          See her app <ArrowUpRight size={14} />
        </Link>
      </div>

      {flags.length > 0 && (
        <div className="mt-5 rounded-2xl border border-attention/25 bg-attention-tint/50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-attention" />
            <p className="text-sm font-medium">
              {flags.length} thing{flags.length > 1 ? "s" : ""} on your Radar
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {flags.map((f) => (
              <li key={f.id} className="text-[14px] leading-snug text-ink-soft">
                <span className="font-mono text-[11px] text-ink-faint">{f.ruleId}</span>{" "}
                {f.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="scroll-hide mt-7 flex gap-1 overflow-x-auto border-b border-ink-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors ${
              tab === t
                ? "border-ink text-ink"
                : "border-transparent text-ink-faint hover:text-ink-soft"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---------------- Overview ---------------- */}
      {tab === "Overview" && (
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <div className="card p-5 md:col-span-2">
            <p className="label">What she is trying to get to</p>
            <ul className="mt-2.5 space-y-1.5">
              {m.goals.map((g, i) => (
                <li key={i} className="text-[15px] leading-snug">
                  {g}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-ink-line pt-3">
              <p className="label">And what she will not do</p>
              <p className="mt-1.5 text-[14px] italic text-ink-soft">&ldquo;{m.wontDo}&rdquo;</p>
            </div>
          </div>

          <div className="card p-5">
            <p className="label">Last 14 days</p>
            <div className="mt-3">
              <ConsistencyBand days={days14} showDayLetters />
            </div>
            <p className="mt-2.5 text-[14px] text-ink-soft">
              Active on{" "}
              {days14.filter((d) => d.level && d.level !== "rest").length} of 14 days.
            </p>
          </div>

          <div className="card p-5">
            <p className="label">Energy and sleep</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[13px] text-ink-soft">Energy</p>
                <Sparkline values={myPulses.map((p) => p.energy)} color="#6E8F73" height={28} />
              </div>
              <div>
                <p className="text-[13px] text-ink-soft">Sleep</p>
                <Sparkline values={myPulses.map((p) => p.sleep)} color="#8FA9C4" height={28} />
              </div>
            </div>
          </div>

          <div className="card p-5 md:col-span-2">
            <div className="flex items-baseline justify-between">
              <p className="label">Today&rsquo;s plan</p>
              <span className="font-mono text-[11px] text-ink-faint">
                {todays.filter((a) => a.completed && a.completed !== "rest").length} /{" "}
                {todays.length} DONE
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {todays.map((a) => (
                <div key={a.id} className="flex items-center gap-3 border-b border-ink-line pb-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">{a.title}</p>
                    {a.skipReason && (
                      <p className="text-[13px] text-ink-faint">
                        Not today — &ldquo;{a.skipReason}&rdquo;
                      </p>
                    )}
                  </div>
                  <ProvenanceChip p={a.provenance} showWho />
                  <EffortRamp
                    level={a.completed === "rest" ? null : (a.completed as any)}
                    rest={a.completed === "rest"}
                  />
                </div>
              ))}
              {todays.length === 0 && (
                <p className="text-[14px] text-ink-faint">Nothing assigned today.</p>
              )}
            </div>
          </div>

          {/* Coach-on-behalf entry — the dual-entry requirement, live */}
          <div className="md:col-span-2">
            <p className="label mb-2">Enter her check-in during the call</p>
            <PulseCard memberId={m.id} asCoach />
          </div>

          <div className="card p-5 md:col-span-2">
            <p className="label">Daily protein target</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              Your number, not a calculated one — the app never sets this
              itself. She sees it on Today and on her food log. Leave it blank
              and the app just counts without a target.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={250}
                value={m.proteinTargetG ?? ""}
                onChange={(e) =>
                  setProteinTarget(m.id, e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="—"
                className="w-24 rounded-xl border border-ink-line bg-paper px-3 py-2 text-right font-mono text-[15px] focus:border-effort-target focus:outline-none"
              />
              <span className="text-[14px] text-ink-soft">grams per day</span>
            </div>
          </div>

          <div className="card p-5 md:col-span-2">
            <p className="label">Send her something</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setVoiceMode(false)}
                className={`rounded-lg px-3 py-1.5 text-[13px] ${
                  !voiceMode ? "bg-ink text-white" : "bg-paper-sunk text-ink-soft"
                }`}
              >
                Text
              </button>
              <button
                onClick={() => setVoiceMode(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ${
                  voiceMode ? "bg-marigold text-white" : "bg-paper-sunk text-ink-soft"
                }`}
              >
                <Mic size={13} /> Voice note
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={
                voiceMode
                  ? "What you would say out loud — this becomes the transcript"
                  : "A short message"
              }
              className="mt-3 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
            />
            <button
              disabled={!note.trim()}
              onClick={() => {
                sendMessage(m.id, {
                  from: "coach",
                  kind: voiceMode ? "voice" : "text",
                  body: note.trim(),
                  seconds: voiceMode ? Math.max(12, Math.round(note.length / 14)) : undefined,
                  dayOffset: 0,
                  time: "just now",
                  read: false,
                });
                setNote("");
              }}
              className="tap mt-3 inline-flex items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-30"
            >
              <Send size={14} /> Send
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Assessment ---------------- */}
      {tab === "Assessment" && (
        <div className="mt-7 space-y-5">
          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <p className="label">Baseline completeness</p>
              <span className="font-mono text-[13px]">{m.assessmentComplete}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-sunk">
              <div
                className="h-full rounded-full bg-effort-target"
                style={{ width: `${m.assessmentComplete}%` }}
              />
            </div>
            {m.assessmentComplete < 100 && (
              <p className="mt-2.5 text-[14px] text-ink-soft">
                Finish the remaining sections together during the next call rather
                than sending another form.
              </p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="card p-5">
              <p className="label">Medical history</p>
              <ul className="mt-2.5 space-y-1.5">
                {m.medical.length ? (
                  m.medical.map((x, i) => (
                    <li key={i} className="text-[15px] leading-snug">
                      {x}
                    </li>
                  ))
                ) : (
                  <li className="text-[14px] text-ink-faint">Nothing recorded.</li>
                )}
              </ul>
              <p className="label mt-4">Medications</p>
              <ul className="mt-2 space-y-1.5">
                {m.medications.length ? (
                  m.medications.map((x, i) => (
                    <li key={i} className="text-[15px] leading-snug">
                      {x}
                    </li>
                  ))
                ) : (
                  <li className="text-[14px] text-ink-faint">None recorded.</li>
                )}
              </ul>
            </div>

            <div className="card p-5">
              <p className="label">Constraints she actually lives with</p>
              <ul className="mt-2.5 space-y-1.5">
                {m.constraints.map((x, i) => (
                  <li key={i} className="text-[15px] leading-snug">
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {m.bodyComp && m.bodyComp.length > 0 && (
            <div className="card p-5">
              <p className="label">Measurements and reports</p>
              <div className="mt-3 divide-y divide-ink-line">
                {m.bodyComp.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-[15px]">{b.label}</p>
                      <p className="text-[13px] text-ink-faint">{b.at}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[14px]">{b.value}</span>
                      <ProvenanceChip p={b.provenance} showWho />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label">Uploaded reports</p>
              <span className="font-mono text-[11px] text-ink-faint">
                {myReports.length} ON FILE
              </span>
            </div>
            {myReports.length === 0 ? (
              <p className="mt-2.5 text-[14px] text-ink-faint">
                Nothing uploaded. She can add these herself from Progress → Your
                reports, or you can enter them during a session.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {myReports.map((r) => (
                  <div key={r.id} className="border-t border-ink-line pt-3 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[15px] font-medium">{r.title}</p>
                      <span className="text-[13px] text-ink-faint">{r.collectedOn}</span>
                      <span className="ml-auto">
                        <ProvenanceChip p={r.provenance} showWho />
                      </span>
                    </div>
                    {r.lab && <p className="text-[13px] text-ink-faint">{r.lab}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                      {r.values.map((v, i) => (
                        <span key={i} className="text-[13px] text-ink-soft">
                          {v.label}{" "}
                          <span className="font-mono text-ink">
                            {v.value}
                            {v.unit ? ` ${v.unit}` : ""}
                          </span>
                        </span>
                      ))}
                    </div>
                    {r.note && (
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{r.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ScopeNotice>
            Reports are stored and trended here, never interpreted. No value on this
            screen is flagged high, low or concerning, because doing so would be a
            clinical judgement and this is not a clinical product. If a value needs
            explaining, that conversation belongs with her doctor — use the
            &ldquo;Preparing Questions for Your Doctor&rdquo; module to make it a
            better appointment.
          </ScopeNotice>
        </div>
      )}

      {/* ---------------- Journey builder ---------------- */}
      {tab === "Journey builder" && (
        <div className="mt-7 space-y-5">
          <div className="card p-5">
            <p className="label">Her constraints, while you build</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              {m.constraints.join(" · ")}
            </p>
            <p className="mt-1.5 text-[14px] italic text-ink-soft">
              &ldquo;{m.wontDo}&rdquo;
            </p>
          </div>

          {/* Phase groups — the calendar structure, not necessarily where she actually is today */}
          <div className="grid grid-cols-3 gap-2.5">
            {PHASE_ORDER.map((ph) => {
              const [start, end] = PHASE_WEEKS[ph];
              const isPast = m.week > end;
              const isCurrentRange = m.week >= start && m.week <= end;
              return (
                <button
                  key={ph}
                  onClick={() => setSelectedWeek(start)}
                  className={`rounded-2xl border p-3.5 text-left transition-colors ${
                    week >= start && week <= end
                      ? "border-ink-soft bg-paper-card"
                      : "border-ink-line bg-paper-sunk/50 hover:bg-paper-sunk"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isPast ? (
                      <CheckCircle2 size={14} className="text-effort-target" />
                    ) : (
                      <Circle
                        size={14}
                        className={isCurrentRange ? "text-effort-target" : "text-ink-faint"}
                      />
                    )}
                    <p className="text-[13px] font-medium">{ph}</p>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-faint">
                    Weeks {start}–{end}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Week 1–12 navigator */}
          <div className="scroll-hide flex gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`tap shrink-0 rounded-xl border px-3 text-[13px] transition-colors ${
                  w === week
                    ? "border-ink-soft bg-paper-card font-medium"
                    : "border-transparent bg-paper-sunk/70 text-ink-soft hover:bg-paper-sunk"
                }`}
              >
                <span className="flex items-center gap-1">
                  Week {w}
                  {w < m.week && <CheckCircle2 size={12} className="text-effort-target" />}
                </span>
                <span className="block text-[10px] text-ink-faint">
                  {w === m.week ? "This week" : w === m.week + 1 ? "Next week" : " "}
                </span>
              </button>
            ))}
          </div>

          <p className="text-[13px] text-ink-faint">
            Editing week {week} of 12{week === m.week ? " — her current week" : ""}
          </p>

          <div className="card p-5">
            <p className="label">Week {week} focus</p>
            <div className="mt-2.5 space-y-2">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  value={weekDraft.focus[i] ?? ""}
                  onChange={(e) => {
                    const n = [weekDraft.focus[0] ?? "", weekDraft.focus[1] ?? "", weekDraft.focus[2] ?? ""];
                    n[i] = e.target.value;
                    updateDraftWeek(m.id, week, { focus: n });
                  }}
                  placeholder={i === 0 ? "First priority" : `Priority ${i + 1} (optional)`}
                  className="tap w-full rounded-xl border border-ink-line bg-paper px-3 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
                />
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="label mb-2.5">Assigned ({weekActive.length})</p>
              <div className="space-y-2">
                {weekActive.map((mod) => (
                  <div key={mod.id} className="card p-3.5">
                    <div className="flex items-start gap-2">
                      <CategoryIcon category={mod.category} className="mt-0.5 shrink-0 text-ink-faint" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug">{mod.name}</p>
                        <p className="mt-0.5 text-[13px] text-ink-faint">
                          {mod.category} · v{mod.version}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          updateDraftWeek(m.id, week, {
                            moduleIds: weekDraft.moduleIds.filter((x) => x !== mod.id),
                          })
                        }
                        className="tap -mr-1 -mt-1 rounded-lg px-2 text-ink-faint hover:bg-paper-sunk hover:text-ink"
                        aria-label={`Remove ${mod.name}`}
                      >
                        <Minus size={15} />
                      </button>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                      {mod.betterLooksLike}
                    </p>
                  </div>
                ))}
                {weekActive.length === 0 && (
                  <p className="text-[13px] text-ink-faint">Nothing assigned this week.</p>
                )}
              </div>
            </div>

            <div>
              <p className="label mb-2.5">Library ({weekAvailable.length})</p>
              <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {weekAvailable.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() =>
                      updateDraftWeek(m.id, week, {
                        moduleIds: [...weekDraft.moduleIds, mod.id],
                      })
                    }
                    className="flex w-full items-start gap-2 rounded-xl bg-paper-sunk/70 p-3.5 text-left transition-colors hover:bg-paper-sunk"
                  >
                    <CategoryIcon category={mod.category} className="mt-0.5 shrink-0 text-ink-faint" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium leading-snug">{mod.name}</p>
                      <p className="mt-0.5 text-[13px] text-ink-faint">
                        {mod.category} · v{mod.version}
                      </p>
                    </div>
                    <Plus size={15} className="mt-0.5 shrink-0 text-ink-faint" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Draft vs published — nothing reaches her until you assign it */}
          <div className="card p-5">
            <p className="label">Why it changed — she will see this</p>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Say it the way you would say it to her. Plainly, without making her feel behind."
              className="mt-2 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => {
                  setDraftSaved(true);
                  setPublished(false);
                }}
                className="tap inline-flex items-center gap-2 rounded-xl bg-paper-sunk px-4 text-sm font-medium text-ink-soft hover:bg-ink-line hover:text-ink"
              >
                Save draft
              </button>
              <button
                disabled={!rationale.trim()}
                onClick={() => {
                  publishWeek(m.id, week, rationale.trim());
                  setRationale("");
                  setPublished(true);
                  setDraftSaved(false);
                }}
                className="tap inline-flex items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-30"
              >
                <Send size={14} /> Assign to member
              </button>
            </div>

            {draftSaved && (
              <p className="mt-3 text-[14px] text-ink-soft">
                Saved as a draft. She won&rsquo;t see week {week} until you assign it.
              </p>
            )}
            {published && (
              <p className="mt-3 text-[14px] text-effort-stretch">
                Assigned.{" "}
                {week === m.week
                  ? "Open her app from the top of this page — the change and your reason are on her Today screen."
                  : `Week ${week} is on her Journey now.`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Week planner ---------------- */}
      {tab === "Week planner" && (
        <div className="mt-7 space-y-5">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Drop today&rsquo;s target down to the minimum without rebuilding the
            module. This is the edit you will make most often.
          </p>

          <div className="space-y-3">
            {todays.map((a) => (
              <div key={a.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-medium">{a.title}</p>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {a.moduleId}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{a.why}</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {(["minimum", "target", "stretch"] as EffortLevel[]).map((l) => (
                    <div key={l} className="rounded-xl bg-paper-sunk/70 p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1 w-5 rounded-full ${
                            l === "minimum"
                              ? "bg-effort-min"
                              : l === "target"
                              ? "bg-effort-target"
                              : "bg-effort-stretch"
                          }`}
                        />
                        <span className="text-[11px] capitalize text-ink-soft">{l}</span>
                      </div>
                      <input
                        value={a[l].label}
                        onChange={(e) =>
                          updateAction(a.id, {
                            [l]: { ...a[l], label: e.target.value },
                          } as any)
                        }
                        className="mt-2 w-full rounded-lg border border-ink-line bg-paper-card px-2 py-1.5 text-[13px] focus:border-effort-target focus:outline-none"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input
                          type="number"
                          value={a[l].minutes}
                          onChange={(e) =>
                            updateAction(a.id, {
                              [l]: { ...a[l], minutes: Number(e.target.value) },
                            } as any)
                          }
                          className="w-16 rounded-lg border border-ink-line bg-paper-card px-2 py-1 font-mono text-[13px] focus:border-effort-target focus:outline-none"
                        />
                        <span className="text-[11px] text-ink-faint">min</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() =>
                    updateAction(a.id, {
                      target: { ...a.minimum },
                      why: `${a.why} Made smaller today — nothing is behind.`,
                    })
                  }
                  className="tap mt-3 rounded-xl bg-paper-sunk px-3 text-[13px] text-ink-soft hover:bg-ink-line hover:text-ink"
                >
                  Make today the minimum version
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Notes ---------------- */}
      {tab === "Notes" && (
        <div className="mt-7 space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <p className="label">Add a note</p>
              <span className="chip bg-paper-sunk text-ink-faint">she never sees this</span>
            </div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              placeholder="Clinical-style observations, patterns, things to watch — dated automatically."
              className="mt-2.5 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
            />
            <button
              disabled={!newNote.trim()}
              onClick={() => {
                addCoachNote(m.id, newNote.trim());
                setNewNote("");
              }}
              className="tap mt-3 rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-30"
            >
              Add note
            </button>
          </div>

          <div>
            <p className="label mb-2.5">History ({myNotes.length})</p>
            {myNotes.length === 0 ? (
              <p className="text-[14px] text-ink-faint">Nothing logged yet.</p>
            ) : (
              <div className="space-y-3">
                {myNotes.map((n) => (
                  <div key={n.id} className="card p-4">
                    <p className="label">
                      {new Date(n.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    <p className="mt-1.5 text-[14px] leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Session prep ---------------- */}
      {tab === "Session prep" && (
        <div className="mt-7 space-y-5">
          {nextSession ? (
            <>
              <div className="card p-5">
                <p className="label">
                  {nextSession.type} ·{" "}
                  {nextSession.dayOffset === 0 ? "today" : `in ${nextSession.dayOffset} day(s)`} ·{" "}
                  {nextSession.time}
                </p>
                <h2 className="mt-2 font-display text-xl">What happened this week</h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="label">Completed</p>
                    <p className="mt-1 font-display text-2xl">
                      {mine.filter((a) => a.completed && a.completed !== "rest").length}
                    </p>
                  </div>
                  <div>
                    <p className="label">Not today</p>
                    <p className="mt-1 font-display text-2xl">
                      {mine.filter((a) => a.completed === "rest").length}
                    </p>
                  </div>
                  <div>
                    <p className="label">Avg energy</p>
                    <p className="mt-1 font-display text-2xl">
                      {myPulses.length
                        ? (
                            myPulses.reduce((s, p) => s + p.energy, 0) / myPulses.length
                          ).toFixed(1)
                        : "—"}
                    </p>
                  </div>
                </div>

                {mine.filter((a) => a.skipReason).length > 0 && (
                  <div className="mt-5 border-t border-ink-line pt-4">
                    <p className="label">Reasons she gave</p>
                    <ul className="mt-2 space-y-1">
                      {mine
                        .filter((a) => a.skipReason)
                        .map((a) => (
                          <li key={a.id} className="text-[14px] text-ink-soft">
                            {a.title} — &ldquo;{a.skipReason}&rdquo;
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {nextSession.memberQuestions.length > 0 && (
                  <div className="mt-5 border-t border-ink-line pt-4">
                    <p className="label">Her questions</p>
                    <ul className="mt-2 space-y-1.5">
                      {nextSession.memberQuestions.map((q, i) => (
                        <li key={i} className="text-[15px] leading-snug">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {nextSession.agenda.length > 0 && (
                  <div className="mt-5 border-t border-ink-line pt-4">
                    <p className="label">Suggested to cover</p>
                    <ul className="mt-2 space-y-1.5">
                      {nextSession.agenda.map((x, i) => (
                        <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-effort-target" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {lastSession?.commitments.length ? (
                <div className="card p-5">
                  <p className="label">What she committed to last time</p>
                  <div className="mt-2.5 space-y-2">
                    {lastSession.commitments.map((c, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-[15px]">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            c.done ? "bg-effort-target" : "bg-rest"
                          }`}
                        />
                        <span className={c.done ? "text-ink-faint" : ""}>{c.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {lastSession?.privateNotes && (
                <div className="card p-5">
                  <div className="flex items-center gap-2">
                    <p className="label">Your private notes from last time</p>
                    <span className="chip bg-paper-sunk text-ink-faint">not shared</span>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                    {lastSession.privateNotes}
                  </p>
                </div>
              )}

              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <p className="label">Private notes</p>
                  <span className="chip bg-paper-sunk text-ink-faint">she never sees this</span>
                </div>
                <textarea
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  rows={4}
                  placeholder="Clinical-style observations, patterns, things to watch."
                  className="mt-2.5 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
                />

                <div className="mt-5 flex items-center gap-2">
                  <p className="label">Recap for her</p>
                  <span className="chip bg-effort-tint text-effort-stretch">she reads this</span>
                </div>
                <textarea
                  value={recap}
                  onChange={(e) => setRecap(e.target.value)}
                  rows={4}
                  placeholder="What you agreed, in her language. This lands in her Coach tab."
                  className="mt-2.5 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
                />

                <button
                  disabled={!privateNotes.trim() && !recap.trim()}
                  onClick={() => {
                    saveSessionNotes(nextSession.id, {
                      privateNotes: privateNotes || undefined,
                      memberRecap: recap || undefined,
                      status: "complete",
                    });
                    if (recap.trim()) {
                      sendMessage(m.id, {
                        from: "coach",
                        kind: "text",
                        body: recap.trim(),
                        dayOffset: 0,
                        time: "just now",
                        read: false,
                      });
                    }
                    setPrivateNotes("");
                    setRecap("");
                  }}
                  className="tap mt-3 rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-30"
                >
                  Save notes and publish the recap
                </button>
              </div>
            </>
          ) : (
            <div className="card p-8 text-center">
              <p className="text-[15px] text-ink-soft">Nothing scheduled with her yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
