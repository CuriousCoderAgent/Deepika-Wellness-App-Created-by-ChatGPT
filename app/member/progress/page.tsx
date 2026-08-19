"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Clock, FileText, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { matchArticles } from "@/lib/articles";
import {
  CategoryIcon,
  ConsistencyBand,
  ProvenanceChip,
  ScopeNotice,
  Sparkline,
} from "@/components/ui";

/**
 * Insights — Progress, Health Data and For You.
 *
 * "Progress" was too narrow a name for what this tab has to hold: adherence,
 * reports, body composition and the reading list all belong to the same
 * question ("how is this actually going?") and none of them justified a sixth
 * tab. Renamed per the Aug 2026 design review, and the URL stays /progress so
 * nothing already bookmarked breaks.
 */
const TABS = ["Progress", "Health Data", "For You"] as const;
type Tab = (typeof TABS)[number];

export default function Insights() {
  const { activeMember: m, actions, pulses, workoutLogs, reports, articles } = useStore();
  const [tab, setTab] = useState<Tab>("Progress");

  const myReports = reports
    .filter((r) => r.memberId === m.id)
    .sort((a, b) => b.collectedOn.localeCompare(a.collectedOn));

  const mine = actions.filter((a) => a.memberId === m.id);
  const days = Array.from({ length: 14 }).map((_, i) => {
    const offset = i - 13;
    const day = mine.filter((a) => a.dayOffset === offset);
    const best = day.find((a) => a.completed === "stretch")
      ? "stretch"
      : day.find((a) => a.completed === "target")
      ? "target"
      : day.find((a) => a.completed === "minimum")
      ? "minimum"
      : day.find((a) => a.completed === "rest")
      ? "rest"
      : null;
    return { level: best as any, dayOffset: offset };
  });
  const activeDays = days.filter((d) => d.level && d.level !== "rest").length;

  const p = pulses
    .filter((x) => x.memberId === m.id)
    .sort((a, b) => a.dayOffset - b.dayOffset);
  const energy = p.map((x) => x.energy);
  // A one-tap mood leaves sleep unrecorded (0). Charting that as a zero would
  // draw a cliff that never happened.
  const sleep = p.filter((x) => x.sleep >= 1).map((x) => x.sleep);

  const comebacks = (() => {
    const done = mine
      .filter((a) => a.completed && a.completed !== "rest")
      .map((a) => a.dayOffset)
      .sort((a, b) => a - b);
    let n = 0;
    for (let i = 1; i < done.length; i++) if (done[i] - done[i - 1] >= 3) n++;
    return n;
  })();

  const logs = workoutLogs.filter((l) => l.memberId === m.id);
  const reads = matchArticles(m, articles);

  return (
    <div className="animate-rise px-5 pt-6">
      <h1 className="font-display text-[1.55rem] leading-tight">Insights</h1>

      <div className="scroll-hide mt-4 flex gap-1 border-b border-ink-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-[14px] transition-colors ${
              tab === t
                ? "border-effort-stretch font-medium text-ink"
                : "border-transparent text-ink-faint hover:text-ink-soft"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---------------- Progress ---------------- */}
      {tab === "Progress" && (
        <div className="mt-5">
          <div className="card p-4">
            <p className="label">Consistency</p>
            <p className="mt-1.5 font-display text-[1.9rem] leading-none">
              {activeDays}
              <span className="text-base text-ink-faint"> of 14 days</span>
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
              You did something on {activeDays} of the last fourteen days.
            </p>
            <div className="mt-3.5">
              <ConsistencyBand days={days} showDayLetters />
            </div>
          </div>

          {comebacks > 0 && (
            <div className="mt-3 rounded-2xl bg-effort-tint p-4">
              <p className="label">Comebacks</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-effort-stretch">
                You came back after a gap {comebacks} time{comebacks > 1 ? "s" : ""}. That is
                the single best predictor that this will still be happening next year.
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="label">Energy</p>
              <div className="mt-2">
                <Sparkline values={energy} color="#6E8F73" />
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">Last {energy.length} check-ins</p>
            </div>
            <div className="card p-4">
              <p className="label">Sleep</p>
              <div className="mt-2">
                <Sparkline values={sleep} color="#6E8FB0" />
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">Last {sleep.length} rated</p>
            </div>
          </div>

          {logs.length > 0 && (
            <div className="card mt-3 p-4">
              <p className="label">Strength</p>
              <div className="mt-2.5 space-y-2">
                {logs.slice(0, 3).map((l) => (
                  <div key={l.id} className="flex items-baseline justify-between">
                    <p className="text-[14px]">Session effort</p>
                    <p className="font-mono text-[13px] text-ink-soft">{l.rpe}/10</p>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
                As sessions start to feel easier at the same load, Deepika adds weight.
                That is what progress looks like here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Health Data ---------------- */}
      {tab === "Health Data" && (
        <div className="mt-5">
          <Link
            href="/member/reports"
            className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-effort-stretch text-sm font-medium text-white"
          >
            <Plus size={16} /> Upload a report
          </Link>

          <div className="mt-4">
            <p className="label mb-2">Your reports ({myReports.length})</p>
            {myReports.length === 0 ? (
              <div className="card p-5 text-center">
                <p className="text-[14px] text-ink-soft">
                  Nothing here yet. Add your blood work or a body-composition scan.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {myReports.slice(0, 4).map((r) => (
                  <Link
                    key={r.id}
                    href="/member/reports"
                    className="card flex items-center gap-3 p-3.5 transition-shadow hover:shadow-lift"
                  >
                    <FileText size={16} className="shrink-0 text-ink-faint" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium leading-snug">{r.title}</p>
                      <p className="text-[12px] text-ink-faint">
                        {r.collectedOn} · {r.values.length} values
                      </p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-ink-faint" />
                  </Link>
                ))}
                {myReports.length > 4 && (
                  <Link
                    href="/member/reports"
                    className="block px-1 py-1 text-[13px] font-medium text-effort-stretch"
                  >
                    See all {myReports.length}
                  </Link>
                )}
              </div>
            )}
          </div>

          {m.bodyComp && m.bodyComp.length > 0 && (
            <div className="card mt-4 p-4">
              <p className="label">Body composition</p>
              <div className="mt-2.5 space-y-2.5">
                {m.bodyComp.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px]">{b.label}</p>
                      <p className="text-[12px] text-ink-faint">{b.at}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[14px]">{b.value}</span>
                      <ProvenanceChip p={b.provenance} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
                Measured every four to six weeks, not daily. Day-to-day movement in
                these numbers is noise, and watching it does nothing useful.
              </p>
            </div>
          )}

          <div className="mt-4">
            <ScopeNotice>
              Your numbers are stored and trended here, never interpreted. What a
              value means for you is a conversation for your doctor — Deepika will
              help you arrive with the right questions.
            </ScopeNotice>
          </div>
        </div>
      )}

      {/* ---------------- For You ---------------- */}
      {tab === "For You" && (
        <div className="mt-5">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Chosen for your stage, your goals and how you actually live. Each one
            says why it is here.
          </p>

          <div className="mt-3.5 space-y-2.5">
            {reads.map(({ article: a, reason }) => (
              <Link
                key={a.id}
                href={`/member/reading/${a.id}`}
                className="card block p-3.5 transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk">
                    <CategoryIcon category={a.category} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug">{a.title}</p>
                    <p className="mt-1 text-[13px] leading-snug text-ink-soft">{a.standfirst}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <Clock size={12} />
                      {a.readMinutes} min read
                    </div>
                  </div>
                  <ChevronRight size={15} className="mt-0.5 shrink-0 text-ink-faint" />
                </div>
                <p className="mt-2.5 border-t border-ink-line pt-2 text-[12px] leading-relaxed text-effort-stretch">
                  {reason}
                </p>
              </Link>
            ))}
          </div>

          <Link
            href="/member/reading"
            className="tap mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-paper-sunk text-sm font-medium text-ink hover:bg-ink-line"
          >
            Browse everything <ChevronRight size={15} />
          </Link>

          <p className="mt-4 px-1 text-[11px] leading-relaxed text-ink-faint">
            These are chosen by a short list of readable rules, not by a machine
            deciding what you should think about your own body.
          </p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
