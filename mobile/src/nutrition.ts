/**
 * Estimating what a meal contained.
 *
 * The previous version added fixed numbers when a description matched one of
 * about a dozen English words. "2 rotis and dal" scored the same as "roti",
 * quantities were ignored entirely, and dal, curd, idli, dosa, poha, khichdi
 * and chai — most of what the pilot cohort actually eats — matched nothing at
 * all and silently returned the same 320 kcal as everything else.
 *
 * This reads the description properly: it finds every food it recognises,
 * reads the quantity in front of each one, and adds them up. Protein values
 * are deliberately the same numbers as the coach console's food table in
 * `lib/seed.ts`, because a member and Deepika looking at the same meal should
 * not see two different figures.
 *
 * It stays an estimate and says so. `matched` reports which foods were
 * actually recognised, so the screen can show what it based the number on
 * rather than presenting an invented total as fact — and `confident` is false
 * when nothing was recognised, which is the case worth being honest about.
 */

export interface NutritionItem {
  name: string;
  qty: number;
  unitLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** The foods the text was understood to contain. */
  matched: NutritionItem[];
  /** False when nothing was recognised and the numbers are a generic guess. */
  confident: boolean;
}

interface FoodDefinition {
  name: string;
  unitLabel: string;
  /** Per single unit. Protein matches `foodItems` in the coach console. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Everything a member might type, including common transliterations. */
  aliases: string[];
  /** Assumed servings when a quantity is not given ("dal and rice"). */
  defaultQty?: number;
}

/**
 * Ordered longest-phrase-first at match time so "besan chilla" is not consumed
 * by "chilla", and "curd rice" does not match as plain "rice".
 */
