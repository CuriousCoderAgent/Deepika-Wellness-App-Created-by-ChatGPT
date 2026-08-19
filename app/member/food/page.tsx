"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import BottomSheet from "@/components/BottomSheet";
import { ProvenanceChip } from "@/components/ui";
import type { FoodEntry, FoodItem } from "@/lib/types";

const MEALS = ["Breakfast", "Lunch", "Snack", "Dinner"] as const;
type Meal = (typeof MEALS)[number];

/**
 * Protein log.
 *
 * Design decisions, all pointed at the same problem — food diaries die in
 * week two because logging costs more than it returns:
 *
 *  - Protein only. Not calories, not carbs, not fat. One number is a habit;
 *    four is data entry, and Radhika's own boundary is "I will not count
 *    calories".
 *  - Household portions. Katori, roti, glass. Grams-and-scales is the input
 *    model that makes people quit.
 *  - A short curated list, not a searchable database of ten million
 *    user-submitted entries where half the numbers are wrong.
 *  - What she ate recently comes first, because real diets repeat.
 *  - Every figure is an average and every figure is editable. If she knows
 *    her dal is thicker than most, hers is the better number.
 */
export default function FoodLog() {
  const { activeMember: m, foodItems, foodEntries, addFood, removeFood } = useStore();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [meal, setMeal] = useState<Meal>("Lunch");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [qty, setQty] = useState(1);
  const [protein, setProtein] = useState(0);
  const [proteinTouched, setProteinTouched] = useState(false);
  const [customName, setCustomName] = useState("");

  const today = useMemo(
    () => foodEntries.filter((e) => e.memberId === m.id && e.dayOffset === 0),
    [foodEntries, m.id]
  );
  const total = today.reduce((s, e) => s + e.protein, 0);
  const target = m.proteinTargetG;
  const pct = target ? Math.min(1, total / target) : 0;

  /** Recently logged floats to the front — a real diet is maybe 20 dishes. */
  const recentIds = useMemo(() => {
    const seen: string[] = [];
    for (const e of foodEntries.filter((x) => x.memberId === m.id)) {
      if (e.itemId && !seen.includes(e.itemId)) seen.push(e.itemId);
    }
    return seen.slice(0, 6);
  }, [foodEntries, m.id]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return foodItems.filter((f) => f.name.toLowerCase().includes(q));
    const recent = recentIds
      .map((id) => foodItems.find((f) => f.id === id))
      .filter(Boolean) as FoodItem[];
    const common = foodItems.filter((f) => f.common && !recentIds.includes(f.id));
    const rest = foodItems.filter((f) => !f.common && !recentIds.includes(f.id));
    return [...recent, ...common, ...rest];
  }, [query, foodItems, recentIds]);

  const openAdd = (mealFor: Meal) => {
    setMeal(mealFor);
    setPicked(null);
    setQuery("");
    setQty(1);
    setProteinTouched(false);
    setCustomName("");
    setSheetOpen(true);
  };

  const choose = (f: FoodItem) => {
    setPicked(f);
    setQty(1);
    setProtein(f.proteinPerUnit);
    setProteinTouched(false);
  };

  const changeQty = (next: number) => {
    const q = Math.max(1, Math.min(20, next));
    setQty(q);
    // Scale the suggestion with quantity, unless she has typed her own number.
    if (!proteinTouched && picked) setProtein(picked.proteinPerUnit * q);
  };

  const save = () => {
    const name = picked ? picked.name : customName.trim();
    if (!name) return;
    addFood({
      memberId: m.id,
      dayOffset: 0,
      itemId: picked?.id,
      name,
      qty,
      unitLabel: picked?.unitLabel ?? "serving",
      protein: Math.max(0, Math.round(protein)),
      proteinEdited: proteinTouched || !picked,
      meal,
    });
    setSheetOpen(false);
  };

  return (
    <div className="animate-rise px-5 pt-6">
      <Link
        href="/member"
        className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm text-ink-faint hover:text-ink"
      >
        <ChevronLeft size={16} /> Today
      </Link>

      <h1 className="mt-3 font-display text-[1.55rem] leading-tight">What you ate</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
        Protein only. Not calories, not everything — just whether there was
        protein on the plate.
      </p>

      {/* The one number. Warm, never a scoreboard. */}
      <div className="card mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <p className="label">Protein today</p>
          {target && (
            <span className="font-mono text-[11px] text-ink-faint">TARGET {target}g</span>
          )}
        </div>
        <p className="mt-1 font-display text-[2rem] leading-none">
          {total}
          <span className="text-base text-ink-faint"> g{target ? ` of ${target}` : ""}</span>
        </p>
        {target && (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-sunk">
              <div
                className="h-full rounded-full bg-effort-target transition-all duration-500"
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {total === 0
                ? "Nothing logged yet today."
                : pct >= 1
                ? "You've reached the amount Deepika set. Anything more is a bonus."
                : `${target - total}g to go — about ${Math.max(
                    1,
                    Math.round((target - total) / 6)
                  )} more protein-ish thing${Math.round((target - total) / 6) > 1 ? "s" : ""}.`}
            </p>
          </>
        )}
        {!target && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            Deepika hasn&rsquo;t set a daily amount for you yet. Logging still
            helps — she&rsquo;ll see the pattern.
          </p>
        )}
      </div>

      {/* By meal, because that is how eating is remembered. */}
      <div className="mt-5 space-y-3">
        {MEALS.map((meal) => {
          const rows = today.filter((e) => e.meal === meal);
          const sub = rows.reduce((s, e) => s + e.protein, 0);
          return (
            <div key={meal}>
              <div className="flex items-baseline justify-between">
                <p className="label">{meal}</p>
                {sub > 0 && (
                  <span className="font-mono text-[11px] text-ink-faint">{sub}g</span>
                )}
              </div>
              <div className="card mt-1.5 divide-y divide-ink-line px-3.5">
                {rows.map((e) => (
                  <Row key={e.id} entry={e} onRemove={() => removeFood(e.id)} />
                ))}
                <button
                  onClick={() => openAdd(meal)}
                  className="tap flex w-full items-center gap-2 py-3 text-left text-[14px] text-ink-soft hover:text-ink"
                >
                  <Plus size={15} className="shrink-0" />
                  Add something
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 px-1 text-[11px] leading-relaxed text-ink-faint">
        The protein figures are averages for a normal home portion, not
        measurements of your food. If yours is different, change the number —
        yours will be the better one.
      </p>

      <div className="h-8" />

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={picked ? picked.name : `Add to ${meal.toLowerCase()}`}
      >
        {!picked ? (
          <div>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search — dal, roti, paneer…"
                className="tap w-full rounded-xl border border-ink-line bg-paper pl-9 pr-3 text-[16px] placeholder:text-ink-faint focus:border-effort-target focus:outline-none"
              />
            </div>

            {!query && recentIds.length > 0 && (
              <p className="label mt-3">Your usuals</p>
            )}

            <div className="mt-2 max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
              {results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => choose(f)}
                  className="flex w-full items-center gap-3 rounded-xl bg-paper-sunk/60 px-3.5 py-3 text-left transition-colors hover:bg-paper-sunk"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium leading-snug">{f.name}</span>
                    <span className="text-[12px] text-ink-faint">per {f.unitLabel}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] text-effort-stretch">
                    {f.proteinPerUnit}g
                  </span>
                </button>
              ))}
              {results.length === 0 && (
                <div className="rounded-xl bg-paper-sunk/60 p-4">
                  <p className="text-[14px] text-ink-soft">
                    Not in the list — add it yourself.
                  </p>
                  <input
                    value={customName || query}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="What was it?"
                    className="tap mt-2.5 w-full rounded-xl border border-ink-line bg-paper px-3 text-[16px] focus:border-effort-target focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      setCustomName(customName || query);
                      setPicked(null);
                      setProtein(0);
                      setProteinTouched(true);
                      setQuery("");
                    }}
                    className="tap mt-2 w-full rounded-xl bg-paper-card text-[14px] font-medium text-ink"
                  >
                    Continue
                  </button>
                </div>
              )}
            </div>

            {customName && (
              <CustomEditor
                name={customName}
                qty={qty}
                protein={protein}
                onQty={changeQty}
                onProtein={(v) => {
                  setProtein(v);
                  setProteinTouched(true);
                }}
                onSave={save}
              />
            )}
          </div>
        ) : (
          <div>
            <p className="text-[13px] text-ink-soft">
              How much? Counted in {picked.unitLabel}.
            </p>
            <div className="mt-2.5 flex items-center gap-3">
              <button
                onClick={() => changeQty(qty - 1)}
                aria-label="Less"
                className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper-sunk text-ink-soft hover:bg-ink-line"
              >
                <Minus size={17} />
              </button>
              <div className="flex-1 text-center">
                <p className="font-display text-[1.8rem] leading-none">{qty}</p>
                <p className="mt-0.5 text-[12px] text-ink-faint">{picked.unitLabel}</p>
              </div>
              <button
                onClick={() => changeQty(qty + 1)}
                aria-label="More"
                className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper-sunk text-ink-soft hover:bg-ink-line"
              >
                <Plus size={17} />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-paper-sunk/60 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">Protein</p>
                  <p className="text-[12px] leading-snug text-ink-faint">
                    {proteinTouched ? "Your figure" : "Average for this portion"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={200}
                    value={protein}
                    onChange={(e) => {
                      setProtein(Number(e.target.value));
                      setProteinTouched(true);
                    }}
                    className="w-20 rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-right font-mono text-[16px] focus:border-effort-target focus:outline-none"
                  />
                  <span className="text-[14px] text-ink-soft">g</span>
                </div>
              </div>
              {proteinTouched && (
                <button
                  onClick={() => {
                    setProtein(picked.proteinPerUnit * qty);
                    setProteinTouched(false);
                  }}
                  className="mt-2 text-[12px] text-effort-stretch underline underline-offset-2"
                >
                  Back to the average
                </button>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPicked(null)}
                className="tap flex-1 rounded-xl bg-paper-sunk text-sm font-medium text-ink-soft hover:bg-ink-line"
              >
                Pick something else
              </button>
              <button
                onClick={save}
                className="tap flex-[2] rounded-xl bg-effort-stretch text-sm font-medium text-white"
              >
                Add to {meal.toLowerCase()}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function Row({ entry, onRemove }: { entry: FoodEntry; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug">
          {entry.qty > 1 && <span className="text-ink-soft">{entry.qty} × </span>}
          {entry.name}
        </p>
        <p className="text-[12px] leading-snug text-ink-faint">
          {entry.unitLabel}
          {entry.proteinEdited ? " · your figure" : ""}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[13px] text-effort-stretch">
        {entry.protein}g
      </span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${entry.name}`}
        className="tap -mr-2 flex shrink-0 items-center justify-center rounded-lg px-2 text-ink-faint hover:text-attention"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function CustomEditor({
  name,
  qty,
  protein,
  onQty,
  onProtein,
  onSave,
}: {
  name: string;
  qty: number;
  protein: number;
  onQty: (n: number) => void;
  onProtein: (n: number) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 rounded-xl bg-paper-sunk/60 p-3.5">
      <p className="text-[14px] font-medium">{name}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={qty}
          onChange={(e) => onQty(Number(e.target.value))}
          aria-label="How many servings"
          className="w-16 rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-center font-mono text-[16px] focus:border-effort-target focus:outline-none"
        />
        <span className="text-[13px] text-ink-soft">servings</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={protein}
          onChange={(e) => onProtein(Number(e.target.value))}
          aria-label="Protein in grams"
          className="ml-auto w-20 rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-right font-mono text-[16px] focus:border-effort-target focus:outline-none"
        />
        <span className="text-[13px] text-ink-soft">g</span>
      </div>
      <button
        onClick={onSave}
        className="tap mt-3 w-full rounded-xl bg-effort-stretch text-sm font-medium text-white"
      >
        Add it
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Not sure of the protein? A rough guess is fine — a bowl of dal is
        about 5g, an egg about 6g, a roti about 3g.
      </p>
    </div>
  );
}
