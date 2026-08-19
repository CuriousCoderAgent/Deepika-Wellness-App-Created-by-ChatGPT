import type {
  FoodEntry,
  FoodItem,
  Article,
  CoachModule,
  DailyAction,
  Feedback,
  Member,
  Message,
  NotificationTemplate,
  PulseEntry,
  Provenance,
  Report,
  Session,
  WeeklyReflection,
  Workout,
  WorkoutLog,
} from "./types";

const p = (
  source: Provenance["source"],
  enteredBy: string,
  at = "2026-08-09"
): Provenance => ({ source, enteredBy, at });

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export const members: Member[] = [
  {
    id: "radhika",
    name: "Radhika Menon",
    age: 44,
    city: "Bengaluru",
    initials: "RM",
    week: 5,
    phase: "Stabilise",
    lifeStage: "Perimenopause — cycle irregular for ~10 months",
    goals: [
      "Stop feeling wiped out by 4pm",
      "Be able to lift my own suitcase again",
      "Sleep through the night",
    ],
    constraints: [
      "Two school runs daily",
      "Travels to Chennai most alternate weeks",
      "No gym membership — home equipment only",
    ],
    wontDo: "I will not give up my evening chai and I will not count calories.",
    medical: ["Borderline high LDL (2025 panel)", "Occasional lower-back stiffness"],
    medications: ["Vitamin D 60k weekly"],
    engagement: "slipping",
    weeklyFocus: ["Protect sleep on non-travel nights", "Two strength sessions, any length"],
    activeModuleIds: ["mv-strength-a", "sl-reset", "nu-protein", "bh-minimum-day"],
    lastPlanChange: {
      at: "2 days ago",
      rationale:
        "You reported low energy three days running and slept badly. I have taken Thursday's session out and made today's movement the 12-minute version. Nothing is behind.",
    },
    bodyComp: [
      { label: "Weight", value: "68.7 kg", at: "Week 1", provenance: p("coach_on_behalf", "Deepika", "2026-07-06") },
      { label: "Skeletal muscle", value: "23.1 kg", at: "Week 1", provenance: p("imported_document", "InBody report", "2026-07-06") },
      { label: "Waist", value: "89 cm", at: "Week 4", provenance: p("coach_on_behalf", "Deepika", "2026-07-28") },
    ],
    assessmentComplete: 85,
    // Set by Deepika in the console, not calculated by the app.
    proteinTargetG: 60,
    notes: [
      {
        id: "note-radhika-1",
        at: "2026-08-07",
        text: "Reported low energy three days running and slept badly. Took Thursday's session out and made today's movement the 12-minute version. Nothing is behind — told her so directly.",
      },
      {
        id: "note-radhika-2",
        at: "2026-07-31",
        text: "Felt better after the reset week. She responds well to small, named wins — kept this week's focus to consistency with protein rather than adding anything new.",
      },
      {
        id: "note-radhika-3",
        at: "2026-07-20",
        text: "Week 1 of Stabilise. Main goal is energy, not weight — she's wiped out by 4pm most days. Two school runs plus alternate-week Chennai travel is the real constraint to design the week around.",
      },
    ],
    weekPlans: [
      { week: 1, phase: "Stabilise", focus: ["Show up, however small", "Protect sleep on non-travel nights"], moduleIds: ["mv-walk-base", "sl-reset", "bh-minimum-day"] },
      { week: 2, phase: "Stabilise", focus: ["Show up, however small", "Protect sleep on non-travel nights"], moduleIds: ["mv-walk-base", "sl-reset", "bh-minimum-day"] },
      { week: 3, phase: "Stabilise", focus: ["Introduce protein at one meal a day", "Protect sleep on non-travel nights"], moduleIds: ["mv-walk-base", "sl-reset", "nu-protein", "bh-minimum-day"] },
      { week: 4, phase: "Stabilise", focus: ["Introduce protein at one meal a day", "Protect sleep on non-travel nights"], moduleIds: ["mv-walk-base", "sl-reset", "nu-protein", "bh-minimum-day"] },
      { week: 5, phase: "Build", focus: ["Protect sleep on non-travel nights", "Two strength sessions, any length"], moduleIds: ["mv-strength-a", "sl-reset", "nu-protein", "bh-minimum-day"] },
      { week: 6, phase: "Build", focus: ["Two strength sessions, any length", "Protein at two meals a day"], moduleIds: ["mv-strength-a", "sl-reset", "nu-protein", "bh-minimum-day"] },
      { week: 7, phase: "Build", focus: ["Add load — Balance & Carry", "Protein at two meals a day"], moduleIds: ["mv-strength-b", "sl-reset", "nu-protein", "bh-if-then"] },
      { week: 8, phase: "Build", focus: ["Add load — Balance & Carry", "Understand why we are lifting"], moduleIds: ["mv-strength-b", "sl-reset", "nu-protein", "hr-bone-muscle"] },
      { week: 9, phase: "Consolidate", focus: ["Consolidate the habits that held", "Build the plate, not just the protein"], moduleIds: ["mv-strength-b", "nu-plate", "sl-reset", "hr-bone-muscle"] },
      { week: 10, phase: "Consolidate", focus: ["Consolidate the habits that held", "Prepare doctor questions on the transition"], moduleIds: ["mv-strength-b", "nu-plate", "hr-perimenopause", "bh-if-then"] },
      { week: 11, phase: "Consolidate", focus: ["Hold the plan through a travel week", "If-then plan for missed sessions"], moduleIds: ["mv-strength-b", "nu-plate", "bh-if-then"] },
      { week: 12, phase: "Consolidate", focus: ["Review what held without daily coaching"], moduleIds: ["mv-strength-b", "nu-plate", "sl-reset", "bh-if-then"] },
    ],
  },
  {
    id: "megha",
    name: "Megha Sharma",
    age: 41,
    city: "Gurugram",
    initials: "MS",
    week: 1,
    phase: "Stabilise",
    lifeStage: "Cycle regular — tracking for baseline",
    goals: ["Build a habit that survives a bad week", "Understand what strength training actually is"],
    constraints: ["Works till 8pm most days", "Prefers mornings"],
    wontDo: "I will not do anything that needs me to be at a gym at 6am.",
    medical: [],
    medications: [],
    engagement: "strong",
    weeklyFocus: ["Show up three times, any duration"],
    activeModuleIds: ["mv-walk-base", "mv-mobility-10", "bh-if-then"],
    bodyComp: [
      { label: "Weight", value: "63.2 kg", at: "Week 1", provenance: p("member_manual", "Megha", "2026-08-03") },
    ],
    assessmentComplete: 100,
  },
  {
    id: "anita",
    name: "Anita Deshpande",
    age: 47,
    city: "Pune",
    initials: "AD",
    week: 7,
    phase: "Build",
    lifeStage: "Perimenopause — hot flushes most nights",
    goals: ["Get my strength back after two years of nothing", "Stop waking at 3am"],
    constraints: ["Caring for her mother — unpredictable evenings"],
    wontDo: "I will not do early mornings. That is my mother's time.",
    medical: ["Hypothyroidism — on treatment", "Perimenopausal night sweats"],
    medications: ["Thyroxine 75mcg"],
    engagement: "quiet",
    weeklyFocus: ["Anything at all — we are restarting gently"],
    activeModuleIds: ["mv-strength-a", "sl-winddown", "bh-comeback"],
    bodyComp: [
      { label: "Weight", value: "71.4 kg", at: "Week 5", provenance: p("member_manual", "Anita", "2026-07-20") },
    ],
    assessmentComplete: 70,
  },
  {
    id: "shreya",
    name: "Shreya Iyer",
    age: 39,
    city: "Mumbai",
    initials: "SI",
    week: 3,
    phase: "Stabilise",
    lifeStage: "Cycle regular — heavy, painful periods",
    goals: ["More energy for my kids on weekends", "Understand my own body for once"],
    constraints: ["Long commute", "Vegetarian — protein is the hard part"],
    wontDo: "I will not eat eggs. Please stop suggesting eggs.",
    medical: ["Low ferritin (2026 panel) — GP following up"],
    medications: ["Iron supplement — prescribed by GP"],
    engagement: "steady",
    weeklyFocus: ["Protein at two meals a day", "One strength session"],
    activeModuleIds: ["nu-protein", "nu-plate", "mv-strength-a"],
    bodyComp: [],
    assessmentComplete: 90,
  },
  {
    id: "nidhi",
    name: "Nidhi Kapoor",
    age: 49,
    city: "Delhi",
    initials: "NK",
    week: 9,
    phase: "Build",
    lifeStage: "Postmenopause — final period 18 months ago",
    goals: ["Protect my bones — my mother had a hip fracture at 68", "Lift heavier than I ever have"],
    constraints: ["Weekend travel for work"],
    wontDo: "I will not go back to eating 1,200 calories a day. I did that for twenty years.",
    medical: ["Family history of osteoporosis"],
    medications: [],
    engagement: "strong",
    weeklyFocus: ["Progress the goblet squat load", "Keep the 3am wake-up log going"],
    activeModuleIds: ["mv-strength-b", "hr-bone-muscle", "nu-protein"],
    bodyComp: [
      { label: "Weight", value: "64.8 kg", at: "Week 8", provenance: p("member_manual", "Nidhi", "2026-08-01") },
      { label: "Goblet squat", value: "16 kg × 8", at: "Week 8", provenance: p("coach_on_behalf", "Deepika", "2026-08-01") },
    ],
    assessmentComplete: 100,
  },
  {
    id: "priya",
    name: "Priya Raghavan",
    age: 43,
    city: "Chennai",
    initials: "PR",
    week: 6,
    phase: "Stabilise",
    lifeStage: "Perimenopause — sleep disruption is the main symptom",
    goals: ["Not abandon this the way I abandoned everything else"],
    constraints: ["Single parent", "Works shifts"],
    wontDo: "I will not pretend I can plan a whole week in advance.",
    medical: [],
    medications: [],
    engagement: "steady",
    weeklyFocus: ["Return gently — one action a day is a full week"],
    activeModuleIds: ["bh-comeback", "mv-walk-base", "bh-minimum-day"],
    bodyComp: [],
    assessmentComplete: 60,
  },
];

/* ------------------------------------------------------------------ */
/* Module library — Deepika's IP layer                                 */
/* ------------------------------------------------------------------ */

