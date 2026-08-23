# Exercise media brief

Shot list for the sequences the app still needs. Generated from
`lib/exercise-library.ts` — if an exercise is added there, regenerate this rather
than editing it by hand, so the two cannot drift.

## What already exists

Eight sequences, 40 frames, all with the same mature Indian model, wardrobe, warm
studio backdrop, editorial lighting and full-body framing:

- Supported chair squat
- Standing hip hinge
- Standing wall push-up
- Standing shoulder wall-slide
- Seated thoracic rotation
- Supported single-leg balance
- Supported standing march
- Supported calf raise

## House style — please match exactly

- **Five frames per exercise**, left to right, one row.
- Same model, wardrobe, backdrop and lighting as the existing eight.
- Full body in frame, including feet. Chair or wall visible where used.
- **No text, numbers or arrows inside the image.** The app draws the step
  numbers and labels underneath, so the photographs stay reusable and can be
  translated into Hindi without a reshoot.
- Neutral, unstrained expression. This is not a fitness-magazine shoot.
- File name: `exercise-<kebab-name>-sequence-v1.png`, dropped into
  `mobile/assets/`. Then add one line to `mobile/src/exerciseMedia.ts`.

**Before these are used with real members, every movement and caption should be
reviewed by a qualified exercise or rehabilitation professional.**

## Still needed — 27 sequences, 135 frames

### Squat — sitting, standing, stairs

**Sit to stand**  
Tier 1 · chair  
Coaching cue shown under the frames: *Nose over toes, push the floor away, stand tall.*

  1. Sit tall
  2. Lean forward
  3. Weight into feet
  4. Stand up
  5. Sit down slowly

**Bodyweight squat**  
Tier 2 · none  
Coaching cue shown under the frames: *Sit down between your hips. Chest stays proud.*

  1. Stand tall
  2. Hips back
  3. Lower down
  4. Pause
  5. Drive up

**Supported split squat**  
Tier 3 · chair  
Coaching cue shown under the frames: *Back knee drops straight down. Hold the chair as much as you need.*

  1. Split stance
  2. Hold support
  3. Lower back knee
  4. Pause
  5. Drive up

**Step up**  
Tier 3 · none  
Coaching cue shown under the frames: *Whole foot on the step. Stand up through the front heel.*

  1. Face the step
  2. Foot on step
  3. Drive through heel
  4. Stand tall
  5. Step down slowly

### Hinge — the back-saving pattern

**Glute bridge**  
Tier 1 · none  
Coaching cue shown under the frames: *Squeeze at the top. Ribs stay down.*

  1. Lie back
  2. knees bent
  3. Feet planted
  4. Lift hips
  5. Squeeze and hold
  6. Lower slowly

**Single-leg glute bridge**  
Tier 3 · none  
Coaching cue shown under the frames: *Keep your hips level. If they tilt, put the other foot down.*

  1. Lie back
  2. knees bent
  3. Lift one leg
  4. Drive through heel
  5. Hips level
  6. Lower slowly

**Standing good morning**  
Tier 2 · none  
Coaching cue shown under the frames: *Hands on hips, chest leads, hips travel back.*

  1. Stand tall
  2. Hands on hips
  3. Hinge forward
  4. Flat back
  5. Stand tall

### Push

**Incline push-up**  
Tier 2 · chair  
Coaching cue shown under the frames: *Lower until your chest meets the surface, then push away.*

  1. Hands on chair
  2. Body in line
  3. Lower chest
  4. Pause
  5. Push away

**Knee push-up**  
Tier 3 · none  
Coaching cue shown under the frames: *Hips stay in line with shoulders. Do not let them sag.*

  1. Kneel
  2. hands wide
  3. Body in line
  4. Lower chest
  5. Pause
  6. Push up

**Band overhead press**  
Tier 2 · band  
Coaching cue shown under the frames: *Press up, not forward. Ribs stay down.*

  1. Band under feet
  2. Hands at shoulders
  3. Press up
  4. Arms straight
  5. Lower slowly

### Pull

**Seated band row**  
Tier 1 · chair, band  
Coaching cue shown under the frames: *Lead with your elbows. Squeeze your shoulder blades together.*

  1. Sit tall
  2. Band around feet
  3. Pull to ribs
  4. Squeeze
  5. Release slowly

**Bent-over row**  
Tier 3 · weight  
Coaching cue shown under the frames: *Hinge first, then row. Your back stays flat throughout.*

  1. Hinge forward
  2. Arms hanging
  3. Row to ribs
  4. Squeeze
  5. Lower slowly

### Core — bracing, not crunching

