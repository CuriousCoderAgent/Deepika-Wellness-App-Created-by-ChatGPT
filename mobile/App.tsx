import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Activity,
  Bell,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudOff,
  Download,
  Dumbbell,
  Footprints,
  HeartPulse,
  Home,
  Info,
  MessageCircle,
  MoonStar,
  Pencil,
  PencilLine,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  MapPin,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  UserRound,
  Utensils,
} from "lucide-react-native";
import {
  ApiError,
  DEMO_TOKEN,
  answerConnection,
  askCoach,
  deleteAccount,
  discoverCircle,
  estimateMealPhoto,
  loadNudges,
  sendNudge,
  generatePlan,
  loadCircle,
  removeConnection,
  requestConnection,
  saveCircleSettings,
  exportAccount,
  generateRecommendation,
  loadMember,
  login,
  logout,
  privateMemberFileSource,
  requestPasswordHelp,
  restoreToken,
  saveMember,
  signup,
  uploadMemberFile,
} from "./src/api";
import { exerciseMediaFor } from "./src/exerciseMedia";
import { subscribeToConnectivity } from "./src/net";
import { currentCell } from "./src/location";
import {
  consistencySentence,
  type ConsistencySummary,
} from "./src/consistency";

/**
 * The whole vocabulary of encouragement.
 *
 * A fixed list rather than free text: a nudge cannot become a channel for
 * anything unkind, and nobody has to think of what to write. None of them
 * reference performance, so none can be read as a comment on how much someone
 * has or has not done.
 */
import { describeMatches, estimateMeal } from "./src/nutrition";
import {
  adjustQuantity,
  describeItems,
  preferred,
  removeItem,
  totalOf,
  wasAdjusted,
  type EstimateItem,
  type EstimateSource,
  type MealProposal,
} from "./src/meal-estimate";
import {
  READINESS_QUESTIONS,
  evaluateReadiness,
  readinessIsComplete,
  readinessMessage,
  type ReadinessAnswer,
} from "./src/readiness";
import {
  cancelAllReminders,
  cancelDailyReminder,
  formatReminderTime,
  notifyCoachReply,
  parseReminderTime,
  remindersAreSupported,
  scheduleDailyReminder,
} from "./src/notifications";
import {
  clearCache,
  clearPendingDoc,
  readCachedDoc,
  readPendingDoc,
  writeCachedDoc,
  writePendingDoc,
} from "./src/storage";
import {
  CONNECTED_HEALTH_NAME,
  openHealthSettings,
  syncHealth,
} from "./src/health";
import { canonicalCity, suggestCities } from "./src/cities";
import { AWARDS, awardMetrics, type AwardIcon } from "./src/awards";
import { Card, ScrollTopContext, useScrollToTop } from "./src/ui";
import { Pulse } from "./src/screens/Pulse";
import { Log, NoteCapture, Food } from "./src/screens/Log";
import { AboutYou } from "./src/screens/AboutYou";
import { Onboarding, DetailQuestions, EventQuestions, GOAL_GROUP_LABELS } from "./src/screens/Onboarding";
import { Coach } from "./src/screens/Coach";
import { Reports, HealthConnectionPanel } from "./src/screens/HealthAndReports";
import { Circle, ConsistencyGrid } from "./src/screens/Circle";
import { Journey, LearningLibrary, History, Progress, Awards } from "./src/screens/PlanSections";
import { Login, AuthMode } from "./src/screens/Login";
import {
  buildLogFeed,
  loggedToday,
  whenLabel,
  type LogKind,
} from "./src/log-feed";
import {
  AGE_BANDS,
  EQUIPMENT_OPTIONS,
  GOAL_OPTIONS,
  LIFE_STAGES,
  SLEEP_BASELINES,
  WEEKDAYS,
  EVENT_KINDS,
  WEEKS_AWAY_OPTIONS,
  WEEKLY_KM_OPTIONS,
  goalIdsFrom,
  isoWeeksFromToday,
  needsEventDetail,
  profileCompleteness,
  weeksUntil,
  goalLabel,
  type AgeBand,
  type Equipment,
  type EventKind,
  type GoalGroup,
  type LifeStage,
  type SleepBaseline,
  type Weekday,
} from "./src/profile";
import { C } from "./src/design/tokens";
import { activeDays } from "./src/activity";
import { findWeekWin } from "./src/week-win";
import { newId } from "./src/ids";
import {
  SKIP_OPTIONS,
  describeSkip,
  isDeliberateRest,
  type SkipReason,
} from "./src/outcomes";
import {
  BODY_SIGNALS,
  DOMAIN_META,
  HEALTH_LABELS,
  NUDGE_OPTIONS,
  moduleName,
  type DomainIcon,
} from "./src/content";
import { s } from "./src/design/styles";
import { compactKcal, liveMeals } from "./src/meals";
import { checkMacros } from "./src/meal-values";
import { latestRecommendation, needsHumanReview } from "./src/recommendations";
import { COACH_NAME, COACH_OPENERS } from "./src/coach";
import { LEARNING_ARTICLES } from "./src/learning";
import { isoDate, offsetFromDate } from "./src/normalize";
import { PHASES, weekPlansFor } from "./src/plan";
import type {
  ActionDomain,
  AiRecommendation,
  CircleState,
  DailyAction,
  EffortLevel,
  FoodEntry,
  HealthMetric,
  MemberDoc,
  PlanNotice,
  Message,
  PulseEntry,
} from "./src/types";

type Tab = "today" | "plan" | "log" | "coach" | "profile";
/**
 * Five tabs, and the middle one is a verb.
 *
 * "Food" was a tab because meals were the only thing the app asked her to
 * record. Everything else she logged was somewhere else entirely: the daily
 * check-in was a card on Today, a workout was a side effect of finishing a
 * session, and there was nowhere at all to write down that her knee felt odd.
 * There was no way to answer "what did I log yesterday" without visiting
 * three screens, and no single place that meant *capture*.
 *
 * Log is that place. Meals are still the common case and still one tap from
 * here; they are no longer the only case.
 */
const tabs = [
  { key: "today", label: "Today", Icon: Home },
  { key: "plan", label: "Plan", Icon: CalendarDays },
  { key: "log", label: "Log", Icon: PlusCircle },
  { key: "coach", label: "Coach", Icon: MessageCircle },
  { key: "profile", label: "You", Icon: UserRound },
] as const;