export const modules: CoachModule[] = [
  {
    id: "mv-strength-a",
    name: "Strength Foundations",
    category: "movement",
    version: "1.2",
    status: "active",
    purpose:
      "Build the first genuine strength base — hinge, squat, push, carry — in someone who has never trained.",
    betterLooksLike:
      "She can do a bodyweight sit-to-stand for 10 reps without using her hands, and knows what a hinge feels like.",
    eligibility:
      "Cleared movement screen. No acute back or knee pain. Has had at least two supervised sessions.",
    keyIdeas: [
      "Strength is a skill before it is an effort — technique first, load later.",
      "Muscle mass declines from the late thirties. Resistance work is the direct intervention.",
      "Soreness is not the goal and is not a measure of a good session.",
    ],
    minimum: { label: "One round, no added weight", minutes: 12 },
    target: { label: "Two rounds as written", minutes: 25 },
    stretch: { label: "Three rounds, add load where it felt easy", minutes: 40 },
    tracking: "Completion level, RPE, load per exercise, pain flag.",
    coachPlaybook: {
      ask: [
        "Which exercise did you feel most unsure about?",
        "Where did you feel it the next day?",
        "Did anything hurt — as opposed to being hard?",
      ],
      barriers: [
        "Fear of injury from lifting",
        "Not knowing what 'heavy enough' means",
        "Believing 25 minutes is not worth doing",
      ],
      escalation:
        "Any pain that is sharp, one-sided, or persists past 48 hours — stop the module and refer to a physiotherapist.",
    },
    notificationTemplates: [
      "Your strength session is on the plan today. The 12-minute version is already written if the day runs over.",
      "Two rounds is the plan, one round is a win.",
    ],
    progression:
      "Progress load when RPE sits at or below 6 for two consecutive sessions with clean technique.",
    reviewNote: "Exercise selection is Deepika's professional decision. Not clinically reviewed.",
    reviewedOn: "2026-07-30",
  },
  {
    id: "mv-strength-b",
    name: "Balance & Carry",
    category: "movement",
    version: "1.1",
    status: "active",
    purpose: "Second strength template — adds unilateral work and loaded carries.",
    betterLooksLike: "She can carry shopping in one hand for 40m without setting it down.",
    eligibility: "Completed at least four weeks of Foundations with stable technique.",
    keyIdeas: [
      "Single-leg work protects balance, which protects against falls later.",
      "Carries build grip and trunk strength at the same time.",
    ],
    minimum: { label: "Carries and squats only", minutes: 15 },
    target: { label: "Full session as written", minutes: 30 },
    stretch: { label: "Full session, progress load on two lifts", minutes: 45 },
    tracking: "Completion level, RPE, load, pain flag.",
    coachPlaybook: {
      ask: ["Which side felt weaker?", "Could you hold the carry without shrugging?"],
      barriers: ["Balance confidence", "Grip gives out before legs do"],
      escalation: "Any knee pain during single-leg work — regress to supported version, review in person.",
    },
    notificationTemplates: ["Balance & Carry today. Start with the carries if you are short on time."],
    progression: "Add load when both sides complete the prescribed reps at RPE 7 or below.",
    reviewedOn: "2026-07-30",
  },
  {
    id: "mv-mobility-10",
    name: "10-minute Mobility",
    category: "movement",
    version: "1.0",
    status: "active",
    purpose: "A movement floor that is always achievable, including on the worst days.",
    betterLooksLike: "On a bad day she still does something, and the week does not collapse.",
    eligibility: "Anyone, any week, any phase.",
    keyIdeas: [
      "The purpose of this module is continuity, not adaptation.",
      "Doing it badly on a bad day is the entire point.",
    ],
    minimum: { label: "Three movements", minutes: 4 },
    target: { label: "Full sequence", minutes: 10 },
    stretch: { label: "Full sequence plus a walk", minutes: 25 },
    tracking: "Completion level only. No RPE.",
    coachPlaybook: {
      ask: ["What made today hard?"],
      barriers: ["Believing 4 minutes is pointless"],
      escalation: "None.",
    },
    notificationTemplates: [
      "Today has only one non-negotiable: 10 minutes of mobility. Everything else is bonus.",
    ],
    progression: "This module does not progress. It is the floor.",
  },
  {
    id: "mv-walk-base",
    name: "Walking Base",
    category: "movement",
    version: "1.0",
    status: "active",
    purpose: "Establish daily movement volume before adding structured training.",
    betterLooksLike: "Walking is no longer a decision, it is just something she does after dinner.",
    eligibility: "Weeks 1–4, or as a rebuild after a lapse.",
    keyIdeas: [
      "Attaching a walk to an existing habit works better than scheduling it.",
      "After-dinner walking helps blood glucose more than the same walk earlier.",
    ],
    minimum: { label: "10 minutes, any time", minutes: 10 },
    target: { label: "20 minutes after dinner", minutes: 20 },
    stretch: { label: "35 minutes, brisk", minutes: 35 },
    tracking: "Completion level; steps if a device is connected.",
    coachPlaybook: {
      ask: ["What time of day actually worked?"],
      barriers: ["Weather", "Not safe to walk after dark in her area"],
      escalation: "None.",
    },
    notificationTemplates: ["A 10-minute walk after dinner counts as the whole thing."],
    progression: "Move to Foundations once walking has held for two weeks.",
  },
  {
    id: "nu-protein",
    name: "Protein Basics",
    category: "nutrition",
    version: "1.3",
    status: "active",
    purpose:
      "Raise protein at the two meals she already eats, without introducing tracking or restriction.",
    betterLooksLike:
      "She can look at a plate and say whether there is protein on it. No weighing, no logging.",
    eligibility:
      "Anyone. Adapt for vegetarian and Jain diets. Not for members with a history of disordered eating without prior discussion.",
    keyIdeas: [
      "Protein needs rise in midlife, not fall.",
      "Most Indian breakfasts are the easiest meal to fix.",
      "Dal, paneer, curd, soya and legumes carry this — meat is not required.",
    ],
    minimum: { label: "Protein at one meal", minutes: 0 },
    target: { label: "Protein at two meals", minutes: 0 },
    stretch: { label: "Protein at every meal", minutes: 0 },
    tracking: "Self-reported meals with protein. No calorie logging in V0.",
    coachPlaybook: {
      ask: ["What did breakfast look like this week?", "Which meal is hardest?"],
      barriers: ["Vegetarian protein feels repetitive", "Cooks separately for family"],
      escalation:
        "Specific gram targets, therapeutic diets or any suspicion of disordered eating — refer to a registered dietitian.",
    },
    notificationTemplates: ["One protein at breakfast changes the whole day. That is the only ask."],
    progression: "Move to Plate Structure once two meals hold for ten days.",
    reviewNote:
      "General nutrition education only. Individualised prescription is outside health-coach scope — refer to an RD.",
    reviewedOn: "2026-08-02",
  },
  {
    id: "nu-plate",
    name: "Plate Structure",
    category: "nutrition",
    version: "1.0",
    status: "active",
    purpose: "A visual rule for building a meal without measuring anything.",
    betterLooksLike: "She builds the plate without thinking about it.",
    eligibility: "After Protein Basics is stable.",
    keyIdeas: ["Half the plate vegetables, a quarter protein, a quarter grain.", "Order of eating matters less than composition."],
    minimum: { label: "One meal built this way", minutes: 0 },
    target: { label: "Two meals built this way", minutes: 0 },
    stretch: { label: "Most meals, including when eating out", minutes: 0 },
    tracking: "Self-report only.",
    coachPlaybook: {
      ask: ["Which meal is easiest to build this way?"],
      barriers: ["Family eats differently", "Restaurant meals"],
      escalation: "Refer to an RD for any therapeutic requirement.",
    },
    notificationTemplates: ["Half the plate vegetables. That is the whole rule."],
    progression: "Introduce Eating Out once home meals are consistent.",
    reviewNote: "General education only.",
  },
  {
    id: "sl-reset",
    name: "Sleep Reset Week",
    category: "sleep",
    version: "1.1",
    status: "active",
    purpose: "Stabilise sleep timing before attempting to improve sleep quality.",
    betterLooksLike: "Wake time is within a 45-minute band, including weekends.",
    eligibility: "Self-reported sleep 2 or below for three or more days.",
    keyIdeas: [
      "A consistent wake time does more than a consistent bedtime.",
      "Night waking in perimenopause is common and is not a personal failure.",
      "Morning light is the strongest available lever and it is free.",
    ],
    minimum: { label: "Same wake time, one day", minutes: 0 },
    target: { label: "Same wake time, five days", minutes: 0 },
    stretch: { label: "Same wake time all week plus morning light", minutes: 0 },
    tracking: "Daily Pulse sleep rating; wake time if a device is connected.",
    coachPlaybook: {
      ask: [
        "What time did you actually wake, not what time did you plan to?",
        "Are you waking hot, or waking anxious? They need different responses.",
      ],
      barriers: ["Night waking with flushes", "Shift work", "Caregiving at night"],
      escalation:
        "Suspected sleep apnoea, severe insomnia, or flushes disrupting sleep nightly — refer to a physician. Do not advise on hormone therapy.",
    },
    notificationTemplates: [
      "A low-sleep night does not cancel the day. Deepika has kept today lighter.",
    ],
    progression: "Move to Evening Wind-down once wake time is stable.",
    reviewNote:
      "Educational. Sleep disorders and menopausal symptom treatment require medical referral.",
    reviewedOn: "2026-08-02",
  },
  {
    id: "sl-winddown",
    name: "Evening Wind-down",
    category: "sleep",
    version: "1.0",
    status: "active",
    purpose: "Create a repeatable 20-minute signal that the day has ended.",
    betterLooksLike: "There is a boundary between the day and the night.",
    eligibility: "After wake time has stabilised.",
    keyIdeas: ["Consistency of the cue matters more than what the cue is."],
    minimum: { label: "Lights down, 5 minutes", minutes: 5 },
    target: { label: "Full 20-minute wind-down", minutes: 20 },
    stretch: { label: "Wind-down plus no screens for the last 30 minutes", minutes: 30 },
    tracking: "Self-report.",
    coachPlaybook: {
      ask: ["What is realistically the last thing you do at night?"],
      barriers: ["Only quiet time she gets is late at night"],
      escalation: "Refer if insomnia persists beyond four weeks.",
    },
    notificationTemplates: ["Five minutes with the lights down still counts."],
    progression: "Hold indefinitely.",
  },
  {
    id: "hr-perimenopause",
    name: "Understanding Perimenopause",
    category: "hormonal",
    version: "1.2",
    status: "active",
    purpose:
      "Replace Instagram-level understanding with an accurate picture of what is happening and why.",
    betterLooksLike:
      "She can describe the transition in her own words and no longer thinks something is wrong with her.",
    eligibility: "Any member in or approaching the transition.",
    keyIdeas: [
      "Perimenopause can run for several years before periods stop.",
      "Symptoms fluctuate because hormone levels fluctuate — this is why one week feels fine and the next does not.",
      "A single blood test rarely diagnoses this. Symptom pattern over time matters more.",
      "Treatment decisions, including hormone therapy, belong with a doctor.",
    ],
    minimum: { label: "Read the summary", minutes: 4 },
    target: { label: "Read and note your own symptom pattern", minutes: 10 },
    stretch: { label: "Prepare questions for your doctor", minutes: 20 },
    tracking: "Marked understood; questions saved for the 1:1.",
    coachPlaybook: {
      ask: ["What have you been told about this so far, and by whom?"],
      barriers: ["Shame", "Family dismissiveness", "Fear of hormone therapy"],
      escalation:
        "Any question about starting, stopping or dosing hormone therapy goes to a physician. Coach does not advise.",
    },
    notificationTemplates: ["A four-minute read that will make your next doctor visit much more useful."],
    progression: "Follow with Preparing Questions for Your Doctor.",
    reviewNote:
      "EDUCATION ONLY. This module must never infer a hormonal state from age, symptoms or a lab value.",
    reviewedOn: "2026-08-05",
  },
  {
    id: "hr-bone-muscle",
    name: "Bone & Muscle Health",
    category: "hormonal",
    version: "1.0",
    status: "active",
    purpose: "Explain why strength and loading matter more now than they did at thirty.",
    betterLooksLike: "She understands why she is lifting, so she keeps lifting.",
    eligibility: "Peri and postmenopausal members.",
    keyIdeas: [
      "Bone responds to load. Walking alone is not enough loading.",
      "Muscle is protective for far more than appearance.",
    ],
    minimum: { label: "Read the summary", minutes: 4 },
    target: { label: "Read and connect it to your own plan", minutes: 10 },
    stretch: { label: "Prepare bone-health questions for your doctor", minutes: 20 },
    tracking: "Marked understood.",
    coachPlaybook: {
      ask: ["Is there fracture or osteoporosis history in your family?"],
      barriers: ["Belief that lifting is unsafe at this age"],
      escalation: "Known osteoporosis or prior fragility fracture — medical clearance before loading.",
    },
    notificationTemplates: ["Four minutes on why we are lifting, not just walking."],
    progression: "Pairs with Balance & Carry.",
    reviewNote: "Education only. Screening and diagnosis are medical decisions.",
    reviewedOn: "2026-08-05",
  },
  {
    id: "hr-doctor-questions",
    name: "Preparing Questions for Your Doctor",
    category: "hormonal",
    version: "1.0",
    status: "active",
    purpose: "Turn a symptom log into a productive ten-minute consultation.",
    betterLooksLike: "She walks into the appointment with a written pattern, not a vague complaint.",
    eligibility: "Any member with symptoms needing medical input.",
    keyIdeas: [
      "Take a pattern, not a feeling — how often, how long, how disruptive.",
      "Write the questions down beforehand. Consultations are short.",
    ],
    minimum: { label: "Note your top symptom", minutes: 3 },
    target: { label: "Build the full question list", minutes: 12 },
    stretch: { label: "Question list plus symptom summary to print", minutes: 20 },
    tracking: "Question list generated.",
    coachPlaybook: {
      ask: ["What do you most want them to take seriously?"],
      barriers: ["Being dismissed previously", "Not wanting to seem difficult"],
      escalation: "This module IS the referral pathway. Use it whenever a question exceeds coaching scope.",
    },
    notificationTemplates: ["Your appointment is Thursday. Ten minutes now will make it count."],
    progression: "Use before each medical appointment.",
    reviewNote: "Referral support tool.",
  },
  {
    id: "bh-minimum-day",
    name: "Minimum Day",
    category: "behaviour",
    version: "1.1",
    status: "active",
    purpose: "Give the member a pre-agreed plan for the days when the plan will not happen.",
    betterLooksLike:
      "A bad day produces a 10-minute action instead of a three-day disappearance.",
    eligibility: "Everyone. Assign in week one, before it is needed.",
    keyIdeas: [
      "Deciding in advance beats deciding in the moment.",
      "Missing one day predicts nothing. Missing three predicts a lot.",
    ],
    minimum: { label: "Name your Minimum Day action", minutes: 2 },
    target: { label: "Use it once this week", minutes: 10 },
    stretch: { label: "Use it and note what triggered it", minutes: 15 },
    tracking: "Minimum-level completions; comeback events.",
    coachPlaybook: {
      ask: ["What is the smallest thing you would still do on your worst day?"],
      barriers: ["Feeling that the minimum is not worth doing"],
      escalation: "None.",
    },
    notificationTemplates: ["Today can be a Minimum Day. Your 10-minute version is already waiting."],
    progression: "Permanent. This module never retires.",
  },
  {
    id: "bh-if-then",
    name: "If-Then Planning",
    category: "behaviour",
    version: "1.0",
    status: "active",
    purpose: "Attach the intended behaviour to a specific cue and time.",
    betterLooksLike: "'I will walk after dinner' replaces 'I will walk more'.",
    eligibility: "Week 1–2 for everyone.",
    keyIdeas: [
      "Specify when and where, not how much.",
      "Attach the new behaviour to something that already happens reliably.",
    ],
    minimum: { label: "Write one if-then", minutes: 3 },
    target: { label: "Write one and use it three times", minutes: 10 },
    stretch: { label: "Write a backup if-then for disrupted days", minutes: 15 },
    tracking: "Plan text saved; adherence on cued days.",
    coachPlaybook: {
      ask: ["What already happens at the same time every day?"],
      barriers: ["No reliable anchor in the day"],
      escalation: "None.",
    },
    notificationTemplates: ["Your plan says: after dinner, shoes on. That is the whole thing."],
    progression: "Revisit whenever the routine changes.",
  },
  {
    id: "bh-comeback",
    name: "Comeback Week",
    category: "behaviour",
    version: "1.2",
    status: "active",
    purpose: "Make returning after a gap structurally easy and emotionally uncharged.",
    betterLooksLike: "She comes back in two days instead of not at all.",
    eligibility: "Assign after three or more inactive days.",
    keyIdeas: [
      "Nothing resets. Progress is cumulative, not consecutive.",
      "The week is deliberately smaller than the one before it.",
    ],
    minimum: { label: "One action, any day", minutes: 10 },
    target: { label: "Three actions across the week", minutes: 30 },
    stretch: { label: "Return to the previous plan", minutes: 60 },
    tracking: "Comeback detected; days to return.",
    coachPlaybook: {
      ask: [
        "What made it possible to come back today?",
        "What would have made it possible two days earlier?",
      ],
      barriers: ["Shame about the gap", "Believing she has to start over"],
      escalation: "None. Never escalate a lapse.",
    },
    notificationTemplates: ["Good to see you. Nothing reset — we are continuing from here."],
    progression: "Return to the prior plan when three actions land in one week.",
  },
];

