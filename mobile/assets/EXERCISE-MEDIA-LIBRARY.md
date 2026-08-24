# Bharosa exercise media library

**All thirty-five movements now have a sequence** — 175 frames. The set is one
format and one size: **1200px wide WebP at quality 82**, roughly 40KB each and
1.3MB for the whole bank. As 1775px PNGs the same set was 54MB, which would
have put about 40MB of images into every install.

Eight were photographed; twenty-seven were generated on 23 Aug 2026 against the
chair-squat sequence as the visual reference, and match the house style. Those
twenty-seven have passed a layout review — five panels, one model, no embedded
text — but **have not been reviewed by a qualified exercise professional.** The
movements and cues in `lib/exercise-library.ts` have been; the photographs of
them have not. That review is still outstanding and is a release gate.

The original eight, photographed:

- Supported chair squat
- Standing wall push-up
- Supported single-leg balance
- Supported calf raise
- Seated thoracic rotation
- Standing hip hinge
- Supported standing march
- Standing shoulder wall-slide

All assets use the same mature Indian model, wardrobe, warm studio backdrop, editorial lighting, full-body framing, and five-panel format. Instruction text and step numbers remain in the app UI rather than inside the images so the photographs can be reused and localized.

The app resolves exercise names to assets through `src/exerciseMedia.ts`. Before production clinical use, every movement and caption should be reviewed by a qualified exercise or rehabilitation professional.
