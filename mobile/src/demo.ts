import { dateFromOffset, normalizeMemberDoc } from "./normalize";
import type { MemberDoc } from "./types";

export function createDemoMember(): MemberDoc {
  const memberId = "demo-member";
  const now = new Date().toISOString();
  return normalizeMemberDoc({
    member: {
      id: memberId,
      name: "Demo Member",
      week: 3,
      phase: "Stabilise",
      weeklyFocus: ["Build a steady morning rhythm", "Protect evening recovery"],
      goals: ["Feel stronger", "Manage stress"],
      constraints: ["Short weekday sessions", "Low-impact movement preferred"],
      activeModuleIds: ["strength-foundations", "protein-foundations", "sleep-rhythm"],
      lastPlanChange: { at: now, rationale: "This week stays deliberately steady while your energy pattern settles." },
    },
    actions: [
      {
        id: "demo-strength",
        memberId,
        dayOffset: 0,
        domain: "movement",
        isPrimary: true,
        title: "Supported chair squat",
        why: "Builds lower-body strength for everyday movement.",
        minimum: { label: "1 set of 6", minutes: 4 },
        target: { label: "2 sets of 8", minutes: 8 },
        stretch: { label: "3 sets of 8", minutes: 12 },
        measurement: { kind: "repetitions", value: 16, unit: "repetitions" },
        completed: null,
        exercise: { name: "Supported chair squat", sets: "2 × 8 slow repetitions", cue: "Keep your knees tracking over your toes and finish tall.", frames: ["Stand tall", "Hips back", "Touch chair", "Drive up", "Finish tall"] },
      },
    ],
    pulses: [
      { id: "demo-pulse-1", memberId, dayOffset: -2, energy: 2, sleep: 3, stress: 2, symptoms: ["afternoon dip"], provenance: { source: "member_manual", enteredBy: "Demo Member", at: new Date(Date.now() - 2 * 86400000).toISOString() } },
      { id: "demo-pulse-2", memberId, dayOffset: -1, energy: 3, sleep: 3, stress: 3, symptoms: [], provenance: { source: "member_manual", enteredBy: "Demo Member", at: new Date(Date.now() - 86400000).toISOString() } },
    ],
    messages: [
      { id: "demo-message", memberId, from: "coach", kind: "text", body: "Let’s keep this week gentle and consistent. Completing the minimum still counts.", dayOffset: 0, time: "9:15 AM", read: false },
    ],
    sessions: [
      { id: "demo-session", memberId, dayOffset: 2, time: "5:30 PM", type: "Weekly coaching check-in", status: "scheduled" },
    ],
    workoutLogs: [],
    reports: [],
    foodEntries: [
      { id: "demo-food-1", memberId, dayOffset: 0, loggedDate: dateFromOffset(0), meal: "Breakfast", description: "Vegetable poha with curd", calories: 360, protein: 13, carbs: 55, fat: 10, confidence: "estimated", createdAt: now },
      { id: "demo-food-2", memberId, dayOffset: -1, loggedDate: dateFromOffset(-1), meal: "Lunch", description: "Dal, rice and cucumber salad", calories: 510, protein: 21, carbs: 78, fat: 12, confidence: "member", memberCorrected: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "demo-food-3", memberId, dayOffset: -3, loggedDate: dateFromOffset(-3), meal: "Dinner", description: "Paneer bhurji with two rotis", calories: 620, protein: 32, carbs: 65, fat: 24, confidence: "estimated", createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    ],
    healthConnection: {
      platform: "none",
      status: "disconnected",
      syncEnabled: false,
      permissions: { steps: "not_requested", restingHeartRate: "not_requested", heartRateVariability: "not_requested", vo2Max: "not_requested" },
    },
    healthSnapshots: [],
    recommendations: [
      { id: "demo-recommendation", createdAt: now, kind: "change_action_level", actionId: "demo-strength", evidence: ["Energy check-ins have been below your usual level"], rationale: "A shorter strength option keeps the habit intact while recovery catches up.", confidence: 0.82, previousValue: "target", proposedValue: "minimum", safety: "low_risk", status: "applied", source: "deterministic" },
    ],
    onboarding: {
      completed: false,
      currentStep: 0,
      goals: [],
      availableMinutes: 15,
      preferredCheckIn: "morning",
      consent: { wellness: false, healthConnect: false, aiPersonalisation: false },
    },
    engagement: {
      weeklyGoal: 4,
      activeChallenge: { id: "steady-seven", title: "Steady Seven", description: "Choose one supportive action on four of the next seven days.", targetDays: 4 },
      circle: { inviteCode: "BHAROSA-DEMO", memberCount: 1 },
      reminders: { enabled: false, time: "8:00 AM" },
      celebratedMilestones: [],
    },
  });
}