/* ------------------------------------------------------------------ */
/* Workouts                                                            */
/* ------------------------------------------------------------------ */

export const workouts: Workout[] = [
  {
    id: "wk-strength-a",
    name: "Foundations",
    intent: "Hinge, squat, push, carry. Technique before load.",
    warmup: ["Cat-cow × 8", "Glute bridge × 10", "Wall slides × 10"],
    exercises: [
      {
        name: "Goblet squat",
        prescription: "3 × 8",
        cue: "Elbows inside the knees. Sit down between the hips, not backwards.",
        figure: "goblet-squat",
        setup: [
          "Feet a little wider than your hips, toes turned slightly out.",
          "Hold one weight against your chest, elbows tucked down.",
        ],
        execute: [
          "Take a breath in and sit down between your hips, as if lowering onto a low stool.",
          "Let your knees travel forward over your toes — that is meant to happen.",
          "Go as low as you can while your back stays long, then drive up through the whole foot.",
        ],
        watchFor: [
          "Heels lifting off the floor. Widen your stance slightly if they do.",
          "Knees falling inward as you stand up — think about pushing them gently apart.",
          "Rounding at the very bottom. Stop a few centimetres higher instead.",
        ],
        feelItIn: "Thighs and glutes. Not your lower back.",
        easier: "Sit onto a chair and stand back up, no weight at all.",
      },
      {
        name: "Hip hinge with dowel",
        prescription: "3 × 10",
        cue: "Three points of contact on the dowel. Push the hips back, not down.",
        figure: "hip-hinge",
        setup: [
          "Hold a broom handle along your spine, touching the back of your head, between your shoulder blades, and your tailbone.",
          "Feet hip-width, knees softly unlocked.",
        ],
        execute: [
          "Push your hips backwards towards the wall behind you, letting your chest travel forward.",
          "Keep all three contact points on the handle the whole way.",
          "Go until you feel a stretch behind your thighs, then squeeze your glutes to stand tall.",
        ],
        watchFor: [
          "The handle lifting off your lower back — that is rounding, and it is the thing to fix.",
          "Turning it into a squat by bending the knees. Hips go back, not down.",
        ],
        feelItIn: "Behind your thighs. This is the pattern every deadlift is built on.",
        easier: "Stand an arm's length from a wall and tap it with your hips.",
      },
      {
        name: "Incline push-up",
        prescription: "3 × 6–10",
        cue: "Higher surface is not easier cheating. It is the right load for now.",
        figure: "incline-push-up",
        setup: [
          "Hands on a kitchen counter or the back of a sturdy sofa, slightly wider than your shoulders.",
          "Walk your feet back until your body is one straight line.",
        ],
        execute: [
          "Lower your chest towards the surface, elbows pointing back at roughly 45°, not straight out sideways.",
          "Touch lightly, then push the surface away from you.",
        ],
        watchFor: [
          "Hips sagging or lifting — squeeze your glutes to hold the line.",
          "Head dropping forward before the chest does.",
        ],
        feelItIn: "Chest, shoulders and the back of your arms.",
        easier: "Use a higher surface. A wall is a completely legitimate starting point.",
      },
      {
        name: "Suitcase carry",
        prescription: "3 × 30m per side",
        cue: "Do not lean away from the weight. Ribs stacked over hips.",
        figure: "suitcase-carry",
        setup: [
          "One weight in one hand, hanging by your side, like carrying a heavy bag.",
          "Stand tall, shoulders level.",
        ],
        execute: [
          "Walk in a straight line, resisting the pull to one side.",
          "Keep your shoulders level and your ribs stacked over your hips.",
          "Set it down, swap hands, walk back.",
        ],
        watchFor: [
          "Leaning away from the weight to counterbalance — the whole point is not to.",
          "Shrugging the loaded shoulder up towards your ear.",
        ],
        feelItIn: "The side of your torso opposite the weight, and your grip.",
        easier: "Shorter distance, or a lighter bag. Distance before load.",
      },
    ],
    minimum: { label: "One round, bodyweight only", minutes: 12 },
    target: { label: "Two rounds as written", minutes: 25 },
    stretch: { label: "Three rounds, add load where it felt easy", minutes: 40 },
    supervision: "independent",
    stopGuidance:
      "Stop if you feel sharp pain, pain on one side only, or anything in your back that makes you catch your breath. Flag it and I will look at it before the next session.",
  },
  {
    id: "wk-strength-b",
    name: "Balance & Carry",
    intent: "Single-leg work and loaded carries. Balance and grip.",
    warmup: ["Ankle rocks × 10", "Single-leg balance 20s per side", "Band pull-apart × 12"],
    exercises: [
      {
        name: "Split squat (supported)",
        prescription: "3 × 6 per side",
        cue: "Back knee down, not forward. Hold the chair as long as you need.",
        figure: "split-squat",
        setup: [
          "Stand in a long stride, one foot forward, one back, about hip-width apart side to side.",
          "Rest one hand on a chair or wall. Using it is not cheating.",
        ],
        execute: [
          "Lower straight down, dropping the back knee towards the floor.",
          "Stop just before the knee touches, then drive up through the front heel.",
        ],
        watchFor: [
          "Drifting forward instead of down — the movement is vertical.",
          "Front knee collapsing inward.",
          "Feet too close together front to back, which makes balance the limiting factor rather than strength.",
        ],
        feelItIn: "Front thigh and glute. Some stretch at the front of the back hip.",
        easier: "Hold the chair with both hands, and shorten the range.",
      },
      {
        name: "Romanian deadlift",
        prescription: "3 × 8",
        cue: "Weight stays close to the legs the whole way down.",
        figure: "romanian-deadlift",
        setup: [
          "Weights in both hands, resting against the front of your thighs.",
          "Feet hip-width, knees softly unlocked.",
        ],
        execute: [
          "Push your hips back and let the weights slide down your thighs, staying in contact.",
          "Lower until you feel a strong stretch behind your thighs, usually around shin height.",
          "Squeeze your glutes to stand tall — do not lean back at the top.",
        ],
        watchFor: [
          "Weights drifting away from your legs, which is what turns this into back strain.",
          "Rounding the upper back. Stop higher instead.",
          "Bending the knees more as you go down — this is the hinge, not a squat.",
        ],
        feelItIn: "Behind your thighs, strongly. Glutes at the top.",
        easier: "No weight at all, hands sliding down your own thighs.",
      },
      {
        name: "Half-kneeling press",
        prescription: "3 × 8 per side",
        cue: "Squeeze the back glute. Ribs down.",
        figure: "half-kneeling-press",
        setup: [
          "Kneel on one knee, the other foot planted in front, both at right angles.",
          "Weight in the hand on the same side as the down knee.",
          "Put a cushion under the knee if the floor is hard.",
        ],
        execute: [
          "Squeeze the glute of the kneeling leg so your hips sit under your ribs.",
          "Press the weight straight overhead until your arm is by your ear.",
          "Lower under control to your shoulder.",
        ],
        watchFor: [
          "Ribs flaring and the lower back arching as you press — that is the arch doing the work instead of the shoulder.",
          "Leaning sideways to get the weight up.",
        ],
        feelItIn: "Shoulder and upper back. The kneeling glute should be working quietly.",
        easier: "Press with no weight, or use a lighter object, and focus on the ribs-down position.",
      },
      {
        name: "Farmer carry",
        prescription: "3 × 40m",
        cue: "Walk tall. Put it down before your form goes.",
        figure: "farmer-carry",
        setup: ["A weight in each hand, hanging by your sides.", "Stand tall, chest open."],
        execute: [
          "Walk in a straight line at a normal pace.",
          "Breathe normally — holding your breath is a sign the load is too heavy.",
          "Put them down the moment your posture starts to sag.",
        ],
        watchFor: [
          "Shoulders creeping up towards your ears.",
          "Leaning back to counterbalance.",
        ],
        feelItIn: "Grip, shoulders and the whole trunk holding you upright.",
        easier: "Two shopping bags, shorter distance. This one scales to whatever you have.",
      },
    ],
    minimum: { label: "Carries and squats only", minutes: 15 },
    target: { label: "Full session as written", minutes: 30 },
    stretch: { label: "Full session, progress load on two lifts", minutes: 45 },
    supervision: "check-in",
    stopGuidance: "Any knee pain in the split squat — stop, use the supported version, and tell me.",
  },
  {
    id: "wk-mobility",
    name: "10-minute Mobility",
    intent: "The floor. Always achievable.",
    warmup: [],
    exercises: [
      {
        name: "Cat-cow",
        prescription: "10 slow",
        cue: "Move with the breath, not against it.",
        figure: "cat-cow",
        setup: ["On hands and knees. Hands under shoulders, knees under hips."],
        execute: [
          "Breathe out and round your back towards the ceiling, tucking your chin.",
          "Breathe in and let your belly drop, lifting your chest and tailbone.",
          "Move slowly enough that the breath sets the pace.",
        ],
        watchFor: ["Rushing. This is the one movement where slower is strictly better."],
        feelItIn: "The whole length of your spine, gently.",
        easier: "Do the same shape seated on a chair, hands on your knees.",
      },
      {
        name: "90/90 hip switch",
        prescription: "8 per side",
        cue: "Go only as far as is comfortable.",
        figure: "hip-switch",
        setup: [
          "Sit on the floor, one leg bent in front of you, one bent out to the side — both at roughly right angles.",
          "Hands behind you for support.",
        ],
        execute: [
          "Lift both knees and rotate them over to the other side, swapping which leg is in front.",
          "Sit tall for a moment, then switch back.",
        ],
        watchFor: [
          "Forcing the range. Hips vary enormously and this is not a flexibility contest.",
          "Any pinching at the front of the hip — reduce how far you rotate.",
        ],
        feelItIn: "Deep in the hips, as a stretch rather than a strain.",
        easier: "Sit on a cushion so your hips are higher than your knees.",
      },
      {
        name: "Thoracic opener",
        prescription: "8 per side",
        cue: "Follow your hand with your eyes.",
        figure: "thoracic-opener",
        setup: [
          "Lie on your side, knees bent up towards your chest, arms stretched out in front, palms together.",
        ],
        execute: [
          "Slide the top hand along the bottom one, then sweep it in a wide arc across your body and open towards the floor behind you.",
          "Let your eyes and head follow your hand.",
          "Keep your knees stacked and on the floor.",
        ],
        watchFor: ["Knees lifting and rolling — the movement should come from your upper back."],
        feelItIn: "Across your chest and through the middle of your back.",
        easier: "Smaller arc. Getting halfway is still worth doing.",
      },
      {
        name: "Standing calf and hamstring",
        prescription: "30s each",
        cue: "Breathe out into the stretch.",
        figure: "standing-stretch",
        setup: ["Stand near a wall or chair. Step one foot forward, heel on the floor, toes up."],
        execute: [
          "Keeping the front leg straight, hinge at the hips until you feel a stretch behind the front thigh.",
          "Hold and breathe out slowly.",
          "Then step back, press that heel down with the knee straight for the calf.",
        ],
        watchFor: ["Rounding your back to reach further — hinge at the hip instead."],
        feelItIn: "Behind the thigh, then behind the lower leg.",
        easier: "Rest the front heel on a low step rather than the floor.",
      },
    ],
    minimum: { label: "Any three movements", minutes: 4 },
    target: { label: "Full sequence", minutes: 10 },
    stretch: { label: "Full sequence plus a walk", minutes: 25 },
    supervision: "independent",
    stopGuidance: "Nothing here should hurt. If it does, skip that movement.",
  },
];

