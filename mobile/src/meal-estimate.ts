/**
 * A meal estimate she has not agreed to yet.
 *
 * Logging a meal used to be one tap: the photo went up, a model read it, and
 * whatever came back was written into her diary as a saved entry. Three
 * things were wrong with that, and this module is the shape that fixes them.
 *
 * **It saved before she agreed.** A number she never looked at still counts
 * towards her day and still reaches her coach. An estimate is a proposal
 * until she accepts it.
 *
 * **The photo silently outranked what she typed.** If she wrote "two rotis
 * and dal" and the photo read something else, the photo won and her own words
 * were discarded without being shown. She is the better witness to her own
 * meal; both readings are kept here and she picks.
 *
 * **The item breakdown was thrown away.** "2 × Roti · 1 × Dal" was rendered
 * once into a string and lost with component state, so nothing afterwards
 * could explain where 520 kcal came from, and she could not say "no, one
 * roti" without retyping every number.
 *
 * Everything here is pure arithmetic on the estimate. No rounding happens
 * until a total is read, so adjusting a portion twice does not drift.
 */

export interface EstimateItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Where a set of numbers came from. Shown to her, and stored. */
export type EstimateSource = "photo" | "description";

export interface MealProposal {
  source: EstimateSource;
  /** Empty for a description estimate, which has no per-item breakdown. */
  items: EstimateItem[];
  /** The model's own view of whether it could read the meal. */
  confident: boolean;
  /** One line naming what the numbers were read from. */
  basis: string;
  /** Set for a photo estimate, so a later screen can explain the number. */
  model?: string;
  promptVersion?: string;
}

/**
 * What gets stored on the entry once she accepts.
 *
 * Deliberately a record of a reading rather than a claim about the meal: it
 * says which source produced these numbers, what the parts were, and whether
 * she changed them. A later screen can answer "where did 520 kcal come from"
 * without asking a model again.
 */
export interface EstimateProvenance {
  source: EstimateSource;
  items: EstimateItem[];
  confident: boolean;
  model?: string;
  promptVersion?: string;
  /** True when she adjusted a portion or a number before saving. */
  adjusted: boolean;
  acceptedAt: string;
}

/** Per unit of quantity, so a portion change scales the whole item. */
function perUnit(item: EstimateItem): Macros {
  /* A zero quantity would make every macro NaN or Infinity. Treat it as one
     unit's worth, which is what the model meant when it named the food. */
  const divisor = item.quantity > 0 ? item.quantity : 1;
  return {
    calories: item.calories / divisor,
    protein: item.protein / divisor,
    carbs: item.carbs / divisor,
    fat: item.fat / divisor,
  };
}

/**
 * The same food, at a different portion.
 *
 * Scaling from the per-unit figure rather than from the current one means
 * repeated adjustments do not compound a rounding error — going 2 → 3 → 2
 * returns exactly the original numbers.
 */
export function scaleItem(item: EstimateItem, quantity: number): EstimateItem {
  const next = Math.max(0, quantity);
  const unit = perUnit(item);
  return {
    ...item,
    quantity: next,
    calories: unit.calories * next,
    protein: unit.protein * next,
    carbs: unit.carbs * next,
    fat: unit.fat * next,
  };
}

/** Adjust one item in a list, leaving the rest alone. */
export function adjustQuantity(
  items: EstimateItem[],
  index: number,
  quantity: number,
): EstimateItem[] {
  return items.map((item, at) =>
    at === index ? scaleItem(item, quantity) : item,
  );
}

/** Drop an item she says is not in the meal. */
export function removeItem(
  items: EstimateItem[],
  index: number,
): EstimateItem[] {
  return items.filter((_, at) => at !== index);
}

/**
 * The meal's totals, rounded once at the end.
 *
 * Rounding each item and then summing is how a plate of five foods ends up
 * two or three calories away from its own parts, which is exactly the kind of
 * small wrongness that makes someone stop trusting the number.
 */
export function totalOf(items: EstimateItem[]): Macros {
  const sum = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    calories: Math.round(sum.calories),
    protein: Math.round(sum.protein),
    carbs: Math.round(sum.carbs),
    fat: Math.round(sum.fat),
  };
}

/** "2 × Roti · 1 × Dal", or a plain sentence when there are no items. */
export function describeItems(items: EstimateItem[]): string {
  if (!items.length) return "No items identified";
  return items
    .map((item) => `${trimNumber(item.quantity)} × ${item.name}`)
    .join(" · ");
}

/** 2 rather than 2.0, and 1.5 rather than 1.50. */
function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Whether the numbers still match what the proposal started as.
 *
 * Used to record `adjusted` honestly: a member who corrected a portion is
 * telling us something about her meal *and* about the estimate, and the
 * second of those is only visible if we notice she changed it.
 */
export function wasAdjusted(
  original: EstimateItem[],
  current: EstimateItem[],
): boolean {
  if (original.length !== current.length) return true;
  return original.some((item, at) => item.quantity !== current[at]?.quantity);
}

/**
 * Which proposal to show first when there are two.
 *
 * The photo leads when the model says it could read the meal, because a
 * photograph of the actual plate is better evidence than a remembered
 * description. When it could not, her words lead. Neither one is ever
 * discarded — this only decides what is on top.
 */
export function preferred(
  typed: MealProposal,
  photo: MealProposal | null,
): MealProposal {
  return photo?.confident ? photo : typed;
}