const FOODS: FoodDefinition[] = [
  // Dals and legumes
  { name: "Dal", unitLabel: "bowl", calories: 130, protein: 5, carbs: 18, fat: 3, aliases: ["dal", "daal", "dhal", "toor dal", "moong dal", "lentils", "sambar dal"] },
  { name: "Rajma", unitLabel: "bowl", calories: 180, protein: 7, carbs: 26, fat: 4, aliases: ["rajma", "kidney beans"] },
  { name: "Chole", unitLabel: "bowl", calories: 190, protein: 7, carbs: 27, fat: 5, aliases: ["chole", "chhole", "chana", "chickpeas", "chana masala"] },
  { name: "Sambar", unitLabel: "bowl", calories: 120, protein: 4, carbs: 17, fat: 3, aliases: ["sambar", "sambhar"] },
  { name: "Sprouts", unitLabel: "bowl", calories: 110, protein: 7, carbs: 16, fat: 1, aliases: ["sprouts", "moong sprouts", "sprouted"] },
  { name: "Soya chunks", unitLabel: "bowl", calories: 170, protein: 18, carbs: 12, fat: 2, aliases: ["soya chunks", "soya", "soy chunks", "nutrela"] },

  // Grains
  { name: "Roti", unitLabel: "roti", calories: 90, protein: 3, carbs: 18, fat: 1, aliases: ["roti", "rotis", "chapati", "chapatis", "chappati", "phulka", "phulkas"], defaultQty: 2 },
  { name: "Paratha", unitLabel: "paratha", calories: 180, protein: 4, carbs: 24, fat: 7, aliases: ["paratha", "parathas", "parantha", "paranthas"] },
  { name: "Rice", unitLabel: "bowl", calories: 200, protein: 3, carbs: 44, fat: 1, aliases: ["rice", "chawal", "steamed rice", "jeera rice", "curd rice"] },
  { name: "Biryani", unitLabel: "plate", calories: 480, protein: 14, carbs: 62, fat: 18, aliases: ["biryani", "biriyani", "pulao", "pulav"] },
  { name: "Khichdi", unitLabel: "bowl", calories: 220, protein: 7, carbs: 38, fat: 4, aliases: ["khichdi", "khichadi", "kitchari"] },
  { name: "Idli", unitLabel: "idli", calories: 60, protein: 2, carbs: 12, fat: 0, aliases: ["idli", "idlis", "idly"], defaultQty: 2 },
  { name: "Dosa", unitLabel: "dosa", calories: 170, protein: 4, carbs: 28, fat: 5, aliases: ["dosa", "dosas", "dose", "masala dosa"] },
  { name: "Poha", unitLabel: "bowl", calories: 200, protein: 3, carbs: 38, fat: 5, aliases: ["poha", "pohe"] },
  { name: "Upma", unitLabel: "bowl", calories: 210, protein: 4, carbs: 34, fat: 6, aliases: ["upma", "uppma"] },
  { name: "Oats", unitLabel: "bowl", calories: 160, protein: 5, carbs: 27, fat: 3, aliases: ["oats", "oatmeal", "porridge"] },
  { name: "Besan chilla", unitLabel: "chilla", calories: 140, protein: 6, carbs: 16, fat: 5, aliases: ["besan chilla", "besan cheela", "chilla", "cheela"] },
  { name: "Bread", unitLabel: "slice", calories: 75, protein: 2, carbs: 14, fat: 1, aliases: ["bread", "toast", "slice of bread", "sandwich bread"], defaultQty: 2 },

  // Vegetables
  { name: "Sabzi", unitLabel: "bowl", calories: 110, protein: 2, carbs: 12, fat: 6, aliases: ["sabzi", "sabji", "subzi", "mixed veg", "vegetable curry"] },
  { name: "Palak sabzi", unitLabel: "bowl", calories: 120, protein: 3, carbs: 10, fat: 7, aliases: ["palak", "spinach", "methi", "saag", "palak paneer sabzi"] },
  { name: "Aloo sabzi", unitLabel: "bowl", calories: 150, protein: 2, carbs: 22, fat: 6, aliases: ["aloo", "potato", "aloo sabzi", "aloo ki sabzi"] },
  { name: "Salad", unitLabel: "bowl", calories: 45, protein: 1, carbs: 8, fat: 1, aliases: ["salad", "kachumber", "cucumber", "raw veg"] },
  { name: "Fruit", unitLabel: "serving", calories: 80, protein: 1, carbs: 20, fat: 0, aliases: ["fruit", "banana", "apple", "papaya", "orange", "mango", "guava"] },

  // Dairy
  { name: "Curd", unitLabel: "bowl", calories: 100, protein: 4, carbs: 7, fat: 5, aliases: ["curd", "dahi", "yoghurt", "yogurt", "raita"] },
  { name: "Milk", unitLabel: "glass", calories: 150, protein: 6, carbs: 12, fat: 8, aliases: ["milk", "doodh"] },
  { name: "Paneer", unitLabel: "50g", calories: 130, protein: 9, carbs: 2, fat: 10, aliases: ["paneer", "cottage cheese"] },
  { name: "Buttermilk", unitLabel: "glass", calories: 60, protein: 2, carbs: 5, fat: 3, aliases: ["buttermilk", "chaas", "chhaas", "lassi"] },
  { name: "Tofu", unitLabel: "100g", calories: 145, protein: 12, carbs: 3, fat: 9, aliases: ["tofu"] },
  { name: "Tea or coffee", unitLabel: "cup", calories: 70, protein: 2, carbs: 8, fat: 3, aliases: ["chai", "tea", "coffee", "filter coffee", "cutting chai"] },

  // Higher-protein
  { name: "Egg", unitLabel: "egg", calories: 78, protein: 6, carbs: 1, fat: 5, // "bhurji" alone is not egg — paneer bhurji is common and has none.
    aliases: ["egg", "eggs", "anda", "omelette", "omlet", "egg bhurji", "anda bhurji"], defaultQty: 2 },
  { name: "Chicken", unitLabel: "100g", calories: 220, protein: 25, carbs: 2, fat: 12, aliases: ["chicken", "murgh", "chicken curry", "tandoori chicken"] },
  { name: "Fish", unitLabel: "100g", calories: 190, protein: 22, carbs: 1, fat: 10, aliases: ["fish", "machli", "prawns", "seafood"] },
  { name: "Mutton", unitLabel: "100g", calories: 290, protein: 24, carbs: 2, fat: 20, aliases: ["mutton", "lamb", "keema"] },
  { name: "Protein powder", unitLabel: "scoop", calories: 120, protein: 24, carbs: 3, fat: 2, aliases: ["protein powder", "whey", "protein shake"] },

  // Snacks
  { name: "Peanuts", unitLabel: "handful", calories: 170, protein: 8, carbs: 6, fat: 14, aliases: ["peanuts", "moongphali", "groundnuts"] },
  { name: "Almonds", unitLabel: "10 almonds", calories: 70, protein: 3, carbs: 3, fat: 6, aliases: ["almonds", "badam", "nuts", "dry fruits"] },
  { name: "Makhana", unitLabel: "bowl", calories: 110, protein: 3, carbs: 20, fat: 1, aliases: ["makhana", "fox nuts", "lotus seeds"] },
  { name: "Samosa", unitLabel: "piece", calories: 260, protein: 4, carbs: 30, fat: 13, aliases: ["samosa", "samose", "kachori", "vada", "pakora", "pakoda"] },
  { name: "Biscuits", unitLabel: "2 biscuits", calories: 100, protein: 1, carbs: 15, fat: 4, aliases: ["biscuit", "biscuits", "cookies", "rusk"] },
  { name: "Sweet", unitLabel: "piece", calories: 180, protein: 3, carbs: 28, fat: 6, aliases: ["sweet", "mithai", "laddu", "barfi", "halwa", "gulab jamun", "dessert", "ice cream"] },
];