/* ------------------------------------------------------------------ */
/* Daily actions — the member's actual plan                            */
/* ------------------------------------------------------------------ */

export const dailyActions: DailyAction[] = [
  // Radhika — today (plan already softened by Deepika)
  {
    id: "a-rad-1",
    memberId: "radhika",
    dayOffset: 0,
    moduleId: "mv-strength-a",
    title: "Foundations",
    why: "You have had three low-energy days. This is the shortened version — one round, no added weight.",
    minimum: { label: "One round, bodyweight only", minutes: 12 },
    target: { label: "Two rounds as written", minutes: 25 },
    stretch: { label: "Three rounds, add load", minutes: 40 },
    completed: null,
    workoutId: "wk-strength-a",
  },
  {
    id: "a-rad-2",
    memberId: "radhika",
    dayOffset: 0,
    moduleId: "nu-protein",
    title: "Protein at lunch",
    why: "Your breakfast has been solid this week. Lunch is the one that keeps slipping on travel days.",
    minimum: { label: "Protein at one meal", minutes: 0 },
    target: { label: "Protein at two meals", minutes: 0 },
    stretch: { label: "Protein at every meal", minutes: 0 },
    completed: null,
  },
  {
    id: "a-rad-3",
    memberId: "radhika",
    dayOffset: 0,
    moduleId: "sl-reset",
    title: "Same wake time tomorrow",
    why: "You are not travelling tonight. This is the easiest night of the week to hold the wake time.",
    minimum: { label: "Within 45 minutes of target", minutes: 0 },
    target: { label: "On target", minutes: 0 },
    stretch: { label: "On target plus 10 minutes of morning light", minutes: 10 },
    completed: null,
  },
  { id: "a-rad-p1", memberId: "radhika", dayOffset: -1, moduleId: "mv-mobility-10", title: "10-minute Mobility", why: "Keeping the floor.", minimum: { label: "Three movements", minutes: 4 }, target: { label: "Full sequence", minutes: 10 }, stretch: { label: "Sequence plus walk", minutes: 25 }, completed: "minimum", provenance: p("member_manual", "Radhika", "2026-08-08") },
  { id: "a-rad-p2", memberId: "radhika", dayOffset: -2, moduleId: "mv-strength-a", title: "Foundations", why: "Planned session.", minimum: { label: "One round", minutes: 12 }, target: { label: "Two rounds", minutes: 25 }, stretch: { label: "Three rounds", minutes: 40 }, completed: "rest", skipReason: "Flight delayed, got home at 11pm", workoutId: "wk-strength-a", provenance: p("member_manual", "Radhika", "2026-08-07") },
  { id: "a-rad-p3", memberId: "radhika", dayOffset: -3, moduleId: "nu-protein", title: "Protein at lunch", why: "Building the habit.", minimum: { label: "One meal", minutes: 0 }, target: { label: "Two meals", minutes: 0 }, stretch: { label: "Every meal", minutes: 0 }, completed: "target", provenance: p("member_manual", "Radhika", "2026-08-06") },
  { id: "a-rad-p4", memberId: "radhika", dayOffset: -4, moduleId: "mv-strength-a", title: "Foundations", why: "Planned session.", minimum: { label: "One round", minutes: 12 }, target: { label: "Two rounds", minutes: 25 }, stretch: { label: "Three rounds", minutes: 40 }, completed: "rest", skipReason: "Too tired", workoutId: "wk-strength-a", provenance: p("member_manual", "Radhika", "2026-08-05") },
  { id: "a-rad-p5", memberId: "radhika", dayOffset: -5, moduleId: "mv-walk-base", title: "Evening walk", why: "After dinner.", minimum: { label: "10 minutes", minutes: 10 }, target: { label: "20 minutes", minutes: 20 }, stretch: { label: "35 minutes", minutes: 35 }, completed: "minimum", provenance: p("member_manual", "Radhika", "2026-08-04") },
  { id: "a-rad-p6", memberId: "radhika", dayOffset: -6, moduleId: "mv-strength-a", title: "Foundations", why: "Planned session.", minimum: { label: "One round", minutes: 12 }, target: { label: "Two rounds", minutes: 25 }, stretch: { label: "Three rounds", minutes: 40 }, completed: "target", workoutId: "wk-strength-a", provenance: p("member_manual", "Radhika", "2026-08-03") },

  // Megha — week 1, doing well
  { id: "a-meg-1", memberId: "megha", dayOffset: 0, moduleId: "mv-walk-base", title: "Walk after dinner", why: "Your if-then plan says: after dinner, shoes on.", minimum: { label: "10 minutes", minutes: 10 }, target: { label: "20 minutes", minutes: 20 }, stretch: { label: "35 minutes brisk", minutes: 35 }, completed: null },
  { id: "a-meg-2", memberId: "megha", dayOffset: 0, moduleId: "mv-mobility-10", title: "10-minute Mobility", why: "Week one is about showing up, not intensity.", minimum: { label: "Three movements", minutes: 4 }, target: { label: "Full sequence", minutes: 10 }, stretch: { label: "Sequence plus walk", minutes: 25 }, completed: "target", provenance: p("member_manual", "Megha", "2026-08-09"), workoutId: "wk-mobility" },
  { id: "a-meg-p1", memberId: "megha", dayOffset: -1, moduleId: "mv-walk-base", title: "Walk after dinner", why: "Cue practice.", minimum: { label: "10 minutes", minutes: 10 }, target: { label: "20 minutes", minutes: 20 }, stretch: { label: "35 minutes", minutes: 35 }, completed: "stretch", provenance: p("member_manual", "Megha", "2026-08-08") },
  { id: "a-meg-p2", memberId: "megha", dayOffset: -2, moduleId: "mv-mobility-10", title: "10-minute Mobility", why: "Floor.", minimum: { label: "Three movements", minutes: 4 }, target: { label: "Full sequence", minutes: 10 }, stretch: { label: "Plus walk", minutes: 25 }, completed: "target", provenance: p("member_manual", "Megha", "2026-08-07") },
  { id: "a-meg-p3", memberId: "megha", dayOffset: -3, moduleId: "bh-if-then", title: "Write your if-then", why: "Specify when and where.", minimum: { label: "Write one", minutes: 3 }, target: { label: "Write and use ×3", minutes: 10 }, stretch: { label: "Plus a backup plan", minutes: 15 }, completed: "target", provenance: p("member_manual", "Megha", "2026-08-06") },

  // Anita — quiet, mid-lapse
  { id: "a-ani-1", memberId: "anita", dayOffset: 0, moduleId: "bh-comeback", title: "One action, any action", why: "This week is deliberately smaller. Nothing reset.", minimum: { label: "One action", minutes: 10 }, target: { label: "Three actions this week", minutes: 30 }, stretch: { label: "Back to the previous plan", minutes: 60 }, completed: null },
  { id: "a-ani-2", memberId: "anita", dayOffset: 0, moduleId: "sl-winddown", title: "Lights down at 10:30", why: "Your nights have been broken. Start with the boundary, not the sleep itself.", minimum: { label: "Five minutes", minutes: 5 }, target: { label: "Full 20 minutes", minutes: 20 }, stretch: { label: "Plus no screens", minutes: 30 }, completed: null },
  { id: "a-ani-p1", memberId: "anita", dayOffset: -5, moduleId: "mv-strength-a", title: "Foundations", why: "Planned.", minimum: { label: "One round", minutes: 12 }, target: { label: "Two rounds", minutes: 25 }, stretch: { label: "Three rounds", minutes: 40 }, completed: "minimum", provenance: p("member_manual", "Anita", "2026-08-04") },

  // Shreya
  { id: "a-shr-1", memberId: "shreya", dayOffset: 0, moduleId: "nu-protein", title: "Protein at breakfast", why: "Breakfast is your easiest win. Curd, chana or paneer — your call.", minimum: { label: "One meal", minutes: 0 }, target: { label: "Two meals", minutes: 0 }, stretch: { label: "Every meal", minutes: 0 }, completed: "target", provenance: p("member_manual", "Shreya", "2026-08-09") },
  { id: "a-shr-2", memberId: "shreya", dayOffset: 0, moduleId: "mv-strength-a", title: "Foundations", why: "Your second independent session. Take it slowly.", minimum: { label: "One round", minutes: 12 }, target: { label: "Two rounds", minutes: 25 }, stretch: { label: "Three rounds", minutes: 40 }, completed: null, workoutId: "wk-strength-a" },
  { id: "a-shr-p1", memberId: "shreya", dayOffset: -1, moduleId: "nu-plate", title: "Build one plate", why: "Half vegetables.", minimum: { label: "One meal", minutes: 0 }, target: { label: "Two meals", minutes: 0 }, stretch: { label: "Most meals", minutes: 0 }, completed: "minimum", provenance: p("member_manual", "Shreya", "2026-08-08") },

  // Nidhi
  { id: "a-nid-1", memberId: "nidhi", dayOffset: 0, moduleId: "mv-strength-b", title: "Balance & Carry", why: "Goblet squat goes to 18kg today if the first set feels like a 6 out of 10.", minimum: { label: "Carries and squats only", minutes: 15 }, target: { label: "Full session", minutes: 30 }, stretch: { label: "Progress load on two lifts", minutes: 45 }, completed: null, workoutId: "wk-strength-b" },
  { id: "a-nid-2", memberId: "nidhi", dayOffset: 0, moduleId: "hr-bone-muscle", title: "Bone & Muscle Health", why: "Given your mother's fracture history, this one matters. Four minutes.", minimum: { label: "Read the summary", minutes: 4 }, target: { label: "Connect it to your plan", minutes: 10 }, stretch: { label: "Prepare doctor questions", minutes: 20 }, completed: null },
  { id: "a-nid-p1", memberId: "nidhi", dayOffset: -2, moduleId: "mv-strength-b", title: "Balance & Carry", why: "Planned.", minimum: { label: "Carries and squats", minutes: 15 }, target: { label: "Full session", minutes: 30 }, stretch: { label: "Progress load", minutes: 45 }, completed: "stretch", provenance: p("member_manual", "Nidhi", "2026-08-07") },

  // Priya — just came back
  { id: "a-pri-p1", memberId: "priya", dayOffset: -5, moduleId: "mv-walk-base", title: "Walk after dinner", why: "Building the cue.", minimum: { label: "10 minutes", minutes: 10 }, target: { label: "20 minutes", minutes: 20 }, stretch: { label: "35 minutes", minutes: 35 }, completed: "target", provenance: p("member_manual", "Priya", "2026-08-04") },
  { id: "a-pri-1", memberId: "priya", dayOffset: 0, moduleId: "mv-walk-base", title: "Walk, any length", why: "You are back. That is the whole task today.", minimum: { label: "10 minutes", minutes: 10 }, target: { label: "20 minutes", minutes: 20 }, stretch: { label: "35 minutes", minutes: 35 }, completed: "minimum", provenance: p("member_manual", "Priya", "2026-08-09") },
  { id: "a-pri-2", memberId: "priya", dayOffset: 0, moduleId: "bh-minimum-day", title: "Name your Minimum Day action", why: "So the next hard week has a plan already written.", minimum: { label: "Name it", minutes: 2 }, target: { label: "Use it once", minutes: 10 }, stretch: { label: "Note what triggered it", minutes: 15 }, completed: null },
];