**Dead bug**  
Tier 2 · none  
Coaching cue shown under the frames: *Lower back stays pressed down. Move slowly.*

  1. Lie back
  2. Arms and knees up
  3. Extend opposite pair
  4. Pause
  5. Return

**Bird dog**  
Tier 2 · none  
Coaching cue shown under the frames: *Reach long, not high. A glass of water on your back should not spill.*

  1. On hands and knees
  2. Flat back
  3. Extend opposite pair
  4. Hold
  5. Return

**Side plank from knees**  
Tier 3 · none  
Coaching cue shown under the frames: *Push the floor away. Hips stay stacked and lifted.*

  1. Lie on side
  2. Elbow under shoulder
  3. Lift hips
  4. Hold
  5. Lower slowly

### Balance

**Single-leg stand**  
Tier 2 · none  
Coaching cue shown under the frames: *Chair within reach, but hands off. Wobbling is the training.*

  1. Stand tall
  2. Shift weight
  3. Lift one foot
  4. Hold steady
  5. Lower down

**Heel-to-toe walk**  
Tier 2 · wall  
Coaching cue shown under the frames: *One foot directly in front of the other. Wall within reach.*

  1. Stand by wall
  2. Heel to toe
  3. Step forward
  4. Steady
  5. Continue

### Mobility

**Ankle rocks**  
Tier 1 · wall  
Coaching cue shown under the frames: *Knee travels forward over the toes. Heel stays down.*

  1. Face the wall
  2. One foot forward
  3. Knee to wall
  4. Heel down
  5. Return

**Cat cow**  
Tier 1 · none  
Coaching cue shown under the frames: *Move with your breath. Nothing here should be forced.*

  1. On hands and knees
  2. Flat back
  3. Round up
  4. Pause
  5. Arch down

**Kneeling hip-flexor stretch**  
Tier 1 · none  
Coaching cue shown under the frames: *Tuck your tailbone first, then ease forward. Stand tall throughout.*

  1. Half kneel
  2. Tuck tailbone
  3. Ease forward
  4. Hold
  5. Release

**Seated figure-four stretch**  
Tier 1 · chair  
Coaching cue shown under the frames: *Sit tall first, then lean forward from the hips.*

  1. Sit tall
  2. Ankle on knee
  3. Lean forward
  4. Hold
  5. Release

**Supported hamstring stretch**  
Tier 1 · chair  
Coaching cue shown under the frames: *Back stays long. Lead with your chest, not your head.*

  1. Heel on chair
  2. Stand tall
  3. Hinge forward
  4. Hold
  5. Return

**Doorway chest opener**  
Tier 1 · wall  
Coaching cue shown under the frames: *Step through gently. You should feel a stretch, never a pinch.*

  1. Stand in doorway
  2. Forearms on frame
  3. Step through
  4. Hold
  5. Release

**Seated neck release**  
Tier 1 · chair  
Coaching cue shown under the frames: *Let the weight of your head do the work. Never pull.*

  1. Sit tall
  2. Drop one shoulder
  3. Tilt head away
  4. Hold
  5. Return centre

### Breathing and recovery

**Box breathing**  
Tier 1 · none  
Coaching cue shown under the frames: *In for four, hold four, out for four, hold four.*

  1. Sit comfortably
  2. Breathe in 4
  3. Hold 4
  4. Breathe out 4
  5. Hold 4

**Legs up the wall**  
Tier 1 · wall  
Coaching cue shown under the frames: *Get comfortable and stay. There is nothing to achieve.*

  1. Sit beside wall
  2. Swing legs up
  3. Lie back
  4. Rest and breathe
  5. Roll to side

**Body scan**  
Tier 1 · none  
Coaching cue shown under the frames: *Move your attention slowly from feet to head. Nothing to fix.*

  1. Settle down
  2. Notice feet
  3. Move upward
  4. Notice shoulders
  5. Rest

## Priority

If these are commissioned in batches, this is the order that unblocks the most
members soonest. Tier 1 movements are what a beginner sees in week one; the
tier 3 progressions are not reached for several weeks and can follow later.

1. **Tier 1 (13)** — seen in the first week: Sit to stand, Glute bridge, Seated band row, Ankle rocks, Cat cow, Kneeling hip-flexor stretch, Seated figure-four stretch, Supported hamstring stretch, Doorway chest opener, Seated neck release, Box breathing, Legs up the wall, Body scan
2. **Tier 2 (8)** — first progressions: Bodyweight squat, Standing good morning, Incline push-up, Band overhead press, Dead bug, Bird dog, Single-leg stand, Heel-to-toe walk
3. **Tier 3 (6)** — later weeks: Supported split squat, Step up, Single-leg glute bridge, Knee push-up, Bent-over row, Side plank from knees
