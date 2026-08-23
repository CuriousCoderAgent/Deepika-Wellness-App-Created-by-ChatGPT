import type {
  ActionDomain,
  DailyAction,
  FoodEntry,
  HealthConnection,
  HealthReport,
  MemberDoc,
  OnboardingState,
  OutcomeMeasurement,
} from "./types";
import { weekPlansFor } from "./plan";
import { isoDate } from "./daily";

const DAY_MS = 86_400_000;

export { isoDate } from "./daily";

export function dateFromOffset(dayOffset = 0): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setTime(date.getTime() + dayOffset * DAY_MS);
  return isoDate(date);
}

export function offsetFromDate(loggedDate: string): number {
  const today = new Date(`${isoDate()}T12:00:00`);
  const selected = new Date(`${loggedDate}T12:00:00`);
  return Math.round((selected.getTime() - today.getTime()) / DAY_MS);
}

function domainFor(
  action: Partial<DailyAction> & { moduleId?: string; title?: string },
): ActionDomain {
  const input = `${action.moduleId ?? ""} ${action.title ?? ""}`.toLowerCase();
  if (/walk|step/.test(input)) return "walking";
  if (/nutrition|protein|meal|food|breakfast|lunch/.test(input))
    return "nutrition";
  if (/sleep|recovery|wake|bed/.test(input)) return "recovery";
  if (/stress|mind|reflect|breath/.test(input)) return "mindset";
  return "movement";
}

function measurementFor(
  action: Partial<DailyAction>,
  domain: ActionDomain,
): OutcomeMeasurement {
  if (action.measurement) return action.measurement;
  if (domain === "nutrition") return { kind: "meal", value: 1, unit: "meal" };
  if (domain === "walking")
    return { kind: "steps", value: 6000, unit: "steps" };
  if (domain === "mindset")
    return { kind: "check_in", value: 1, unit: "reflection" };
  return {
    kind: "minutes",
    value: action.target?.minutes ?? 10,
    unit: "minutes",
  };
}

function normalizeAction(
  action: Partial<DailyAction> & Pick<DailyAction, "id" | "memberId" | "title">,
): DailyAction {
  const domain = action.domain ?? domainFor(action);
  const minimum = action.minimum ?? {
    label: "Choose a gentle start",
    minutes: 5,
  };
  const target = action.target ?? {
    label: "Complete today’s plan",
    minutes: 10,
  };
  const stretch = action.stretch ?? {
    label: "Add a little more if it feels good",
    minutes: 15,
  };
  return {
    ...action,
    dayOffset: action.dayOffset ?? 0,
    domain,
    why: action.why ?? "This supports the focus agreed with your coach.",
    minimum: domain === "nutrition" ? { ...minimum, minutes: 0 } : minimum,
    target: domain === "nutrition" ? { ...target, minutes: 0 } : target,
    stretch: domain === "nutrition" ? { ...stretch, minutes: 0 } : stretch,
    measurement: measurementFor(action, domain),
    completed: action.completed ?? null,
  };
}

function actionTemplate(memberId: string, domain: ActionDomain): DailyAction {
  const common = { memberId, dayOffset: 0, completed: null as null };
  const id = `legacy-${memberId}-${domain}-today`;
  if (domain === "movement")
    return normalizeAction({
      ...common,
      id,
      title: "Movement plan check-in",
      domain,
      why: "No movement session has been published for today. This check-in keeps the domain visible without inventing an exercise.",
      minimum: { label: "Review today’s guidance", minutes: 0 },
      target: { label: "Note what feels manageable", minutes: 0 },
      stretch: { label: "Ask your coach a question", minutes: 0 },
      measurement: { kind: "check_in", value: 1, unit: "plan check-in" },
    });
  if (domain === "walking")
    return normalizeAction({
      ...common,
      id,
      title: "Walking plan check-in",
      domain,
      why: "No walking target has been published for today. Review your context before you and your coach agree a suitable target.",
      minimum: { label: "Review recent activity", minutes: 0 },
      target: { label: "Note what felt comfortable", minutes: 0 },
      stretch: { label: "Share context with your coach", minutes: 0 },
      measurement: { kind: "check_in", value: 1, unit: "activity check-in" },
    });
  if (domain === "nutrition")
    return normalizeAction({
      ...common,
      id,
      title: "Record one main meal",
      domain,
      why: "A simple meal record gives you and your coach useful context without judging the day.",
      minimum: { label: "Record one meal", minutes: 0 },
      target: { label: "Add a fullness or energy note", minutes: 0 },
      stretch: { label: "Prepare one easy option for tomorrow", minutes: 0 },
      measurement: { kind: "meal", value: 1, unit: "meal" },
    });
  if (domain === "recovery")
    return normalizeAction({
      ...common,
      id,
      title: "Create a short wind-down",
      domain,
      why: "A brief, flexible wind-down can make it easier to notice what supports your recovery.",
      minimum: { label: "5 quiet minutes", minutes: 5 },
      target: { label: "10-minute wind-down", minutes: 10 },
      stretch: { label: "Note what helped you settle", minutes: 10 },
      measurement: { kind: "minutes", value: 10, unit: "minutes" },
    });
  return normalizeAction({
    ...common,
    id,
    title: "Pause and check in",
    domain,
    why: "A brief check-in helps you notice what you need without forcing a particular result.",
    minimum: { label: "Name how you feel", minutes: 1 },
    target: { label: "Write one line", minutes: 3 },
    stretch: { label: "Take five quiet minutes", minutes: 5 },
    measurement: { kind: "check_in", value: 1, unit: "reflection" },
  });
}