/* ------------------------------------------------------------------ */
/* Pulse entries                                                       */
/* ------------------------------------------------------------------ */

export const pulses: PulseEntry[] = [
  { id: "p-rad-1", memberId: "radhika", dayOffset: -1, energy: 2, sleep: 2, stress: 2, symptoms: ["Night waking"], note: "Woke at 3 and again at 5.", provenance: p("member_manual", "Radhika", "2026-08-08") },
  { id: "p-rad-2", memberId: "radhika", dayOffset: -2, energy: 2, sleep: 1, stress: 1, symptoms: ["Night waking", "Hot flush"], note: "Travel day. Rough.", provenance: p("member_manual", "Radhika", "2026-08-07") },
  { id: "p-rad-3", memberId: "radhika", dayOffset: -3, energy: 2, sleep: 2, stress: 2, symptoms: [], provenance: p("coach_on_behalf", "Deepika", "2026-08-06") },
  { id: "p-rad-4", memberId: "radhika", dayOffset: -4, energy: 3, sleep: 3, stress: 3, symptoms: [], provenance: p("member_manual", "Radhika", "2026-08-05") },
  { id: "p-rad-5", memberId: "radhika", dayOffset: -5, energy: 3, sleep: 3, stress: 3, symptoms: [], provenance: p("member_manual", "Radhika", "2026-08-04") },
  { id: "p-rad-6", memberId: "radhika", dayOffset: -6, energy: 4, sleep: 4, stress: 4, symptoms: [], provenance: p("member_manual", "Radhika", "2026-08-03") },
  { id: "p-rad-7", memberId: "radhika", dayOffset: -7, energy: 3, sleep: 3, stress: 3, symptoms: [], provenance: p("member_manual", "Radhika", "2026-08-02") },

  { id: "p-meg-1", memberId: "megha", dayOffset: 0, energy: 4, sleep: 4, stress: 4, symptoms: [], provenance: p("member_manual", "Megha", "2026-08-09") },
  { id: "p-meg-2", memberId: "megha", dayOffset: -1, energy: 4, sleep: 4, stress: 4, symptoms: [], provenance: p("member_manual", "Megha", "2026-08-08") },
  { id: "p-meg-3", memberId: "megha", dayOffset: -2, energy: 5, sleep: 4, stress: 5, symptoms: [], provenance: p("member_manual", "Megha", "2026-08-07") },
  { id: "p-meg-4", memberId: "megha", dayOffset: -3, energy: 3, sleep: 3, stress: 3, symptoms: [], provenance: p("member_manual", "Megha", "2026-08-06") },

  { id: "p-ani-1", memberId: "anita", dayOffset: -5, energy: 2, sleep: 2, stress: 2, symptoms: ["Hot flush", "Night waking"], note: "Amma had a bad night.", provenance: p("member_manual", "Anita", "2026-08-04") },

  { id: "p-shr-1", memberId: "shreya", dayOffset: 0, energy: 3, sleep: 3, stress: 3, symptoms: [], provenance: p("member_manual", "Shreya", "2026-08-09") },
  { id: "p-shr-2", memberId: "shreya", dayOffset: -1, energy: 3, sleep: 2, stress: 2, symptoms: ["Heavy bleeding"], provenance: p("member_manual", "Shreya", "2026-08-08") },
  { id: "p-shr-3", memberId: "shreya", dayOffset: -2, energy: 2, sleep: 2, stress: 2, symptoms: ["Cramping"], provenance: p("member_manual", "Shreya", "2026-08-07") },

  { id: "p-nid-1", memberId: "nidhi", dayOffset: 0, energy: 4, sleep: 3, stress: 4, symptoms: ["3am waking"], provenance: p("member_manual", "Nidhi", "2026-08-09") },
  { id: "p-nid-2", memberId: "nidhi", dayOffset: -1, energy: 4, sleep: 3, stress: 4, symptoms: ["3am waking"], provenance: p("member_manual", "Nidhi", "2026-08-08") },
  { id: "p-nid-3", memberId: "nidhi", dayOffset: -2, energy: 5, sleep: 4, stress: 5, symptoms: [], provenance: p("member_manual", "Nidhi", "2026-08-07") },

  { id: "p-pri-1", memberId: "priya", dayOffset: 0, energy: 3, sleep: 3, stress: 3, symptoms: [], note: "Back after a rough stretch.", provenance: p("member_manual", "Priya", "2026-08-09") },
];

