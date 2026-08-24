/**
 * Cities, for the one field that has to be typed exactly right.
 *
 * City discovery matches on `lower(city)`, so "Bengaluru" and "Bangalore" are
 * two different cities and the members in each never see one another. Free
 * text was quietly splitting the very thing the field exists to join up.
 *
 * A picker fixes that by making the common answers spellable in one tap, and
 * the aliases below fix the rest: someone who types "Bangalore", "Blr" or
 * "Bengaluru" lands on the same stored value either way.
 *
 * Typing is still allowed. A member in Hubli should not be told her city is
 * not on a list — she just does not get help spelling it.
 */

export interface City {
  /** What gets stored and matched on. One spelling per place. */
  name: string;
  /** Shown after the name, so two Hyderabads would be distinguishable. */
  region: string;
  /** Other things people type for this place. Matched, never stored. */
  aliases?: string[];
}

/**
 * Indian cities first and in rough population order, because that is where
 * the members are; the international list covers the diaspora cities that
 * come up rather than trying to be a gazetteer.
 */
export const CITIES: City[] = [
  { name: "Mumbai", region: "Maharashtra", aliases: ["bombay"] },
  { name: "Delhi", region: "Delhi NCR", aliases: ["new delhi"] },
  { name: "Bengaluru", region: "Karnataka", aliases: ["bangalore", "blr"] },
  { name: "Hyderabad", region: "Telangana", aliases: ["hyd"] },
  { name: "Chennai", region: "Tamil Nadu", aliases: ["madras"] },
  { name: "Kolkata", region: "West Bengal", aliases: ["calcutta"] },
  { name: "Pune", region: "Maharashtra", aliases: ["poona"] },
  { name: "Ahmedabad", region: "Gujarat", aliases: ["amdavad"] },
  { name: "Gurugram", region: "Delhi NCR", aliases: ["gurgaon"] },
  { name: "Noida", region: "Delhi NCR", aliases: ["greater noida"] },
  { name: "Jaipur", region: "Rajasthan" },
  { name: "Lucknow", region: "Uttar Pradesh" },
  { name: "Chandigarh", region: "Punjab & Haryana" },
  { name: "Kochi", region: "Kerala", aliases: ["cochin", "ernakulam"] },
  { name: "Indore", region: "Madhya Pradesh" },
  { name: "Bhopal", region: "Madhya Pradesh" },
  { name: "Nagpur", region: "Maharashtra" },
  { name: "Surat", region: "Gujarat" },
  { name: "Coimbatore", region: "Tamil Nadu" },
  { name: "Visakhapatnam", region: "Andhra Pradesh", aliases: ["vizag"] },
  { name: "Thiruvananthapuram", region: "Kerala", aliases: ["trivandrum"] },
  { name: "Bhubaneswar", region: "Odisha" },
  { name: "Guwahati", region: "Assam" },
  { name: "Dehradun", region: "Uttarakhand" },
  { name: "Patna", region: "Bihar" },
  { name: "Vadodara", region: "Gujarat", aliases: ["baroda"] },
  { name: "Mysuru", region: "Karnataka", aliases: ["mysore"] },
  { name: "Nashik", region: "Maharashtra" },
  { name: "Ludhiana", region: "Punjab" },
  { name: "Goa", region: "Goa", aliases: ["panaji", "panjim"] },

  { name: "Singapore", region: "Singapore", aliases: ["sg"] },
  { name: "Dubai", region: "UAE" },
  { name: "Abu Dhabi", region: "UAE" },
  { name: "London", region: "United Kingdom" },
  { name: "Manchester", region: "United Kingdom" },
  { name: "Dublin", region: "Ireland" },
  {
    name: "New York",
    region: "United States",
    aliases: ["nyc", "new york city"],
  },
  {
    name: "San Francisco",
    region: "United States",
    aliases: ["sf", "bay area"],
  },
  { name: "Seattle", region: "United States" },
  { name: "Austin", region: "United States" },
  { name: "Chicago", region: "United States" },
  { name: "Toronto", region: "Canada" },
  { name: "Vancouver", region: "Canada" },
  { name: "Sydney", region: "Australia" },
  { name: "Melbourne", region: "Australia" },
  { name: "Auckland", region: "New Zealand" },
  { name: "Doha", region: "Qatar" },
  { name: "Riyadh", region: "Saudi Arabia" },
  { name: "Hong Kong", region: "Hong Kong SAR", aliases: ["hk"] },
  { name: "Kuala Lumpur", region: "Malaysia", aliases: ["kl"] },
  { name: "Bangkok", region: "Thailand" },
  { name: "Tokyo", region: "Japan" },
  { name: "Berlin", region: "Germany" },
  { name: "Amsterdam", region: "Netherlands" },
  { name: "Zurich", region: "Switzerland" },
];

/**
 * Suggestions for what she has typed so far.
 *
 * An exact match ranks above a prefix, and a prefix above a match in the
 * middle; ties fall back to list order. Empty input returns the head of the
 * list rather than nothing, because a picker that stays blank until you guess
 * a letter is not a picker.
 */
export function suggestCities(query: string, limit = 6): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITIES.slice(0, limit);

  // An alias ranks exactly as well as the name, because it *is* a name for
  // the place — demoting it put Bangkok above Bengaluru for "ban", which is
  // not what anyone typing that into this app means. Ties fall back to list
  // order via a stable sort, so the bigger and closer city wins.
  const score = (city: City): number => {
    const names = [city.name.toLowerCase(), ...(city.aliases ?? [])];
    if (names.some((n) => n === q)) return 0;
    if (names.some((n) => n.startsWith(q))) return 1;
    if (names.some((n) => n.includes(q))) return 2;
    return Infinity;
  };

  return CITIES.map((city) => ({ city, rank: score(city) }))
    .filter((row) => row.rank !== Infinity)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((row) => row.city);
}

/**
 * The canonical spelling for something she typed, when there is one.
 *
 * Returns null when nothing matches, which means "store what she wrote" — the
 * list is help, not a whitelist.
 */
export function canonicalCity(input: string): string | null {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  const hit = CITIES.find(
    (city) =>
      city.name.toLowerCase() === q ||
      city.aliases?.some((alias) => alias === q),
  );
  return hit ? hit.name : null;
}
