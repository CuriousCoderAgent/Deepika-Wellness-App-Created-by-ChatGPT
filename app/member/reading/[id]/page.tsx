"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Clock, BookMarked } from "lucide-react";
import { useStore } from "@/lib/store";
import { ScopeNotice } from "@/components/ui";

export default function ArticleDetail({ params }: { params: { id: string } }) {
  const { articles, activeMember, sendMessage } = useStore();
  const a = articles.find((x) => x.id === params.id);
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(false);

  if (!a) return <div className="px-5 pt-10 text-sm text-ink-soft">Not found.</div>;

  return (
    <div className="animate-rise px-5 pt-6">
      <Link
        href="/member/reading"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Worth reading
      </Link>

      <h1 className="mt-4 font-display text-[1.55rem] leading-tight">{a.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{a.standfirst}</p>
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
        <Clock size={12} />
        {a.readMinutes} min read
      </div>

      <div className="mt-6 space-y-4">
        {a.body.map((para, i) => (
          <p key={i} className="text-[15px] leading-relaxed">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-effort-tint px-4 py-3.5">
        <p className="text-[13px] leading-relaxed text-effort-stretch">{a.whyThis}</p>
      </div>

      {a.sourceNote && (
        <div className="mt-4">
          <ScopeNotice>{a.sourceNote}</ScopeNotice>
        </div>
      )}

      <div className="card mt-6 p-4">
        <div className="flex items-center gap-2">
          <BookMarked size={15} className="text-ink-soft" />
          <p className="text-[14px] font-medium">Save a question for Deepika</p>
        </div>
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={2}
          placeholder="Something this raised that you want to ask about"
          className="mt-2.5 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
        />
        <button
          disabled={!q.trim() || saved}
          onClick={() => {
            sendMessage(activeMember.id, {
              from: "member",
              kind: "text",
              body: `About "${a.title}": ${q.trim()}`,
              dayOffset: 0,
              time: "just now",
              read: false,
            });
            setSaved(true);
          }}
          className="tap mt-2 w-full rounded-xl bg-paper-sunk text-sm font-medium text-ink disabled:opacity-40"
        >
          {saved ? "Saved for your session" : "Save it"}
        </button>
      </div>

      <div className="h-8" />
    </div>
  );
}