function ActionCard({
  action,
  recommendation,
  onComplete,
  inline,
}: {
  action: DailyAction;
  recommendation?: AiRecommendation;
  onComplete: (
    level: EffortLevel | "rest",
    effort?: 1 | 2 | 3 | 4 | 5,
    pain?: boolean,
    skipKind?: SkipReason,
  ) => void;
  /** Rendered inside the day card, so it drops its own background and border. */
  inline?: boolean;
}) {
  const [expanded, setExpanded] = useState(
    Boolean(inline || action.isPrimary || action.exercise),
  );
  const [pendingLevel, setPendingLevel] = useState<EffortLevel | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [pain, setPain] = useState(false);
  const domain = DOMAIN_META[action.domain];
  const DomainIconComponent = DOMAIN_ICONS[domain.icon];
  const chooseLevel = (level: EffortLevel) =>
    action.exercise ? setPendingLevel(level) : onComplete(level);
  const saveWorkout = () => {
    if (!pendingLevel) return;
    onComplete(pendingLevel, effort, pain);
    setPendingLevel(null);
  };
  return (
    <Card style={[s.actionCard, inline && s.actionCardInline]}>
      {!inline && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={s.actionTop}
          onPress={() => setExpanded((value) => !value)}
        >
          <View style={s.domainIcon}>
            <DomainIconComponent
              size={17}
              color={C.greenDeep}
              strokeWidth={2}
            />
          </View>
          <View style={s.actionText}>
            <Text style={s.domainLabel}>{domain.label.toUpperCase()}</Text>
            <Text style={s.actionTitle}>{action.title}</Text>
            <Text style={s.actionOutcome}>{action.target.label}</Text>
          </View>
          <View
            style={[s.actionStatus, action.completed && s.actionStatusDone]}
          >
            {action.completed ? (
              <Check
                style={{ margin: 4 }}
                size={16}
                strokeWidth={2.6}
                color="white"
              />
            ) : null}
          </View>
          {expanded ? (
            <ChevronUp size={18} color={C.faint} />
          ) : (
            <ChevronDown size={18} color={C.faint} />
          )}
        </Pressable>
      )}
      {expanded && (
        <>
          <View style={s.whyBlock}>
            <Text style={s.whyLabel}>WHY THIS TODAY?</Text>
            <Text style={s.actionWhy}>
              {recommendation?.rationale ?? action.why}
            </Text>
            {recommendation && (
              <Text style={s.recommendationEvidence}>
                {recommendation.evidence[0]}
              </Text>
            )}
          </View>
          <View style={s.effortRow}>
            {(["minimum", "target", "stretch"] as EffortLevel[]).map(
              (level) => (
                <Pressable
                  key={level}
                  style={[
                    s.effort,
                    (action.completed === level || pendingLevel === level) &&
                      s.effortActive,
                  ]}
                  onPress={() => chooseLevel(level)}
                >
                  <Text
                    style={[
                      s.effortLabel,
                      (action.completed === level || pendingLevel === level) &&
                        s.effortLabelActive,
                    ]}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                  <Text
                    style={[
                      s.effortDetail,
                      (action.completed === level || pendingLevel === level) &&
                        s.effortLabelActive,
                    ]}
                  >
                    {action[level].label}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
          {action.exercise && (
            <View style={s.exerciseBlock}>
              <View style={s.rowBetween}>
                <Text style={s.exerciseSets}>{action.exercise.sets}</Text>
                <Text style={s.exerciseCue}>FORM GUIDE</Text>
              </View>
              {/* The id is exact; the name is the fallback for a coach-authored action.
                  A movement with no photograph renders nothing rather than a
                  broken frame — the numbered steps below are the instructions
                  either way. */}
              {exerciseMediaFor(
                action.exercise.name,
                action.exercise.exerciseId,
              ) ? (
                <View style={s.exerciseSequenceFrame}>
                  <Image
                    source={
                      exerciseMediaFor(
                        action.exercise.name,
                        action.exercise.exerciseId,
                      )!
                    }
                    style={s.exerciseSequence}
                    resizeMode="contain"
                    accessibilityLabel={`Five-step ${action.exercise.name} form guide`}
                  />
                </View>
              ) : null}
              <View style={s.exerciseSteps}>
                {action.exercise.frames.slice(0, 5).map((frame, index) => (
                  <View key={`${frame}-${index}`} style={s.exerciseStep}>
                    <Text style={s.exerciseStepNumber}>{index + 1}</Text>
                    <Text numberOfLines={2} style={s.exerciseStepLabel}>
                      {frame}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={s.formCue}>{action.exercise.cue}</Text>
            </View>
          )}
          {action.exercise && pendingLevel && (
            <View style={s.workoutLog}>
              <Text style={s.logTitle}>How did that feel?</Text>
              <Text style={s.logLabel}>EFFORT · 1 EASY — 5 VERY HARD</Text>
              <View style={s.ratingRow}>
                {([1, 2, 3, 4, 5] as const).map((value) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: effort === value }}
                    key={value}
                    onPress={() => setEffort(value)}
                    style={[
                      s.ratingButton,
                      effort === value && s.ratingButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.ratingText,
                        effort === value && s.ratingTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.logLabel}>ANY PAIN DURING THIS MOVEMENT?</Text>
              <View style={s.painRow}>
                <Pressable
                  onPress={() => setPain(false)}
                  style={[s.painChoice, !pain && s.painChoiceActive]}
                >
                  <Text
                    style={[s.painChoiceText, !pain && s.painChoiceTextActive]}
                  >
                    No pain
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPain(true)}
                  style={[s.painChoice, pain && s.painChoiceWarning]}
                >
                  <Text
                    style={[s.painChoiceText, pain && s.painChoiceWarningText]}
                  >
                    Yes, pain
                  </Text>
                </Pressable>
              </View>
              {pain && (
                <Text style={s.painWarning}>
                  Stop this movement. Your coach will be asked to review it
                  before you repeat it.
                </Text>
              )}
              <Pressable
                style={({ pressed }) => [s.logButton, pressed && s.pressed]}
                onPress={saveWorkout}
              >
                <Text style={s.logButtonText}>Save workout</Text>
              </Pressable>
            </View>
          )}
          {/* Was a single "Not today" that recorded every skip as a
              deliberate rest — see src/outcomes.ts. Offered as three equally
              valid descriptions of a day, never ranked, never a request for
              a justification. */}
          {skipping ? (
            <View style={s.skipRow}>
              {SKIP_OPTIONS.map((option) => (
                <Pressable
                  key={option.reason}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.skipOption, pressed && s.pressed]}
                  onPress={() => {
                    setSkipping(false);
                    onComplete("rest", undefined, false, option.reason);
                  }}
                >
                  <Text style={s.skipOptionText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable onPress={() => setSkipping(true)}>
              <Text style={s.notToday}>Not today</Text>
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

function EngagementPanel({ doc }: { doc: MemberDoc }) {
  const goal = doc.engagement?.weeklyGoal ?? 4;
  const achieved = activeDays(doc);
  const challenge = doc.engagement?.activeChallenge;
  const pct = Math.min(1, achieved / goal);
  const shareWin = () =>
    Share.share({
      message: `A small win from Bharosa Wellness: I showed up for myself on ${achieved} day${achieved === 1 ? "" : "s"} this week. No perfect streak—just steady progress.`,
    });
  return (
    <LinearGradient colors={[C.greenDeep, "#126B69"]} style={s.consistencyCard}>
      <View style={s.rowBetween}>
        <Text style={s.consistencyLabel}>YOUR WEEKLY RHYTHM</Text>
        <Text style={s.consistencyCount}>
          {achieved}/{goal} days
        </Text>
      </View>
      <Text style={s.consistencyTitle}>
        {achieved >= goal
          ? "You kept your promise to yourself."
          : `${Math.max(0, goal - achieved)} gentle check-in${goal - achieved === 1 ? "" : "s"} to your goal.`}
      </Text>
      <View style={s.consistencyTrack}>
        <View style={[s.consistencyFill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={s.rhythmDots}>
        {Array.from({ length: 7 }, (_, index) => {
          const offset = index - 6;
          const done = doc.actions.some(
            (action) =>
              action.dayOffset === offset &&
              action.completed &&
              action.completed !== "rest",
          );
          return (
            <View key={offset} style={[s.rhythmDot, done && s.rhythmDotDone]} />
          );
        })}
      </View>
      {challenge && (
        <View style={s.challengeStrip}>
          <Text style={s.challengeKicker}>✦ {challenge.title}</Text>
          <Text style={s.challengeCopy}>{challenge.description}</Text>
        </View>
      )}
      {achieved > 0 && (
        <Pressable onPress={shareWin} style={s.shareWin}>
          <Text style={s.shareWinText}>Share this win privately</Text>
        </Pressable>
      )}
    </LinearGradient>
  );
}

/**
 * Whether a recorded date is today, in her timezone.
 *
 * Deliberately a date comparison rather than an age in hours: a step count
 * from 11pm last night is yesterday's, however recent it feels.
 */
function isToday(date: string): boolean {
  return date === isoDate();
}

/**
 * How old a health reading is, in words.
 *
 * Health sources go quiet — a watch left on the charger, a revoked
 * permission, a phone that has not synced. The failure mode that matters is
 * silent: an old number rendered exactly like a current one, so she reads
 * three-week-old steps as today's and so does her plan. Every reading gets
 * its age attached.
 */
function freshness(date: string): string {
  if (isToday(date)) return "Today";
  const days = Math.max(0, -offsetFromDate(date));
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Over a week ago";
  return "Over a fortnight ago";
}

function DailySnapshot({
  doc,
  onOpenProfile,
}: {
  doc: MemberDoc;
  onOpenProfile: () => void;
}) {
  const todayActions = doc.actions.filter((action) => action.dayOffset === 0);
  const actionsDone = todayActions.filter(
    (action) => action.completed && action.completed !== "rest",
  ).length;
  const meals = liveMeals(doc).filter(
    (entry) => entry.loggedDate === isoDate(),
  );
  const protein = meals.reduce((total, entry) => total + entry.protein, 0);
  const pulse = doc.pulses.find((entry) => entry.dayOffset === 0);
  const steps = [...doc.healthSnapshots]
    .filter((item) => item.metric === "steps" && item.available)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const tiles = [
    {
      key: "actions",
      label: "Daily actions",
      value: `${actionsDone}/${todayActions.length}`,
      detail: todayActions.length ? "completed" : "nothing planned yet",
      Icon: Check,
    },
    {
      key: "steps",
      label: "Steps",
      // A stale reading is not today's, and must not look like it. The number
      // used to render alone with its date computed and then discarded, so a
      // three-week-old sync sat on Today looking like this morning's walk.
      value: steps ? Math.round(steps.value).toLocaleString() : "—",
      detail: steps ? freshness(steps.date) : "Not connected",
      stale: Boolean(steps) && !isToday(steps!.date),
      Icon: Footprints,
      onPress: steps ? undefined : onOpenProfile,
    },
    {
      key: "nutrition",
      label: "Food logged",
      value: `${meals.length} meal${meals.length === 1 ? "" : "s"}`,
      detail: protein
        ? `${Math.round(protein)}g protein`
        : "No judgement attached",
      Icon: Utensils,
    },
    {
      key: "sleep",
      label: "Sleep quality",
      value: pulse?.sleep ? `${pulse.sleep}/5` : "—",
      detail: pulse?.sleep ? "You reported this" : "Not recorded yet",
      Icon: MoonStar,
    },
  ];
  return (
    <Card style={s.snapshotCard}>
      <View style={s.rowBetween}>
        <View>
          <Text style={s.cardTitle}>Today’s evidence</Text>
          <Text style={s.snapshotIntro}>Real inputs, not a health score</Text>
        </View>
        <ShieldCheck size={20} color={C.green} />
      </View>
      <View style={s.snapshotGrid}>
        {tiles.map((tile) => (
          <Pressable
            accessibilityRole={tile.onPress ? "button" : undefined}
            key={tile.key}
            disabled={!tile.onPress}
            onPress={tile.onPress}
            style={({ pressed }) => [
              s.snapshotTile,
              Boolean(tile.onPress) && s.snapshotTileAction,
              pressed && s.pressed,
            ]}
          >
            <View style={s.snapshotIcon}>
              <tile.Icon size={12} color={C.greenDeep} />
            </View>
            <Text numberOfLines={1} style={s.snapshotLabel}>
              {tile.label}
            </Text>
            <Text
              numberOfLines={1}
              style={[s.snapshotValue, tile.stale && s.snapshotValueStale]}
            >
              {tile.value}
            </Text>
            {/* Computed since this card was written and never rendered, which
                is what let a stale figure pass for a current one. */}
            <Text
              numberOfLines={1}
              style={[s.snapshotDetail, tile.stale && s.snapshotDetailStale]}
            >
              {tile.detail}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function DailyInsight({ doc }: { doc: MemberDoc }) {
  const current = doc.pulses.find((entry) => entry.dayOffset === 0);
  // Only the most recent recommendation decides what shows here -- see
  // src/recommendations.ts for why scanning the whole history was wrong.
  const latest = latestRecommendation(doc);
  const applicable =
    latest && ["applied", "approved"].includes(latest.status) ? latest : null;
  const pendingReview = needsHumanReview(doc) ? latest : null;
  const steps = [...doc.healthSnapshots]
    .filter((item) => item.metric === "steps" && item.available)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  let title = "Your baseline is taking shape";
  let copy =
    "Bharosa needs a few honest check-ins before it can describe a personal pattern. No plan change is being inferred today.";
  let evidence = "0–1 recent inputs · no causal conclusion";
  let label = "WHAT BHAROSA NOTICED";
  if (pendingReview) {
    // This used to announce "a human review is the right next step" and
    // "coach review requested" to every member, including the overwhelming
    // majority who have no coach and no way to get one. It described a queue
    // in the coach console, not anything she could see or act on.
    //
    // What actually happened is worth telling her, so say that instead: she
    // reported something, the app held that item rather than guessing around
    // it, and nothing about her plan was inferred from one report.
    const coached = doc.coaching?.mode === "coached";
    title = coached
      ? "Sent to your coach to look at"
      : "Held, pending a person";
    copy = coached
      ? pendingReview.rationale
      : `${pendingReview.rationale} Bharosa will not work around this on its own. Ask ${COACH_NAME} in the Coach tab what it means, or bring it to your doctor.`;
    evidence = pendingReview.evidence[0] ?? "A review flag was recorded today.";
    label = coached ? "WITH YOUR COACH" : "WAITING ON A PERSON";
  } else if (applicable) {
    title = "Why today’s plan looks this way";
    copy = applicable.rationale;
    evidence = `${applicable.evidence[0] ?? "Approved plan context"} · ${applicable.status === "approved" ? "coach-approved" : "applied"}`;
  } else if (current?.sleep && current.sleep <= 2) {
    title = "Sleep felt less restorative today";
    copy =
      "You rated sleep at the lower end of the scale. This is one self-report, so Bharosa will observe the pattern rather than infer a cause.";
    evidence = `Today · sleep ${current.sleep}/5 · 1 member check-in`;
  } else if (current?.symptoms?.length) {
    title = `${current.symptoms.length} body signal${current.symptoms.length === 1 ? "" : "s"} recorded`;
    copy =
      "These observations are saved for pattern review. They are not being translated into a hormone level or diagnosis.";
    evidence = `Today · ${current.symptoms.join(" · ")}`;
  } else if (steps) {
    title = "Movement data is connected";
    copy =
      "Your latest step total is available as context. Bharosa will use personal trends, not a single day, before suggesting a bounded adjustment.";
    evidence = `${Math.round(steps.value).toLocaleString()} steps · ${steps.date} · ${steps.source}`;
  }
  return (
    <View style={s.insightCard}>
      <View style={s.insightIcon}>
        <Sparkles size={17} color={C.marigold} />
      </View>
      <View style={s.insightBody}>
        <Text style={s.insightLabel}>{label}</Text>
        <Text style={s.insightTitle}>{title}</Text>
        <Text style={s.insightCopy}>{copy}</Text>
        <Text style={s.insightEvidence}>{evidence}</Text>
      </View>
    </View>
  );
}

function CoachConnectionCard({
  doc,
  onOpenCoach,
}: {
  doc: MemberDoc;
  onOpenCoach: () => void;
}) {
  const latestCoachMessage = [...doc.messages]
    .reverse()
    .find((message) => message.from === "coach");
  const nextSession = [...doc.sessions]
    .filter(
      (session) => session.status === "scheduled" && session.dayOffset >= 0,
    )
    .sort((a, b) => a.dayOffset - b.dayOffset)[0];
  const reviewPending = needsHumanReview(doc);
  return (
    <Card style={[s.coachConnection, reviewPending && s.coachConnectionReview]}>
      <View style={s.coachConnectionTop}>
        <View style={s.coachMark}>
          <MessageCircle size={19} color={C.greenDeep} />
        </View>
        <View style={s.flex}>
          <Text style={s.coachConnectionKicker}>
            {reviewPending ? "SOMETHING IS ON HOLD" : "HUMAN SUPPORT"}
          </Text>
          <Text style={s.coachConnectionTitle}>
            {reviewPending
              ? "One item is paused until a person sees it"
              : "A coach is part of the plan"}
          </Text>
        </View>
      </View>
      <Text style={s.coachConnectionCopy}>
        {reviewPending
          ? `You reported something the rules will not train through, so that item is paused and nothing was substituted for it. ${COACH_NAME} can explain which item and why.`
          : (latestCoachMessage?.body ??
            `${COACH_NAME} answers straight away in the Coach tab. A human coach is there for the things software should not decide.`)}
      </Text>
      {nextSession ? (
        <Text style={s.coachConnectionMeta}>
          Next session ·{" "}
          {nextSession.dayOffset === 0
            ? "Today"
            : `in ${nextSession.dayOffset} day${nextSession.dayOffset === 1 ? "" : "s"}`}{" "}
          · {nextSession.time}
        </Text>
      ) : (
        <Text style={s.coachConnectionMeta}>
          Replies happen between sessions; this is not an emergency channel.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onOpenCoach}
        style={({ pressed }) => [s.coachConnectionButton, pressed && s.pressed]}
      >
        <Text style={s.coachConnectionButtonText}>
          {reviewPending ? "See what is paused" : `Ask ${COACH_NAME}`}
        </Text>
        <ChevronRight size={17} color="white" />
      </Pressable>
    </Card>
  );
}

function DomainRow({
  meta,
  title,
  detail,
  done,
  total,
  onPress,
  expanded,
}: {
  meta: { label: string; icon: DomainIcon };
  title: string;
  detail?: string;
  done: number;
  total: number;
  onPress: () => void;
  /** Open, with its detail directly beneath. Undefined for rows that navigate. */
  expanded?: boolean;
}) {
  const complete = total > 0 && done >= total;
  const MetaIconComponent = DOMAIN_ICONS[meta.icon];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${meta.label}: ${title}${total > 1 ? `, ${done} of ${total} done` : complete ? ", done" : ""}`}
      style={({ pressed }) => [s.domainRow, pressed && s.domainRowPressed]}
      onPress={onPress}
    >
      <View style={[s.domainRowIcon, complete && s.domainRowIconDone]}>
        {complete ? (
          <Check size={15} color="#fff" strokeWidth={2.8} />
        ) : (
          <MetaIconComponent size={16} color={C.greenDeep} />
        )}
      </View>
      <View style={s.flex}>
        <Text style={s.domainRowLabel}>{meta.label.toUpperCase()}</Text>
        <Text style={[s.domainRowTitle, complete && s.domainRowTitleDone]}>
          {title}
        </Text>
        {detail ? <Text style={s.domainRowDetail}>{detail}</Text> : null}
      </View>
      {total > 1 && (
        <Text style={s.domainRowCount}>
          {done}/{total}
        </Text>
      )}
      {expanded ? (
        <ChevronUp size={17} color={C.faint} />
      ) : (
        <ChevronRight size={17} color={C.faint} />
      )}
    </Pressable>
  );
}

/**
 * The movement session, on its own screen.
 *
 * Everything that used to make Today long lives here: the exercises in order,
 * each with its form guide and effort logging. One screen, one job, and it is
 * only opened by someone who has decided to train.
 */
function MovementSession({
  doc,
  actions,
  onComplete,
  onBack,
}: {
  doc: MemberDoc;
  actions: DailyAction[];
  onComplete: (
    id: string,
    level: EffortLevel | "rest",
    effort?: 1 | 2 | 3 | 4 | 5,
    pain?: boolean,
  ) => void;
  onBack: () => void;
}) {
  const done = actions.filter((a) => a.completed).length;
  const minutes = actions.reduce((sum, a) => sum + (a.target?.minutes ?? 0), 0);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to today"
        style={s.backRow}
        onPress={onBack}
      >
        <ChevronLeft size={18} color={C.green} />
        <Text style={s.backRowText}>Today</Text>
      </Pressable>
      <Text style={s.eyebrow}>YOUR MOVEMENT TODAY</Text>
      <Text style={s.hero}>
        {done === actions.length && actions.length
          ? "That is the session done."
          : `${actions.length} movement${actions.length === 1 ? "" : "s"}, about ${minutes} minutes.`}
      </Text>
      <Text style={s.heroCopy}>
        {done === actions.length && actions.length
          ? "Nothing more is asked of you today."
          : "Work through them in any order. A shorter version of any of these is a complete day."}
      </Text>
      <View style={s.sessionProgress}>
        {actions.map((a) => (
          <View
            key={a.id}
            style={[s.sessionPip, a.completed && s.sessionPipDone]}
          />
        ))}
      </View>
      {actions.map((a) => (
        <ActionCard
          key={a.id}
          action={a}
          recommendation={[...doc.recommendations]
            .reverse()
            .find(
              (item) =>
                item.actionId === a.id &&
                ["applied", "approved"].includes(item.status),
            )}
          onComplete={(level, effort, pain) =>
            onComplete(a.id, level, effort, pain)
          }
        />
      ))}
    </>
  );
}

/**
 * The circle, on Today.
 *
 * Connecting to other members is one of the reasons this app exists, and it was
 * buried three taps deep under You. It belongs on the screen someone opens
 * every morning.
 *
 * Deliberately small: names, how many days each has shown up this month, and a
 * way in. No ranking and no numbers anyone can lose at — the evidence on
 * activity apps is consistent that comparison drives beginners out, and this is
 * the most-seen screen in the product, so it is the last place to put a ladder.
 *
 * It fails quietly. A member with no connections, no network, or a server
 * having a bad morning sees nothing here rather than an error on the screen she
 * opens to find out what to do today.
 */
function CircleToday({
  token,
  onOpenCircle,
}: {
  token: string;
  onOpenCircle: () => void;
}) {
  const [state, setState] = useState<CircleState | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (token === DEMO_TOKEN) return;
    loadCircle(token)
      .then((next) => {
        if (!cancelled && next) setState(next);
      })
      .catch(() => {
        // Today is not the place to report that the circle is unreachable.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!state) return null;
  const waiting = state.requests.incoming.length;
  const people = state.circle;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        waiting
          ? `Your circle, ${waiting} request${waiting === 1 ? "" : "s"} waiting`
          : "Your circle"
      }
      onPress={onOpenCircle}
    >
      <Card style={s.circleTodayCard}>
        <View style={s.rowBetween}>
          <View style={s.rowInline}>
            <Users size={16} color={C.greenDeep} />
            <Text style={s.cardTitle}>Your circle</Text>
          </View>
          {waiting ? (
            <View style={s.tabBadge}>
              <Text style={s.tabBadgeText}>{waiting > 9 ? "9+" : waiting}</Text>
            </View>
          ) : (
            <ChevronRight size={17} color={C.faint} />
          )}
        </View>

        {waiting > 0 ? (
          <Text style={s.profileCopy}>
            {waiting === 1
              ? "Someone would like to connect with you."
              : `${waiting} people would like to connect with you.`}
          </Text>
        ) : people.length ? (
          <View style={s.circleTodayRow}>
            {people.slice(0, 4).map((person) => (
              <View key={person.memberId} style={s.circleTodayPerson}>
                <View style={s.circleTodayAvatar}>
                  <Text style={s.circleTodayInitial}>
                    {person.displayName.trim().charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <Text numberOfLines={1} style={s.circleTodayName}>
                  {person.displayName.split(" ")[0]}
                </Text>
                <Text style={s.circleTodayDays}>
                  {person.consistency?.activeDays ?? 0}d
                </Text>
              </View>
            ))}
            {people.length > 4 && (
              <View style={s.circleTodayPerson}>
                <View style={[s.circleTodayAvatar, s.circleTodayMore]}>
                  <Text style={s.circleTodayInitial}>+{people.length - 4}</Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <Text style={s.profileCopy}>
            Bharosa connects members going through the same thing. It is easier
            with company.
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

/**
 * What the plan needs to tell her, above the day it produced.
 *
 * These exist because a plan sometimes cannot give her what she asked for,
 * and the previous behaviour in that case was silence. A member whose
 * readiness answers held movement back saw an empty movement section with no
 * explanation anywhere, and the sentence explaining it — including the advice
 * to speak to a doctor — was generated on the server and discarded with the
 * response. See PlanNotice in lib/plan-generator.ts.
 *
 * Rendered above the day rather than inside a domain, because the whole point
 * is that the reason is missing from where she would otherwise look.
 */
function PlanNotices({ notices }: { notices: PlanNotice[] }) {
  if (!notices.length) return null;
  return (
    <>
      {notices.map((notice) => (
        <View
          key={notice.kind}
          accessibilityRole="summary"
          style={[
            s.planNotice,
            notice.kind === "movement_held" && s.planNoticeSerious,
          ]}
        >
          <View style={s.planNoticeHead}>
            <Info
              size={15}
              color={
                notice.kind === "movement_held" ? C.marigoldInk : C.greenDeep
              }
            />
            <Text style={s.planNoticeTitle}>{notice.title}</Text>
          </View>
          <Text style={s.planNoticeBody}>{notice.body}</Text>
        </View>
      ))}
    </>
  );
}

function Today({
  doc,
  update,
  onOpenCoach,
  onOpenProfile,
  token,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  onOpenCoach: () => void;
  onOpenProfile: () => void;
  token: string;
}) {
  const [openSession, setOpenSession] = useState(false);
  const scrollToTop = useScrollToTop();
  /** Which single-action domain is expanded in place. Only one at a time. */
  const [expandedDomain, setExpandedDomain] = useState<ActionDomain | null>(
    null,
  );
  const first = doc.member.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const domainOrder: ActionDomain[] = [
    "movement",
    "walking",
    "nutrition",
    "recovery",
    "mindset",
  ];
  const actions = doc.actions
    .filter((a) => a.dayOffset === 0)
    .sort(
      (a, b) => domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain),
    );
  const actionsDone = actions.filter(
    (action) => action.completed && action.completed !== "rest",
  ).length;
  const movementActions = actions.filter(
    (action) => action.domain === "movement",
  );
  /** Something is genuinely waiting with her coach, rather than a standing ad. */
  const coachNeedsAttention =
    doc.recommendations.some(
      (item) =>
        item.kind === "coach_review" && item.status === "needs_coach_review",
    ) ||
    doc.sessions.some(
      (session) =>
        session.status === "scheduled" &&
        session.dayOffset >= 0 &&
        session.dayOffset <= 2,
    );
  const remaining = actions.length - actionsDone;
  const primary = actions.find((action) => action.isPrimary) ?? actions[0];
  const complete = (
    id: string,
    level: EffortLevel | "rest",
    effort: 1 | 2 | 3 | 4 | 5 = 3,
    pain = false,
    skipKind?: SkipReason,
  ) => {
    const action = doc.actions.find((item) => item.id === id);
    const workoutLogs =
      action?.exercise && level !== "rest"
        ? [
            ...doc.workoutLogs,
            {
              id: newId("workout"),
              actionId: id,
              memberId: doc.member.id,
              completedAt: new Date().toISOString(),
              level,
              perceivedEffort: effort,
              pain,
              coachReviewRequired: pain,
            },
          ]
        : doc.workoutLogs;
    const painMessage = pain
      ? [
          {
            id: newId("pain"),
            memberId: doc.member.id,
            from: "system" as const,
            kind: "plan_update" as const,
            body: `${doc.member.name} reported pain during ${action?.title ?? "an exercise"}. Review before this movement is repeated.`,
            dayOffset: 0,
            time: "just now",
            read: false,
          },
        ]
      : [];
    const painRecommendation: AiRecommendation[] = pain
      ? [
          {
            id: newId("recommendation"),
            createdAt: new Date().toISOString(),
            kind: "coach_review",
            actionId: id,
            evidence: [
              `Pain was reported during ${action?.title ?? "a movement"}`,
            ],
            rationale:
              "This movement is paused for coach review. Bharosa has not prescribed a replacement.",
            confidence: 1,
            safety: "coach_review",
            status: "needs_coach_review",
            source: "deterministic",
          },
        ]
      : [];
    update({
      ...doc,
      actions: doc.actions.map((a) =>
        a.id === id ? { ...a, completed: level, skipKind } : a,
      ),
      workoutLogs,
      messages: [...doc.messages, ...painMessage],
      recommendations: [...doc.recommendations, ...painRecommendation],
    });
    if (pain)
      Alert.alert(
        "Movement paused",
        "Do not repeat this exercise for now. Your pain flag has been added for coach review. Seek urgent medical help for severe or concerning symptoms.",
      );
  };
  if (!doc.onboarding?.completed)
    return <Onboarding doc={doc} update={update} />;

  // The movement session has its own screen. Everything else on Today is a
  // single small action and stays here.
  if (openSession)
    return (
      <MovementSession
        doc={doc}
        actions={movementActions}
        onComplete={complete}
        onBack={() => {
          setOpenSession(false);
          scrollToTop();
        }}
      />
    );

  return (
    <>
      <Text style={s.eyebrow}>
        WEEK {doc.member.week} · {doc.member.phase.toUpperCase()}
      </Text>
      <Text style={s.hero}>
        {greeting}, {first}.
      </Text>
      <Text style={s.heroCopy}>
        {remaining
          ? `${remaining} of ${actions.length} left today.`
          : "Today’s plan is complete. Recovery counts as part of the work."}
      </Text>
      {/* Anything the plan could not do, and why. Above the day, because
          the gap it explains is inside the day. */}
      <PlanNotices notices={doc.planNotices ?? []} />

      {doc.member.lastPlanChange && (
        <View style={s.planChange}>
          <Text style={s.planLabel}>↻ Plan adjusted</Text>
          <Text style={s.planCopy}>{doc.member.lastPlanChange.rationale}</Text>
        </View>
      )}

      {/* What her phone and health source already know, before anything asks
          her for input. This is the answer to "how am I doing" and belongs
          above the day rather than below it. */}
      <DailySnapshot doc={doc} onOpenProfile={onOpenProfile} />

      <Card style={s.glanceCard}>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Your day</Text>
          <Text style={s.sectionMeta}>
            {actionsDone} of {actions.length}
          </Text>
        </View>
        {domainOrder.map((domain) => {
          const meta = DOMAIN_META[domain];
          const inDomain = actions.filter((a) => a.domain === domain);
          if (!inDomain.length) return null;
          const doneCount = inDomain.filter((a) => a.completed).length;
          const isMovement = domain === "movement";
          const only = inDomain[0]!;
          return (
            <View key={domain}>
              <DomainRow
                meta={meta}
                title={
                  isMovement && inDomain.length > 1
                    ? `${inDomain.length} movements`
                    : only.title
                }
                detail={
                  isMovement && inDomain.length > 1
                    ? `About ${inDomain.reduce((sum, a) => sum + (a.target?.minutes ?? 0), 0)} minutes`
                    : only.target?.label
                }
                done={doneCount}
                total={inDomain.length}
                expanded={expandedDomain === domain}
                onPress={() => {
                  if (isMovement && inDomain.length > 1) {
                    setOpenSession(true);
                    scrollToTop();
                  } else
                    setExpandedDomain(
                      expandedDomain === domain ? null : domain,
                    );
                }}
              />
              {expandedDomain === domain &&
                inDomain.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    inline
                    recommendation={[...doc.recommendations]
                      .reverse()
                      .find(
                        (item) =>
                          item.actionId === a.id &&
                          ["applied", "approved"].includes(item.status),
                      )}
                    onComplete={(level, effort, pain) =>
                      complete(a.id, level, effort, pain)
                    }
                  />
                ))}
            </View>
          );
        })}
      </Card>

      {/* The circle is a headline feature, not a setting buried under You. */}
      <CircleToday token={token} onOpenCircle={onOpenProfile} />

      {/* The check-in asks something of her, so it sits below what the app can
          already tell her. */}
      <Pulse doc={doc} onChange={update} />

      <DailyInsight doc={doc} />
      {coachNeedsAttention && (
        <CoachConnectionCard doc={doc} onOpenCoach={onOpenCoach} />
      )}
    </>
  );
}

/**
 * Awards.
 *
 * Fitness apps hand out three kinds of badge: cumulative volume (Peloton's 1,
 * 10, 25, 50, 100 classes), consistency held over time, and one-off firsts.
 * All three are here — with one rule that is ours. Nothing rewards intensity,
 * and nothing can ever be taken away. A badge that disappears is a streak
 * wearing a different hat, and this product is built against streaks.
 *
 * Three awards was too few to be a collection. Most members saw two grey
 * circles and nothing within reach. Seventeen means something is nearly always
 * close, and they arrive across walking, food, check-ins, rest and the circle
 * rather than only for training hard — so the member who cannot train this
 * month still has somewhere to go.
 */
/**
 * Award icon names to components.
 *
 * The rules in `src/awards.ts` name their icon rather than importing one, so
 * that module stays free of React Native and can be tested. This is where the
 * name becomes something to render.
 */
/**
 * Domain icon names to components. Same convention as AWARD_ICONS — the
 * content module names an icon, the screen resolves it.
 */
const DOMAIN_ICONS: Record<DomainIcon, typeof Dumbbell> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  utensils: Utensils,
  moon: MoonStar,
  brain: Brain,
};


type YouSection = "about" | "circle" | "health" | "reports" | "settings";

function YouHub({
  doc,
  circleRequests,
  onOpen,
}: {
  doc: MemberDoc;
  circleRequests: number;
  onOpen: (section: YouSection) => void;
}) {
  const initials = doc.member.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  const health = doc.healthConnection;
  const connected =
    health?.status === "connected" || health?.status === "partial";
  const latestSteps = [...(doc.healthSnapshots ?? [])]
    .filter((snapshot) => snapshot.metric === "steps" && snapshot.available)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const reportCount = doc.reports?.length ?? 0;
  /*
   * How much of her profile is filled in.
   *
   * Shown as a count rather than a percentage or a progress ring: this is not
   * a task to complete, and every one of these questions is optional. It is
   * here so that someone who declined at sign-up can see there is something
   * here to answer, without being nagged about it.
   */
  const known = profileCompleteness(doc.profile ?? { goals: [] });
  const aboutDetail =
    known.known >= known.total
      ? "Age, goals and preferences — all answered"
      : doc.profile?.detailConsent === "declined"
        ? "Add details any time to sharpen your plan"
        : `${known.known} of ${known.total} answered — each one sharpens your plan`;
  const activeDays = new Set(
    (doc.actions ?? [])
      .filter(
        (action) =>
          action.completed && action.dayOffset <= 0 && action.dayOffset >= -27,
      )
      .map((action) => action.dayOffset),
  ).size;

  const rows: {
    key: YouSection;
    Icon: typeof Users;
    label: string;
    detail: string;
    badge?: number;
  }[] = [
    {
      key: "about",
      Icon: UserRound,
      label: "About you",
      detail: aboutDetail,
    },
    {
      key: "health",
      Icon: HeartPulse,
      label: CONNECTED_HEALTH_NAME,
      detail: connected
        ? latestSteps
          ? `${Math.round(latestSteps.value).toLocaleString()} steps most recently`
          : "Connected"
        : "Not connected — steps and heart rate are unavailable",
    },
    {
      key: "circle",
      Icon: Users,
      label: "Your circle",
      detail: circleRequests
        ? `${circleRequests} request${circleRequests === 1 ? "" : "s"} waiting`
        : "People you have added, and how their month is going",
      badge: circleRequests || undefined,
    },
    {
      key: "reports",
      Icon: ShieldCheck,
      label: "Reports",
      detail: reportCount
        ? `${reportCount} uploaded`
        : "Blood work and scans, stored privately",
    },
    {
      key: "settings",
      Icon: UserRound,
      label: "Settings and your data",
      detail: "Reminders, privacy, export, delete your account",
    },
  ];

  return (
    <>
      <View style={s.profileBadge}>
        <Text style={s.profileInitials}>{initials}</Text>
      </View>
      <Text style={[s.hero, s.center]}>{doc.member.name}</Text>
      <Text style={[s.heroCopy, s.center]}>
        Week {doc.member.week} · {doc.member.phase}
        {activeDays ? ` · ${activeDays} active days this month` : ""}
      </Text>

      <Card style={s.glanceCard}>
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={
              row.badge
                ? `${row.label}, ${row.badge} waiting`
                : `${row.label}. ${row.detail}`
            }
            style={({ pressed }) => [
              s.domainRow,
              index === 0 && s.domainRowFirst,
              pressed && s.domainRowPressed,
            ]}
            onPress={() => onOpen(row.key)}
          >
            <View style={s.domainRowIcon}>
              <row.Icon size={16} color={C.greenDeep} />
            </View>
            <View style={s.flex}>
              <Text style={s.domainRowTitle}>{row.label}</Text>
              <Text style={s.domainRowDetail}>{row.detail}</Text>
            </View>
            {row.badge ? (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeText}>
                  {row.badge > 9 ? "9+" : row.badge}
                </Text>
              </View>
            ) : null}
            <ChevronRight size={17} color={C.faint} />
          </Pressable>
        ))}
      </Card>

      <Text style={s.disclaimer}>
        Bharosa supports coaching and education. It does not diagnose conditions
        or replace medical care.
      </Text>
    </>
  );
}

function Profile({
  doc,
  update,
  onLogout,
  token,
  onDeleted,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  onLogout: () => void;
  token: string;
  onDeleted: () => void;
}) {
  const website = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const engagement = doc.engagement ?? {
    weeklyGoal: 4,
    circle: {
      inviteCode: `BHAROSA-${doc.member.id.toUpperCase()}`,
      memberCount: 1,
    },
    reminders: { enabled: false, time: "8:00 AM" },
    celebratedMilestones: [],
  };
  /**
   * Share the thing that actually works: her username.
   *
   * This used to share `BHAROSA-{ID}` as a "code", which no route anywhere
   * resolves — sign-up only accepts the deployment-wide SIGNUP_CODE, so
   * whoever received it typed it in and was told the code was wrong. A broken
   * promise at the exact moment someone is vouching for the product to a
   * friend is worse than no invitation at all.
   *
   * Adding by username is the real, working mechanism, and it keeps the
   * privacy shape intact: she still has to accept before either of them sees
   * anything. A proper referral link that survives install is the right
   * long-term answer; this is the honest version of what exists today.
   */
  const invite = () =>
    Share.share({
      message: `I’m building steadier wellness habits with Bharosa Wellness. Once you’ve signed up, add me — my username is ${doc.member.id}. We’d each only see how much of our plan we’ve done, and only after we both accept.`,
    });
  const reminderTime = parseReminderTime(engagement.reminders.time);
  const saveReminder = (enabled: boolean, time = reminderTime) =>
    update({
      ...doc,
      engagement: {
        ...engagement,
        reminders: { enabled, time: formatReminderTime(time) },
      },
    });

  /**
   * The switch schedules a real notification now. If the member declines the
   * permission prompt it goes back off, rather than sitting on for a reminder
   * that will never arrive.
   */
  const toggleReminder = async (enabled: boolean) => {
    if (!enabled) {
      await cancelDailyReminder();
      saveReminder(false);
      return;
    }
    const scheduled = await scheduleDailyReminder(
      reminderTime,
      doc.onboarding.preferredCheckIn ?? "morning",
    );
    if (!scheduled) {
      saveReminder(false);
      // Two very different reasons to end up here, and telling someone to
      // check her settings when the app simply cannot do it would waste her
      // time looking for a switch that is already on.
      if (!remindersAreSupported()) {
        Alert.alert(
          "Reminders are not available in this version",
          "This build of the app cannot schedule reminders yet. Everything else works as normal.",
        );
        return;
      }
      Alert.alert(
        "Notifications are switched off for Bharosa",
        "You can turn them back on for Bharosa Wellness in your phone settings whenever you like.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    saveReminder(true);
  };

  /** Half-hour steps, which is as precise as a gentle nudge needs to be. */
  const shiftReminder = async (deltaMinutes: number) => {
    const total =
      (reminderTime.hour * 60 + reminderTime.minute + deltaMinutes + 1440) %
      1440;
    const next = { hour: Math.floor(total / 60), minute: total % 60 };
    if (engagement.reminders.enabled) {
      const ok = await scheduleDailyReminder(
        next,
        doc.onboarding.preferredCheckIn ?? "morning",
      );
      if (!ok) {
        saveReminder(false, next);
        return;
      }
    }
    saveReminder(engagement.reminders.enabled, next);
  };

  /**
   * A member's own copy of her record, handed to the share sheet so she can
   * keep it wherever she keeps things. Nothing is uploaded anywhere new.
   */
  const exportData = async () => {
    setBusy("export");
    try {
      const data = await exportAccount(token);
      await Share.share({
        title: "Bharosa Wellness data export",
        message: JSON.stringify(data, null, 2),
      });
    } catch (error) {
      Alert.alert(
        "Export not ready",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletePassword) {
      Alert.alert("Enter your password", "Deletion needs your password.");
      return;
    }
    setBusy("delete");
    try {
      const result = await deleteAccount(token, deletePassword);
      await cancelAllReminders();
      await clearCache();
      setDeletePassword("");
      Alert.alert("Account deleted", result.message);
      onDeleted();
    } catch (error) {
      Alert.alert(
        "Not deleted",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <View style={s.profileBadge}>
        <Text style={s.profileInitials}>
          {doc.member.name
            .split(" ")
            .map((x) => x[0])
            .join("")
            .slice(0, 2)}
        </Text>
      </View>
      <Text style={[s.hero, s.center]}>{doc.member.name}</Text>
      <Text style={[s.heroCopy, s.center]}>
        Week {doc.member.week} · {doc.member.phase}
      </Text>
      <Card>
        <View style={s.rowBetween}>
          <View style={s.flex}>
            <Text style={s.cardTitle}>Daily gentle reminder</Text>
            <Text style={s.profileCopy}>
              A quiet prompt at {formatReminderTime(reminderTime)}. No guilt if
              you ignore it.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Daily gentle reminder"
            value={engagement.reminders.enabled}
            onValueChange={toggleReminder}
            trackColor={{ false: C.line, true: C.greenTint }}
            thumbColor={engagement.reminders.enabled ? C.green : C.faint}
          />
        </View>
        <View style={s.reminderRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Half an hour earlier"
            style={s.reminderStep}
            onPress={() => shiftReminder(-30)}
          >
            <ChevronLeft size={18} color={C.green} />
          </Pressable>
          <View style={s.reminderTime}>
            <Bell size={15} color={C.green} />
            <Text style={s.reminderTimeText}>
              {formatReminderTime(reminderTime)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Half an hour later"
            style={s.reminderStep}
            onPress={() => shiftReminder(30)}
          >
            <ChevronRight size={18} color={C.green} />
          </Pressable>
        </View>
      </Card>
      <LinearGradient colors={["#E7EFF0", "#F3EBDD"]} style={s.circleCard}>
        <Text style={s.circleKicker}>BHAROSA CIRCLE · OPT IN</Text>
        <Text style={s.circleTitle}>
          Wellness is easier with one trusted person.
        </Text>
        <Text style={s.profileCopy}>
          Add other members for encouragement, below. Your meals, check-ins,
          reports and messages are never shared — only how much of your plan you
          have done, and only with people you accept.
        </Text>
        <View style={s.inviteCode}>
          <Text style={s.inviteCodeLabel}>ADD ME BY USERNAME</Text>
          <Text style={s.inviteCodeValue}>{doc.member.id}</Text>
        </View>
        <Pressable style={s.circleButton} onPress={invite}>
          <Text style={s.circleButtonText}>Invite someone you trust</Text>
        </Pressable>
      </LinearGradient>
      <Card>
        <Text style={s.cardTitle}>Your boundaries matter</Text>
        <Text style={s.profileCopy}>
          {doc.member.constraints.length
            ? doc.member.constraints.join(" · ")
            : "Add your preferences with your coach."}
        </Text>
      </Card>
      <Card>
        <Text style={s.cardTitle}>Your data</Text>
        <Text style={s.profileCopy}>
          Your information is used for your coaching journey. Take a copy
          whenever you want it, and delete everything whenever you decide to.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.dataButton}
          onPress={exportData}
          disabled={busy !== null}
        >
          {busy === "export" ? (
            <ActivityIndicator color={C.green} />
          ) : (
            <>
              <Download size={16} color={C.green} />
              <Text style={s.dataButtonText}>Download a copy of my data</Text>
            </>
          )}
        </Pressable>
        {confirmingDelete ? (
          <View style={s.deleteBox}>
            <Text style={s.deleteTitle}>
              This deletes everything, permanently.
            </Text>
            <Text style={s.profileCopy}>
              Your check-ins, meals, photos, reports and messages are removed
              and cannot be recovered. Your coach will no longer see your
              record. Enter your password to confirm.
            </Text>
            <TextInput
              style={s.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
              placeholderTextColor={C.faint}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={s.deleteActions}>
              <Pressable
                accessibilityRole="button"
                style={s.secondaryButton}
                onPress={() => {
                  setConfirmingDelete(false);
                  setDeletePassword("");
                }}
              >
                <Text style={s.secondaryButtonText}>Keep my account</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={s.deleteConfirmButton}
                onPress={confirmDelete}
                disabled={busy !== null}
              >
                {busy === "delete" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.deleteConfirmText}>Delete permanently</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={s.dataButton}
            onPress={() => setConfirmingDelete(true)}
          >
            <Trash2 size={16} color={C.soft} />
            <Text style={[s.dataButtonText, s.deleteLinkText]}>
              Delete my account and data
            </Text>
          </Pressable>
        )}
        {website ? (
          <View style={s.policyLinks}>
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(`${website}/privacy`)}
            >
              <Text style={s.policyLink}>Privacy policy</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(`${website}/account-deletion`)}
            >
              {/* Deletion itself happens above, in the app. This is the
                  published page describing what it removes. */}
              <Text style={s.policyLink}>What deletion removes</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>
      <Pressable
        accessibilityRole="button"
        style={s.secondaryButton}
        onPress={onLogout}
      >
        <Text style={s.secondaryButtonText}>Sign out</Text>
      </Pressable>
      <Text style={s.disclaimer}>
        Bharosa Wellness supports coaching and education. It does not diagnose
        conditions or replace medical care.
      </Text>
    </>
  );
}

function MemberApp({
  token,
  onSignedOut,
}: {
  token: string;
  onSignedOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<MemberDoc | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);
  /** A change is held on the device, waiting for a connection. */
  const [queued, setQueued] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  /** Connection requests waiting on her, surfaced on the You tab. */
  const [circleRequests, setCircleRequests] = useState(0);
  /** Which section of You is open. Null is the hub. */
  const [youSection, setYouSection] = useState<null | YouSection>(null);
  /** Progress opens on its own; null is the plan itself. */
  const [planSection, setPlanSection] = useState<null | "progress">(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);
  // Every change of screen starts at the top of it. Without this the offset
  // from the previous screen is inherited, which reads as a page opening
  // half-way down.
  useEffect(() => {
    scrollToTop();
  }, [tab, planSection, youSection, scrollToTop]);
  /** The current document, readable from callbacks without a stale closure. */
  const latest = useRef<MemberDoc | null>(null);
  /** Coach messages already seen, so only genuinely new ones are announced. */
  const seenCoachMessages = useRef<Set<string> | null>(null);
  const mounted = useRef(true);

  const apply = useCallback((next: MemberDoc) => {
    latest.current = next;
    setDoc(next);
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    // Her health data should not stay on the device after she leaves, and a
    // reminder should not keep arriving for an account nobody is signed into.
    await clearCache();
    await cancelAllReminders();
    onSignedOut();
  }, [onSignedOut]);

  /**
   * Tell her when the coach has replied. Only messages that were not present
   * the last time we looked count, so a refresh never re-announces old ones.
   */
  const noticeCoachReplies = useCallback((next: MemberDoc) => {
    const coachIds = next.messages
      .filter((message) => message.from === "coach")
      .map((message) => message.id);
    const known = seenCoachMessages.current;
    if (known) {
      const fresh = coachIds.filter((id) => !known.has(id));
      if (fresh.length)
        notifyCoachReply(fresh.length).catch(() => {
          // A missing notification permission is not worth interrupting her.
        });
    }
    seenCoachMessages.current = new Set(coachIds);
  }, []);

  const refresh = useCallback(
    async ({
      silent = false,
      readOnly = false,
    }: { silent?: boolean; readOnly?: boolean } = {}) => {
      try {
        // readOnly exists for the Coach tab's sixty-second poll. Reading
        // messages must never build a plan or ask a model for anything: the
        // poll was running the whole pipeline, so simply sitting on the
        // conversation mutated plan state once a minute. The server is
        // idempotent now, but a poll that writes is still the wrong shape.
        if (token !== DEMO_TOKEN && !readOnly) {
          const built = await readCachedDoc();
          const alreadyToday =
            built?.doc?.planGeneratedOn === isoDate() ||
            latest.current?.planGeneratedOn === isoDate();
          if (!alreadyToday) {
            await generatePlan(token).catch(() => {
              // Yesterday's plan is a much better outcome than none.
            });
          }
        }
        let next = await loadMember(token);
        const today = isoDate();
        const hasTodayRecommendation = next.recommendations.some(
          (item) => item.createdAt.slice(0, 10) === today,
        );
        if (
          next.onboarding.consent.aiPersonalisation &&
          !hasTodayRecommendation &&
          token !== DEMO_TOKEN &&
          !readOnly
        ) {
          try {
            const result = await generateRecommendation(token);
            if (result?.recommendation)
              next = {
                ...next,
                recommendations: [
                  ...next.recommendations,
                  result.recommendation,
                ],
              };
          } catch {
            // Today never blocks when the recommendation service is unavailable.
          }
        }
        if (next.healthConnection.syncEnabled) {
          const result = await syncHealth(false);
          const merged = new Map(
            next.healthSnapshots.map((item) => [item.id, item]),
          );
          result.snapshots.forEach((item) => merged.set(item.id, item));
          next = {
            ...next,
            healthConnection: result.connection,
            healthSnapshots: [...merged.values()],
          };
          await saveMember(token, next);
        }
        if (!mounted.current) return;
        noticeCoachReplies(next);
        apply(next);
        await writeCachedDoc(next);
        setLastSyncedAt(new Date().toISOString());
        setOnline(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await signOut();
          return;
        }
        if (!mounted.current) return;
        setOnline(false);
        // A cached document is a real answer, not a failure. Only a member
        // with nothing on screen at all needs to be told something went wrong.
        if (!latest.current) {
          const cached = await readCachedDoc();
          if (cached) {
            apply(cached.doc);
            setLastSyncedAt(cached.savedAt);
          } else if (!silent) {
            Alert.alert(
              "Couldn’t load your plan",
              err instanceof Error ? err.message : "Please try again.",
            );
          }
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, apply, signOut, noticeCoachReplies],
  );

  /** Send anything held on the device while there was no connection. */
  const flushQueued = useCallback(async () => {
    if (token === DEMO_TOKEN) return;
    const pending = await readPendingDoc();
    if (!pending) return;
    try {
      await saveMember(token, pending);
      await clearPendingDoc();
      if (mounted.current) setQueued(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await signOut();
      // Anything else: it stays queued and is tried again on the next
      // connection change or save.
    }
  }, [token, signOut]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      // Open on the cached copy first. The app stays usable on a train, in a
      // lift, and on the kind of connection that takes eight seconds to fail.
      const cached = await readCachedDoc();
      if (!cancelled && cached && !latest.current) {
        apply(cached.doc);
        setLastSyncedAt(cached.savedAt);
        setLoading(false);
      }
      const pending = await readPendingDoc();
      if (!cancelled && pending) setQueued(true);
      if (!cancelled) {
        await flushQueued();
        await refresh({ silent: Boolean(cached) });
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [token, apply, refresh, flushQueued]);

  useEffect(
    () =>
      subscribeToConnectivity((reachable) => {
        setOnline(reachable);
        if (reachable) flushQueued();
      }),
    [flushQueued],
  );

  /**
   * Coach replies used to be invisible until a member happened to pull to
   * refresh. While the conversation is open, look for new ones.
   */
  useEffect(() => {
    if (tab !== "coach" || token === DEMO_TOKEN) return;
    // readOnly: this is a poll for new messages, not a reason to rebuild her
    // day. It used to run the full pipeline every minute.
    refresh({ silent: true, readOnly: true });
    const timer = setInterval(
      () => refresh({ silent: true, readOnly: true }),
      60_000,
    );
    return () => clearInterval(timer);
  }, [tab, token, refresh]);

  const update = useCallback(
    async (next: MemberDoc) => {
      apply(next);
      await writeCachedDoc(next);
      if (token === DEMO_TOKEN) return;
      setSaving(true);
      try {
        await saveMember(token, next);
        await clearPendingDoc();
        setQueued(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await signOut();
          return;
        }
        if (err instanceof ApiError && err.status < 500) {
          // The server refused this content. Retrying it forever would not
          // help, so take the stored record as the truth and say what happened.
          Alert.alert("Not saved", err.message);
          await refresh({ silent: true });
          return;
        }
        // Offline, or the server is briefly unavailable. Hold the change and
        // send it when the connection returns instead of discarding her entry.
        await writePendingDoc(next);
        setQueued(true);
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [token, apply, signOut, refresh],
  );

  const unreadFromCoach = doc
    ? doc.messages.filter(
        (message) => message.from === "coach" && !message.read,
      ).length
    : 0;

  /**
   * Re-assert the reminder against the OS whenever the document loads.
   *
   * The member's preference lives in her document; the schedule lives on the
   * device. A new phone, a reinstall, or a member who cleared the app's data
   * has the first without the second, and the switch would read "on" while
   * nothing ever arrived. Scheduling is idempotent — it replaces the one
   * existing reminder by identifier.
   */
  const remindersEnabled = doc?.engagement?.reminders.enabled ?? false;
  const reminderAt = doc?.engagement?.reminders.time;
  const preferredCheckIn = doc?.onboarding.preferredCheckIn;
  useEffect(() => {
    if (!remindersEnabled) return;
    scheduleDailyReminder(
      parseReminderTime(reminderAt),
      preferredCheckIn ?? "morning",
    ).catch(() => {
      // Permission was withdrawn in system settings. Profile shows the switch
      // and is where she can turn it back on; nothing to interrupt her with.
    });
  }, [remindersEnabled, reminderAt, preferredCheckIn]);

  useEffect(() => {
    if (tab !== "profile") setYouSection(null);
    if (tab !== "plan") setPlanSection(null);
  }, [tab]);

  /** Opening the conversation is reading it. */
  useEffect(() => {
    if (tab !== "coach" || !unreadFromCoach) return;
    const current = latest.current;
    if (!current) return;
    update({
      ...current,
      messages: current.messages.map((message) =>
        message.from === "coach" ? { ...message, read: true } : message,
      ),
    });
  }, [tab, unreadFromCoach, update]);

  if (loading)
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={s.loadingText}>Loading your plan…</Text>
      </View>
    );
  if (!doc)
    return (
      <View style={s.loading}>
        <Text style={s.error}>Your plan could not be loaded.</Text>
        <Pressable style={s.primaryButton} onPress={() => refresh()}>
          <Text style={s.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );

  let content: React.ReactNode;
  if (tab === "today")
    content = (
      <Today
        doc={doc}
        update={update}
        token={token}
        onOpenCoach={() => setTab("coach")}
        onOpenProfile={() => setTab("profile")}
      />
    );
  else if (tab === "plan")
    content =
      planSection === "progress" ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to plan"
            style={s.backRow}
            onPress={() => setPlanSection(null)}
          >
            <ChevronLeft size={18} color={C.green} />
            <Text style={s.backRowText}>Plan</Text>
          </Pressable>
          <Progress doc={doc} />
          <History doc={doc} />
        </>
      ) : (
        <>
          <Journey doc={doc} />
          <LearningLibrary weekFocus={doc.member.weeklyFocus} />
          <Card style={s.glanceCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See how it has been going"
              style={({ pressed }) => [
                s.domainRow,
                s.domainRowFirst,
                pressed && s.domainRowPressed,
              ]}
              onPress={() => setPlanSection("progress")}
            >
              <View style={s.domainRowIcon}>
                <Sparkles size={16} color={C.greenDeep} />
              </View>
              <View style={s.flex}>
                <Text style={s.domainRowTitle}>How it has been going</Text>
                <Text style={s.domainRowDetail}>
                  Your whole record — every day, what you did and how it felt
                </Text>
              </View>
              <ChevronRight size={17} color={C.faint} />
            </Pressable>
          </Card>
        </>
      );
  else if (tab === "log")
    content = (
      <Log
        doc={doc}
        update={update}
        token={token}
        onOpenToday={() => setTab("today")}
      />
    );
  else if (tab === "coach")
    content = <Coach doc={doc} update={update} token={token} />;
  else
    content = (
      <>
        {/* Four full screens used to be stacked here — roughly 1,200 lines of
            one scroll. It is now a hub: each section opens on its own, the same
            way the movement session does. */}
        {youSection === null ? (
          <YouHub
            doc={doc}
            circleRequests={circleRequests}
            onOpen={setYouSection}
          />
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to you"
              style={s.backRow}
              onPress={() => setYouSection(null)}
            >
              <ChevronLeft size={18} color={C.green} />
              <Text style={s.backRowText}>You</Text>
            </Pressable>
            {youSection === "about" && (
              <AboutYou doc={doc} update={update} />
            )}
            {youSection === "circle" && (
              <Circle token={token} onUnreadChange={setCircleRequests} />
            )}
            {youSection === "health" && (
              <HealthConnectionPanel doc={doc} update={update} />
            )}
            {youSection === "reports" && (
              <Reports doc={doc} update={update} token={token} />
            )}
            {youSection === "settings" && (
              <Profile
                doc={doc}
                update={update}
                token={token}
                onLogout={signOut}
                onDeleted={onSignedOut}
              />
            )}
          </>
        )}
      </>
    );

  const initials = doc.member.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <SafeAreaView style={s.app} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={s.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to Today"
          style={s.wordmark}
          onPress={() => setTab("today")}
        >
          <Image source={require("./assets/icon-v2.png")} style={s.topLogo} />
          <View>
            <Text style={s.topBrand}>Bharosa Wellness</Text>
            <Text style={s.topBrandSub}>PRIVATE MEMBER SPACE</Text>
          </View>
        </Pressable>
        <View style={s.topActions}>
          {saving ? (
            <Text style={s.saving}>Saving…</Text>
          ) : queued ? (
            <Text style={s.savingQueued}>Saved on this phone</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => setTab("profile")}
            style={[s.topAvatar, tab === "profile" && s.topAvatarActive]}
          >
            <Text style={s.topAvatarText}>{initials}</Text>
          </Pressable>
        </View>
      </View>
      {(!online || queued) && (
        <View style={s.offlineBar}>
          <CloudOff size={14} color={C.calm} />
          <Text style={s.offlineText}>
            {queued
              ? "Saved on this phone. It will reach your coach when you are back online."
              : lastSyncedAt
                ? `Offline. Showing your plan as of ${new Date(lastSyncedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.`
                : "Offline. Showing the last plan saved on this phone."}
          </Text>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.green}
            onRefresh={() => {
              setRefreshing(true);
              refresh();
            }}
          />
        }
      >
        <ScrollTopContext.Provider value={scrollToTop}>
          {content}
        </ScrollTopContext.Provider>
        <View style={{ height: 30 + insets.bottom }} />
      </ScrollView>
      <View style={[s.tabShell, { paddingBottom: Math.max(7, insets.bottom) }]}>
        <View accessibilityRole="tablist" style={s.tabBar}>
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  item.key === "coach" && unreadFromCoach > 0
                    ? `${item.label} tab, ${unreadFromCoach} unread`
                    : item.key === "profile" && circleRequests > 0
                      ? `${item.label} tab, ${circleRequests} connection request${circleRequests === 1 ? "" : "s"}`
                      : `${item.label} tab`
                }
                style={({ pressed }) => [s.tab, pressed && s.tabPressed]}
                onPress={() => setTab(item.key)}
              >
                <View style={[s.tabIcon, active && s.tabIconActive]}>
                  <item.Icon
                    size={20}
                    strokeWidth={active ? 2.35 : 1.9}
                    color={active ? C.greenDeep : C.faint}
                  />
                  {item.key === "coach" && unreadFromCoach > 0 && (
                    <View style={s.tabBadge}>
                      <Text style={s.tabBadgeText}>
                        {unreadFromCoach > 9 ? "9+" : unreadFromCoach}
                      </Text>
                    </View>
                  )}
                  {item.key === "profile" && circleRequests > 0 && (
                    <View style={s.tabBadge}>
                      <Text style={s.tabBadgeText}>
                        {circleRequests > 9 ? "9+" : circleRequests}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * The last line before a blank screen.
 *
 * A render error anywhere in the tree used to leave a member looking at
 * nothing at all, with no way back except force-quitting the app. This catches
 * it, keeps her signed in, and offers the one action that actually helps.
 *
 * It deliberately does not show the error text. A stack trace is no use to the
 * member holding the phone, and it can carry fragments of her own data.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible in `adb logcat` and in the development console. There is no
    // crash reporter wired up yet; when one is added, report it from here.
    console.error("[bharosa] render failed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={s.loading}>
        <Text style={s.errorTitle}>Something went wrong on this screen.</Text>
        <Text style={s.loadingText}>
          Nothing you have logged is lost — it is saved on this phone and with
          your coach.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.primaryButton}
          onPress={() => this.setState({ failed: false })}
        >
          <Text style={s.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

export default function App() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    restoreToken().then(setToken);
  }, []);
  if (token === undefined)
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        {token ? (
          <MemberApp token={token} onSignedOut={() => setToken(null)} />
        ) : (
          <Login onSuccess={setToken} onDemo={() => setToken(DEMO_TOKEN)} />
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
