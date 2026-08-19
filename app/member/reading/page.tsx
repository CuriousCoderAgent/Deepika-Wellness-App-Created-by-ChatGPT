"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { matchArticles, otherArticles } from "@/lib/articles";
import { CategoryIcon } from "@/components/ui";

export default function Reading() {
  const { activeMember: m, articles } = useStore();
  const picked = matchArticles(m, articles);
  const rest = otherArticles(m, articles);

  return (
    <div className="animate-rise px-5 pt-6">
      <Link
        href="/member/journey"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Journey
      </Link>

      <h1 className="mt-4 font-display text-[1.55rem] leading-tight">Worth reading</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        Short pieces chosen from what you have told us about your stage, your
        goals and how you live. Every one says why it is here.
      </p>

      <div className="mt-6 space-y-2.5">
        {picked.map(({ article: a, reason }) => (
          <Link
            key={a.id}
            href={`/member/reading/${a.id}`}
            className="card block p-4 transition-shadow hover:shadow-lift"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-sunk">
                <CategoryIcon category={a.category} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{a.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{a.standfirst}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-faint">
                  <Clock size={12} />
                  {a.readMinutes} min read
                </div>
              </div>
              <ChevronRight size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            </div>
            <p className="mt-3 border-t border-ink-line pt-2.5 text-[12px] leading-relaxed text-effort-stretch">
              {reason}
            </p>
          </Link>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-8">
          <p className="label">Everything else</p>
          <div className="mt-3 space-y-2">
            {rest.map((a) => (
              <Link
                key={a.id}
                href={`/member/reading/${a.id}`}
                className="flex items-center gap-3 rounded-xl bg-paper-sunk/60 p-3.5 transition-colors hover:bg-paper-sunk"
              >
                <CategoryIcon category={a.category} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug">{a.title}</p>
                  <p className="text-[12px] text-ink-faint">{a.readMinutes} min read</p>
                </div>
                <ChevronRight size={15} className="shrink-0 text-ink-faint" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="mt-7 px-1 text-[11px] leading-relaxed text-ink-faint">
        These are chosen by a short list of readable rules, not by a machine
        deciding what you should think about your own body. Anything medical here
        is general education — your doctor knows your history and this does not.
      </p>

      <div className="h-8" />
    </div>
  );
}
