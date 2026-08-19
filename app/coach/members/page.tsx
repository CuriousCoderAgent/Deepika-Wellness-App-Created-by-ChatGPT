"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { memberCode } from "@/lib/display";
import { EffortRamp } from "@/components/ui";
import type { EngagementState } from "@/lib/types";

/** Descriptive, never stigmatising. "Needs attention", not "Non-compliant". */
const ENGAGEMENT: Record<EngagementState, { label: string; cls: string }> = {
  strong: { label: "On plan", cls: "bg-effort-tint text-effort-stretch" },
  steady: { label: "Steady", cls: "bg-paper-sunk text-ink-soft" },
  slipping: { label: "Needs attention", cls: "bg-attention-tint text-attention" },
  quiet: { label: "Quiet lately", cls: "bg-attention-tint text-attention" },
};

export default function MembersPage() {
  const { members, actions, radar, sessions } = useStore();
  const [q, setQ] = useState("");

  const filtered = members.filter((m) =>
    memberCode(m).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-4xl leading-tight">Members</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        The first cohort. Six of twenty places filled.
      </p>

      <div className="relative mt-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find by member ID"
          className="tap w-full rounded-xl border border-ink-line bg-paper-card pl-9 pr-3 text-sm placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
        />
      </div>

      <div className="mt-6 space-y-2.5">
        {filtered.map((m) => {
          const mine = actions.filter((a) => a.memberId === m.id);
          const last7 = Array.from({ length: 7 }).map((_, i) => {
            const off = i - 6;
            const day = mine.filter((a) => a.dayOffset === off);
            return day.find((a) => a.completed === "stretch")
              ? "stretch"
              : day.find((a) => a.completed === "target")
              ? "target"
              : day.find((a) => a.completed === "minimum")
              ? "minimum"
              : null;
          });
          const flags = radar.filter((r) => r.memberId === m.id && !r.resolved);
          const next = sessions
            .filter((s) => s.memberId === m.id && s.status === "scheduled")
            .sort((a, b) => a.dayOffset - b.dayOffset)[0];
          const e = ENGAGEMENT[m.engagement];

          return (
            <Link
              key={m.id}
              href={`/coach/members/${m.id}`}
              className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-lift"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-sm font-medium text-ink-soft">
                {m.initials}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="font-mono text-[15px] font-medium">{memberCode(m)}</p>
                  <span className="text-[13px] text-ink-faint">
                    {m.age} · {m.city}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  Week {m.week} · {m.phase}
                  {next &&
                    ` · ${next.type} ${
                      next.dayOffset === 0 ? "today" : `in ${next.dayOffset}d`
                    }`}
                </p>
              </div>

              <div className="hidden shrink-0 items-center gap-1 sm:flex">
                {last7.map((l, i) => (
                  <EffortRamp key={i} level={l as any} size="sm" />
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {flags.length > 0 && (
                  <span className="chip bg-paper-sunk text-ink-faint">
                    {flags.length} flag{flags.length > 1 ? "s" : ""}
                  </span>
                )}
                <span className={`chip ${e.cls}`}>{e.label}</span>
                <ChevronRight size={16} className="text-ink-faint" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
