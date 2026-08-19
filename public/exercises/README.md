# Exercise artwork

Drop supplied PNGs in this folder to replace the drawn SVG figures.

## The twelve files

Filenames must match exactly — that string is what the code looks up.

| File | Exercise as it appears in the app |
| --- | --- |
| `goblet-squat.png` | Goblet squat |
| `hip-hinge.png` | Hip hinge with dowel |
| `incline-push-up.png` | Incline push-up |
| `suitcase-carry.png` | Suitcase carry (weight in one hand) |
| `split-squat.png` | Split squat, supported |
| `romanian-deadlift.png` | Romanian deadlift |
| `half-kneeling-press.png` | Half-kneeling press |
| `farmer-carry.png` | Farmer carry (weight in both hands) |
| `cat-cow.png` | Cat-cow |
| `hip-switch.png` | 90/90 hip switch |
| `thoracic-opener.png` | Thoracic opener |
| `standing-stretch.png` | Standing calf and hamstring |
| `walk.png` | Walking (used by the walking module) |

## What the files need to be

- **Transparent background.** They sit on white cards *and* on warm grey
  panels. A white box behind the figure will show as a visible square on one
  of them.
- **Square, 1:1.** Displayed at 38–76px, so **512×512 is plenty** and 256×256
  is enough. Bigger just costs load time.
- **Consistent framing.** Same figure size and margin in every file. If one
  image is zoomed in and the next is zoomed out, the row looks broken even
  when each image is fine on its own.
- **One visual style across all twelve.** This is the part that most often
  goes wrong with separately generated images — mismatched line weights or
  colours are far more noticeable across a set than any single image's
  quality. Generate them in one batch with the same style instruction.
- **Side profile where the movement has one** (squat, hinge, push-up,
  deadlift, split squat). What matters is that the *position* is readable,
  not that the figure is detailed.
- Keep each file under ~80KB if possible.

## How to switch them on

1. Add the files here.
2. In `components/ExerciseFigure.tsx`, uncomment the matching key in
   `HAS_ARTWORK`.

That's it — no other code changes. Movements not listed in `HAS_ARTWORK`
keep their drawn SVG, so the set can be swapped over one at a time, and
removing a key puts the drawing back if an image doesn't work out.