export const workoutLogs: WorkoutLog[] = [
  { id: "wl-1", memberId: "radhika", workoutId: "wk-strength-a", dayOffset: -6, completedLevel: "target", rpe: 7, painFlag: false, feltLike: "Hard but fine", provenance: p("member_manual", "Radhika", "2026-08-03") },
  { id: "wl-2", memberId: "nidhi", workoutId: "wk-strength-b", dayOffset: -2, completedLevel: "stretch", rpe: 6, painFlag: false, feltLike: "16kg felt easy", provenance: p("member_manual", "Nidhi", "2026-08-07") },
  { id: "wl-3", memberId: "megha", workoutId: "wk-mobility", dayOffset: 0, completedLevel: "target", rpe: 3, painFlag: false, provenance: p("member_manual", "Megha", "2026-08-09") },
];

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export const messages: Message[] = [
  {
    id: "m-rad-1",
    memberId: "radhika",
    from: "coach",
    kind: "voice",
    body: "Radhika, I looked at your week before you did. Three bad nights in a row is not a discipline problem, it is a sleep problem, and we treat those differently. I have pulled Thursday's session out entirely and made today's the twelve-minute version. Do that one thing and the week is intact. We will talk about the travel pattern on Monday.",
    seconds: 47,
    dayOffset: 0,
    time: "7:12 am",
    read: false,
  },
  {
    id: "m-rad-2",
    memberId: "radhika",
    from: "system",
    kind: "plan_update",
    body: "Deepika changed your week. Thursday's strength session was removed and today's session is now the 12-minute version. Reason: three consecutive low-energy days and poor sleep.",
    dayOffset: -2,
    time: "9:40 pm",
    read: true,
  },
  {
    id: "m-rad-3",
    memberId: "radhika",
    from: "member",
    kind: "text",
    body: "Flight got delayed again, home at 11. I know I keep saying this.",
    dayOffset: -2,
    time: "11:20 pm",
    read: true,
  },
  {
    id: "m-rad-4",
    memberId: "radhika",
    from: "coach",
    kind: "text",
    body: "You are not apologising to me, you are apologising to a plan that did not account for your job. That is my error, not yours. I am rebuilding the travel weeks.",
    dayOffset: -2,
    time: "11:34 pm",
    read: true,
  },
  { id: "m-meg-1", memberId: "megha", from: "coach", kind: "text", body: "Three for three in your first week. I am not going to make a fuss about it, but I did notice.", dayOffset: -1, time: "8:15 pm", read: true },
  { id: "m-ani-1", memberId: "anita", from: "coach", kind: "voice", body: "Anita, no pressure at all in this message. I know your evenings are not yours right now. Whenever you are ready, the week I have written is much smaller than the last one. Nothing has reset.", seconds: 31, dayOffset: -1, time: "6:05 pm", read: false },
  { id: "m-shr-1", memberId: "shreya", from: "member", kind: "text", body: "Question for Monday — my GP mentioned my ferritin again. Should I be changing anything in the plan?", dayOffset: -1, time: "7:50 am", read: false },
  { id: "m-nid-1", memberId: "nidhi", from: "coach", kind: "text", body: "16kg at RPE 6 twice in a row. Go to 18 today if the first set feels the same.", dayOffset: -2, time: "9:00 am", read: true },
  { id: "m-pri-1", memberId: "priya", from: "coach", kind: "text", body: "Good to see you. Nothing reset — we are continuing from here.", dayOffset: 0, time: "10:02 am", read: false },
];

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export const sessions: Session[] = [
  {
    id: "s-rad-1",
    memberId: "radhika",
    type: "1:1 coaching",
    dayOffset: 1,
    time: "6:00 pm",
    mode: "Video",
    status: "scheduled",
    memberQuestions: ["Is it normal to wake at 3am every night now?", "Should I just stop planning sessions on travel weeks?"],
    agenda: [
      "Travel weeks — rebuild the plan around them rather than against them",
      "Sleep pattern: waking hot vs waking anxious",
      "Decide whether to refer for the sleep disruption",
    ],
    commitments: [],
  },
  {
    id: "s-rad-0",
    memberId: "radhika",
    type: "1:1 coaching",
    dayOffset: -6,
    time: "6:00 pm",
    mode: "Video",
    status: "complete",
    memberQuestions: [],
    agenda: ["Week 4 review"],
    privateNotes:
      "Very high self-criticism when describing missed sessions. Watch for all-or-nothing framing. She used the phrase 'I've failed again' twice. Reframed toward Minimum Day. Consider assigning Comeback Week pre-emptively before the next travel block.",
    memberRecap:
      "We agreed the travel weeks need their own smaller plan rather than the same plan you cannot do. Two priorities for next week: protect sleep on the nights you are home, and two strength sessions of any length.",
    commitments: [
      { text: "Name a Minimum Day action before Wednesday", done: true },
      { text: "Two strength sessions, any length", done: false },
    ],
  },
  { id: "s-meg-1", memberId: "megha", type: "Supervised strength", dayOffset: 2, time: "7:30 am", mode: "In person", status: "scheduled", memberQuestions: ["Am I doing the hinge right?"], agenda: ["Technique: hinge and goblet squat", "Introduce load"], commitments: [] },
  { id: "s-shr-1", memberId: "shreya", type: "1:1 coaching", dayOffset: 1, time: "8:00 pm", mode: "Video", status: "scheduled", memberQuestions: ["My GP mentioned ferritin again — does the plan change?"], agenda: ["Vegetarian protein without eggs", "Ferritin question — route to GP, stay in scope"], commitments: [] },
  { id: "s-nid-1", memberId: "nidhi", type: "Supervised strength", dayOffset: 3, time: "6:30 am", mode: "In person", status: "scheduled", memberQuestions: [], agenda: ["Load progression check", "Split squat technique"], commitments: [] },
  { id: "s-ani-1", memberId: "anita", type: "Follow-up", dayOffset: 4, time: "5:00 pm", mode: "Video", status: "scheduled", memberQuestions: [], agenda: ["Low-pressure reconnect", "Rebuild a smaller week"], commitments: [] },
];

export const reflections: WeeklyReflection[] = [
  {
    id: "r-rad-1",
    memberId: "radhika",
    weekOf: "Week 4",
    biggestWin: "I did the mobility thing on the day I got home at midnight.",
    hardestPart: "Travel weeks. I cannot make any of it work when I'm away.",
    feltUnrealistic: "Three strength sessions. It was never going to be three.",
    confidenceNextWeek: 2,
    questions: "Is it normal to wake at 3am every night now?",
    provenance: p("member_manual", "Radhika", "2026-08-03"),
  },
];

/* ------------------------------------------------------------------ */
/* Food library — protein per household serving                        */
/*                                                                     */
/* Values are for food as actually served at home, cooked, in the       */
/* portion an Indian kitchen uses. That distinction matters more than   */
/* it sounds: raw masoor dal is ~25g protein per 100g, but a bowl (katori) of  */
/* homestyle dal is loose and soupy and lands nearer 5g. Quoting the    */
/* raw figure would overstate a typical day by a factor of three or     */
/* four, which is worse than not counting at all.                       */
/*                                                                     */
/* Everything here is a reasonable average, not a precise measurement,  */
/* and the UI says so — every figure is editable by the member.         */
/* Sources: Indian Food Composition Tables (NIN Hyderabad) and standard */
/* bowl-sized (katori) portion references, cross-checked Aug 2026.                   */
/* ------------------------------------------------------------------ */

