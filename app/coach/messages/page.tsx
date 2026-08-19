"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { memberCode } from "@/lib/display";
import { Mic, ChevronRight, RefreshCw } from "lucide-react";

export default function MessagesPage() {
  const { members, messages } = useStore();

  const threads = members
    .map((m) => {
      const thread = messages
        .filter((x) => x.memberId === m.id)
        .sort((a, b) => b.dayOffset - a.dayOffset);
      return { m, last: thread[0], unread: thread.filter((x) => x.from === "member" && !x.read).length };
    })
    .filter((t) => t.last)
    .sort((a, b) => b.unread - a.unread || b.last.dayOffset - a.last.dayOffset);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-4xl leading-tight">Messages</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Templates exist to save you typing, never to speak for you. Anything sent as
        a voice note is unmistakably yours.
      </p>

      <div className="mt-7 space-y-2.5">
        {threads.map(({ m, last, unread }) => (
          <Link
            key={m.id}
            href={`/coach/members/${m.id}`}
            className="card flex items-start gap-4 p-4 transition-shadow hover:shadow-lift"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-[13px] font-medium text-ink-soft">
              {m.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="font-mono text-[14px] font-medium">{memberCode(m)}</p>
                <span className="text-[12px] text-ink-faint">{last.time}</span>
                {unread > 0 && (
                  <span className="chip ml-auto bg-attention-tint text-attention">
                    {unread} waiting
                  </span>
                )}
              </div>
              <p className="mt-1 flex items-start gap-1.5 text-[14px] leading-snug text-ink-soft">
                {last.kind === "voice" && <Mic size={13} className="mt-0.5 shrink-0 text-marigold" />}
                {last.kind === "plan_update" && (
                  <RefreshCw size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                )}
                <span className="line-clamp-2">
                  {last.from === "coach" ? "You: " : last.from === "system" ? "" : ""}
                  {last.body}
                </span>
              </p>
            </div>
            <ChevronRight size={16} className="mt-1 shrink-0 text-ink-faint" />
          </Link>
        ))}
      </div>
    </div>
  );
}
