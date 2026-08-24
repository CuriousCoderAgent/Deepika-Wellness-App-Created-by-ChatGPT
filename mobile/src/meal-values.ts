/**
 * Checking a meal's numbers before they are stored.
 *
 * Corrections were saved with `Number(input) || 0` and no bounds, so `-500`
 * and `999999` both went in. That is not only a wrong figure on her own
 * screen: `plan-generator.ts` reads the food log to decide `lowProtein` and
 * `lowFoodLogging`, so one mistyped correction quietly changes what she is
 * offered tomorrow.
 *
 * ## What this is not
 *
 * It is not a judgement about what she ate, and it must never become one. The
 * bounds below are the edge of *physically plausible for a single meal*, wide
 * enough that no real meal is ever questioned. A 1,400-calorie meal is a large
 * meal and passes without comment; nothing here has an opinion about it.
 *
 * And it asks rather than clamps. Silently rewriting 5,000 to 2,000 would
 * leave her looking at a number she did not enter, with no idea why — which
 * is worse than the original bug, because at least that one stored what she
 * typed.
 */

/**
 * Plausible upper limits for a single meal entry.
 *
 * Deliberately generous. These exist to catch a slipped decimal point or a
 * value typed into the wrong field, not to police portions.
 */
const LIMITS = {
  calories: 5_000,
  protein: 300,
  carbs: 800,
  fat: 400,
} as const;

export type MacroField = keyof typeof LIMITS;

export const MACRO_FIELDS: MacroField[] = [
  "calories",
  "protein",
  "carbs",
  "fat",
];

/** Human names, for a message that says which field is the problem. */
const FIELD_NAMES: Record<MacroField, string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbohydrate",
  fat: "Fat",
};

export interface MacroProblem {
  field: MacroField;
  /** Shown to her. Never implies the meal was wrong, only the number. */
  message: string;
}

/**
 * Read one typed value.
 *
 * An empty field means zero, which is a real answer — "this meal had no
 * protein worth recording" is legitimate. Anything unparseable is not a
 * number and is reported rather than silently becoming zero.
 */
export function parseMacro(
  field: MacroField,
  raw: string,
): { value: number } | { problem: MacroProblem } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: 0 };

  const value = Number(trimmed);
  if (!Number.isFinite(value))
    return {
      problem: {
        field,
        message: `${FIELD_NAMES[field]} needs to be a number.`,
      },
    };
  if (value < 0)
    return {
      problem: {
        field,
        message: `${FIELD_NAMES[field]} cannot be less than zero.`,
      },
    };
  if (value > LIMITS[field])
    return {
      problem: {
        field,
        // Names the limit, so the next attempt is informed rather than a
        // guess, and frames it as a check rather than a verdict.
        message: `${FIELD_NAMES[field]} looks like more than one meal — over ${LIMITS[field].toLocaleString()}. Worth a second look before saving.`,
      },
    };

  // Stored to one decimal at most. A macro figure carrying six decimal places
  // implies a precision no estimate of a plate of food has.
  return { value: Math.round(value * 10) / 10 };
}

export interface CheckedMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Check all four together.
 *
 * Returns every problem rather than the first, so she is not sent round the
 * loop once per field.
 */
export function checkMacros(
  raw: Record<MacroField, string>,
): { values: CheckedMacros } | { problems: MacroProblem[] } {
  const values = {} as CheckedMacros;
  const problems: MacroProblem[] = [];

  for (const field of MACRO_FIELDS) {
    const result = parseMacro(field, raw[field] ?? "");
    if ("problem" in result) problems.push(result.problem);
    else values[field] = result.value;
  }

  return problems.length ? { problems } : { values };
}