function ensureHolisticToday(
  actions: DailyAction[],
  memberId: string,
): DailyAction[] {
  const normalized = actions.map(normalizeAction);
  const todayDomains = new Set(
    normalized
      .filter((action) => action.dayOffset === 0)
      .map((action) => action.domain),
  );
  const required: ActionDomain[] = [
    "movement",
    "walking",
    "nutrition",
    "recovery",
    "mindset",
  ];
  return [
    ...normalized,
    ...required
      .filter((domain) => !todayDomains.has(domain))
      .map((domain) => actionTemplate(memberId, domain)),
  ];
}

function normalizeFood(entry: Record<string, unknown>): FoodEntry {
  const dayOffset = typeof entry.dayOffset === "number" ? entry.dayOffset : 0;
  const loggedDate =
    typeof entry.loggedDate === "string"
      ? entry.loggedDate
      : dateFromOffset(dayOffset);
  const description = String(entry.description ?? entry.name ?? "Meal");
  return {
    id: String(entry.id ?? `food-${Math.random()}`),
    memberId: String(entry.memberId ?? ""),
    dayOffset: offsetFromDate(loggedDate),
    loggedDate,
    meal: (["Breakfast", "Lunch", "Snack", "Dinner"].includes(
      String(entry.meal),
    )
      ? entry.meal
      : "Lunch") as FoodEntry["meal"],
    description,
    calories: Number(entry.calories ?? 0),
    protein: Number(entry.protein ?? 0),
    carbs: Number(entry.carbs ?? 0),
    fat: Number(entry.fat ?? 0),
    photoFileId:
      typeof entry.photoFileId === "string" ? entry.photoFileId : undefined,
    photoUri: typeof entry.photoUri === "string" ? entry.photoUri : undefined,
    confidence:
      entry.confidence === "member" || entry.proteinEdited
        ? "member"
        : "estimated",
    memberCorrected: Boolean(entry.memberCorrected ?? entry.proteinEdited),
    createdAt: String(
      entry.createdAt ??
        (entry.provenance as { at?: string } | undefined)?.at ??
        new Date().toISOString(),
    ),
  };
}

function normalizeReport(entry: Record<string, unknown>): HealthReport {
  const kind = String(entry.category ?? entry.kind ?? "other");
  const provenance = entry.provenance as { at?: string } | undefined;
  const uploadedAt = String(
    entry.uploadedAt ??
      provenance?.at ??
      (entry.collectedOn
        ? `${String(entry.collectedOn)}T12:00:00.000Z`
        : new Date().toISOString()),
  );
  return {
    id: String(entry.id ?? `report-${Math.random()}`),
    memberId: String(entry.memberId ?? ""),
    title: String(entry.title ?? "Uploaded report"),
    category:
      kind === "blood_work" || kind === "blood_panel"
        ? "blood_work"
        : kind === "body_composition"
          ? "body_composition"
          : "other",
    fileName: String(entry.fileName ?? "Report"),
    fileId: typeof entry.fileId === "string" ? entry.fileId : undefined,
    fileUri: typeof entry.fileUri === "string" ? entry.fileUri : undefined,
    uploadedAt,
    status: entry.status === "coach_reviewed" ? "coach_reviewed" : "uploaded",
  };
}

export const EMPTY_HEALTH_CONNECTION: HealthConnection = {
  platform: "none",
  status: "disconnected",
  syncEnabled: false,
  permissions: {
    steps: "not_requested",
    restingHeartRate: "not_requested",
    heartRateVariability: "not_requested",
    vo2Max: "not_requested",
  },
};

function normalizeOnboarding(
  raw: Partial<OnboardingState> | undefined,
): OnboardingState {
  const goals = raw?.goals?.length
    ? raw.goals
    : raw?.primaryGoal
      ? [raw.primaryGoal]
      : [];
  return {
    completed: raw?.completed ?? false,
    currentStep: raw?.currentStep ?? 0,
    goals,
    customGoal: raw?.customGoal,
    activityLevel: raw?.activityLevel,
    availableMinutes: raw?.availableMinutes ?? 15,
    movementCaution: raw?.movementCaution,
    preferredCheckIn: raw?.preferredCheckIn ?? "morning",
    consent: raw?.consent ?? {
      wellness: false,
      healthConnect: false,
      aiPersonalisation: false,
    },
  };
}

export function normalizeMemberDoc(
  input: MemberDoc | Record<string, unknown>,
): MemberDoc {
  const raw = input as Partial<MemberDoc>;
  if (!raw.member) throw new Error("Member profile is missing.");
  const member = { ...raw.member, weekPlans: weekPlansFor(raw.member) };
  return {
    member,
    actions: ensureHolisticToday(
      (raw.actions ?? []) as DailyAction[],
      member.id,
    ),
    pulses: raw.pulses ?? [],
    messages: raw.messages ?? [],
    sessions: raw.sessions ?? [],
    workoutLogs: raw.workoutLogs ?? [],
    reports: ((raw.reports ?? []) as unknown as Record<string, unknown>[]).map(
      normalizeReport,
    ),
    foodEntries: (
      (raw.foodEntries ?? []) as unknown as Record<string, unknown>[]
    ).map(normalizeFood),
    healthConnection: raw.healthConnection ?? EMPTY_HEALTH_CONNECTION,
    healthSnapshots: raw.healthSnapshots ?? [],
    recommendations: raw.recommendations ?? [],
    onboarding: normalizeOnboarding(raw.onboarding),
    // Date-keyed, so unlike actions and pulses these need no re-basing.
    hydrationLogs: raw.hydrationLogs ?? [],
    habits: raw.habits ?? [],
    habitLogs: raw.habitLogs ?? [],
    engagement: raw.engagement,
  };
}
