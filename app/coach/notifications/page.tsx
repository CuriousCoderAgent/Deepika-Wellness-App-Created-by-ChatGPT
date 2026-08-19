"use client";

import { useStore } from "@/lib/store";
import { notificationTemplates } from "@/lib/seed";
import { Mic, Bell } from "lucide-react";

const RULES = [
  ["Value before demand", "A notification should carry a useful thought or a concrete action even if she never opens the app."],
  ["No guilt copy", "Never “you missed”, never “streak at risk”, never “don't give up”. Continuity language only."],
  ["Specific over motivational", "“Your 12-minute version is ready” beats “You've got this!” every time."],
  ["Human when human", "A message from you is visibly from you. A system nudge never pretends to be."],
  ["Frequency cap", "One non-critical system nudge a day, plus genuine coach messages. Quiet hours are hers to set."],
  ["Escalation by silence", "If she ignores a prompt repeatedly, send fewer — not more."],
  ["Explain adaptation", "If the plan changed because of her sleep or her week, say so plainly."],
];

export default function NotificationsPage() {
  const { members } = useStore();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-4xl leading-tight">Notifications</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Zomato wants an impulse. You want agency. The measure of a good
        notification here is not whether she opened the app — it is whether the
        smallest useful thing happened.
      </p>

      <div className="mt-8">
        <p className="label">The seven rules</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {RULES.map(([t, d]) => (
            <div key={t} className="card p-4">
              <p className="text-[15px] font-medium">{t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-9">
        <p className="label">Trigger → copy</p>
        <div className="mt-3 space-y-2.5">
          {notificationTemplates.map((n) => (
            <div key={n.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-paper-sunk text-ink-faint">{n.timing}</span>
                {n.voice === "coach" ? (
                  <span className="chip bg-marigold-tint text-marigold-deep">
                    <Mic size={9} /> from Deepika
                  </span>
                ) : (
                  <span className="chip bg-paper-sunk text-ink-soft">
                    <Bell size={9} /> system
                  </span>
                )}
                {n.capped && <span className="chip bg-paper-sunk text-ink-faint">counts to daily cap</span>}
              </div>
              <p className="mt-2.5 text-[13px] text-ink-faint">When: {n.trigger}</p>

              {/* Rendered as it would actually appear on a lock screen. */}
              <div className="mt-3 max-w-md rounded-2xl bg-ink px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                  Deepika Wellness
                </p>
                <p className="mt-1 text-[14px] leading-snug text-white">{n.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-9 card p-5">
        <p className="label">What we are not sending</p>
        <div className="mt-3 max-w-md rounded-2xl border border-dashed border-attention/40 bg-attention-tint/40 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-attention/60">
            Deepika Wellness
          </p>
          <p className="mt-1 text-[14px] leading-snug text-ink-soft line-through">
            🔥 Your 17-day streak is at risk! Don't lose your progress!
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          This one works. It reliably produces app opens. It also produces the exact
          all-or-nothing collapse that made {members.length ? "these women" : "women"} quit
          everything they tried before — so it does not ship.
        </p>
      </div>
    </div>
  );
}
