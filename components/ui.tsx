"use client";

import React from "react";
import { Dumbbell, Apple, Moon, HeartPulse, Repeat, type LucideIcon } from "lucide-react";
import type { EffortLevel, ModuleCategory, Provenance, SourceType } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Effort Ramp — the signature element                                 */
/*                                                                     */
/* Three segments: Minimum, Target, Stretch. Filling one is a real,    */
/* coloured win. Minimum is never grey and never an empty outline,     */
/* because a 12-minute session is not a lesser kind of success.        */
/* "Rest" is a neutral band, never red.                                */
/* ------------------------------------------------------------------ */

const RAMP: Record<EffortLevel, { fill: string; text: string; idx: number }> = {
  minimum: { fill: "bg-effort-min", text: "text-effort-minInk", idx: 1 },
  target: { fill: "bg-effort-target", text: "text-effort-target", idx: 2 },
  stretch: { fill: "bg-effort-stretch", text: "text-effort-stretch", idx: 3 },
};

export function EffortRamp({
  level,
  size = "md",
  rest = false,
}: {
  level: EffortLevel | null;
  size?: "sm" | "md" | "lg";
  rest?: boolean;
}) {
  const h = size === "sm" ? "h-1" : size === "lg" ? "h-2" : "h-1.5";
  const w = size === "sm" ? "w-4" : size === "lg" ? "w-8" : "w-6";
  const filled = level ? RAMP[level].idx : 0;

  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`${h} ${w} rounded-full transition-colors duration-300 ${
            rest
              ? i === 1
                ? "bg-rest"
                : "bg-rest-tint"
              : i <= filled
              ? RAMP[level!].fill
              : "bg-paper-sunk"
          }`}
        />
      ))}
    </span>
  );
}

export function EffortLabel({ level, rest }: { level: EffortLevel | null; rest?: boolean }) {
  if (rest) return <span className="text-sm text-ink-faint">Rest day</span>;
  if (!level) return <span className="text-sm text-ink-faint">Not yet</span>;
  const copy = { minimum: "Minimum", target: "Target", stretch: "Stretch" }[level];
  return <span className={`text-sm font-medium ${RAMP[level].text}`}>{copy}</span>;
}

/* ------------------------------------------------------------------ */
/* Provenance chip — dual-entry made visible                           */
/* ------------------------------------------------------------------ */

const SOURCE_COPY: Record<SourceType, { label: string; cls: string }> = {
  member_manual: { label: "member", cls: "bg-effort-tint text-effort-stretch" },
  coach_on_behalf: { label: "coach · on behalf", cls: "bg-marigold-tint text-marigold-deep" },
  wearable: { label: "device", cls: "bg-paper-sunk text-ink-soft" },
  imported_document: { label: "from report", cls: "bg-paper-sunk text-ink-soft" },
  system_derived: { label: "derived", cls: "bg-paper-sunk text-ink-faint" },
};

export function ProvenanceChip({ p, showWho = false }: { p?: Provenance; showWho?: boolean }) {
  if (!p) return null;
  const s = SOURCE_COPY[p.source];
  return (
    <span className={`chip ${s.cls}`} title={`Entered by ${p.enteredBy} on ${p.at}`}>
      {s.label}
      {showWho && <span className="opacity-60"> · {p.enteredBy}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Category icon — helps a 38–50 audience scan a list.                 */
/* ------------------------------------------------------------------ */

const CATEGORY_ICON: Record<ModuleCategory, LucideIcon> = {
  movement: Dumbbell,
  nutrition: Apple,
  sleep: Moon,
  hormonal: HeartPulse,
  behaviour: Repeat,
};

export function CategoryIcon({
  category,
  size = 15,
  className = "text-ink-faint",
}: {
  category: ModuleCategory;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category];
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="label mb-2">{children}</p>;
}

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: any;
}) {
  return <As className={`card ${className}`}>{children}</As>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "ghost" | "human";
}) {
  const styles = {
    primary: "bg-ink text-white hover:bg-ink/90",
    quiet: "bg-paper-sunk text-ink hover:bg-ink-line",
    ghost: "text-ink-soft hover:text-ink hover:bg-paper-sunk",
    human: "bg-marigold text-white hover:bg-marigold-deep",
  }[variant];
  return (
    <button
      {...rest}
      className={`tap inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {note && <p className="mt-0.5 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — used for pulse trends. No axes, no grid, no dashboard.  */
/* ------------------------------------------------------------------ */

export function Sparkline({
  values,
  color = "#6E8F73",
  height = 36,
  min = 1,
  max = 5,
}: {
  values: number[];
  color?: string;
  height?: number;
  min?: number;
  max?: number;
}) {
  if (values.length < 2) {
    return <p className="text-xs text-ink-faint">Not enough days yet.</p>;
  }
  const w = 100;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / (max - min)) * (height - 6) - 3;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {pts.map((pt, i) => {
        const [x, y] = pt.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r={1.8} fill={color} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Consistency band — replaces the streak.                             */
/* Shows "9 of the last 14 days", never "17-day streak at risk".       */
/* ------------------------------------------------------------------ */

/** Sunday, 9 August 2026 is "today" throughout this prototype's seed data. */
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
function letterForOffset(offset: number) {
  return WEEKDAY_LETTERS[((offset % 7) + 7) % 7];
}

export function ConsistencyBand({
  days,
  showDayLetters = false,
}: {
  days: { level: EffortLevel | "rest" | null; dayOffset?: number }[];
  showDayLetters?: boolean;
}) {
  return (
    <div>
      <div className="flex gap-1" aria-hidden="true">
        {days.map((d, i) => (
          <span
            key={i}
            className={`h-6 flex-1 rounded-[3px] ${
              d.level === "stretch"
                ? "bg-effort-stretch"
                : d.level === "target"
                ? "bg-effort-target"
                : d.level === "minimum"
                ? "bg-effort-min"
                : d.level === "rest"
                ? "bg-rest-tint"
                : "bg-paper-sunk"
            }`}
          />
        ))}
      </div>
      {showDayLetters && (
        <div className="mt-1 flex gap-1">
          {days.map((d, i) => (
            <span key={i} className="flex-1 text-center font-mono text-[9px] text-ink-faint">
              {d.dayOffset !== undefined ? letterForOffset(d.dayOffset) : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress ring — orientation, not a dashboard metric.                */
/* ------------------------------------------------------------------ */

export function ProgressRing({
  value,
  size = 76,
  stroke = 7,
  label,
}: {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, value)));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-paper-sunk" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-effort-target transition-all duration-700"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <span className="absolute font-display text-lg leading-none">{label}</span>
      )}
    </div>
  );
}

export function ScopeNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-line bg-paper-sunk/50 p-3">
      <p className="label mb-1">Coaching scope</p>
      <p className="text-xs leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
