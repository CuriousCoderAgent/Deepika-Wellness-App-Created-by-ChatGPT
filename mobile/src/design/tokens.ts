/**
 * The palette.
 *
 * Extracted from `App.tsx` so it is one importable thing rather than a
 * constant buried at line 176 of an eight-thousand-line file. Two reasons
 * beyond tidiness: a redesign should be able to change these without opening
 * a screen file, and the contrast assertions in `scripts/test.mjs` can now
 * read the real values instead of a hand-copied duplicate that would drift.
 *
 * ## The contrast history, because it is worth not repeating
 *
 * Two of these failed WCAG AA badly, measured against the real surfaces:
 * `faint` was 2.71:1 on paper and 2.96:1 on card, and `marigold` 2.60:1 and
 * 2.84:1, against a 4.5:1 minimum for ordinary text. Both were used at 11pt
 * and below — on labels, timestamps, metadata and the whole bottom tab bar —
 * so the smallest text in the app had the worst contrast in the app, for a
 * membership largely over forty.
 *
 * `faint` is darkened to clear it on both surfaces. `marigold` is unchanged,
 * because it is the brand colour and carries badges, rails and borders where
 * the text rules do not apply the same way — text that used it now uses
 * `marigoldInk`, the same hue taken dark enough to read.
 *
 * Anything added here that is used as text must clear 4.5:1 on both `paper`
 * and `card`. A test enforces it.
 */

export const C = {
  paper: "#F3F1EA",
  card: "#FCFBF7",
  ink: "#132D2E",
  soft: "#566665",
  /** 4.91:1 on paper, 5.36:1 on card. Was #8A9692 — 2.71:1 and 2.96:1. */
  faint: "#5F6B66",
  line: "#DCE2DD",
  green: "#0B5557",
  greenDeep: "#073F43",
  greenTint: "#DCEAE5",
  /** Brand and decoration — badges, rails, borders. Not for text. */
  marigold: "#B6914B",
  /** The same gold, dark enough for text: 5.16:1 on paper, 5.63:1 on card. */
  marigoldInk: "#7F6024",
  marigoldTint: "#F1E8D5",
  calm: "#3E7182",
} as const;

/**
 * The two surfaces text is ever drawn on, and the colours drawn on them.
 *
 * Split out so the contrast test knows which tokens are text and which are
 * decoration, rather than inferring it. Adding a text colour without adding
 * it here means it is not checked — so add it here.
 */
export const SURFACES = [C.paper, C.card] as const;

export const TEXT_COLOURS = {
  ink: C.ink,
  soft: C.soft,
  faint: C.faint,
  marigoldInk: C.marigoldInk,
  green: C.green,
  greenDeep: C.greenDeep,
} as const;

/**
 * The smallest text the app is allowed to render.
 *
 * The bottom tab labels were 9pt and forty-seven other styles sat at 7–9pt.
 * That is the smallest text in the app on the controls used most, for the
 * people least able to read it. Eleven is the platform convention for a tab
 * label (iOS 10–11, Material 12) and reads without enlarging any container.
 */
export const MIN_FONT_SIZE = 11;
