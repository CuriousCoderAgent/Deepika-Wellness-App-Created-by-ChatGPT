import type { LearningArticle } from "./types";

/**
 * What is true of all five today: written in-house, and read by no clinician.
 *
 * Stated once rather than repeated, so that the day one of these is properly
 * reviewed it becomes obvious which ones still are not.
 */
const IN_HOUSE = {
  kind: "bharosa_guidance",
  author: "Bharosa",
} as const;


export const LEARNING_ARTICLES: LearningArticle[] = [
  {
    id: "minimum-counts",
    title: "Why the minimum still counts",
    summary:
      "Build consistency without turning wellness into another performance review.",
    readMinutes: 3,
    category: "Mindset",
    body: [
      "A useful plan must survive a difficult week, not only an ideal one.",
      "Choosing the minimum version keeps the habit available when time or energy is limited. It is not failure; it is intelligent load management.",
      "Judge the week by how often you returned—not by whether every day was perfect.",
    ],
    provenance: IN_HOUSE,
  },
  {
    id: "protein-breakfast",
    title: "A steadier breakfast",
    summary:
      "A practical way to add protein and fibre without redesigning your morning.",
    readMinutes: 4,
    category: "Nutrition",
    body: [
      "Start with the breakfast you already eat and add one dependable protein source.",
      "Curd, eggs, paneer, tofu, sprouts or dal-based dishes can all work. Choose what suits your preferences and medical guidance.",
      "A repeatable breakfast is often more useful than a complicated perfect recipe.",
    ],
    provenance: IN_HOUSE,
  },
  {
    id: "desk-reset",
    title: "The five-minute desk reset",
    summary:
      "Use movement snacks to reduce stiffness between demanding blocks of work.",
    readMinutes: 3,
    category: "Movement",
    body: [
      "Long uninterrupted sitting can leave the body feeling stiff even after a workout.",
      "Every 60–90 minutes, stand, walk briefly, and move the shoulders and hips through a comfortable range.",
      "Stop if movement causes sharp, spreading or unusual pain and discuss it with an appropriate professional.",
    ],
    provenance: IN_HOUSE,
  },
  {
    id: "sleep-winddown",
    title: "Protect the final hour",
    summary:
      "A realistic wind-down for people whose working day does not end neatly.",
    readMinutes: 5,
    category: "Recovery",
    body: [
      "The goal is not a flawless night routine. It is a recognisable transition from work to rest.",
      "Dim stimulation, prepare tomorrow's essentials, and choose one repeatable cue such as reading or slow breathing.",
      "If sleep problems persist or significantly affect daily function, seek clinical advice.",
    ],
    provenance: IN_HOUSE,
  },
  {
    id: "body-signals",
    title: "Notice patterns without guessing hormones",
    summary:
      "Record sleep, cycle or midlife changes in a way that supports a useful coach or clinician conversation.",
    readMinutes: 4,
    category: "Body signals",
    body: [
      "A body signal is an observation: a night waking, a cycle change, a hot flush, unusual soreness or a shift in mood. It is not a measurement of a hormone level.",
      "Record what happened and when, then look across several entries. One difficult day is context, not a diagnosis or proof of a cause.",
      "Use the pattern to prepare better questions for your coach or clinician. Persistent, concerning or disruptive changes deserve appropriate clinical advice; the app should not diagnose or prescribe treatment.",
    ],
    provenance: IN_HOUSE,
  },
];
