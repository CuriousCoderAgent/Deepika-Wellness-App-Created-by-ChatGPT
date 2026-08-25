import type { JourneyPhase, Member, WeekPlan } from "./types";

export const PHASES: { phase: JourneyPhase; weeks: string; promise: string }[] =
  [
    {
      phase: "Stabilise",
      weeks: "Weeks 1–4",
      promise:
        "Create reliable foundations for energy, food, movement and recovery.",
    },
    {
      phase: "Build",
      weeks: "Weeks 5–8",
      promise:
        "Progress strength and capacity without sacrificing consistency.",
    },
    {
      phase: "Consolidate",
      weeks: "Weeks 9–12",
      promise: "Make the routines resilient, flexible and easier to own.",
    },
  ];

const OUTLINE: { phase: JourneyPhase; focus: string[]; modules: string[] }[] = [
  {
    phase: "Stabilise",
    focus: ["Set a realistic baseline", "Notice energy and recovery patterns"],
    modules: ["Baseline", "Daily pulse"],
  },
  {
    phase: "Stabilise",
    focus: [
      "Anchor a protein-forward meal",
      "Build a comfortable walking rhythm",
    ],
    modules: ["Nutrition foundations", "Walking"],
  },
  {
    phase: "Stabilise",
    focus: ["Introduce foundational strength", "Protect evening recovery"],
    modules: ["Strength foundations", "Sleep rhythm"],
  },
  {
    phase: "Stabilise",
    focus: ["Review what held", "Adjust barriers before progressing"],
    modules: ["Reflection", "Coach review"],
  },
  {
    phase: "Build",
    focus: ["Progress full-body strength", "Keep meals steady on busy days"],
    modules: ["Strength progression", "Meal structure"],
  },
  {
    phase: "Build",
    focus: ["Build aerobic capacity", "Use recovery signals to pace effort"],
    modules: ["Cardio base", "Recovery"],
  },
  {
    phase: "Build",
    focus: ["Add movement variety", "Practise stress downshifts"],
    modules: ["Mobility", "Stress skills"],
  },
  {
    phase: "Build",
    focus: ["Consolidate training volume", "Review what has actually held"],
    modules: ["Strength progression", "Review"],
  },
  {
    phase: "Consolidate",
    focus: ["Make the plan travel-proof", "Choose minimums for demanding days"],
    modules: ["Adaptive planning", "Minimum dose"],
  },
  {
    phase: "Consolidate",
    focus: [
      "Build confidence with independent sessions",
      "Refine food decisions",
    ],
    modules: ["Independent strength", "Nutrition confidence"],
  },
  {
    phase: "Consolidate",
    focus: ["Prepare for interruptions", "Protect the habits with most impact"],
    modules: ["Relapse planning", "Recovery"],
  },
  {
    phase: "Consolidate",
    focus: [
      "Review the twelve-week evidence",
      "Create your next sustainable chapter",
    ],
    modules: ["Outcomes review", "Next plan"],
  },
];

export function phaseForWeek(week: number): JourneyPhase {
  if (week <= 4) return "Stabilise";
  if (week <= 8) return "Build";
  return "Consolidate";
}

export function weekPlansFor(member: Member): WeekPlan[] {
  const published = member.weekPlans ?? [];
  return OUTLINE.map((fallback, index) => {
    const week = index + 1;
    const record = published.find((item) => item.week === week);
    const liveFocus =
      week === member.week && member.weeklyFocus.length
        ? member.weeklyFocus
        : fallback.focus;
    return {
      week,
      phase: record?.phase ?? fallback.phase,
      focus: record?.focus?.length ? record.focus : liveFocus,
      moduleIds: record?.moduleIds?.length
        ? record.moduleIds
        : fallback.modules,
      rationale:
        record?.rationale ??
        (week === member.week ? member.lastPlanChange?.rationale : undefined),
    };
  });
}
