"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, FileText, Plus, Upload, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ProvenanceChip, ScopeNotice, Sparkline } from "@/components/ui";
import type { ReportValue } from "@/lib/types";

const KIND_LABEL = {
  blood_panel: "Blood panel",
  body_composition: "Body composition",
  other: "Report",
} as const;

export default function Reports() {
  const { activeMember: m, reports, addReport, sendMessage } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [collectedOn, setCollectedOn] = useState("");
  const [lab, setLab] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ReportValue[]>([{ label: "", value: "", unit: "" }]);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(false);

  const mine = useMemo(
    () =>
      reports
        .filter((r) => r.memberId === m.id)
        .sort((a, b) => b.collectedOn.localeCompare(a.collectedOn)),
    [reports, m.id]
  );

  /**
   * A marker's own history. Trending your own numbers over time is factual;
   * saying what any of them means about you is not, and does not happen here.
   */
  const trends = useMemo(() => {
    const byLabel = new Map<string, { at: string; n: number }[]>();
    for (const r of [...mine].reverse()) {
      for (const v of r.values) {
        const n = parseFloat(v.value);
        if (Number.isNaN(n)) continue;
        byLabel.set(v.label, [...(byLabel.get(v.label) ?? []), { at: r.collectedOn, n }]);
      }
    }
    return Array.from(byLabel.entries())
      .filter(([, pts]) => pts.length >= 2)
      .map(([label, pts]) => ({ label, pts }));
  }, [mine]);

  const ready = title.trim() && collectedOn.trim();

  return (
    <div className="animate-rise px-5 pt-6">
      <Link
        href="/member/progress"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Insights
      </Link>

      <h1 className="mt-4 font-display text-[1.55rem] leading-tight">Your reports</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        Everything in one place, so you are never hunting through email the night
        before an appointment.
      </p>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="tap mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-white"
        >
          <Upload size={15} /> Add a report
        </button>
      )}

      {open && (
        <div className="card mt-5 p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium">Add a report</p>
            <button
              onClick={() => setOpen(false)}
              className="tap -mr-2 -mt-1 rounded-lg px-2 text-ink-faint hover:text-ink"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-ink-line bg-paper-sunk/50 px-3 py-3 text-[14px] text-ink-soft">
            <Upload size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {fileName || "Choose the PDF or photo from your phone"}
            </span>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFileName(f.name);
                  if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
          </label>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            In this prototype the file itself is not stored — only what you type
            below. Real document storage arrives with the secure version.
          </p>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is it? e.g. Annual health panel"
            className="tap mt-3 w-full rounded-xl border border-ink-line bg-paper px-3 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <input
              type="date"
              value={collectedOn}
              onChange={(e) => setCollectedOn(e.target.value)}
              className="tap min-w-0 flex-1 rounded-xl border border-ink-line bg-paper px-3 text-[14px] focus:border-effort-target focus:outline-none"
            />
            <input
              value={lab}
              onChange={(e) => setLab(e.target.value)}
              placeholder="Lab (optional)"
              className="tap min-w-0 flex-1 rounded-xl border border-ink-line bg-paper px-3 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
            />
          </div>

          <p className="label mt-4">The values, as printed</p>
          <div className="mt-2 space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={row.label}
                  onChange={(e) =>
                    setRows((p) => p.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                  }
                  placeholder="Marker"
                  className="tap min-w-0 flex-[2] rounded-xl border border-ink-line bg-paper px-3 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
                />
                <input
                  value={row.value}
                  onChange={(e) =>
                    setRows((p) => p.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                  }
                  placeholder="Value"
                  className="tap min-w-0 flex-1 rounded-xl border border-ink-line bg-paper px-3 font-mono text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
                />
                <input
                  value={row.unit}
                  onChange={(e) =>
                    setRows((p) => p.map((r, j) => (j === i ? { ...r, unit: e.target.value } : r)))
                  }
                  placeholder="Unit"
                  className="tap w-16 shrink-0 rounded-xl border border-ink-line bg-paper px-2 text-[13px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setRows((p) => [...p, { label: "", value: "", unit: "" }])}
            className="tap mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-faint hover:bg-paper-sunk hover:text-ink"
          >
            <Plus size={13} /> Another value
          </button>

          <button
            disabled={!ready}
            onClick={() => {
              addReport({
                memberId: m.id,
                kind: "blood_panel",
                title: title.trim(),
                collectedOn,
                lab: lab.trim() || undefined,
                fileName: fileName || undefined,
                values: rows.filter((r) => r.label.trim() && r.value.trim()),
                provenance: {
                  source: "imported_document",
                  enteredBy: m.name.split(" ")[0],
                  at: new Date().toISOString().slice(0, 10),
                },
              });
              setOpen(false);
              setTitle("");
              setCollectedOn("");
              setLab("");
              setFileName("");
              setRows([{ label: "", value: "", unit: "" }]);
            }}
            className="tap mt-4 w-full rounded-xl bg-ink text-sm font-medium text-white disabled:opacity-30"
          >
            Save it
          </button>
        </div>
      )}

      {trends.length > 0 && (
        <div className="mt-7">
          <p className="label">Your own trend</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
            The same marker, over time. What any of it means for you is a
            conversation for your doctor.
          </p>
          <div className="card mt-3 divide-y divide-ink-line p-1">
            {trends.map(({ label, pts }) => {
              const ns = pts.map((p) => p.n);
              const lo = Math.min(...ns);
              const hi = Math.max(...ns);
              return (
                <div key={label} className="flex items-center gap-3 px-3 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-[14px]">{label}</p>
                  <div className="w-16 shrink-0">
                    <Sparkline
                      values={ns}
                      min={lo === hi ? lo - 1 : lo}
                      max={lo === hi ? hi + 1 : hi}
                      color="#4A5D70"
                      height={18}
                    />
                  </div>
                  <p className="w-24 shrink-0 text-right font-mono text-[13px] text-ink-soft">
                    {pts[0].n} → <span className="text-ink">{pts[pts.length - 1].n}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-ink-faint">
            {trends[0].pts[0].at} → {trends[0].pts[trends[0].pts.length - 1].at}
          </p>
        </div>
      )}

      <div className="mt-7">
        <p className="label">All reports ({mine.length})</p>
        <div className="mt-3 space-y-2.5">
          {mine.length === 0 && (
            <div className="card p-5 text-center">
              <p className="text-[14px] text-ink-soft">Nothing added yet.</p>
            </div>
          )}
          {mine.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start gap-2.5">
                <FileText size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium leading-snug">{r.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-faint">
                    {KIND_LABEL[r.kind]} · {r.collectedOn}
                    {r.lab ? ` · ${r.lab}` : ""}
                  </p>
                </div>
                <ProvenanceChip p={r.provenance} />
              </div>

              {r.values.length > 0 && (
                <div className="mt-3 divide-y divide-ink-line border-t border-ink-line">
                  {r.values.map((v, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className="text-[14px] text-ink-soft">{v.label}</span>
                      <span className="font-mono text-[14px]">
                        {v.value}
                        {v.unit ? <span className="text-ink-faint"> {v.unit}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {r.note && (
                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{r.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <ScopeNotice>
          Deepika is a health coach, not a doctor. She will not tell you what a
          blood value means, whether it is good or bad, or what to take for it —
          that is your doctor&rsquo;s job and it is the law, not modesty. What she
          will do is help you walk into that appointment with the right questions.
        </ScopeNotice>
      </div>

      <div className="card mt-4 p-4">
        <p className="text-[14px] font-medium">Save a question for your doctor</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          Write it now, while you are looking at the number. Deepika will help you
          sharpen it before the appointment.
        </p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="e.g. My vitamin D was 21 last year and 17 the year before — should I be doing something about that?"
          className="mt-2.5 w-full resize-none rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
        />
        <button
          disabled={!question.trim() || asked}
          onClick={() => {
            sendMessage(m.id, {
              from: "member",
              kind: "text",
              body: `Question for my doctor: ${question.trim()}`,
              dayOffset: 0,
              time: "just now",
              read: false,
            });
            setAsked(true);
          }}
          className="tap mt-2 w-full rounded-xl bg-paper-sunk text-sm font-medium text-ink disabled:opacity-40"
        >
          {asked ? "Saved for your next session" : "Save it"}
        </button>
      </div>

      <div className="h-8" />
    </div>
  );
}
