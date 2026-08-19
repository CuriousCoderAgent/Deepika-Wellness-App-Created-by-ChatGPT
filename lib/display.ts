import type { Member } from "./types";

/**
 * Coach-facing member identifier.
 *
 * The console shows an ID rather than a full name. Real women's names sitting
 * next to symptom logs, lab values and adherence percentages is exactly the
 * screen you do not want over someone's shoulder in a cafe, and it is the
 * screen that gets demoed most. The member's own app still greets her by
 * name — she knows who she is.
 */
export function memberCode(m: Member): string {
  return m.id.toUpperCase();
}

export function memberLabel(m: Member): string {
  return `ID: ${memberCode(m)}`;
}
