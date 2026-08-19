"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { ScopeNotice } from "@/components/ui";
import type { ModuleCategory } from "@/lib/types";

const CATS: { key: ModuleCategory | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "movement", label: "Movement" },
  { key: "nutrition", label: "Nutrition" },
  { key: "sleep", label: "Sleep & lifestyle" },
  { key: "hormonal", label: "Midlife education" },
  { key: "behaviour", label: "Behaviour" },
];

export default function LibraryPage() {
  const { modules, members } = useStore();
  const [cat, setCat] = useState<ModuleCategory | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const shown = cat === "all" ? modules : modules.filter((m) => m.category === cat);
  const usage = (id: string) => members.filter((m) => m.activeModuleIds.includes(id)).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-4xl leading-tight">Module library</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        The reusable pieces you assemble each journey from. Over time this stops
        being a content folder and becomes the written form of how you coach.
      </p>

      <div className="scroll-hide mt-6 flex gap-2 overflow-x-auto">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
              cat === c.key
                ? "bg-ink text-white"
                : "bg-paper-sunk text-ink-soft hover:bg-ink-line"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2.5">
        {shown.map((mod) => {
          const isOpen = open === mod.id;
          const used = usage(mod.id);
          return (
            <div key={mod.id} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : mod.id)}
                className="flex w-full items-start gap-3 p-5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <p className="font-medium">{mod.name}</p>
                    <span className="chip bg-paper-sunk text-ink-faint">v{mod.version}</span>
                    {used > 0 && (
                      <span className="chip bg-effort-tint text-effort-stretch">
                        {used} assigned
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{mod.purpose}</p>
                </div>
                <ChevronDown
                  size={17}
                  className={`mt-1 shrink-0 text-ink-faint transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="animate-rise border-t border-ink-line px-5 pb-5 pt-4">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="label">What better looks like</p>
                      <p className="mt-1.5 text-[14px] leading-relaxed">{mod.betterLooksLike}</p>

                      <p className="label mt-4">Who it is for</p>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                        {mod.eligibility}
                      </p>

                      <p className="label mt-4">Effort ladder</p>
                      <div className="mt-2 space-y-1.5">
                        {(["minimum", "target", "stretch"] as const).map((l) => (
                          <div key={l} className="flex items-center gap-2.5">
                            <span
                              className={`h-1 w-5 shrink-0 rounded-full ${
                                l === "minimum"
                                  ? "bg-effort-min"
                                  : l === "target"
                                  ? "bg-effort-target"
                                  : "bg-effort-stretch"
                              }`}
                            />
                            <span className="text-[14px]">{mod[l].label}</span>
                            {mod[l].minutes > 0 && (
                              <span className="font-mono text-[11px] text-ink-faint">
                                {mod[l].minutes}m
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <p className="label mt-4">When to progress</p>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                        {mod.progression}
                      </p>
                    </div>

                    <div>
                      <p className="label">Coach playbook — what to ask</p>
                      <ul className="mt-1.5 space-y-1">
                        {mod.coachPlaybook.ask.map((a, i) => (
                          <li key={i} className="text-[14px] leading-snug text-ink-soft">
                            {a}
                          </li>
                        ))}
                      </ul>

                      <p className="label mt-4">Barriers you will hear</p>
                      <ul className="mt-1.5 space-y-1">
                        {mod.coachPlaybook.barriers.map((b, i) => (
                          <li key={i} className="text-[14px] leading-snug text-ink-soft">
                            {b}
                          </li>
                        ))}
                      </ul>

                      <p className="label mt-4">When to refer</p>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-attention">
                        {mod.coachPlaybook.escalation}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="label mb-2">Notification copy tied to this module</p>
                    <div className="space-y-1.5">
                      {mod.notificationTemplates.map((n, i) => (
                        <p
                          key={i}
                          className="rounded-xl bg-paper-sunk/70 px-3 py-2 text-[14px] text-ink-soft"
                        >
                          {n}
                        </p>
                      ))}
                    </div>
                  </div>

                  {mod.reviewNote && (
                    <div className="mt-5">
                      <ScopeNotice>
                        {mod.reviewNote}
                        {mod.reviewedOn && (
                          <span className="ml-1 text-ink-faint">Last reviewed {mod.reviewedOn}.</span>
                        )}
                      </ScopeNotice>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-[13px] leading-relaxed text-ink-faint">
        Editing a module creates a new version. Journeys already assigned keep the
        version they were built on, so nobody&rsquo;s plan changes underneath them
        without you deciding it should.
      </p>
    </div>
  );
}
