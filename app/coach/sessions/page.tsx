"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { memberCode } from "@/lib/display";
import { ChevronRight, Video, MapPin } from "lucide-react";

const LABEL = (o: number) =>
  o === 0 ? "Today" : o === 1 ? "Tomorrow" : o < 0 ? `${Math.abs(o)} days ago` : `In ${o} days`;

export default function SessionsPage() {
  const { sessions, members } = useStore();
  const upcoming = sessions
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => a.dayOffset - b.dayOffset);
  const past = sessions
    .filter((s) => s.status === "complete")
    .sort((a, b) => b.dayOffset - a.dayOffset);

  const member = (id: string) => members.find((m) => m.id === id);

  const Row = ({ s }: { s: (typeof sessions)[number] }) => {
    const m = member(s.memberId);
    if (!m) return null;
    return (
      <Link
        href={`/coach/members/${m.id}`}
        className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-lift"
      >
        <div className="w-20 shrink-0">
          <p className="font-mono text-[11px] text-ink-faint">{LABEL(s.dayOffset).toUpperCase()}</p>
          <p className="mt-0.5 text-[15px] font-medium">{s.time}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-[13px] font-medium text-ink-soft">
          {m.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[14px] font-medium">{memberCode(m)}</p>
          <p className="text-[13px] text-ink-soft">{s.type}</p>
        </div>
        <span className="hidden items-center gap-1.5 text-[13px] text-ink-faint sm:flex">
          {s.mode === "Video" ? <Video size={13} /> : <MapPin size={13} />}
          {s.mode}
        </span>
        {s.memberQuestions.length > 0 && (
          <span className="chip bg-marigold-tint text-marigold-deep">
            {s.memberQuestions.length} question{s.memberQuestions.length > 1 ? "s" : ""}
          </span>
        )}
        <ChevronRight size={16} className="shrink-0 text-ink-faint" />
      </Link>
    );
  };

  const coachHours = (upcoming.length * 45) / 60;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-4xl leading-tight">Sessions</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        {upcoming.length} scheduled — roughly {coachHours.toFixed(1)} hours of your week.
      </p>

      <div className="mt-8">
        <p className="label">Coming up</p>
        <div className="mt-3 space-y-2.5">
          {upcoming.map((s) => (
            <Row key={s.id} s={s} />
          ))}
          {upcoming.length === 0 && (
            <div className="card p-8 text-center text-[15px] text-ink-soft">
              Nothing booked. Open a member to schedule.
            </div>
          )}
        </div>
      </div>

      {past.length > 0 && (
        <div className="mt-9">
          <p className="label">Already happened</p>
          <div className="mt-3 space-y-2.5">
            {past.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-9 card p-5">
        <p className="label">Capacity, honestly</p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          At twenty members with a weekly 1:1 plus supervised strength, you are
          looking at 25 to 30 hours a week of contact time before any planning,
          messaging or admin. Session types are recorded separately here so that
          when you decide whether to bring in a second coach, you are deciding from
          numbers rather than from how tired you feel.
        </p>
      </div>
    </div>
  );
}