export const foodItems: FoodItem[] = [
  // Dals and legumes
  { id: "f-dal", name: "Dal (any)", category: "dal", unitLabel: "bowl", proteinPerUnit: 5, common: true },
  { id: "f-rajma", name: "Rajma", category: "dal", unitLabel: "bowl", proteinPerUnit: 7, common: true },
  { id: "f-chole", name: "Chole / chana", category: "dal", unitLabel: "bowl", proteinPerUnit: 7, common: true },
  { id: "f-sambar", name: "Sambar", category: "dal", unitLabel: "bowl", proteinPerUnit: 4 },
  { id: "f-sprouts", name: "Sprouts", category: "dal", unitLabel: "bowl", proteinPerUnit: 7 },
  { id: "f-soya", name: "Soya chunks", category: "dal", unitLabel: "bowl", proteinPerUnit: 18 },

  // Grains
  { id: "f-roti", name: "Roti / chapati", category: "grain", unitLabel: "roti", proteinPerUnit: 3, common: true },
  { id: "f-paratha", name: "Paratha", category: "grain", unitLabel: "paratha", proteinPerUnit: 4 },
  { id: "f-rice", name: "Rice", category: "grain", unitLabel: "bowl", proteinPerUnit: 3, common: true },
  { id: "f-idli", name: "Idli", category: "grain", unitLabel: "idli", proteinPerUnit: 2 },
  { id: "f-dosa", name: "Dosa", category: "grain", unitLabel: "dosa", proteinPerUnit: 4 },
  { id: "f-poha", name: "Poha", category: "grain", unitLabel: "bowl", proteinPerUnit: 3 },
  { id: "f-upma", name: "Upma", category: "grain", unitLabel: "bowl", proteinPerUnit: 4 },
  { id: "f-oats", name: "Oats", category: "grain", unitLabel: "bowl", proteinPerUnit: 5 },
  { id: "f-besan-chilla", name: "Besan chilla", category: "grain", unitLabel: "chilla", proteinPerUnit: 6 },

  // Vegetables
  { id: "f-sabzi", name: "Sabzi (mixed veg)", category: "veg", unitLabel: "bowl", proteinPerUnit: 2, common: true },
  { id: "f-palak", name: "Palak / methi sabzi", category: "veg", unitLabel: "bowl", proteinPerUnit: 3 },
  { id: "f-aloo", name: "Aloo sabzi", category: "veg", unitLabel: "bowl", proteinPerUnit: 2 },
  { id: "f-salad", name: "Salad", category: "veg", unitLabel: "bowl", proteinPerUnit: 1 },

  // Dairy
  { id: "f-curd", name: "Curd / dahi", category: "dairy", unitLabel: "bowl", proteinPerUnit: 4, common: true },
  { id: "f-milk", name: "Milk", category: "dairy", unitLabel: "glass", proteinPerUnit: 6, common: true },
  { id: "f-paneer", name: "Paneer", category: "dairy", unitLabel: "50g (≈4 cubes)", proteinPerUnit: 9, common: true },
  { id: "f-chaas", name: "Buttermilk / chaas", category: "dairy", unitLabel: "glass", proteinPerUnit: 2 },
  { id: "f-tofu", name: "Tofu", category: "dairy", unitLabel: "100g", proteinPerUnit: 12 },

  // Higher-protein
  { id: "f-egg", name: "Egg", category: "protein", unitLabel: "egg", proteinPerUnit: 6, common: true },
  { id: "f-chicken", name: "Chicken", category: "protein", unitLabel: "bowl (≈100g)", proteinPerUnit: 25 },
  { id: "f-fish", name: "Fish", category: "protein", unitLabel: "piece (≈100g)", proteinPerUnit: 22 },
  { id: "f-whey", name: "Protein powder", category: "protein", unitLabel: "scoop", proteinPerUnit: 24 },

  // Snacks
  { id: "f-peanuts", name: "Peanuts", category: "snack", unitLabel: "handful", proteinPerUnit: 8 },
  { id: "f-almonds", name: "Almonds", category: "snack", unitLabel: "10 almonds", proteinPerUnit: 3 },
  { id: "f-makhana", name: "Makhana", category: "snack", unitLabel: "bowl", proteinPerUnit: 3 },
];

/** A day already part-logged, so the screen is not empty on first open. */
export const foodEntries: FoodEntry[] = [
  { id: "fe-1", memberId: "radhika", dayOffset: 0, itemId: "f-curd", name: "Curd / dahi", qty: 1, unitLabel: "bowl", protein: 4, meal: "Breakfast", provenance: p("member_manual", "Radhika", "2026-08-09") },
  { id: "fe-2", memberId: "radhika", dayOffset: 0, itemId: "f-roti", name: "Roti / chapati", qty: 2, unitLabel: "roti", protein: 6, meal: "Breakfast", provenance: p("member_manual", "Radhika", "2026-08-09") },
  { id: "fe-3", memberId: "radhika", dayOffset: -1, itemId: "f-dal", name: "Dal (any)", qty: 1, unitLabel: "bowl", protein: 5, meal: "Lunch", provenance: p("member_manual", "Radhika", "2026-08-08") },
  { id: "fe-4", memberId: "radhika", dayOffset: -1, itemId: "f-paneer", name: "Paneer", qty: 1, unitLabel: "50g (≈4 cubes)", protein: 9, meal: "Dinner", provenance: p("member_manual", "Radhika", "2026-08-08") },
];

/* ------------------------------------------------------------------ */
/* Reports — stored and trended, never interpreted                     */
/* ------------------------------------------------------------------ */

export const reports: Report[] = [
  {
    id: "rep-radhika-1",
    memberId: "radhika",
    kind: "blood_panel",
    title: "Annual health panel",
    collectedOn: "2026-07-06",
    lab: "Neuberg Diagnostics, Bengaluru",
    fileName: "annual-panel-jul-2026.pdf",
    values: [
      { label: "Haemoglobin", value: "12.4", unit: "g/dL" },
      { label: "Ferritin", value: "38", unit: "ng/mL" },
      { label: "Total cholesterol", value: "214", unit: "mg/dL" },
      { label: "LDL", value: "138", unit: "mg/dL" },
      { label: "HDL", value: "52", unit: "mg/dL" },
      { label: "Fasting glucose", value: "97", unit: "mg/dL" },
      { label: "HbA1c", value: "5.6", unit: "%" },
      { label: "TSH", value: "2.8", unit: "mIU/L" },
      { label: "Vitamin D", value: "21", unit: "ng/mL" },
    ],
    provenance: p("imported_document", "Radhika", "2026-07-08"),
    note: "GP has seen this. Follow-up on LDL and vitamin D booked for September.",
  },
  {
    id: "rep-radhika-2",
    memberId: "radhika",
    kind: "blood_panel",
    title: "Previous year's panel",
    collectedOn: "2025-06-18",
    lab: "Neuberg Diagnostics, Bengaluru",
    values: [
      { label: "Haemoglobin", value: "12.1", unit: "g/dL" },
      { label: "Ferritin", value: "31", unit: "ng/mL" },
      { label: "Total cholesterol", value: "228", unit: "mg/dL" },
      { label: "LDL", value: "149", unit: "mg/dL" },
      { label: "HDL", value: "48", unit: "mg/dL" },
      { label: "Fasting glucose", value: "94", unit: "mg/dL" },
      { label: "HbA1c", value: "5.5", unit: "%" },
      { label: "Vitamin D", value: "17", unit: "ng/mL" },
    ],
    provenance: p("imported_document", "Radhika", "2026-07-08"),
  },
  {
    id: "rep-radhika-3",
    memberId: "radhika",
    kind: "body_composition",
    title: "InBody scan — baseline",
    collectedOn: "2026-07-06",
    lab: "Studio, in person with Deepika",
    values: [
      { label: "Weight", value: "68.7", unit: "kg" },
      { label: "Skeletal muscle", value: "23.1", unit: "kg" },
      { label: "Body fat", value: "34.2", unit: "%" },
      { label: "Waist", value: "89", unit: "cm" },
    ],
    provenance: p("coach_on_behalf", "Deepika", "2026-07-06"),
  },
  {
    id: "rep-shreya-1",
    memberId: "shreya",
    kind: "blood_panel",
    title: "Iron studies",
    collectedOn: "2026-06-22",
    lab: "Metropolis, Mumbai",
    values: [
      { label: "Haemoglobin", value: "10.8", unit: "g/dL" },
      { label: "Ferritin", value: "9", unit: "ng/mL" },
    ],
    provenance: p("imported_document", "Shreya", "2026-06-25"),
    note: "GP prescribed an iron supplement and is following up. Deepika is not managing this.",
  },
];

/* ------------------------------------------------------------------ */
/* Articles — short reads, matched by rule, never prescriptive         */
/* ------------------------------------------------------------------ */

