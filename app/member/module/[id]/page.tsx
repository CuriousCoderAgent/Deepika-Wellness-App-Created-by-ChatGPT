"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Check, BookMarked } from "lucide-react";
import { useStore } from "@/lib/store";
import { ScopeNotice } from "@/components/ui";

export default function ModuleDetail({ params }: { params: { id: string } }) {
  const { modules, activeMember, sendMessage } = useStore();
  const m = modules.find((x) => x.id === params.id);
  const [understood, setUnderstood] = useState(false);
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(false);

  if (!m) return <div className="px-5 pt-10 text-sm text-ink-soft">Module not found.</div>;

  return (
    <div className="animate-rise px-5 pt-6">
      <Link
        href="/member/journey"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Journey
      </Link>

      <p className="label mt-4">
        {m.category === "hormonal" ? "Understanding your body" : m.category}
      </p>
      <h1 className="mt-2 font-display text-[1.55rem] leading-tight">{m.name}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{m.purpose}</p>

      <div className="mt-6 rounded-2xl bg-effort-tint p-4">
        <p className="label">What better looks like</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-effort-stretch">
          {m.betterLooksLike}
        </p>
      </div>

      <div className="mt-7">
        <p className="label">The key ideas</p>
        <ol className="mt-3 space-y-3">
          {m.keyIdeas.map((k, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1 font-mono text-[11px] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[15px] leading-relaxed">{k}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-7 grid grid-cols-3 gap-2">
        {(["minimum", "target", "stretch"] as const).map((l) => (
          <div key={l} className="rounded-xl bg-paper-sunk/70 p-3">
            <span
              className={`block h-1 w-6 rounded-full ${
                l === "minimum"
                  ? "bg-effort-min"
                  : l === "target"
                  ? "bg-effort-target"
                  : "bg-effort-stretch"
              }`}
            />
            <p className="mt-2 text-[11px] capitalize text-ink-soft">{l}</p>
            <p className="mt-0.5 text-[13px] leading-snug">{m[l].label}</p>
          </div>
        ))}
      </div>

      {m.reviewNote && (
        <div className="mt-6">
          <ScopeNotice>{m.reviewNote}</ScopeNotice>
        </div>
      )}

      <button
        onClick={() => setUnderstood(true)}
        className={`tap mt-6 flex w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${
          understood ? "bg-effort-tint text-effort-stretch" : "bg-ink text-white"
        }`}
      >
        {understood ? (
          <>
            <Check size={15} /> Marked as read
          </>
        ) : (
          "I have read this"
        )}
      </button>

      <div className="mt-6 card p-4">
        <div className="flex items-center gap-2">
          <BookMarked size={15} className="text-ink-soft" />
          <p className="text-[14px] font-medium">Save a question for Deepika</p>
        </div>
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={2}
          placeholder="Something you want to ask in your next session"
          className="mt-2.5 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
        />
        <button
          disabled={!q.trim() || saved}
          onClick={() => {
            sendMessage(activeMember.id, {
              from: "member",
              kind: "text",
              body: `About ${m.name}: ${q.trim()}`,
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