/** Words members write instead of digits, including Hindi numbers. */
const QUANTITY_WORDS: Record<string, number> = {
  half: 0.5, aadha: 0.5, adha: 0.5, aadhi: 0.5,
  one: 1, ek: 1, a: 1, an: 1,
  two: 2, do: 2, couple: 2,
  three: 3, teen: 3,
  four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5,
  six: 6, che: 6,
  small: 0.5, little: 0.5, bit: 0.5,
  big: 1.5, large: 1.5, full: 1,
};

/**
 * Serving words that sit between the number and the food ("2 katori dal",
 * "one plate rice"). They are skipped rather than scaled: a katori and a bowl
 * are the same serving in this table, and inventing a multiplier for "plate"
 * would be a precision the estimate does not have.
 */
const SERVING_WORDS = new Set([
  "katori", "katoris", "bowl", "bowls", "plate", "plates", "glass", "glasses",
  "cup", "cups", "piece", "pieces", "serving", "servings", "scoop", "scoops",
  "slice", "slices", "handful", "spoon", "spoons", "tbsp", "tsp", "of",
]);

const GENERIC_MEAL: NutritionEstimate = {
  calories: 320,
  protein: 12,
  carbs: 42,
  fat: 11,
  matched: [],
  confident: false,
};

/** Longest alias first, so multi-word foods win over their own last word. */
const ALIAS_INDEX = FOODS.flatMap((food) =>
  food.aliases.map((alias) => ({ alias, food })),
).sort((a, b) => b.alias.length - a.alias.length);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The quantity written immediately before a food, if there is one.
 *
 * Reads backwards over serving words so "2 katori dal" and "two bowls of dal"
 * both find the 2. Fractions written as "1/2" are understood too.
 */
function quantityBefore(text: string, matchStart: number): number | null {
  const preceding = text.slice(0, matchStart).trim().split(/\s+/);
  for (let i = preceding.length - 1, hops = 0; i >= 0 && hops < 3; i--, hops++) {
    const word = (preceding[i] ?? "").replace(/[^a-z0-9/.]/g, "");
    if (!word) continue;
    if (SERVING_WORDS.has(word)) continue;
    const fraction = word.match(/^(\d+)\/(\d+)$/);
    if (fraction) {
      const value = Number(fraction[1]) / Number(fraction[2]);
      return value > 0 && value <= 20 ? value : null;
    }
    if (/^\d+(\.\d+)?$/.test(word)) {
      const value = Number(word);
      return value > 0 && value <= 20 ? value : null;
    }
    if (word in QUANTITY_WORDS) return QUANTITY_WORDS[word] ?? null;
    return null;
  }
  return null;
}

const round = (value: number) => Math.round(value);

/**
 * Read a free-text description into an estimate.
 *
 * Recognised foods are summed. If nothing is recognised the generic meal is
 * returned with `confident: false`, which the caller shows as an estimate the
 * member is invited to correct rather than as a measured value.
 */
export function estimateMeal(description: string): NutritionEstimate {
  const text = ` ${description.toLowerCase().replace(/[^a-z0-9/.\s]/g, " ")} `;
  if (!text.trim()) return { ...GENERIC_MEAL };

  const matched: NutritionItem[] = [];
  const seen = new Set<string>();
  // Consumed spans stop "paneer" inside "palak paneer sabzi" being counted
  // twice, and stop a shorter alias re-matching text a longer one already took.
  const consumed: [number, number][] = [];
  const overlaps = (start: number, end: number) =>
    consumed.some(([from, to]) => start < to && end > from);

  for (const { alias, food } of ALIAS_INDEX) {
    if (seen.has(food.name)) continue;
    const pattern = new RegExp(`(?<![a-z])${escapeRegExp(alias)}(?![a-z])`, "g");
    let hit = pattern.exec(text);
    while (hit) {
      const start = hit.index;
      const end = start + hit[0].length;
      if (!overlaps(start, end)) {
        consumed.push([start, end]);
        seen.add(food.name);
        const qty = quantityBefore(text, start) ?? food.defaultQty ?? 1;
        matched.push({
          name: food.name,
          qty,
          unitLabel: food.unitLabel,
          calories: round(food.calories * qty),
          protein: round(food.protein * qty),
          carbs: round(food.carbs * qty),
          fat: round(food.fat * qty),
        });
        break;
      }
      hit = pattern.exec(text);
    }
  }

  if (!matched.length) return { ...GENERIC_MEAL };

  const total = matched.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    calories: Math.max(40, round(total.calories)),
    protein: round(total.protein),
    carbs: round(total.carbs),
    fat: round(total.fat),
    matched,
    confident: true,
  };
}

/** "2 roti · 1 bowl dal" — what the estimate was actually based on. */
export function describeMatches(matched: NutritionItem[]): string {
  return matched
    .map((item) => {
      const qty = Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(1);
      return `${qty} × ${item.name}`;
    })
    .join(" · ");
}