export const articles: Article[] = [
  {
    id: "art-4pm-crash",
    title: "Why 4pm feels like a wall",
    category: "behaviour",
    readMinutes: 4,
    standfirst:
      "The afternoon dip is real, it is normal, and it is not evidence that something is wrong with you.",
    body: [
      "Almost everyone has a dip in alertness in the early afternoon. It is part of the ordinary daily rhythm, not a personal failing and not a sign of laziness.",
      "What makes it feel like a wall rather than a dip is usually what surrounds it: a short night, a long stretch without eating, several hours of concentration without a break, or a morning that started with a rush and never really settled.",
      "Three things tend to soften it, and none of them are dramatic. Getting outside into daylight at some point before lunch. Eating a lunch that contains some protein rather than only carbohydrate. And taking an actual pause — ten minutes, away from a screen — before the dip rather than after it.",
      "If the crash is new, severe, or comes with symptoms that worry you, that is worth a conversation with your doctor rather than a change to your routine. Bring it up at your next appointment and say when it started.",
    ],
    match: { goal: ["energy", "wiped out", "4pm"] },
    whyThis: "Because you said you want to stop feeling wiped out by 4pm.",
  },
  {
    id: "art-what-is-strength",
    title: "What strength training actually is",
    category: "movement",
    readMinutes: 5,
    standfirst:
      "It is not bodybuilding, it does not require a gym, and it is the single most useful thing most women start doing in their forties.",
    body: [
      "Strength training means asking a muscle to work against a resistance that is meaningful for it — your own bodyweight, a pair of dumbbells, a loaded bag. That is the whole idea.",
      "It matters more now than it did at thirty because muscle mass declines gradually from the late thirties onward unless something asks it not to. Resistance work is that ask. Walking, valuable as it is, does not provide the same signal.",
      "Technique comes before load. A movement you can do well with no weight is worth more than the same movement done badly with weight, and it is how you avoid the injuries people fear when they start.",
      "Soreness is not the scoreboard. Plenty of genuinely productive sessions leave you feeling fine the next day, and chasing soreness is how people end up doing too much in week one and nothing in week three.",
    ],
    match: { goal: ["strength", "lift", "suitcase", "understand what strength"], moduleIds: ["mv-strength-a", "mv-strength-b"] },
    whyThis: "Because strength work is on your plan right now.",
  },
  {
    id: "art-perimenopause-basics",
    title: "Perimenopause, in plain language",
    category: "hormonal",
    readMinutes: 5,
    standfirst:
      "The transition can run for years before periods stop. Knowing that changes how the symptoms feel.",
    body: [
      "Perimenopause is the stretch of time before periods stop for good. It commonly runs for several years, and during it hormone levels fluctuate rather than declining in a straight line.",
      "That fluctuation is why one week can feel completely normal and the next can bring disrupted sleep, a shorter fuse, changes in cycle length, or hot flushes — and why it can be so disorienting. Nothing is broken. The pattern itself is the thing.",
      "A single blood test on a single day rarely settles the question, precisely because the levels move. Doctors generally weigh the pattern of symptoms over time much more heavily.",
      "Decisions about treatment, including hormone therapy, belong with a doctor who knows your history. What is genuinely useful is walking into that appointment with a written record of what you have actually been experiencing and for how long — which is something this app can help you assemble.",
    ],
    match: { lifeStage: ["perimenopause", "postmenopause"], minAge: 40 },
    whyThis: "Because of the stage you told us you are in.",
    sourceNote:
      "General education, drawn from mainstream menopause guidance. Not a diagnosis and not specific to you.",
  },
  {
    id: "art-sleep-midlife",
    title: "When sleep changes in midlife",
    category: "sleep",
    readMinutes: 4,
    standfirst: "Waking at 3am has more than one cause, and they are not treated the same way.",
    body: [
      "Broken sleep in midlife is extremely common, and the useful first question is not how to fix it but what kind it is.",
      "Waking up hot, throwing off a blanket, and settling again is a different experience from waking with your mind already running through tomorrow. So is waking because a child, a parent, or a phone woke you.",
      "It is worth noticing which one you are having, because they point in different directions — and because being able to describe it precisely makes any conversation with a doctor far more productive than 'I am not sleeping'.",
      "The things that help across all of them are unglamorous: a consistent wake time, daylight early, and a wind-down that starts before you are already exhausted. None of them work in one night.",
    ],
    match: { goal: ["sleep", "3am", "night"], moduleIds: ["sl-reset", "sl-winddown"] },
    whyThis: "Because sleep is one of the things you are working on.",
  },
  {
    id: "art-protein-basics",
    title: "Protein, without the arithmetic",
    category: "nutrition",
    readMinutes: 4,
    standfirst: "You do not need to weigh anything to eat noticeably better than you did last month.",
    body: [
      "Most people find protein easiest to think about by meal rather than by day: is there a protein source on this plate, or is this plate mostly carbohydrate?",
      "In a typical Indian kitchen that source might be dal, rajma or chana, paneer, curd, eggs, fish or chicken, or a combination across the day. Vegetarian eating makes it require a little more thought, not less possible.",
      "Breakfast is where it most often goes missing. A morning meal built only around bread, poha or cereal tends to leave people reaching for something else by eleven.",
      "How much any individual needs depends on things a coach cannot assess for you, and a specific number for your body is a conversation for a registered dietitian. What is safe and useful to aim at is simply: more meals with a protein source on the plate than without.",
    ],
    match: { goal: ["protein"], moduleIds: ["nu-protein", "nu-plate"] },
    whyThis: "Because protein is part of your current focus.",
    sourceNote:
      "General education only. Individual nutrition prescriptions are outside a health coach's scope — ask us for a dietitian referral if you want specific numbers.",
  },
  {
    id: "art-bone-loading",
    title: "Why bones need load, not just steps",
    category: "hormonal",
    readMinutes: 4,
    standfirst: "Walking is genuinely good for you. It is not, on its own, a bone strategy.",
    body: [
      "Bone is living tissue that responds to the demands placed on it. Load it meaningfully and it maintains itself; leave it unloaded and it gradually gives ground.",
      "Walking loads the skeleton lightly and habitually, which is worth having. But the stimulus that most reliably speaks to bone is heavier, briefer, and more deliberate — resistance work, and for some people impact.",
      "This matters more after the menopausal transition, when the rate of bone loss changes. It is also why the strength sessions on your plan are not really about how you look.",
      "If there is osteoporosis or a fragility fracture in your family history, tell your doctor and tell your coach. It changes what is appropriate to do and how quickly.",
    ],
    match: { lifeStage: ["postmenopause", "perimenopause"], medical: ["osteoporosis", "fracture"], moduleIds: ["hr-bone-muscle"] },
    whyThis: "Because of your stage and what is on your plan.",
    sourceNote: "Education only. Screening and diagnosis are medical decisions.",
  },
  {
    id: "art-bad-week",
    title: "What to do with a genuinely bad week",
    category: "behaviour",
    readMinutes: 3,
    standfirst: "The week after the bad week is the one that actually decides anything.",
    body: [
      "Everyone has weeks where none of it happens. Illness, travel, a family crisis, or simply a stretch where there was nothing left at the end of the day.",
      "What separates people who are still doing this in a year from people who are not is almost never willpower during the bad week. It is what they do in the three days after it.",
      "The move that works is to make the return deliberately small — smaller than feels satisfying. One session. One walk. One meal you planned. The point of the small return is that it is impossible to fail at, and doing it re-establishes that you are someone who does this.",
      "There is nothing to make up. Nothing accumulated a debt while you were away, and treating it as though it did is the reliable way to turn one bad week into three.",
    ],
    match: { goal: ["consistency", "habit", "survives a bad week"], moduleIds: ["bh-comeback", "bh-minimum-day"] },
    whyThis: "Because building something that survives a bad week is what you said you wanted.",
  },
  {
    id: "art-doctor-appointment",
    title: "Getting more out of ten minutes with your doctor",
    category: "hormonal",
    readMinutes: 4,
    standfirst: "Most appointments are short. Preparation is what makes them count.",
    body: [
      "A consultation is often ten minutes, and a lot of it disappears into establishing basics that you could have handed over on paper.",
      "Three things are worth writing down beforehand. What you are actually experiencing, in your own words. When it started and whether it is getting worse. And the one question you would be most annoyed to leave without an answer to.",
      "If you have recent reports, bring the actual numbers rather than a summary of how you remember them. Your own trend over two or three years is often more informative than any single result.",
      "It is completely reasonable to ask a doctor to explain what a result means for you specifically, and to ask what would change their advice. That is their job, and it is not one your coach can do for you.",
    ],
    match: { moduleIds: ["hr-doctor-questions", "hr-perimenopause"], minAge: 38 },
    whyThis: "Because preparing for appointments is part of your journey.",
  },
  {
    id: "art-vegetarian-iron",
    title: "Iron when you eat vegetarian",
    category: "nutrition",
    readMinutes: 4,
    standfirst: "Plant sources behave differently, and a couple of ordinary habits change how much you absorb.",
    body: [
      "Iron from plant foods is absorbed less readily than iron from meat. That does not make a vegetarian diet inadequate; it means the details matter more.",
      "Vitamin C eaten alongside iron-containing food improves absorption meaningfully. Lemon over dal, tomato in the sabzi, a citrus fruit with the meal — ordinary things, not supplements.",
      "Tea and coffee taken with a meal work in the other direction. Moving chai to between meals rather than with them is a small change that costs nothing.",
      "If a blood test has shown low iron or low ferritin, that is your doctor's territory, not your coach's. Supplements in particular should be their decision — take too much for too long and it causes its own problems.",
    ],
    match: { constraint: ["vegetarian"], medical: ["ferritin", "iron"] },
    whyThis: "Because you eat vegetarian and told us protein and iron are the hard part.",
    sourceNote: "General education. Supplement decisions belong with your doctor.",
  },
  {
    id: "art-strength-not-weight",
    title: "Why we are not leading with the scale",
    category: "behaviour",
    readMinutes: 3,
    standfirst: "The number moves for reasons that have nothing to do with whether this is working.",
    body: [
      "Bodyweight shifts day to day with salt, water, where you are in your cycle, and what time you last ate. Reading a daily number as feedback on your effort mostly generates noise and discouragement.",
      "It also misses the thing most worth having. Two people at the same weight can be in very different positions in terms of how much muscle they carry, and muscle is what makes stairs, suitcases and grandchildren manageable later.",
      "The measures that track what is actually changing here are slower and less exciting: what you can lift, how a session feels at the same load, how often you found a way to move in a fortnight, whether you sleep through.",
      "Weight is still recorded — it is on the Progress screen — but as one line among several, measured every few weeks rather than every morning.",
    ],
    match: { goal: ["body composition", "fat", "weight", "energy"] },
    whyThis: "Because how we measure progress here is worth understanding early.",
  },
];

/* ------------------------------------------------------------------ */
/* Feedback + notifications                                            */
/* ------------------------------------------------------------------ */

export const feedbackItems: Feedback[] = [
  { id: "f-1", reporter: "Deepika", role: "coach", screen: "Journey Builder", category: "idea", severity: "medium", text: "I need to see the member's constraints while I am assigning modules, not on a different tab. I keep assigning morning sessions to Anita.", status: "triaged" },
  { id: "f-2", reporter: "Radhika", role: "member", screen: "Today", category: "confusing", severity: "low", text: "I wasn't sure whether tapping Minimum meant I was giving up.", easeScore: 4, status: "new" },
  { id: "f-3", reporter: "Deepika", role: "coach", screen: "Radar", category: "idea", severity: "high", text: "Celebrate flags should be at the top some days. If I only ever open this to find problems I will start dreading it.", status: "building" },
  { id: "f-4", reporter: "Megha", role: "member", screen: "Daily Pulse", category: "bug", severity: "low", text: "Submitted twice by accident and it counted both.", easeScore: 5, status: "fixed" },
];

export const notificationTemplates: NotificationTemplate[] = [
  { id: "n-1", trigger: "Morning, day has a single priority", copy: "Today has only one non-negotiable: your 12-minute strength session. Everything else is bonus.", voice: "system", timing: "07:35 local", capped: true },
  { id: "n-2", trigger: "90 minutes before a planned session", copy: "Your strength session is at 6. If the day runs over, the 12-minute Minimum version still counts.", voice: "system", timing: "T−90 min", capped: true },
  { id: "n-3", trigger: "Sleep ≤2 or energy ≤2 reported this morning", copy: "A low-energy day can still be a healthy day. Deepika has kept today lighter.", voice: "system", timing: "Within 1h of Pulse", capped: true },
  { id: "n-4", trigger: "First action after 3+ inactive days", copy: "Good to see you back. Nothing reset — we are continuing.", voice: "system", timing: "Immediate", capped: false },
  { id: "n-5", trigger: "Coach records a voice note", copy: "Deepika left you a 47-second note about this week's plan.", voice: "coach", timing: "Immediate", capped: false },
  { id: "n-6", trigger: "Evening before a 1:1", copy: "Two minutes tonight will make tomorrow's session with Deepika much more useful.", voice: "system", timing: "20:30 local", capped: true },
];
