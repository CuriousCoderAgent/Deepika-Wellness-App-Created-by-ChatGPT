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
import { openHealthSettings, syncHealth } from "./src/health";
import { canonicalCity, suggestCities } from "./src/cities";
import { AWARDS, awardMetrics, type AwardIcon } from "./src/awards";
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

const CONNECTED_HEALTH_NAME =
  Platform.OS === "ios" ? "Apple Health" : "Health Connect";

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

type AuthMode = "signin" | "signup" | "help";

function Login({
  onSuccess,
  onDemo,
}: {
  onSuccess: (token: string) => void;
  onDemo: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async () => {
    if (!username.trim()) return setError("Enter your username.");
    if (mode !== "help" && !password) return setError("Enter your password.");
    if (mode === "signup" && !name.trim()) return setError("Enter your name.");
    if (mode === "signup" && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return setError("Enter a valid email for account recovery.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") onSuccess(await login(username.trim(), password));
      if (mode === "signup")
        onSuccess(
          await signup({
            name: name.trim(),
            email: email.trim(),
            username: username.trim(),
            password,
            code: joinCode.trim() || undefined,
          }),
        );
      if (mode === "help")
        setNotice((await requestPasswordHelp(username.trim())).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  return (
    <KeyboardAvoidingView
      style={s.loginPage}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          s.authScroll,
          { paddingBottom: 28 + insets.bottom, paddingTop: insets.top },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient colors={[C.greenDeep, "#0A6264"]} style={s.authHero}>
          <Image source={require("./assets/icon-v2.png")} style={s.brandIcon} />
          <Text style={s.brand}>BHAROSA WELLNESS</Text>
          <Text style={s.loginTitle}>
            {mode === "signup"
              ? "Begin with support."
              : mode === "help"
                ? "Regain access."
                : "Welcome back."}
          </Text>
          <Text style={s.loginCopy}>
            {mode === "signup"
              ? "Create your private member space and meet your coach inside."
              : mode === "help"
                ? "Tell us which account needs help. We never reveal whether a username exists."
                : "Your plan, your progress, and your coach’s guidance—in one private place."}
          </Text>
        </LinearGradient>
        <View style={s.authCard}>
          {mode === "signup" && (
            <>
              <Text style={s.inputLabel}>Your name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                textContentType="name"
              />
              <Text style={s.inputLabel}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <Text style={s.fieldHint}>
                Used only for account notices and secure password recovery.
              </Text>
            </>
          )}
          <Text style={s.inputLabel}>
            {mode === "help" ? "Username or email" : "Username"}
          </Text>
          <TextInput
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            textContentType="username"
          />
          {mode !== "help" && (
            <>
              <Text style={s.inputLabel}>Password</Text>
              <TextInput
                style={s.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                textContentType={mode === "signup" ? "newPassword" : "password"}
              />
              {mode === "signup" && (
                <Text style={s.fieldHint}>Use at least 8 characters.</Text>
              )}
            </>
          )}
          {mode === "signup" && (
            <>
              <Text style={s.inputLabel}>Join code</Text>
              {/* Was autoCapitalize="characters", which force-uppercased every
                  keystroke while the server compares case-sensitively — so any
                  code containing a lowercase letter was impossible to type on a
                  phone. Nothing here may alter what she typed. */}
              <TextInput
                style={s.input}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                value={joinCode}
                onChangeText={setJoinCode}
              />
              <Text style={s.fieldHint}>
                Exactly as it was sent to you, including capitals.
              </Text>
            </>
          )}
          {!!error && <Text style={s.error}>{error}</Text>}
          {!!notice && <Text style={s.notice}>{notice}</Text>}
          <Pressable
            style={({ pressed }) => [s.primaryButton, pressed && s.pressed]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryButtonText}>
                {mode === "signup"
                  ? "Create account"
                  : mode === "help"
                    ? "Email reset link"
                    : "Sign in"}
              </Text>
            )}
          </Pressable>
          {mode === "signin" && (
            <Pressable onPress={() => changeMode("help")}>
              <Text style={s.textButton}>Forgot your password?</Text>
            </Pressable>
          )}
          <View style={s.authDivider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>OR</Text>
            <View style={s.dividerLine} />
          </View>
          <Pressable
            style={({ pressed }) => [s.secondaryButton, pressed && s.pressed]}
            onPress={() => changeMode(mode === "signup" ? "signin" : "signup")}
            disabled={busy}
          >
            <Text style={s.secondaryButtonText}>
              {mode === "signup"
                ? "I already have an account"
                : "Create a member account"}
            </Text>
          </Pressable>
          {__DEV__ && (
            <Pressable
              style={({ pressed }) => [s.secondaryButton, pressed && s.pressed]}
              onPress={onDemo}
              disabled={busy}
            >
              <Text style={s.secondaryButtonText}>Explore demo</Text>
            </Pressable>
          )}
          {mode === "help" && (
            <Pressable onPress={() => changeMode("signin")}>
              <Text style={s.textButton}>Back to sign in</Text>
            </Pressable>
          )}
        </View>
        <Text style={s.privacyNote}>
          Your wellness information is visible only to you and your authorised
          coach. If you choose to join a circle, the people you accept see how
          much of your plan you have done — never your meals, reports, check-ins
          or messages.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Scrolling back to the top when the screen changes.
 *
 * Every screen renders into one ScrollView that is never remounted, so React
 * Native keeps whatever offset the last screen was left at. Opening the record
 * from a scrolled-down Plan tab landed the member at the bottom of it, with the
 * heading somewhere above her — and the same happened for the movement session
 * and for opening an article.
 *
 * Only the ScrollView can reset its own offset, so it publishes the reset here
 * and screens that swap in place call it as they navigate. Tab and section
 * changes are handled centrally in the shell; this is for the screens that
 * change inside a tab, where the shell cannot see it happen.
 */
const ScrollTopContext = createContext<() => void>(() => {});

function useScrollToTop() {
  return useContext(ScrollTopContext);
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

function Pulse({
  doc,
  onChange,
}: {
  doc: MemberDoc;
  onChange: (doc: MemberDoc) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const moods = [
    { label: "Good", glyph: "◡", energy: 4, stress: 4 },
    { label: "Okay", glyph: "—", energy: 3, stress: 3 },
    { label: "Tired", glyph: "☾", energy: 2, stress: 3 },
    { label: "Stressed", glyph: "⌁", energy: 2, stress: 2 },
  ];
  const current = doc.pulses.find((p) => p.dayOffset === 0);

  const save = (patch: Partial<PulseEntry>) => {
    const pulse: PulseEntry = {
      id: current?.id ?? newId("pulse"),
      memberId: doc.member.id,
      dayOffset: 0,
      energy: current?.energy ?? 3,
      sleep: current?.sleep ?? 0,
      stress: current?.stress ?? 3,
      symptoms: current?.symptoms ?? [],
      note: current?.note,
      provenance: {
        source: "member_manual",
        enteredBy: doc.member.name,
        at: new Date().toISOString(),
      },
      ...patch,
      partial: !(patch.sleep ?? current?.sleep),
    };
    onChange({
      ...doc,
      pulses: [...doc.pulses.filter((p) => p.dayOffset !== 0), pulse],
    });
  };
  const choose = (mood: (typeof moods)[number]) =>
    save({ energy: mood.energy, stress: mood.stress });
  const toggleSignal = (signal: (typeof BODY_SIGNALS)[number]) => {
    const symptoms = current?.symptoms ?? [];
    save({
      symptoms: symptoms.includes(signal)
        ? symptoms.filter((item) => item !== signal)
        : [...symptoms, signal],
    });
  };

  return (
    <Card>
      <View style={s.rowBetween}>
        <Text style={s.cardTitle}>How are you feeling?</Text>
        {current && <Text style={s.saved}>✓ Saved</Text>}
      </View>
      <View style={s.moodRow}>
        {moods.map((mood) => {
          const active =
            current?.energy === mood.energy && current?.stress === mood.stress;
          return (
            <Pressable
              key={mood.label}
              style={s.mood}
              onPress={() => choose(mood)}
            >
              <View style={[s.moodCircle, active && s.moodCircleActive]}>
                <Text style={[s.moodGlyph, active && s.moodGlyphActive]}>
                  {mood.glyph}
                </Text>
              </View>
              <Text style={[s.moodLabel, active && s.moodLabelActive]}>
                {mood.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {current && (
        <Text style={s.pulseSummary}>
          Energy {current.energy}/5 · Calm {current.stress}/5 · Sleep{" "}
          {current.sleep ? `${current.sleep}/5` : "not added"}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        onPress={() => setDetailsOpen((value) => !value)}
        style={({ pressed }) => [s.pulseDetailsButton, pressed && s.pressed]}
      >
        <Text style={s.pulseDetailsText}>
          {detailsOpen ? "Hide recovery details" : "Add sleep or body signals"}
        </Text>
        {detailsOpen ? (
          <ChevronUp size={17} color={C.greenDeep} />
        ) : (
          <ChevronDown size={17} color={C.greenDeep} />
        )}
      </Pressable>
      {detailsOpen && (
        <View style={s.pulseDetails}>
          <Text style={s.logLabel}>HOW WAS YOUR SLEEP?</Text>
          <View style={s.sleepRow}>
            {([1, 2, 3, 4, 5] as const).map((value) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`Sleep quality ${value} out of 5`}
                accessibilityState={{ checked: current?.sleep === value }}
                key={value}
                onPress={() => save({ sleep: value })}
                style={[
                  s.sleepChoice,
                  current?.sleep === value && s.sleepChoiceActive,
                ]}
              >
                <Text
                  style={[
                    s.sleepChoiceValue,
                    current?.sleep === value && s.sleepChoiceValueActive,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.sleepScaleLabels}>
            <Text style={s.sleepScaleLabel}>Very poor</Text>
            <Text style={s.sleepScaleLabel}>Restorative</Text>
          </View>
          <Text style={s.logLabel}>BODY SIGNALS · OPTIONAL</Text>
          <View style={s.signalWrap}>
            {BODY_SIGNALS.map((signal) => {
              const selected = current?.symptoms?.includes(signal) ?? false;
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={signal}
                  onPress={() => toggleSignal(signal)}
                  style={[s.signalChip, selected && s.signalChipActive]}
                >
                  <Text
                    style={[
                      s.signalChipText,
                      selected && s.signalChipTextActive,
                    ]}
                  >
                    {signal}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.signalNote}>
            Bharosa records what you notice; it does not infer hormone levels or
            diagnose a condition. Choose “Coach input requested” when you want a
            human review.
          </Text>
        </View>
      )}
    </Card>
  );
}

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

/**
 * The questions we only ask once she has said we may.
 *
 * One component, used in two places: the last step of onboarding for anyone
 * who opts in there, and the About you screen for everyone else and for
 * anyone changing an answer later. Two copies of these questions would drift,
 * and the drift would be invisible — a member would answer one version and
 * the plan would read the other.
 *
 * Every question here is skippable. None of them blocks a plan; each one only
 * narrows what the generator reaches for. See lib/member-profile.ts for what
 * each answer actually changes.
 */
function DetailQuestions({
  equipment,
  setEquipment,
  lifeStage,
  setLifeStage,
  sleepBaseline,
  setSleepBaseline,
  trainingDays,
  setTrainingDays,
  wontDo,
  setWontDo,
  toggleIn,
  showGymEquipment,
}: {
  equipment: Equipment[];
  setEquipment: (value: Equipment[]) => void;
  lifeStage: LifeStage | undefined;
  setLifeStage: (value: LifeStage) => void;
  sleepBaseline: SleepBaseline | undefined;
  setSleepBaseline: (value: SleepBaseline) => void;
  trainingDays: Weekday[];
  setTrainingDays: (value: Weekday[]) => void;
  wontDo: string;
  setWontDo: (value: string) => void;
  toggleIn: <T,>(list: T[], value: T) => T[];
  /** Gym equipment is only worth asking about when she is training for an event. */
  showGymEquipment: boolean;
}) {
  return (
    <>
      <View style={s.detailBlock}>
        <Text style={s.detailLabel}>What do you have to train with?</Text>
        <Text style={s.detailHint}>
          Choose everything you can reach on a normal day. We only ever build a
          plan from what you pick here.
        </Text>
        <View style={s.chipWrap}>
          {EQUIPMENT_OPTIONS.filter((option) => option.place === "home").map(
            (option) => {
              const selected = equipment.includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={[s.chip, selected && s.chipActive]}
                  onPress={() => setEquipment(toggleIn(equipment, option.id))}
                >
                  <Text style={[s.chipText, selected && s.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
        {/* Sleds, ergs and medicine balls exist in the library as event
            stations, so they are only worth asking about when she is training
            for one. Without this list those movements are unreachable by
            everybody, which is what they were. */}
        {showGymEquipment && (
          <>
            <Text style={s.detailHint}>
              And at a gym, if you train at one:
            </Text>
            <View style={s.chipWrap}>
              {EQUIPMENT_OPTIONS.filter((option) => option.place === "gym").map(
                (option) => {
                  const selected = equipment.includes(option.id);
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      style={[s.chip, selected && s.chipActive]}
                      onPress={() =>
                        setEquipment(toggleIn(equipment, option.id))
                      }
                    >
                      <Text style={[s.chipText, selected && s.chipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </>
        )}
      </View>

      <View style={s.detailBlock}>
        <Text style={s.detailLabel}>Is any of this true right now?</Text>
        <Text style={s.detailHint}>
          Some of these change which movements are safe, and some change what
          is worth prioritising. Prefer not to say is a real answer.
        </Text>
        <View style={s.chipWrap}>
          {LIFE_STAGES.map((option) => {
            const selected = lifeStage === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.chip, selected && s.chipActive]}
                onPress={() => setLifeStage(option.id)}
              >
                <Text style={[s.chipText, selected && s.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.detailBlock}>
        <Text style={s.detailLabel}>How has your sleep been lately?</Text>
        <Text style={s.detailHint}>
          A hard few weeks means we start smaller, not that we ask more of you.
        </Text>
        <View style={s.chipWrap}>
          {SLEEP_BASELINES.map((option) => {
            const selected = sleepBaseline === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.chip, selected && s.chipActive]}
                onPress={() => setSleepBaseline(option.id)}
              >
                <Text style={[s.chipText, selected && s.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.detailBlock}>
        <Text style={s.detailLabel}>Which days suit you?</Text>
        <Text style={s.detailHint}>
          Pick the days you could realistically move on. Leave it blank and we
          will assume three.
        </Text>
        <View style={s.chipWrap}>
          {WEEKDAYS.map((option) => {
            const selected = trainingDays.includes(option.id);
            return (
              <Pressable
                key={option.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                style={[s.chip, s.dayChip, selected && s.chipActive]}
                onPress={() =>
                  setTrainingDays(toggleIn(trainingDays, option.id))
                }
              >
                <Text style={[s.chipText, selected && s.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.detailBlock}>
        <Text style={s.detailLabel}>Anything you would rather not do?</Text>
        <Text style={s.detailHint}>
          In your own words — "nothing on my knees", "no floor work". This is
          preference, not injury; the health question earlier covers that.
        </Text>
        <TextInput
          value={wontDo}
          onChangeText={setWontDo}
          multiline
          style={[s.input, s.detailInput]}
          placeholder="Optional"
          placeholderTextColor={C.faint}
        />
      </View>
    </>
  );
}

const GOAL_GROUP_LABELS: { group: GoalGroup; label: string }[] = [
  { group: "wellbeing", label: "How you want to feel" },
  { group: "capacity", label: "What you want to be able to do" },
  { group: "event", label: "Something you are training for" },
];

function Onboarding({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const saved = doc.onboarding;
  const [step, setStep] = useState(saved?.currentStep ?? 0);
  /*
   * Goal *ids*, not the labels shown on screen.
   *
   * Existing members have labels stored, and several of those labels have
   * since been reworded, so they are resolved through the profile module
   * rather than compared directly — otherwise a returning member would find
   * her goals screen blank. Labels are written back out in finish().
   */
  const [goals, setGoals] = useState<string[]>(
    doc.profile?.goals?.length
      ? doc.profile.goals
      : goalIdsFrom(saved?.goals ?? []),
  );
  /* Core. Asked of everyone, because the plan is not honest without it. */
  const [ageBand, setAgeBand] = useState<AgeBand | undefined>(
    doc.profile?.ageBand,
  );
  /*
   * Whether she agreed to be asked the finer questions.
   *
   * Undefined until she answers the gate either way, which is what makes
   * Continue wait for her there rather than skipping past it.
   */
  const [wantsDetail, setWantsDetail] = useState<boolean | undefined>(
    doc.profile?.detailConsent
      ? doc.profile.detailConsent === "given"
      : undefined,
  );
  const [equipment, setEquipment] = useState<Equipment[]>(
    doc.profile?.equipment ?? [],
  );
  const [lifeStage, setLifeStage] = useState<LifeStage | undefined>(
    doc.profile?.lifeStage,
  );
  const [sleepBaseline, setSleepBaseline] = useState<SleepBaseline | undefined>(
    doc.profile?.sleepBaseline,
  );
  const [trainingDays, setTrainingDays] = useState<Weekday[]>(
    doc.profile?.trainingDays ?? [],
  );
  const [wontDo, setWontDo] = useState(doc.profile?.wontDo ?? "");
  /*
   * Her event, held as three separate answers while she edits.
   *
   * Assembled into a stored EventTarget only on save, which is where the
   * week count becomes a real date and the block start is stamped.
   */
  const [eventKind, setEventKind] = useState<EventKind | undefined>(
    doc.profile?.event?.kind,
  );
  const [weeksAway, setWeeksAway] = useState<number | undefined>(
    doc.profile?.event ? weeksUntil(doc.profile.event.dateIso) : undefined,
  );
  const [weeklyKm, setWeeklyKm] = useState<number | undefined>(
    doc.profile?.event?.currentWeeklyKm,
  );
  const wantsEvent = needsEventDetail(goals);
  /** Assembled on save. Undefined until all three are answered. */
  const eventTarget =
    wantsEvent && eventKind && weeksAway !== undefined && weeklyKm !== undefined
      ? {
          kind: eventKind,
          dateIso: isoWeeksFromToday(weeksAway),
          currentWeeklyKm: weeklyKm,
          startedOn: doc.profile?.event?.startedOn ?? isoWeeksFromToday(0),
        }
      : undefined;

  const [activity, setActivity] = useState(saved?.activityLevel ?? "");
  const [minutes, setMinutes] = useState(saved?.availableMinutes ?? 15);
  const [otherMinutes, setOtherMinutes] = useState(false);
  /**
   * Whether she has explicitly said there is nothing to work around.
   *
   * A blank caution used to pass straight through, which made "nothing to
   * declare" indistinguishable from "did not engage with the question" —
   * and the plan generator reads an absent caution as *no restrictions*.
   * Requiring an answer either way is what makes the empty case meaningful.
   */
  const [nothingToAdd, setNothingToAdd] = useState(false);
  const [caution, setCaution] = useState(saved?.movementCaution ?? "");
  const [checkIn, setCheckIn] = useState<"morning" | "evening">(
    saved?.preferredCheckIn ?? "morning",
  );
  const [readinessAnswers, setReadinessAnswers] = useState<
    Record<string, ReadinessAnswer>
  >(doc.readiness?.answers ?? {});
  const [wellnessConsent, setWellnessConsent] = useState(
    saved?.consent.wellness ?? false,
  );
  const [healthConsent, setHealthConsent] = useState(
    saved?.consent.healthConnect ?? false,
  );
  const [aiConsent, setAiConsent] = useState(
    saved?.consent.aiPersonalisation ?? false,
  );
  const toggleGoal = (value: string) =>
    setGoals((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length < 3
          ? [...current, value]
          : current,
    );
  /** Add or remove a value in a multi-select answer. */
  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  const finish = () =>
    update({
      ...doc,
      member: {
        ...doc.member,
        // The one thing lib/day-offset.ts's programWeek() counts her twelve
        // weeks from. Never previously set anywhere, which is why every
        // member's program week silently froze at 1 forever — see that
        // file's rebaseMemberDoc(). Keeps an existing value rather than
        // overwriting it, in case she is ever routed back through this flow
        // after already finishing it once.
        onboardedAt: doc.member.onboardedAt ?? new Date().toISOString(),
        // Labels, not ids. This list is read by her coach and by the
        // daily-action rules, both of which work in her language. The ids
        // live in doc.profile, which is what the generator reads.
        goals: [
          ...goals.map(goalLabel),
          ...doc.member.goals.filter(
            (item) => !goals.map(goalLabel).includes(item),
          ),
        ],
        constraints: caution.trim()
          ? [
              caution.trim(),
              ...doc.member.constraints.filter(
                (item) => item !== caution.trim(),
              ),
            ]
          : doc.member.constraints,
      },
      readiness: {
        answers: readinessAnswers,
        completedAt: new Date().toISOString(),
        ...evaluateReadiness(readinessAnswers),
      },
      profile: {
        ageBand,
        goals,
        // Recorded either way. "She said no" and "she was never asked" lead
        // to the same empty profile otherwise, and only one of them should
        // be asked again.
        detailConsent: wantsDetail ? "given" : "declined",
        // Her event sits outside the detail gate: it belongs to the goal,
        // not to the optional questions, and without it the goal cannot be
        // acted on at all.
        event: eventTarget,
        ...(wantsDetail
          ? {
              equipment,
              lifeStage,
              sleepBaseline,
              trainingDays,
              wontDo: wontDo.trim() || undefined,
            }
          : {}),
      },
      onboarding: {
        completed: true,
        currentStep: lastStep + 1,
        goals: goals.map(goalLabel),
        // Kept rather than re-derived: a goal she typed into the old
        // free-text box is still hers, even though nothing offers it now.
        customGoal: saved?.customGoal,
        activityLevel: activity,
        availableMinutes: minutes,
        movementCaution: caution.trim(),
        // Records that she answered, so an empty caution means "nothing to
        // declare" rather than "never asked".
        movementCautionAnswered: true,
        preferredCheckIn: checkIn,
        consent: {
          wellness: wellnessConsent,
          healthConnect: healthConsent,
          aiPersonalisation: aiConsent,
        },
      },
    });
  /*
   * The last step, which depends on her answer to the gate.
   *
   * Declining ends the flow at the gate itself, so saying no costs her
   * nothing — that is the whole promise the gate makes.
   */
  const lastStep = wantsDetail ? 9 : 8;

  const canContinue =
    step === 0
      ? Boolean(ageBand)
      : step === 1
        ? goals.length >= 1
        : step === 2
          ? Boolean(activity)
          : step === 4
            ? Boolean(caution.trim()) || nothingToAdd
            : step === 6
              ? readinessIsComplete(readinessAnswers)
              : step === 7
                ? wellnessConsent
                : step === 8
                  ? wantsDetail !== undefined
                  : true;

  let question: React.ReactNode;
  if (step === 0)
    question = (
      <>
        <Text style={s.onboardingTitle}>Which decade are you in?</Text>
        <Text style={s.onboardingCopy}>
          This sets where your plan starts and how fast it builds. A decade is
          all we need — not a birthday.
        </Text>
        <View style={s.optionStack}>
          {AGE_BANDS.map((option) => {
            const selected = ageBand === option.band;
            return (
              <Pressable
                key={option.band}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.option, selected && s.optionActive]}
                onPress={() => setAgeBand(option.band)}
              >
                <Text style={[s.optionText, selected && s.optionTextActive]}>
                  {option.label}
                </Text>
                {selected && <Check size={17} color={C.greenDeep} />}
              </Pressable>
            );
          })}
        </View>
      </>
    );
  else if (step === 1)
    question = (
      <>
        <Text style={s.onboardingTitle}>
          What should Bharosa help you change?
        </Text>
        <Text style={s.onboardingCopy}>
          Choose one to three goals. The order you choose becomes the priority
          order.
        </Text>
        <View style={s.selectionCount}>
          <Text style={s.selectionCountText}>{goals.length}/3 selected</Text>
          {goals.length === 3 && (
            <Text style={s.selectionLimit}>Maximum reached</Text>
          )}
        </View>
        {GOAL_GROUP_LABELS.map((group) => (
          <View key={group.group} style={s.goalGroup}>
            <Text style={s.goalGroupLabel}>{group.label}</Text>
            <View style={s.optionStack}>
              {GOAL_OPTIONS.filter(
                (option) => option.group === group.group,
              ).map((option) => {
                const selected = goals.includes(option.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={option.id}
                    style={[s.option, selected && s.optionActive]}
                    onPress={() => toggleGoal(option.id)}
                  >
                    <View style={s.goalOptionText}>
                      <Text
                        style={[s.optionText, selected && s.optionTextActive]}
                      >
                        {option.label}
                      </Text>
                      <Text style={s.goalDetail}>{option.detail}</Text>
                    </View>
                    {selected && (
                      <Text style={s.goalPriority}>
                        {goals.indexOf(option.id) + 1}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {wantsEvent && (
          <EventQuestions
            kind={eventKind}
            setKind={setEventKind}
            weeksAway={weeksAway}
            setWeeksAway={setWeeksAway}
            weeklyKm={weeklyKm}
            setWeeklyKm={setWeeklyKm}
          />
        )}
      </>
    );
  else if (step === 2)
    question = (
      <>
        <Text style={s.onboardingTitle}>
          What does movement look like today?
        </Text>
        <Text style={s.onboardingCopy}>
          This establishes a starting point; it is not a score.
        </Text>
        <View style={s.optionStack}>
          {["Mostly seated", "Some movement", "Regular exercise"].map(
            (value) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: activity === value }}
                key={value}
                style={[s.option, activity === value && s.optionActive]}
                onPress={() => setActivity(value)}
              >
                <Text
                  style={[
                    s.optionText,
                    activity === value && s.optionTextActive,
                  ]}
                >
                  {value}
                </Text>
                {activity === value && <Check size={17} color={C.greenDeep} />}
              </Pressable>
            ),
          )}
        </View>
      </>
    );
  else if (step === 3)
    question = (
      <>
        <Text style={s.onboardingTitle}>How much time is realistic?</Text>
        <Text style={s.onboardingCopy}>
          Choose a normal weekday—not your best-case day.
        </Text>
        <View style={s.minutesRow}>
          {[15, 30, 45, 60].map((value) => (
            <Pressable
              key={value}
              onPress={() => setMinutes(value)}
              style={[
                s.minuteChoice,
                minutes === value && s.minuteChoiceActive,
              ]}
            >
              <Text
                style={[s.minuteText, minutes === value && s.minuteTextActive]}
              >
                {value}
                <Text style={s.minuteUnit}> min</Text>
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Somebody who has twenty minutes, or ninety, should be able to say
            so. movementBudget() reads the number continuously, so any value
            in range sizes a real session — the four above are shortcuts, not
            the permitted set. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enter a different number of minutes"
          onPress={() => setOtherMinutes(true)}
        >
          <Text style={s.minutesOther}>
            {otherMinutes || ![15, 30, 45, 60].includes(minutes)
              ? "Some other amount"
              : "Some other amount?"}
          </Text>
        </Pressable>
        {(otherMinutes || ![15, 30, 45, 60].includes(minutes)) && (
          <View style={s.minutesCustomRow}>
            <TextInput
              style={[s.input, s.flex]}
              keyboardType="number-pad"
              value={String(minutes)}
              onChangeText={(text) => {
                const value = Number(text.replace(/[^0-9]/g, ""));
                setMinutes(Number.isFinite(value) ? Math.min(180, value) : 0);
              }}
              placeholder="Minutes on a normal weekday"
              placeholderTextColor={C.faint}
            />
            <Text style={s.minutesCustomUnit}>min</Text>
          </View>
        )}
      </>
    );
  else if (step === 4)
    question = (
      <>
        <Text style={s.onboardingTitle}>
          Anything your coach should respect?
        </Text>
        <Text style={s.onboardingCopy}>
          Pain, an injury, pregnancy, a limitation, anything a doctor has told
          you. This shapes which movements you are offered, so it is worth a
          moment.
        </Text>
        <TextInput
          value={caution}
          onChangeText={(text) => {
            setCaution(text);
            // Typing something is itself an answer.
            if (text.trim()) setNothingToAdd(false);
          }}
          style={[s.input, s.cautionInput]}
          multiline
          placeholder="e.g. Knee-sensitive; low impact preferred"
          placeholderTextColor={C.faint}
        />
        {/* An explicit "nothing", rather than letting a blank field mean it.
            A button beats asking someone to type the word "none". */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: nothingToAdd }}
          style={({ pressed }) => [
            s.nothingToAdd,
            nothingToAdd && s.nothingToAddOn,
            pressed && s.pressed,
          ]}
          onPress={() => {
            const next = !nothingToAdd;
            setNothingToAdd(next);
            if (next) setCaution("");
          }}
        >
          <View style={[s.checkBox, nothingToAdd && s.checkBoxOn]}>
            {nothingToAdd ? <Check size={13} color={C.card} /> : null}
          </View>
          <Text style={s.nothingToAddText}>
            Nothing to add — no injuries or limitations
          </Text>
        </Pressable>
      </>
    );
  else if (step === 5)
    question = (
      <>
        <Text style={s.onboardingTitle}>When should Bharosa check in?</Text>
        <Text style={s.onboardingCopy}>
          This changes reminder timing only. You stay in control.
        </Text>
        <View style={s.optionStack}>
          {(["morning", "evening"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setCheckIn(value)}
              style={[s.option, checkIn === value && s.optionActive]}
            >
              <Text
                style={[s.optionText, checkIn === value && s.optionTextActive]}
              >
                {value === "morning"
                  ? "Morning · plan the day"
                  : "Evening · reflect and prepare"}
              </Text>
              {checkIn === value && <Check size={17} color={C.greenDeep} />}
            </Pressable>
          ))}
        </View>
      </>
    );
  else if (step === 6)
    question = (
      <>
        <Text style={s.onboardingTitle}>
          A few questions before you start moving
        </Text>
        <Text style={s.onboardingCopy}>
          These are the standard checks before starting any exercise plan. They
          decide which movements you are offered — not whether you can use
          Bharosa. If you are not sure about one, say so.
        </Text>
        <View style={s.optionStack}>
          {READINESS_QUESTIONS.map((item) => (
            <View key={item.id} style={s.readinessBlock}>
              <Text style={s.readinessPrompt}>{item.prompt}</Text>
              {item.hint ? (
                <Text style={s.readinessHint}>{item.hint}</Text>
              ) : null}
              <View style={s.readinessRow}>
                {(["no", "yes", "unsure"] as const).map((value) => {
                  const active = readinessAnswers[item.id] === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${item.prompt} — ${value === "unsure" ? "not sure" : value}`}
                      style={[s.readinessChoice, active && s.optionActive]}
                      onPress={() =>
                        setReadinessAnswers((current) => ({
                          ...current,
                          [item.id]: value,
                        }))
                      }
                    >
                      <Text
                        style={[s.optionText, active && s.optionTextActive]}
                      >
                        {value === "unsure"
                          ? "Not sure"
                          : value === "yes"
                            ? "Yes"
                            : "No"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
        {readinessIsComplete(readinessAnswers) && (
          <View style={s.readinessOutcome}>
            <Text style={s.readinessOutcomeTitle}>
              {
                readinessMessage(evaluateReadiness(readinessAnswers).outcome)
                  .title
              }
            </Text>
            <Text style={s.readinessOutcomeBody}>
              {
                readinessMessage(evaluateReadiness(readinessAnswers).outcome)
                  .body
              }
            </Text>
          </View>
        )}
      </>
    );
  else if (step === 7)
    question = (
      <>
        <Text style={s.onboardingTitle}>Choose what you share.</Text>
        <Text style={s.onboardingCopy}>
          Core wellness consent is required. Connected health and AI
          personalisation are separate and optional.
        </Text>
        <View style={s.consentStack}>
          <View style={s.consentRow}>
            <View style={s.flex}>
              <Text style={s.consentTitle}>Wellness coaching data</Text>
              <Text style={s.consentCopy}>
                Needed to save your plan, logs and coach conversation.
              </Text>
            </View>
            <Switch
              value={wellnessConsent}
              onValueChange={setWellnessConsent}
            />
          </View>
          <View style={s.consentRow}>
            <View style={s.flex}>
              <Text style={s.consentTitle}>{CONNECTED_HEALTH_NAME}</Text>
              <Text style={s.consentCopy}>
                Permission for each metric is still requested later.
              </Text>
            </View>
            <Switch value={healthConsent} onValueChange={setHealthConsent} />
          </View>
          <View style={s.consentRow}>
            <View style={s.flex}>
              <Text style={s.consentTitle}>Bounded AI personalisation</Text>
              <Text style={s.consentCopy}>
                Uses limited aggregates only; no clinical documents.
              </Text>
            </View>
            <Switch value={aiConsent} onValueChange={setAiConsent} />
          </View>
        </View>
      </>
    );
  else if (step === 8)
    question = (
      <>
        <Text style={s.onboardingTitle}>
          Want to tell us a bit more about you?
        </Text>
        <Text style={s.onboardingCopy}>
          Your plan is ready either way. A few more answers — what you have to
          train with, how you have been sleeping, anything you would rather not
          do — let us fit it more closely to your week.
        </Text>
        <Text style={s.onboardingCopy}>
          These are more personal than what we have asked so far, so they are
          entirely your choice. You can answer them any time from{" "}
          <Text style={s.emphasis}>About you</Text> in the You tab, and change
          them whenever you like.
        </Text>
        <View style={s.optionStack}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: wantsDetail === true }}
            style={[s.option, wantsDetail === true && s.optionActive]}
            onPress={() => setWantsDetail(true)}
          >
            <View style={s.goalOptionText}>
              <Text
                style={[
                  s.optionText,
                  wantsDetail === true && s.optionTextActive,
                ]}
              >
                Yes, ask me now
              </Text>
              <Text style={s.goalDetail}>Four short questions</Text>
            </View>
            {wantsDetail === true && <Check size={17} color={C.greenDeep} />}
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: wantsDetail === false }}
            style={[s.option, wantsDetail === false && s.optionActive]}
            onPress={() => setWantsDetail(false)}
          >
            <View style={s.goalOptionText}>
              <Text
                style={[
                  s.optionText,
                  wantsDetail === false && s.optionTextActive,
                ]}
              >
                Not now
              </Text>
              <Text style={s.goalDetail}>
                Start with the plan; add details later
              </Text>
            </View>
            {wantsDetail === false && <Check size={17} color={C.greenDeep} />}
          </Pressable>
        </View>
      </>
    );
  else if (step === 9)
    question = (
      <>
        <Text style={s.onboardingTitle}>A little more about you</Text>
        <Text style={s.onboardingCopy}>
          Skip anything you would rather not answer — every one of these has a
          sensible default, and none of them blocks your plan.
        </Text>
        <DetailQuestions
          equipment={equipment}
          setEquipment={setEquipment}
          lifeStage={lifeStage}
          setLifeStage={setLifeStage}
          sleepBaseline={sleepBaseline}
          setSleepBaseline={setSleepBaseline}
          trainingDays={trainingDays}
          setTrainingDays={setTrainingDays}
          wontDo={wontDo}
          setWontDo={setWontDo}
          toggleIn={toggleIn}
          showGymEquipment={wantsEvent}
        />
      </>
    );

  return (
    <>
      <Text style={s.eyebrow}>LET’S PERSONALISE YOUR START</Text>
      <Text style={s.hero}>A plan that fits your real week.</Text>
      <Text style={s.heroCopy}>
        A few focused questions so your plan fits your week, your body and the
        time you actually have.
      </Text>
      <View style={s.onboardingProgress}>
        {Array.from({ length: lastStep + 1 }, (_, value) => value).map((value) => (
          <View
            key={value}
            style={[
              s.onboardingProgressPart,
              value <= step && s.onboardingProgressActive,
            ]}
          />
        ))}
      </View>
      <Card style={s.onboardingCard}>
        {question}
        <View style={s.onboardingActions}>
          {step > 0 && (
            <Pressable onPress={() => setStep(step - 1)} style={s.backButton}>
              <Text style={s.backButtonText}>Back</Text>
            </Pressable>
          )}
          <Pressable
            disabled={!canContinue}
            onPress={() => (step === lastStep ? finish() : setStep(step + 1))}
            style={[s.continueButton, !canContinue && s.disabledButton]}
          >
            <Text style={s.continueButtonText}>
              {step === lastStep ? "Create my starting plan" : "Continue"}
            </Text>
          </Pressable>
        </View>
      </Card>
      <Text style={s.privacyNote}>
        You can change these answers later. They guide coaching; they are not a
        medical assessment.
      </Text>
    </>
  );
}

/**
 * Today, at a glance.
 *
 * This screen used to render every action in full, one after another. That was
 * reasonable when a day held five actions — one per domain. Then plan
 * generation started producing a movement session of up to six exercises
 * *plus* the four other domains, so the same layout was asked to show ten
 * expandable cards, each with a form-guide photograph. The screen roughly
 * doubled and became a scroll nobody finishes.
 *
 * So the day is now a summary: five rows, one per domain, each showing what it
 * is and whether it is done. The movement session — the only part with real
 * depth — opens on its own screen. The other four are a single small action
 * each and expand where they are, because sending someone to a new page to
 * tick "drink a glass of water" is worse than the scrolling was.
 *
 * The rule this follows: one screen answers one question. Today answers "what
 * am I doing today, and how far in am I". Anything needing more than a line
 * gets its own space rather than being stacked here.
 */
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

const AWARD_ICONS: Record<AwardIcon, typeof Sparkles> = {
  sparkles: Sparkles,
  check: Check,
  trophy: Trophy,
  calendar: CalendarDays,
  home: Home,
  dumbbell: Dumbbell,
  footprints: Footprints,
  utensils: Utensils,
  heart: HeartPulse,
  moon: MoonStar,
  shield: ShieldCheck,
  users: Users,
};

/**
 * One row that scrolls sideways, with the description inside the same card.
 *
 * The first version stacked a full-width card per award and opened the
 * description underneath all of them, which both added scrolling — the thing
 * this whole redesign exists to remove — and made the description read as an
 * unrelated panel. Everything is one card now: the strip along the top, and
 * whatever is selected directly beneath it, so the tap and its answer are
 * never more than a few pixels apart.
 *
 * Earned awards sort to the front, so the collection is what she sees first
 * and the next thing to reach for sits immediately after it.
 */ function Awards({ doc }: { doc: MemberDoc }) {
  const metrics = awardMetrics(doc);
  const ordered = [...AWARDS].sort(
    (a, b) => Number(b.earned(metrics)) - Number(a.earned(metrics)),
  );
  const earnedCount = AWARDS.filter((award) => award.earned(metrics)).length;
  // Open on the next thing within reach rather than something already won.
  const suggested =
    ordered.find((award) => !award.earned(metrics)) ?? ordered[0]!;
  const [selectedId, setSelectedId] = useState<string>(suggested.id);
  const selected = AWARDS.find((award) => award.id === selectedId) ?? suggested;
  const isEarned = selected.earned(metrics);

  return (
    <>
      <View style={s.sectionHead}>
        <Text style={s.sectionHeadTitle}>Awards</Text>
        <Text style={s.sectionMeta}>
          {earnedCount} of {AWARDS.length} earned
        </Text>
      </View>
      <Card style={s.awardsCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.awardStrip}
        >
          {ordered.map((award) => {
            const earned = award.earned(metrics);
            const active = award.id === selectedId;
            const AwardIconComponent = AWARD_ICONS[award.icon];
            return (
              <Pressable
                key={award.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${award.title}. ${
                  earned ? "Earned." : "Not yet earned."
                }`}
                style={s.awardItem}
                onPress={() => setSelectedId(award.id)}
              >
                <View
                  style={[
                    s.awardBadge,
                    earned && s.awardBadgeEarned,
                    active && s.awardBadgeActive,
                  ]}
                >
                  <AwardIconComponent
                    size={23}
                    color={earned ? C.marigold : C.faint}
                    strokeWidth={earned ? 2 : 1.5}
                  />
                </View>
                <Text
                  numberOfLines={2}
                  style={[
                    s.awardLabel,
                    earned && s.awardLabelEarned,
                    active && s.awardLabelActive,
                  ]}
                >
                  {award.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[s.awardDetail, isEarned && s.awardDetailEarned]}>
          <Text style={s.awardDetailTitle}>{selected.title}</Text>
          <Text style={s.awardDetailCopy}>{selected.copy}</Text>
          <Text
            style={[s.awardDetailState, isEarned && s.awardDetailStateEarned]}
          >
            {isEarned
              ? "Earned"
              : (selected.progress?.(metrics) ?? "Not yet earned")}
          </Text>
        </View>
      </Card>
    </>
  );
}

function Journey({ doc }: { doc: MemberDoc }) {
  const plans = weekPlansFor(doc.member);
  const [selectedWeek, setSelectedWeek] = useState(doc.member.week);
  const selected =
    plans.find((plan) => plan.week === selectedWeek) ??
    plans[doc.member.week - 1] ??
    plans[0]!;
  const weekEndOffset = (selectedWeek - doc.member.week) * 7;
  const weekStartOffset = weekEndOffset - 6;
  const selectedActions = doc.actions.filter(
    (action) =>
      action.dayOffset >= weekStartOffset && action.dayOffset <= weekEndOffset,
  );
  const weekWin = findWeekWin(selectedActions, doc.actions, doc.workoutLogs);
  const selectedCompleted = selectedActions.filter(
    (action) => action.completed && action.completed !== "rest",
  ).length;
  const state =
    selectedWeek < doc.member.week
      ? "past"
      : selectedWeek === doc.member.week
        ? "current"
        : "future";
  return (
    <>
      <Text style={s.eyebrow}>YOUR 12-WEEK JOURNEY</Text>
      <View style={s.journeyHeroRow}>
        <View>
          <Text style={s.hero}>Week {doc.member.week} of 12</Text>
          <Text style={s.heroCopy}>
            {doc.member.phase} · {Math.round((doc.member.week / 12) * 100)}%
            through the strategic journey
          </Text>
        </View>
      </View>
      <View style={s.journeyTrack}>
        <View
          style={[
            s.journeyTrackFill,
            { width: `${Math.min(100, (doc.member.week / 12) * 100)}%` },
          ]}
        />
      </View>
      <View style={s.phaseGrid}>
        {PHASES.map((item) => (
          <View
            key={item.phase}
            style={[
              s.phaseCard,
              item.phase === doc.member.phase && s.phaseCardActive,
            ]}
          >
            <Text
              style={[
                s.phaseName,
                item.phase === doc.member.phase && s.phaseNameActive,
              ]}
            >
              {item.phase}
            </Text>
            <Text style={s.phaseWeeks}>{item.weeks}</Text>
            <Text style={s.phasePromise}>{item.promise}</Text>
          </View>
        ))}
      </View>
      <Text style={s.sectionTitle}>Explore every week</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.weekTimeline}
      >
        {plans.map((plan) => {
          const weekState =
            plan.week < doc.member.week
              ? "past"
              : plan.week === doc.member.week
                ? "current"
                : "future";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: plan.week === selectedWeek }}
              key={plan.week}
              onPress={() => setSelectedWeek(plan.week)}
              style={[
                s.weekButton,
                weekState === "past" && s.weekButtonPast,
                weekState === "current" && s.weekButtonCurrent,
                plan.week === selectedWeek && s.weekButtonSelected,
              ]}
            >
              <Text
                style={[
                  s.weekNumber,
                  (weekState === "current" || plan.week === selectedWeek) &&
                    s.weekNumberActive,
                ]}
              >
                {plan.week}
              </Text>
              <Text
                style={[
                  s.weekState,
                  (weekState === "current" || plan.week === selectedWeek) &&
                    s.weekNumberActive,
                ]}
              >
                {weekState === "past"
                  ? "Done"
                  : weekState === "current"
                    ? "Now"
                    : "Next"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Card style={s.weekDetail}>
        <View style={s.rowBetween}>
          <View style={s.flex}>
            <Text style={s.weekDetailKicker}>
              {state === "past"
                ? "COMPLETED WEEK"
                : state === "current"
                  ? "CURRENT WEEK"
                  : "TENTATIVE · ADJUSTS WITH YOUR PROGRESS"}
            </Text>
            <Text style={s.weekDetailTitle}>
              Week {selected.week} · {selected.phase}
            </Text>
          </View>
          <Text style={s.weekDetailCount}>
            {state === "past"
              ? `${selectedCompleted}/${selectedActions.length || "—"}`
              : `${selected.moduleIds.length} modules`}
          </Text>
        </View>
        <Text style={s.weekDetailSection}>Planned focus</Text>
        {selected.focus.map((focus) => (
          <View key={focus} style={s.listRow}>
            <Text style={s.bullet}>{state === "past" ? "✓" : "•"}</Text>
            <Text style={s.listText}>{focus}</Text>
          </View>
        ))}
        <Text style={s.weekDetailSection}>How we will work on it</Text>
        <View style={s.moduleChips}>
          {selected.moduleIds.map((module) => (
            <View key={module} style={s.moduleChip}>
              <Text style={s.moduleChipText}>{moduleName(module)}</Text>
            </View>
          ))}
        </View>
        {state === "past" &&
          (weekWin ? (
            <View style={s.weekWin}>
              <Sparkles size={17} color={C.marigold} />
              <View style={s.flex}>
                <Text style={s.weekWinTitle}>Worth remembering</Text>
                <Text style={s.weekWinCopy}>{weekWin.text}</Text>
              </View>
            </View>
          ) : (
            // No invented win. A week with nothing notable in it is a normal
            // week, and calling a completion count an achievement is the kind
            // of hollow praise that discounts everything else the app says.
            <Text style={s.weekQuiet}>
              {selectedCompleted
                ? `${selectedCompleted} of ${selectedActions.length} planned actions done.`
                : "This week is part of your record even where life interrupted the plan."}
            </Text>
          ))}
        {selected.rationale && (
          <View style={s.planReason}>
            <Text style={s.whyLabel}>WHY THE PLAN CHANGED</Text>
            <Text style={s.planCopy}>{selected.rationale}</Text>
          </View>
        )}
      </Card>
      <Awards doc={doc} />
    </>
  );
}

function LearningLibrary({ weekFocus }: { weekFocus?: string[] }) {
  const [articleId, setArticleId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const scrollToTop = useScrollToTop();
  const openArticle = (id: string | null) => {
    setArticleId(id);
    scrollToTop();
  };
  const article = LEARNING_ARTICLES.find((item) => item.id === articleId);
  if (article)
    return (
      <View style={s.learningDetail}>
        <Pressable onPress={() => openArticle(null)}>
          <Text style={s.learningBack}>‹ All articles</Text>
        </Pressable>
        <Text style={s.learningCategory}>
          {article.category.toUpperCase()} · {article.readMinutes} MIN READ
        </Text>
        <Text style={s.learningTitle}>{article.title}</Text>
        {article.body.map((paragraph, index) => (
          <Text key={index} style={s.learningParagraph}>
            {paragraph}
          </Text>
        ))}
        <View style={s.educationNote}>
          <Text style={s.educationNoteText}>
            Education only—not diagnosis or individual medical advice.
          </Text>
        </View>
      </View>
    );
  const focus = (weekFocus ?? []).join(" ").toLowerCase();
  /**
   * Ordered by what this week is about, not alphabetically. A member reading
   * five guides in a row is not the behaviour to design for; a member reading
   * the one that matches the week she is in might be.
   */
  const relevant = [...LEARNING_ARTICLES].sort((a, b) => {
    const score = (item: (typeof LEARNING_ARTICLES)[number]) => {
      const category = item.category.toLowerCase();
      if (focus.includes(category)) return 2;
      if (
        (category === "recovery" && /sleep|rest|recover/.test(focus)) ||
        (category === "movement" && /strength|walk|move|mobil/.test(focus)) ||
        (category === "nutrition" &&
          /protein|meal|food|nutrition/.test(focus)) ||
        (category === "mindset" && /stress|reflect|mind/.test(focus))
      )
        return 2;
      return 0;
    };
    return score(b) - score(a);
  });

  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={s.sectionHeadTitle}>Reading for this week</Text>
        <Text style={s.sectionMeta}>{relevant.length} guides</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [s.learnToggle, pressed && s.pressed]}
        onPress={() => setOpen((value) => !value)}
      >
        <View style={s.flex}>
          <Text style={s.cardTitle}>
            {open ? "Hide the reading list" : "Open the reading list"}
          </Text>
          <Text style={s.domainRowDetail}>
            Chosen for where you are now — most relevant first
          </Text>
        </View>
        {open ? (
          <ChevronUp size={18} color={C.faint} />
        ) : (
          <ChevronDown size={18} color={C.faint} />
        )}
      </Pressable>
      {open &&
        relevant.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => openArticle(item.id)}
            style={({ pressed }) => [s.articleCard, pressed && s.pressed]}
          >
            <View style={s.articleMeta}>
              <Text style={s.articleCategory}>
                {item.category.toUpperCase()}
              </Text>
              <Text style={s.articleMinutes}>{item.readMinutes} min</Text>
            </View>
            <Text style={s.articleTitle}>{item.title}</Text>
            <Text style={s.articleSummary}>{item.summary}</Text>
            <Text style={s.articleOpen}>Read guide ›</Text>
          </Pressable>
        ))}
    </View>
  );
}

/**
 * The record of what actually happened.
 *
 * Progress used to be four summary cards — a fortnight of dots, two averages
 * and a symptom count. That answers "roughly how has it been", which is a
 * smaller question than the one a member has after eight weeks: *what did I
 * actually do?*
 *
 * This is the whole record, one day at a time: the movements completed and how
 * they felt, the meals logged with their protein, the check-in, and water.
 * Everything the app has ever stored about her, arranged by the day it
 * happened.
 *
 * Fourteen days are shown, because that is a fortnight of real detail rather
 * than an unreadable wall, and the rest loads on request. A ninety-day
 * programme is ninety days of record; it just does not all need rendering
 * before she has asked for it.
 *
 * The tone rules matter here more than anywhere. This is the screen most likely
 * to be read as a report card, so an empty day says "nothing recorded" and
 * stops there. No red, no "missed", no gaps counted up. A quiet Tuesday in
 * March is not a failure to be reminded of in June.
 */
function History({ doc }: { doc: MemberDoc }) {
  const [days, setDays] = useState(14);

  const dayOf = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return isoDate(date);
  };

  /** How far back there is anything at all, so "show more" can stop. */
  const oldest = Math.min(
    0,
    ...(doc.actions ?? []).map((a) => a.dayOffset),
    ...(doc.pulses ?? []).map((p) => p.dayOffset),
    ...liveMeals(doc).map((f) => f.dayOffset ?? 0),
  );
  const available = Math.max(14, Math.abs(oldest) + 1);

  const rows = Array.from({ length: Math.min(days, available) }, (_, i) => {
    const offset = -i;
    const date = dayOf(offset);
    const actions = (doc.actions ?? []).filter(
      (a) => a.dayOffset === offset && a.completed,
    );
    const meals = liveMeals(doc).filter((f) => f.loggedDate === date);
    const pulse = (doc.pulses ?? []).find((p) => p.dayOffset === offset);
    const logs = (doc.workoutLogs ?? []).filter((log) => {
      const at = String(
        (log as unknown as Record<string, unknown>).completedAt ?? "",
      );
      return at.slice(0, 10) === date;
    });
    const water = doc.hydrationLogs?.find((entry) => entry.date === date);
    return { offset, date, actions, meals, pulse, logs, water };
  }).filter(
    (row) =>
      row.offset === 0 ||
      row.actions.length ||
      row.meals.length ||
      row.pulse ||
      row.water,
  );

  const protein = (row: (typeof rows)[number]) =>
    row.meals.reduce((sum, meal) => sum + (meal.protein ?? 0), 0);

  return (
    <>
      <Text style={s.eyebrow}>YOUR RECORD</Text>
      <Text style={s.hero}>Everything, day by day.</Text>
      <Text style={s.heroCopy}>
        What you did, what you ate and how you felt — kept so you can look back,
        not so anything can be scored.
      </Text>

      {rows.length === 0 && (
        <Card>
          <Text style={s.empty}>
            Your record starts the first day you log something.
          </Text>
        </Card>
      )}

      {rows.map((row) => {
        const label =
          row.offset === 0
            ? "Today"
            : row.offset === -1
              ? "Yesterday"
              : new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                });
        const nothing =
          !row.actions.length && !row.meals.length && !row.pulse && !row.water;
        return (
          <Card key={row.date} style={s.historyDay}>
            <View style={s.rowBetween}>
              <Text style={s.historyDate}>{label}</Text>
              {row.actions.length > 0 && (
                <Text style={s.historyCount}>
                  {row.actions.length} completed
                </Text>
              )}
            </View>

            {nothing ? (
              <Text style={s.historyQuiet}>Nothing recorded.</Text>
            ) : null}

            {row.actions.map((action) => {
              const log = row.logs.find(
                (item) =>
                  String(
                    (item as unknown as Record<string, unknown>).actionId ?? "",
                  ) === action.id,
              );
              const effort = log
                ? Number(
                    (log as unknown as Record<string, unknown>)
                      .perceivedEffort ?? 0,
                  )
                : 0;
              return (
                <View key={action.id} style={s.historyLine}>
                  <View style={s.historyDot} />
                  <View style={s.flex}>
                    <Text style={s.historyItem}>{action.title}</Text>
                    <Text style={s.historyMeta}>
                      {action.completed === "rest"
                        ? describeSkip(action.skipKind)
                        : `${action.completed}${effort ? ` · felt ${["", "very easy", "easy", "steady", "hard", "very hard"][effort]}` : ""}`}
                    </Text>
                  </View>
                </View>
              );
            })}

            {row.meals.length > 0 && (
              <View style={s.historyLine}>
                <View style={[s.historyDot, s.historyDotFood]} />
                <View style={s.flex}>
                  <Text style={s.historyItem}>
                    {row.meals.length} meal{row.meals.length === 1 ? "" : "s"}
                    {protein(row)
                      ? ` · ${Math.round(protein(row))}g protein`
                      : ""}
                  </Text>
                  <Text style={s.historyMeta} numberOfLines={2}>
                    {row.meals.map((meal) => meal.description).join(" · ")}
                  </Text>
                </View>
              </View>
            )}

            {row.pulse && (
              <View style={s.historyLine}>
                <View style={[s.historyDot, s.historyDotPulse]} />
                <View style={s.flex}>
                  <Text style={s.historyItem}>Check-in</Text>
                  <Text style={s.historyMeta}>
                    {[
                      row.pulse.energy ? `energy ${row.pulse.energy}/5` : "",
                      row.pulse.sleep ? `sleep ${row.pulse.sleep}/5` : "",
                      row.pulse.stress ? `stress ${row.pulse.stress}/5` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </View>
            )}

            {row.water && row.water.glasses > 0 && (
              <View style={s.historyLine}>
                <View style={[s.historyDot, s.historyDotWater]} />
                <Text style={s.historyItem}>
                  {row.water.glasses} glass
                  {row.water.glasses === 1 ? "" : "es"} of water
                </Text>
              </View>
            )}
          </Card>
        );
      })}

      {days < available && (
        <Pressable
          accessibilityRole="button"
          style={s.secondaryButton}
          onPress={() => setDays((value) => value + 28)}
        >
          <Text style={s.secondaryButtonText}>Show earlier days</Text>
        </Pressable>
      )}
    </>
  );
}

function Progress({ doc }: { doc: MemberDoc }) {
  const days = Array.from({ length: 14 }, (_, i) => i - 13);
  const active = days.filter((d) =>
    doc.actions.some(
      (a) => a.dayOffset === d && a.completed && a.completed !== "rest",
    ),
  ).length;
  const recent = [...doc.pulses]
    .filter((p) => p.dayOffset >= -13)
    .sort((a, b) => a.dayOffset - b.dayOffset);
  const sleepEntries = recent.filter((entry) => entry.sleep > 0);
  const averageSleep = sleepEntries.length
    ? sleepEntries.reduce((total, entry) => total + entry.sleep, 0) /
      sleepEntries.length
    : 0;
  const signalCounts = recent.reduce<Record<string, number>>(
    (counts, entry) => {
      (entry.symptoms ?? []).forEach((signal) => {
        counts[signal] = (counts[signal] ?? 0) + 1;
      });
      return counts;
    },
    {},
  );
  const commonSignals = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <>
      <Text style={s.eyebrow}>YOUR PROGRESS</Text>
      <Text style={s.hero}>{active} of 14 days</Text>
      <Text style={s.heroCopy}>
        included at least one healthy action. This is consistency—not a streak
        you can lose.
      </Text>
      <Card>
        <Text style={s.cardTitle}>The shape of your fortnight</Text>
        <View style={s.dotRow}>
          {days.map((d) => {
            const done = doc.actions.some(
              (a) => a.dayOffset === d && a.completed && a.completed !== "rest",
            );
            return <View key={d} style={[s.dayDot, done && s.dayDotDone]} />;
          })}
        </View>
      </Card>
      <Card>
        <Text style={s.cardTitle}>Energy check-ins</Text>
        {recent.length ? (
          recent.slice(-7).map((p) => (
            <View key={p.id} style={s.metricRow}>
              <Text style={s.metricDay}>
                {p.dayOffset === 0 ? "Today" : `${Math.abs(p.dayOffset)}d ago`}
              </Text>
              <View style={s.metricTrack}>
                <View style={[s.metricFill, { width: `${p.energy * 20}%` }]} />
              </View>
              <Text style={s.metricValue}>{p.energy}/5</Text>
            </View>
          ))
        ) : (
          <Text style={s.empty}>Your check-ins will appear here.</Text>
        )}
      </Card>
      <Card>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Sleep check-ins</Text>
          <Text style={s.sectionMeta}>Last 14 days</Text>
        </View>
        {sleepEntries.length ? (
          <>
            <View style={s.trendSummary}>
              <Text style={s.trendValue}>{averageSleep.toFixed(1)}/5</Text>
              <Text style={s.trendLabel}>
                average from {sleepEntries.length} member check-in
                {sleepEntries.length === 1 ? "" : "s"}
              </Text>
            </View>
            {sleepEntries.slice(-7).map((entry) => (
              <View key={`sleep-${entry.id}`} style={s.metricRow}>
                <Text style={s.metricDay}>
                  {entry.dayOffset === 0
                    ? "Today"
                    : `${Math.abs(entry.dayOffset)}d ago`}
                </Text>
                <View style={s.metricTrack}>
                  <View
                    style={[
                      s.metricFill,
                      s.sleepMetricFill,
                      { width: `${entry.sleep * 20}%` },
                    ]}
                  />
                </View>
                <Text style={s.metricValue}>{entry.sleep}/5</Text>
              </View>
            ))}
            <Text style={s.trendEvidence}>
              Source: your check-ins. This describes your entries; it does not
              diagnose a sleep or hormone condition.
            </Text>
          </>
        ) : (
          <Text style={s.empty}>
            Add sleep quality in Today to begin a personal baseline.
          </Text>
        )}
      </Card>
      <Card>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Body signals</Text>
          <Text style={s.sectionMeta}>{recent.length} check-ins reviewed</Text>
        </View>
        {commonSignals.length ? (
          <>
            {commonSignals.map(([signal, count]) => (
              <View key={signal} style={s.signalHistoryRow}>
                <Text style={s.signalHistoryName}>{signal}</Text>
                <Text style={s.signalHistoryCount}>
                  {count} entr{count === 1 ? "y" : "ies"}
                </Text>
              </View>
            ))}
            <Text style={s.trendEvidence}>
              Descriptive only. Repeated or concerning changes can be shared
              with your coach or clinician; Bharosa does not infer hormone
              levels from symptoms.
            </Text>
          </>
        ) : (
          <Text style={s.empty}>
            Optional observations from Today will appear here without a score.
          </Text>
        )}
      </Card>
    </>
  );
}

/**
 * Where anything gets recorded.
 *
 * A hub rather than a screen: four kinds of capture, the common one reachable
 * without opening anything, and one list of what she has actually logged. The
 * sections behind it are the screens that already existed — this does not
 * reimplement meal capture or the check-in, it gives them a shared front door
 * and a shared history.
 *
 * The Recent list is deliberately mixed rather than grouped by kind. Her day
 * happened in one order, and a member looking for "did I log lunch" is
 * looking for a moment, not for a category.
 */
function Log({
  doc,
  update,
  token,
  onOpenToday,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
  /** Workouts are logged by finishing the session, which lives on Today. */
  onOpenToday: () => void;
}) {
  const [section, setSection] = useState<null | LogKind>(null);
  const [mealMode, setMealMode] = useState<"photo" | "describe">("photo");
  const scrollToTop = useScrollToTop();
  useEffect(() => {
    scrollToTop();
  }, [section, scrollToTop]);

  const today = isoDate();
  const done = loggedToday(doc, today, doc.notes ?? []);
  const feed = buildLogFeed(doc, today, { limit: 6, notes: doc.notes ?? [] });

  const movementToday = (doc.actions ?? []).find(
    (action) => action.dayOffset === 0 && action.domain === "movement",
  );

  const CARDS: {
    kind: LogKind;
    Icon: typeof Utensils;
    label: string;
    detail: string;
  }[] = [
    {
      kind: "meal",
      Icon: Utensils,
      label: "Meal",
      detail: "Photo or description",
    },
    {
      kind: "checkin",
      Icon: Activity,
      label: "Check-in",
      detail: "Energy, sleep, stress",
    },
    {
      kind: "workout",
      Icon: Dumbbell,
      label: "Workout",
      detail: "Effort and any pain",
    },
    {
      kind: "note",
      Icon: PencilLine,
      label: "Note",
      detail: "Anything worth remembering",
    },
  ];

  if (section !== null)
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to log"
          style={s.backRow}
          onPress={() => setSection(null)}
        >
          <ChevronLeft size={18} color={C.green} />
          <Text style={s.backRowText}>Log</Text>
        </Pressable>
        {section === "meal" && (
          <Food doc={doc} update={update} token={token} startMode={mealMode} />
        )}
        {section === "checkin" && <Pulse doc={doc} onChange={update} />}
        {section === "workout" &&
          (movementToday ? (
            <Card>
              <Text style={s.cardTitle}>{movementToday.title}</Text>
              <Text style={s.cardCopy}>
                A workout is recorded by finishing the session itself, so that
                what gets logged is what you actually did rather than what you
                remember of it afterwards. Effort and any pain are asked at the
                end of the session.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.primaryButton}
                onPress={onOpenToday}
              >
                <Text style={s.primaryButtonText}>Open today's session</Text>
              </Pressable>
            </Card>
          ) : (
            <Card>
              <Text style={s.cardTitle}>No movement planned today</Text>
              <Text style={s.cardCopy}>
                A workout is logged by finishing the session on Today, so there
                is nothing to record until one is planned. If you did something
                of your own, a note is the honest place for it.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.secondaryButton}
                onPress={() => setSection("note")}
              >
                <Text style={s.secondaryButtonText}>Write a note instead</Text>
              </Pressable>
            </Card>
          ))}
        {section === "note" && <NoteCapture doc={doc} update={update} />}
      </>
    );

  return (
    <>
      <Text style={s.eyebrow}>LOG</Text>
      <Text style={s.hero}>What would you like to capture?</Text>
      <Text style={s.heroCopy}>
        Small inputs are what make tomorrow's plan feel like yours.
      </Text>

      <View style={s.captureGrid}>
        {CARDS.map((card) => (
          <Pressable
            key={card.kind}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}. ${card.detail}${done[card.kind] ? ". Already logged today" : ""}`}
            style={({ pressed }) => [
              s.captureCard,
              pressed && s.domainRowPressed,
            ]}
            onPress={() => setSection(card.kind)}
          >
            <View style={s.captureIcon}>
              <card.Icon size={17} color={C.greenDeep} />
            </View>
            <Text style={s.captureLabel}>{card.label}</Text>
            <Text style={s.captureDetail}>{card.detail}</Text>
            {/* Said quietly. It marks what she has given, and never asks her
                to give it again or implies she owes another. */}
            {done[card.kind] && (
              <Text style={s.captureDone}>Logged today</Text>
            )}
          </Pressable>
        ))}
      </View>

      <Card style={s.quickCaptureCard}>
        <Text style={s.cardTitle}>Quick meal capture</Text>
        <View style={s.quickModeRow}>
          {(
            [
              ["photo", "Take photo"],
              ["describe", "Describe meal"],
            ] as const
          ).map(([mode, label]) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              style={[
                s.quickModeChip,
                mealMode === mode && s.quickModeChipActive,
              ]}
              onPress={() => {
                setMealMode(mode);
                setSection("meal");
              }}
            >
              <Text
                style={[
                  s.quickModeText,
                  mealMode === mode && s.quickModeTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.captureDetail}>
          Bharosa suggests the foods and portions it can see. Nothing is saved
          until you confirm it.
        </Text>
      </Card>

      <Text style={s.sectionTitle}>Recent</Text>
      {feed.length === 0 ? (
        <Card>
          <Text style={s.cardCopy}>
            Nothing logged yet. Whatever you record here is what tomorrow's
            plan is built from.
          </Text>
        </Card>
      ) : (
        <Card style={s.glanceCard}>
          {feed.map((item, index) => (
            <View
              key={item.kind + item.id}
              style={[s.domainRow, index === 0 && s.domainRowFirst]}
            >
              <View style={s.domainRowIcon}>
                {item.kind === "meal" && <Utensils size={15} color={C.greenDeep} />}
                {item.kind === "checkin" && <Activity size={15} color={C.greenDeep} />}
                {item.kind === "workout" && <Dumbbell size={15} color={C.greenDeep} />}
                {item.kind === "note" && <PencilLine size={15} color={C.greenDeep} />}
              </View>
              <View style={s.flex}>
                <Text style={s.domainRowTitle}>
                  {item.title}
                  <Text style={s.feedWhen}> · {whenLabel(item, today)}</Text>
                </Text>
                <Text style={s.domainRowDetail} numberOfLines={2}>
                  {item.detail}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

/**
 * A short note, and the list of them.
 *
 * The only capture kind with no prior home. Deliberately unstructured: the
 * things worth remembering about a body — a knee that felt odd on stairs, a
 * week of bad sleep before a trip — do not fit the fields we already ask for,
 * and asking her to categorise them is how they stop being written down.
 *
 * Nothing reads these but her and her coach. They are not parsed, scored, or
 * fed to the plan, and the screen says so.
 */
function NoteCapture({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const [body, setBody] = useState("");
  const notes = (doc.notes ?? [])
    .filter((note) => !note.deletedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const save = () => {
    const text = body.trim();
    if (!text) return;
    update({
      ...doc,
      notes: [
        ...(doc.notes ?? []),
        {
          id: newId("note"),
          memberId: doc.member.id,
          loggedDate: isoDate(),
          body: text,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setBody("");
  };

  const remove = (id: string) =>
    update({
      ...doc,
      // A tombstone, not a deletion — the server merges these by union.
      notes: (doc.notes ?? []).map((note) =>
        note.id === id ? { ...note, deletedAt: new Date().toISOString() } : note,
      ),
    });

  return (
    <>
      <Text style={s.hero}>A note</Text>
      <Text style={s.heroCopy}>
        Anything worth remembering. Nothing reads these but you and your coach
        — they are not scored and they do not change your plan.
      </Text>
      <Card>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          style={[s.input, s.detailInput]}
          placeholder="Knee felt fine on the stairs today"
          placeholderTextColor={C.faint}
        />
        <Pressable
          accessibilityRole="button"
          style={[s.primaryButton, !body.trim() && s.disabledButton]}
          disabled={!body.trim()}
          onPress={save}
        >
          <Text style={s.primaryButtonText}>Save note</Text>
        </Pressable>
      </Card>
      {notes.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Earlier notes</Text>
          {notes.map((note) => (
            <Card key={note.id}>
              <Text style={s.cardCopy}>{note.body}</Text>
              <View style={s.rowBetween}>
                <Text style={s.captureDetail}>
                  {whenLabel(
                    {
                      id: note.id,
                      kind: "note",
                      title: "Note",
                      detail: note.body,
                      at: note.createdAt,
                      loggedDate: note.loggedDate,
                    },
                    isoDate(),
                  )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove this note"
                  onPress={() => remove(note.id)}
                >
                  <Text style={s.removeLink}>Remove</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </>
      )}
    </>
  );
}

function Food({
  doc,
  update,
  token,
  startMode,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
  /**
   * Which capture the Log hub's quick buttons asked for.
   *
   * Only an opening position — she can still switch once she is here, and
   * the screen behaves identically when it is absent.
   */
  startMode?: "photo" | "describe";
}) {
  const [description, setDescription] = useState("");
  /** What the last estimate was read from, shown so it can be judged. */
  /*
   * The estimate she has not agreed to yet.
   *
   * Nothing is written to her diary while this is set. The previous flow
   * saved first and showed the breakdown afterwards, which meant a number she
   * never looked at was already counted in her day and already visible to her
   * coach. See src/meal-estimate.ts.
   */
  const [proposal, setProposal] = useState<{
    /** What she typed, always kept, even when the photo leads. */
    typed: MealProposal;
    /** Null when there was no photo, or the model could not read it. */
    photo: MealProposal | null;
    /** Which of the two she is currently looking at. */
    using: EstimateSource;
    /** The items as she has adjusted them. */
    items: EstimateItem[];
    /** The items as they arrived, so an adjustment can be noticed. */
    original: EstimateItem[];
    /** Held until she saves, because the entry needs it. */
    photoFileId?: string;
    photoUri?: string;
    description: string;
  } | null>(null);
  /** The month is for reviewing history, which is occasional. Folded by default. */
  const [showCalendar, setShowCalendar] = useState(false);
  const [photoAsset, setPhotoAsset] = useState<ImagePicker.ImagePickerAsset>();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoUri = photoAsset?.uri;
  const [meal, setMeal] = useState<FoodEntry["meal"]>("Lunch");
  const [selectedDate, setSelectedDate] = useState(isoDate());
  const [month, setMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [editingId, setEditingId] = useState<string>();
  const [editValues, setEditValues] = useState({
    description: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const selectedEntries = liveMeals(doc).filter(
    (entry) => entry.loggedDate === selectedDate,
  );
  const total = selectedEntries.reduce((sum, entry) => sum + entry.calories, 0);
  const totalProtein = selectedEntries.reduce(
    (sum, entry) => sum + entry.protein,
    0,
  );
  const calendar = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const days = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > days) return null;
      const date = new Date(year, monthIndex, day);
      return { day, date: isoDate(date) };
    });
  }, [month]);
  const dailyTotals = useMemo(
    () =>
      liveMeals(doc).reduce<
        Record<string, { calories: number; protein: number }>
      >((result, entry) => {
        const current = result[entry.loggedDate] ?? { calories: 0, protein: 0 };
        result[entry.loggedDate] = {
          calories: current.calories + entry.calories,
          protein: current.protein + entry.protein,
        };
        return result;
      }, {}),
    [doc.foodEntries],
  );

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) setPhotoAsset(result.assets[0]);
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access is off",
        "Allow camera access in your phone settings to take a meal photo.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) setPhotoAsset(result.assets[0]);
  };
  const addPhoto = () =>
    Alert.alert("Add a meal photo", "Choose how you want to add it.", [
      { text: "Take photo", onPress: takePhoto },
      { text: "Choose library", onPress: choosePhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  /*
   * Tapping "Take photo" on the Log hub means take a photo.
   *
   * Opening the chooser on arrival is the whole point of that button; making
   * her tap a second one would make the quick path slower than the ordinary
   * one. Runs once, and only when she asked for it.
   */
  const openedFromHub = useRef(false);
  useEffect(() => {
    if (startMode !== "photo" || openedFromHub.current) return;
    openedFromHub.current = true;
    addPhoto();
  }, [startMode]);
  const add = async () => {
    if (!description.trim() && !photoUri) return;
    setUploadingPhoto(true);
    try {
      const stored = photoAsset
        ? await uploadMemberFile(
            token,
            {
              uri: photoAsset.uri,
              name: photoAsset.fileName,
              type: photoAsset.mimeType,
            },
            "meal-photo",
          )
        : null;
      const typed = estimateMeal(description || "meal from photo");
      /*
       * Her own words, as a proposal in their own right.
       *
       * A description estimate has no per-item breakdown — it comes from the
       * food table rather than from a model — so it carries a single item
       * standing for the whole meal. That keeps one shape through the confirm
       * step instead of two.
       */
      const typedProposal: MealProposal = {
        source: "description",
        confident: typed.confident,
        basis: typed.confident
          ? describeMatches(typed.matched)
          : "No familiar foods recognised",
        items: [
          {
            name: description.trim() || "This meal",
            quantity: 1,
            unit: "serving",
            calories: typed.calories,
            protein: typed.protein,
            carbs: typed.carbs,
            fat: typed.fat,
          },
        ],
      };

      // A photograph of the plate is better evidence than a remembered
      // description, so it leads when the model could read it. It never
      // replaces what she typed: both are kept and she can switch.
      let photoProposal: MealProposal | null = null;
      if (stored?.id) {
        try {
          const seen = await estimateMealPhoto(
            token,
            stored.id,
            description.trim() || undefined,
          );
          if (seen?.confident && seen.items.length)
            photoProposal = {
              source: "photo",
              items: seen.items,
              confident: true,
              basis: describeItems(seen.items),
              model: seen.model,
              promptVersion: seen.promptVersion,
            };
        } catch {
          // Her description stands. Logging a meal must never depend on a
          // model answering.
        }
      }

      // Nothing is saved here. She sees the breakdown, adjusts any portion
      // that is wrong, and decides — see confirmMeal below.
      const chosen = preferred(typedProposal, photoProposal);
      setProposal({
        typed: typedProposal,
        photo: photoProposal,
        using: chosen.source,
        items: chosen.items,
        original: chosen.items,
        photoFileId: stored?.id,
        photoUri: token === DEMO_TOKEN ? photoUri : undefined,
        description: description.trim() || "Meal captured from photo",
      });
    } catch (error) {
      Alert.alert(
        "Photo not saved",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };
  /** Switch between what she typed and what the photo read. */
  const useSource = (source: EstimateSource) =>
    setProposal((current) => {
      if (!current) return current;
      const next = source === "photo" ? current.photo : current.typed;
      if (!next) return current;
      return {
        ...current,
        using: source,
        items: next.items,
        original: next.items,
      };
    });

  /** Save what she has agreed to, with a record of where it came from. */
  const confirmMeal = () => {
    if (!proposal) return;
    const chosen =
      proposal.using === "photo" ? proposal.photo : proposal.typed;
    const totals = totalOf(proposal.items);
    const adjusted = wasAdjusted(proposal.original, proposal.items);
    const entry: FoodEntry = {
      id: newId("food"),
      memberId: doc.member.id,
      dayOffset: offsetFromDate(selectedDate),
      loggedDate: selectedDate,
      meal,
      description: proposal.description,
      ...totals,
      photoFileId: proposal.photoFileId,
      photoUri: proposal.photoUri,
      // She looked at these numbers and accepted them, but she did not
      // measure them. "member" is reserved for a figure she typed herself.
      confidence: "estimated",
      memberCorrected: adjusted,
      estimate: {
        source: proposal.using,
        items: proposal.items,
        confident: chosen?.confident ?? false,
        model: chosen?.model,
        promptVersion: chosen?.promptVersion,
        adjusted,
        acceptedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };
    update({ ...doc, foodEntries: [...doc.foodEntries, entry] });
    setProposal(null);
    setDescription("");
    setPhotoAsset(undefined);
  };

  /** Throw the estimate away. The photo upload is left where it is. */
  const discardProposal = () => setProposal(null);

  const beginCorrection = (entry: FoodEntry) => {
    setEditingId(entry.id);
    setEditValues({
      description: entry.description,
      calories: String(entry.calories),
      protein: String(entry.protein),
      carbs: String(entry.carbs),
      fat: String(entry.fat),
    });
  };

  /**
   * Remove a meal she logged.
   *
   * There was no way to do this at all: a photo of the wrong plate, or a
   * duplicate from a double tap, stayed in her record and her totals
   * permanently. Correcting the numbers was possible; removing the entry was
   * not.
   *
   * Confirmed first, because it is not recoverable — and note this is the one
   * place that makes the server's union-merge of foodEntries wrong, so the
   * removal has to reach the server rather than only the phone. It does,
   * because `update()` saves the whole document and the entry is gone from
   * it. When there are more deletions than this, that merge needs tombstones.
   */
  const removeEntry = (entry: FoodEntry) =>
    Alert.alert(
      "Remove this meal?",
      `“${entry.description}” will be taken out of your record and your totals for that day.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            if (editingId === entry.id) setEditingId(undefined);
            update({
              ...doc,
              // Tombstoned, not dropped. The server unions these logs by id so
              // two devices cannot erase each other's meals, which means a row
              // that merely disappeared here would come back on the next sync.
              foodEntries: doc.foodEntries.map((item) =>
                item.id === entry.id
                  ? { ...item, deletedAt: new Date().toISOString() }
                  : item,
              ),
            });
          },
        },
      ],
    );
  const saveCorrection = () => {
    if (!editingId) return;

    // Checked before storing. These figures are read back by the plan
    // generator for its lowProtein and lowFoodLogging signals, so a slipped
    // decimal does not just look wrong on this screen — it changes what she
    // is offered tomorrow. See src/meal-values.ts for why this asks rather
    // than silently clamping.
    const checked = checkMacros(editValues);
    if ("problems" in checked) {
      Alert.alert(
        "Check these numbers",
        checked.problems.map((problem) => problem.message).join("\n\n"),
      );
      return;
    }

    update({
      ...doc,
      foodEntries: doc.foodEntries.map((entry) =>
        entry.id === editingId
          ? {
              ...entry,
              description: editValues.description.trim() || entry.description,
              ...checked.values,
              confidence: "member",
              memberCorrected: true,
            }
          : entry,
      ),
    });
    setEditingId(undefined);
  };
  const changeMonth = (amount: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );

  return (
    <>
      <Text style={s.eyebrow}>FOOD, WITHOUT THE FUSS</Text>
      <Text style={s.hero}>
        {total || "—"}{" "}
        <Text style={s.heroUnit}>kcal · {totalProtein || "—"}g protein</Text>
      </Text>
      <Text style={s.heroCopy}>
        Calories and protein are estimates for context, never a score.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showCalendar }}
        accessibilityLabel={showCalendar ? "Hide the month" : "See another day"}
        style={s.calendarToggle}
        onPress={() => setShowCalendar((value) => !value)}
      >
        <CalendarDays size={15} color={C.green} />
        <Text style={s.calendarToggleText}>
          {selectedDate === isoDate()
            ? "See another day"
            : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                undefined,
                { day: "numeric", month: "long" },
              )}
        </Text>
        {showCalendar ? (
          <ChevronUp size={16} color={C.faint} />
        ) : (
          <ChevronDown size={16} color={C.faint} />
        )}
      </Pressable>
      {showCalendar && (
        <Card style={s.calendarCard}>
          <View style={s.calendarHeader}>
            <Pressable
              accessibilityLabel="Previous month"
              style={s.calendarArrow}
              onPress={() => changeMonth(-1)}
            >
              <ChevronLeft size={20} color={C.greenDeep} />
            </Pressable>
            <Text style={s.calendarMonth}>
              {month.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Pressable
              accessibilityLabel="Next month"
              style={s.calendarArrow}
              onPress={() => changeMonth(1)}
            >
              <ChevronRight size={20} color={C.greenDeep} />
            </Pressable>
          </View>
          <View style={s.calendarGrid}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <Text key={`${day}-${index}`} style={s.weekday}>
                {day}
              </Text>
            ))}
            {calendar.map((cell, index) =>
              cell ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDate === cell.date }}
                  key={cell.date}
                  onPress={() => setSelectedDate(cell.date)}
                  style={[
                    s.calendarDay,
                    selectedDate === cell.date && s.calendarDaySelected,
                  ]}
                >
                  <Text
                    style={[
                      s.calendarDayNumber,
                      selectedDate === cell.date && s.calendarDayNumberSelected,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {dailyTotals[cell.date] ? (
                    <>
                      <Text
                        style={[
                          s.calendarKcal,
                          selectedDate === cell.date &&
                            s.calendarDayNumberSelected,
                        ]}
                      >
                        {compactKcal(dailyTotals[cell.date]?.calories ?? 0)}
                      </Text>
                      <View
                        style={[
                          s.proteinDot,
                          // Filled when protein was logged at all — which is
                          // what the legend below has always said. It used to
                          // fill at 20g, a threshold nothing set and nobody
                          // chose, presented to her as a judgement about her
                          // day. The app does not have a protein target for
                          // her unless a coach sets one, so it does not imply
                          // one.
                          (dailyTotals[cell.date]?.protein ?? 0) > 0 &&
                            s.proteinDotFull,
                        ]}
                      />
                    </>
                  ) : null}
                </Pressable>
              ) : (
                <View key={`blank-${index}`} style={s.calendarDay} />
              ),
            )}
          </View>
          <View style={s.calendarLegend}>
            <View style={s.legendDot} />
            <Text style={s.legendText}>Protein logged</Text>
            <Text style={s.legendText}>
              · figures are neutral estimates, not good/bad scores
            </Text>
          </View>
        </Card>
      )}
      <Card>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>
            Capture for{" "}
            {selectedDate === isoDate()
              ? "today"
              : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "short" },
                )}
          </Text>
          <Text style={s.sectionMeta}>{selectedEntries.length} meals</Text>
        </View>
        <View style={s.mealChoiceRow}>
          {(["Breakfast", "Lunch", "Snack", "Dinner"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setMeal(value)}
              style={[s.mealChoice, meal === value && s.mealChoiceActive]}
            >
              <Text
                style={[
                  s.mealChoiceText,
                  meal === value && s.mealChoiceTextActive,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[s.input, s.mealInput]}
          multiline
          value={description}
          onChangeText={setDescription}
          // Focused when she arrived by tapping "Describe meal", so that
          // button lands her on a keyboard rather than on a screen she has
          // to tap again.
          autoFocus={startMode === "describe"}
          placeholder="e.g. 2 rotis, paneer bhurji and salad"
          placeholderTextColor={C.faint}
        />
        <View style={s.captureRow}>
          <Pressable
            style={s.photoButton}
            onPress={addPhoto}
            disabled={uploadingPhoto}
          >
            <Text style={s.photoButtonText}>
              {photoUri ? "✓ Photo added" : "＋ Add photo"}
            </Text>
          </Pressable>
          <Pressable
            style={[s.primaryButton, s.estimateButton]}
            onPress={add}
            // A second estimate while one is still waiting on her would
            // silently replace the first, including any portion she had
            // already corrected.
            disabled={uploadingPhoto || proposal !== null}
          >
            {uploadingPhoto ? (
              <ActivityIndicator color="#fff" />
            ) : (
              // It no longer adds anything — it proposes, and she decides.
              <Text style={s.primaryButtonText}>Estimate this meal</Text>
            )}
          </Pressable>
        </View>
        {photoUri && <Image source={{ uri: photoUri }} style={s.mealPhoto} />}
        {proposal && (
          <View style={s.proposalCard}>
            <Text style={s.proposalTitle}>Does this look right?</Text>
            <Text style={s.proposalCopy}>
              Nothing is saved yet. Change any portion that is wrong, then add
              it to your day.
            </Text>

            {/* Both readings stay available. The photo leads when the model
                could read the plate, but her own words are never discarded —
                she is the better witness to her own meal. */}
            {proposal.photo && (
              <View style={s.sourceRow}>
                {(["photo", "description"] as EstimateSource[]).map((source) => {
                  const active = proposal.using === source;
                  return (
                    <Pressable
                      key={source}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      style={[s.sourceChip, active && s.sourceChipActive]}
                      onPress={() => useSource(source)}
                    >
                      <Text
                        style={[
                          s.sourceChipText,
                          active && s.sourceChipTextActive,
                        ]}
                      >
                        {source === "photo" ? "From the photo" : "What you typed"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Which of her words the food table recognised. Worth saying for
                a typed estimate, where the item list is just her description
                back at her; the photo's item list already is the basis. */}
            {proposal.using === "description" && (
              <Text style={s.proposalBasis}>
                Read from: {proposal.typed.basis}
              </Text>
            )}

            {proposal.items.map((item, index) => (
              <View key={item.name + index} style={s.proposalItem}>
                <View style={s.flex}>
                  <Text style={s.proposalItemName}>{item.name}</Text>
                  <Text style={s.proposalItemMacros}>
                    {Math.round(item.calories)} kcal ·{" "}
                    {Math.round(item.protein)}g protein
                  </Text>
                </View>
                <View style={s.portionRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Less ${item.name}`}
                    style={s.portionButton}
                    onPress={() =>
                      setProposal((current) =>
                        current
                          ? {
                              ...current,
                              items: adjustQuantity(
                                current.items,
                                index,
                                Math.max(0, item.quantity - 0.5),
                              ),
                            }
                          : current,
                      )
                    }
                  >
                    <Text style={s.portionButtonText}>−</Text>
                  </Pressable>
                  <Text style={s.portionValue}>
                    {Number.isInteger(item.quantity)
                      ? item.quantity
                      : item.quantity.toFixed(1)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`More ${item.name}`}
                    style={s.portionButton}
                    onPress={() =>
                      setProposal((current) =>
                        current
                          ? {
                              ...current,
                              items: adjustQuantity(
                                current.items,
                                index,
                                item.quantity + 0.5,
                              ),
                            }
                          : current,
                      )
                    }
                  >
                    <Text style={s.portionButtonText}>+</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                    style={s.portionRemove}
                    onPress={() =>
                      setProposal((current) =>
                        current
                          ? { ...current, items: removeItem(current.items, index) }
                          : current,
                      )
                    }
                  >
                    <X size={14} color={C.faint} />
                  </Pressable>
                </View>
              </View>
            ))}

            <View style={s.proposalTotal}>
              <Text style={s.proposalTotalLabel}>Total</Text>
              <Text style={s.proposalTotalValue}>
                {totalOf(proposal.items).calories} kcal ·{" "}
                {totalOf(proposal.items).protein}g protein
              </Text>
            </View>

            <View style={s.proposalActions}>
              <Pressable
                accessibilityRole="button"
                style={s.secondaryButton}
                onPress={discardProposal}
              >
                <Text style={s.secondaryButtonText}>Discard</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[
                  s.primaryButton,
                  s.flex,
                  !proposal.items.length && s.disabledButton,
                ]}
                disabled={!proposal.items.length}
                onPress={confirmMeal}
              >
                <Text style={s.primaryButtonText}>Add to my day</Text>
              </Pressable>
            </View>
          </View>
        )}
        <Text style={s.estimateNote}>
          Bharosa labels every estimate. Corrected member values always take
          precedence.
        </Text>
      </Card>
      <Text style={s.sectionTitle}>
        {selectedDate === isoDate()
          ? "Today’s meals"
          : `Meals on ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long" })}`}
      </Text>
      {selectedEntries.length ? (
        selectedEntries.map((entry) => (
          <Card key={entry.id} style={s.foodCard}>
            {(entry.photoFileId || entry.photoUri) && (
              <Image
                source={
                  entry.photoFileId
                    ? privateMemberFileSource(token, entry.photoFileId)
                    : { uri: entry.photoUri }
                }
                style={s.foodThumb}
              />
            )}
            <View style={s.foodText}>
              {editingId === entry.id ? (
                <>
                  <TextInput
                    style={[s.input, s.inlineEditDescription]}
                    value={editValues.description}
                    onChangeText={(value) =>
                      setEditValues((current) => ({
                        ...current,
                        description: value,
                      }))
                    }
                  />
                  <View style={s.macroEditRow}>
                    {(["calories", "protein", "carbs", "fat"] as const).map(
                      (field) => (
                        <View key={field} style={s.macroEdit}>
                          <Text style={s.macroEditLabel}>
                            {field === "calories"
                              ? "KCAL"
                              : `${field.toUpperCase()} G`}
                          </Text>
                          <TextInput
                            keyboardType="numeric"
                            value={editValues[field]}
                            onChangeText={(value) =>
                              setEditValues((current) => ({
                                ...current,
                                [field]: value,
                              }))
                            }
                            style={s.macroEditInput}
                          />
                        </View>
                      ),
                    )}
                  </View>
                  <Pressable
                    style={s.saveCorrectionButton}
                    onPress={saveCorrection}
                  >
                    <Text style={s.saveCorrectionText}>Save my correction</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={s.rowBetween}>
                    <View style={s.flex}>
                      <Text style={s.foodMeal}>{entry.meal}</Text>
                      <Text style={s.actionTitle}>{entry.description}</Text>
                    </View>
                    <Text style={s.calories}>{entry.calories} kcal</Text>
                  </View>
                  <Text style={s.macroText}>
                    {entry.protein}g protein · {entry.carbs}g carbs ·{" "}
                    {entry.fat}g fat
                  </Text>
                  <View style={s.foodFooter}>
                    <Text
                      style={[
                        s.aiTag,
                        entry.confidence === "member" && s.memberTag,
                      ]}
                    >
                      {entry.confidence === "member"
                        ? "MEMBER CONFIRMED"
                        : "STARTER ESTIMATE"}
                    </Text>
                    <View style={s.rowInline}>
                      <Pressable
                        accessibilityLabel="Correct meal estimate"
                        onPress={() => beginCorrection(entry)}
                        style={s.editFoodButton}
                      >
                        <Pencil size={13} color={C.greenDeep} />
                        <Text style={s.editFoodText}>Correct</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Remove ${entry.description}`}
                        onPress={() => removeEntry(entry)}
                        style={s.editFoodButton}
                      >
                        <Text style={s.removeFoodText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )}
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text style={s.empty}>
            Nothing logged on this day. A sentence is enough to begin.
          </Text>
        </Card>
      )}
    </>
  );
}

/**
 * The Coach tab.
 *
 * The human coach is a paid extra almost nobody has yet, which left this
 * screen as a message box that nothing answered. Vera answers it — grounded in
 * the member's own plan, and bounded by the rules in `lib/coach-ai.ts`.
 *
 * Two things are load-bearing in how this is presented:
 *
 * **She is never disguised as a person.** Her bubbles are labelled, her
 * avatar is not a photograph, and the first thing the screen says is that she
 * is part of the app. A member who thinks a nurse is reading this will tell it
 * things she should be telling a clinic.
 *
 * **A human coach outranks her.** Where one exists, their messages sit in the
 * same conversation, marked as theirs, and Vera says so when asked to make a
 * decision that is theirs to make.
 *
 * The conversation lives in `doc.messages`, which the phone already owns and
 * syncs. Vera has no route that can write to the derived plan state.
 */
function Coach({
  doc,
  update,
  token,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
}) {
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollToTop = useScrollToTop();
  const messages = [...doc.messages].sort((a, b) => a.dayOffset - b.dayOffset);
  const hasHumanCoach = doc.coaching?.mode === "coached";
  const next = [...doc.sessions]
    .filter((x) => x.status === "scheduled" && x.dayOffset >= 0)
    .sort((a, b) => a.dayOffset - b.dayOffset)[0];

  const append = (
    current: MemberDoc,
    from: Message["from"],
    body: string,
    /**
     * The id the server stored this under, when it stored one.
     *
     * Vera's replies are written server-side — see persistExchange in
     * app/api/coach/ask. Storing them under the server's id is what makes
     * them survive: mergeMemberUpdate only accepts *new* client messages from
     * "member", so an id the server has never seen is discarded, which is why
     * her half of the conversation used to vanish on reload.
     */
    id?: string,
  ): MemberDoc => ({
    ...current,
    messages: [
      ...current.messages,
      {
        id: id ?? newId(`message-${from}`),
        memberId: current.member.id,
        from,
        kind: "text",
        body,
        dayOffset: 0,
        time: "just now",
        read: from === "member",
      },
    ],
  });

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    setDraft("");
    const withQuestion = append(doc, "member", question);
    update(withQuestion);
    if (token === DEMO_TOKEN) {
      update(
        append(
          withQuestion,
          "ai",
          "This is the sample account, so I am not connected here. Sign in with your own account and I can answer from your plan.",
        ),
      );
      return;
    }
    setThinking(true);
    try {
      // Only the conversation goes back — the server builds her context from
      // the stored document rather than trusting anything the phone sends.
      const history = withQuestion.messages
        .filter((m) => m.from === "member" || m.from === "ai")
        .slice(-12)
        .map((m) => ({
          role: (m.from === "member" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: m.body,
        }));
      const result = await askCoach(token, question, history.slice(0, -1));
      update(append(withQuestion, "ai", result.reply, result.messageId));
    } catch {
      update(
        append(
          withQuestion,
          "ai",
          "I could not reach my side of things just then. Your plan is unaffected — please try again in a moment.",
        ),
      );
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <View style={s.coachHead}>
        <View style={s.coachAvatar}>
          <Sparkles size={20} color={C.greenDeep} />
        </View>
        <View style={s.flex}>
          <Text style={s.coachName}>{COACH_NAME}</Text>
          <Text style={s.coachRole}>Your coach in the app · always here</Text>
        </View>
      </View>

      {hasHumanCoach && next && (
        <View style={s.session}>
          <Text style={s.sessionLabel}>NEXT SESSION WITH YOUR COACH</Text>
          <Text style={s.sessionTitle}>{next.type}</Text>
          <Text style={s.sessionMeta}>
            {next.dayOffset === 0
              ? "Today"
              : `In ${next.dayOffset} day${next.dayOffset === 1 ? "" : "s"}`}{" "}
            · {next.time}
          </Text>
        </View>
      )}

      {messages.length === 0 && (
        <Card>
          <Text style={s.coachIntro}>
            I can explain what your plan is doing and why, help you decide what
            to do on a hard day, and answer the ordinary questions. I am part of
            the app, not a doctor — and I cannot change your plan, because that
            follows what you log.
          </Text>
        </Card>
      )}

      {messages.slice(-20).map((m) => {
        const mine = m.from === "member";
        const who =
          m.from === "member"
            ? "You"
            : m.from === "ai"
              ? COACH_NAME
              : m.from === "coach"
                ? "Your coach"
                : "Bharosa";
        return (
          <View
            key={m.id}
            style={[
              s.messageBubble,
              mine ? s.memberBubble : s.coachBubble,
              m.from === "coach" && s.humanCoachBubble,
            ]}
          >
            <View style={s.rowBetween}>
              <Text
                style={[
                  s.messageFrom,
                  !mine && s.messageFromCoach,
                  m.from === "coach" && s.messageFromHuman,
                ]}
              >
                {who}
              </Text>
              <Text style={s.messageTime}>{m.time}</Text>
            </View>
            <Text style={[s.messageBody, mine && s.memberMessageText]}>
              {m.body}
            </Text>
          </View>
        );
      })}

      {thinking && (
        <View style={[s.messageBubble, s.coachBubble]}>
          <Text style={s.messageFromCoach}>{COACH_NAME}</Text>
          <View style={s.rowInline}>
            <ActivityIndicator size="small" color={C.green} />
            <Text style={s.thinkingText}>Reading your plan…</Text>
          </View>
        </View>
      )}

      {messages.length === 0 && !thinking && (
        <View style={s.openerWrap}>
          {COACH_OPENERS.map((opener) => (
            <Pressable
              key={opener}
              accessibilityRole="button"
              style={({ pressed }) => [s.opener, pressed && s.pressed]}
              onPress={() => ask(opener)}
            >
              <Text style={s.openerText}>{opener}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={s.composer}>
        <TextInput
          style={s.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Ask ${COACH_NAME} anything…`}
          placeholderTextColor={C.faint}
          multiline
          editable={!thinking}
          onSubmitEditing={() => ask(draft)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={thinking || !draft.trim()}
          style={[s.sendButton, (thinking || !draft.trim()) && s.sendDisabled]}
          onPress={() => ask(draft)}
        >
          <Text style={s.sendButtonText}>↑</Text>
        </Pressable>
      </View>

      {messages.length > 6 && (
        <Pressable
          accessibilityRole="button"
          style={s.secondaryButton}
          onPress={scrollToTop}
        >
          <Text style={s.secondaryButtonText}>Back to the top</Text>
        </Pressable>
      )}

      {!hasHumanCoach && (
        <Card style={s.upsell}>
          <View style={s.rowInline}>
            <UserRound size={16} color={C.marigold} />
            <Text style={s.upsellKicker}>WANT A PERSON AS WELL?</Text>
          </View>
          <Text style={s.upsellTitle}>Add a human coach</Text>
          <Text style={s.upsellCopy}>
            {COACH_NAME} explains your plan and is here at two in the morning. A
            coach does the things software should not: reads your blood work,
            watches you move, and overrides the plan when your body disagrees
            with it.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [s.upsellButton, pressed && s.pressed]}
            onPress={() => {
              // An actual message into the conversation, which a coach sees in
              // the console. No fake checkout, and no claim that somebody is
              // already assigned.
              update(
                append(
                  doc,
                  "member",
                  "I would like to know more about adding a human coach.",
                ),
              );
              Alert.alert(
                "Noted",
                "That is in your conversation now. Coaching is not on sale yet — when it is, this is where it will appear.",
              );
            }}
          >
            <Text style={s.upsellButtonText}>Tell me more</Text>
            <ChevronRight size={16} color={C.greenDeep} />
          </Pressable>
        </Card>
      )}

      <Text style={s.responseNote}>
        {COACH_NAME} is software, and she is not a substitute for medical care.
        For anything urgent, call your local emergency number — 112 in India.
        This is not an emergency channel.
        {hasHumanCoach
          ? " Where your coach has set something, that stands."
          : ""}
      </Text>
    </>
  );
}
function Reports({
  doc,
  update,
  token,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
}) {
  const [category, setCategory] = useState<"blood_work" | "body_composition">(
    "blood_work",
  );
  const [uploading, setUploading] = useState(false);
  const upload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const stored = await uploadMemberFile(
        token,
        { uri: asset.uri, name: asset.name, type: asset.mimeType },
        "report",
      );
      update({
        ...doc,
        reports: [
          ...doc.reports,
          {
            id: newId("report"),
            memberId: doc.member.id,
            title:
              category === "blood_work" ? "Blood work" : "Body composition",
            category,
            fileName: asset.name,
            fileId: stored?.id,
            fileUri: token === DEMO_TOKEN ? asset.uri : undefined,
            uploadedAt: new Date().toISOString(),
            status: "uploaded",
          },
        ],
      });
    } catch (error) {
      Alert.alert(
        "Report not saved",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <Card>
      <View style={s.rowBetween}>
        <View style={s.flex}>
          <Text style={s.cardTitle}>Health reports</Text>
          <Text style={s.profileCopy}>
            Share blood work or body-composition reports with your coach.
          </Text>
        </View>
        <Text style={s.reportCount}>{doc.reports.length}</Text>
      </View>
      <View style={s.reportCategories}>
        <Pressable
          onPress={() => setCategory("blood_work")}
          style={[
            s.reportCategory,
            category === "blood_work" && s.reportCategoryActive,
          ]}
        >
          <Text
            style={[
              s.reportCategoryText,
              category === "blood_work" && s.reportCategoryTextActive,
            ]}
          >
            Blood work
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setCategory("body_composition")}
          style={[
            s.reportCategory,
            category === "body_composition" && s.reportCategoryActive,
          ]}
        >
          <Text
            style={[
              s.reportCategoryText,
              category === "body_composition" && s.reportCategoryTextActive,
            ]}
          >
            Body composition
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [s.uploadButton, pressed && s.pressed]}
        onPress={upload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={C.greenDeep} />
        ) : (
          <Text style={s.uploadButtonText}>Choose PDF or photo</Text>
        )}
      </Pressable>
      {doc.reports
        .slice(-3)
        .reverse()
        .map((report) => (
          <View key={report.id} style={s.reportRow}>
            <View style={s.reportFileIcon}>
              <Text style={s.reportFileText}>FILE</Text>
            </View>
            <View style={s.reportText}>
              <Text numberOfLines={1} style={s.reportName}>
                {report.fileName}
              </Text>
              <Text style={s.reportMeta}>
                {report.title} ·{" "}
                {new Date(report.uploadedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={s.reportStatus}>
              {report.fileId ? "Saved privately" : "On this device"}
            </Text>
          </View>
        ))}
      <Text style={s.reportPrivacy}>
        Uploading stores the report for coach review; it does not automatically
        interpret or diagnose the result.
      </Text>
    </Card>
  );
}

function HealthConnectionPanel({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const connection = doc.healthConnection;
  const providerName = CONNECTED_HEALTH_NAME;
  const mergeSnapshots = (incoming: MemberDoc["healthSnapshots"]) => {
    const map = new Map(doc.healthSnapshots.map((item) => [item.id, item]));
    incoming.forEach((item) => map.set(item.id, item));
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  };
  const runSync = async (requestPermissions: boolean) => {
    setSyncing(true);
    try {
      const result = await syncHealth(requestPermissions);
      await update({
        ...doc,
        healthConnection: result.connection,
        healthSnapshots: mergeSnapshots(result.snapshots),
      });
    } catch (error) {
      // A throw here used to leave the spinner turning with nothing said, so
      // the screen looked busy indefinitely and there was no way to tell a
      // slow sync from a broken one.
      Alert.alert(
        "Could not sync",
        error instanceof Error
          ? error.message
          : "Your health source did not respond. Your plan is unaffected.",
      );
    } finally {
      setSyncing(false);
    }
  };
  const toggle = (enabled: boolean) =>
    enabled
      ? runSync(true)
      : update({
          ...doc,
          healthConnection: {
            ...connection,
            syncEnabled: false,
            status: "disconnected",
            message:
              "Sync is paused. Existing snapshots remain in your Bharosa history.",
          },
        });
  const latest = (Object.keys(HEALTH_LABELS) as HealthMetric[]).map(
    (metric) => ({
      metric,
      snapshot: [...doc.healthSnapshots]
        .reverse()
        .find((item) => item.metric === metric && item.available),
    }),
  );
  return (
    <>
      <Text style={s.sectionTitle}>Connected health</Text>
      <Card style={s.healthCard}>
        <View style={s.healthHeader}>
          <View
            style={[
              s.healthIcon,
              connection.status === "connected" && s.healthIconConnected,
            ]}
          >
            <HeartPulse
              size={23}
              color={connection.status === "connected" ? "white" : C.greenDeep}
            />
          </View>
          <View style={s.flex}>
            <Text style={s.cardTitle}>{providerName}</Text>
            <Text style={s.healthStatus}>
              {connection.status === "connected"
                ? "Connected"
                : connection.status === "partial"
                  ? "Partially connected"
                  : connection.status === "unavailable"
                    ? `${Platform.OS === "ios" ? "iOS" : "Android"} build required`
                    : "Not connected"}
            </Text>
          </View>
          <Switch
            value={connection.syncEnabled}
            onValueChange={toggle}
            disabled={syncing}
            trackColor={{ false: C.line, true: C.greenTint }}
            thumbColor={connection.syncEnabled ? C.green : C.faint}
          />
        </View>
        <Text style={s.profileCopy}>
          Bharosa reads only the metrics you approve. Availability depends on
          the phone, connected apps and wearable hardware.
          {Platform.OS === "ios"
            ? " iOS keeps individual read decisions private, so Bharosa shows Requested rather than claiming access was granted."
            : ""}
        </Text>
        {connection.message && (
          <View style={s.healthMessage}>
            <Text style={s.healthMessageText}>{connection.message}</Text>
          </View>
        )}
        <View style={s.permissionGrid}>
          {latest.map(({ metric, snapshot }) => (
            <View key={metric} style={s.permissionItem}>
              <View style={s.rowBetween}>
                <Text style={s.permissionLabel}>
                  {HEALTH_LABELS[metric].label}
                </Text>
                <Text
                  style={[
                    s.permissionState,
                    ["granted", "requested"].includes(
                      connection.permissions[metric],
                    ) && s.permissionGranted,
                  ]}
                >
                  {connection.permissions[metric] === "granted"
                    ? "Allowed"
                    : connection.permissions[metric] === "requested"
                      ? "Requested"
                      : connection.permissions[metric] === "denied"
                        ? "Not allowed"
                        : "Not asked"}
                </Text>
              </View>
              <Text style={s.healthValue}>
                {snapshot
                  ? `${Math.round(snapshot.value * 10) / 10} ${snapshot.unit}`
                  : "No data yet"}
              </Text>
              {snapshot && (
                <Text numberOfLines={1} style={s.healthSource}>
                  {snapshot.date} · {snapshot.source}
                  {snapshot.measurementMethod
                    ? ` · ${snapshot.measurementMethod.toUpperCase()}`
                    : ""}
                </Text>
              )}
            </View>
          ))}
        </View>
        <View style={s.healthButtons}>
          <Pressable
            disabled={syncing}
            onPress={() => runSync(!connection.syncEnabled)}
            style={[s.circleButton, s.healthPrimary]}
          >
            {syncing ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <RefreshCw size={15} color="white" />
                <Text style={s.circleButtonText}>
                  {connection.syncEnabled ? "Sync now" : "Connect"}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={openHealthSettings} style={s.manageHealthButton}>
            <Text style={s.manageHealthText}>
              {Platform.OS === "ios"
                ? "Open iPhone settings"
                : "Manage Health Connect access"}
            </Text>
          </Pressable>
        </View>
        {connection.lastSyncAt && (
          <Text style={s.lastSync}>
            Last synced {new Date(connection.lastSyncAt).toLocaleString()}
          </Text>
        )}
        <View style={s.healthPrivacy}>
          <ShieldCheck size={16} color={C.green} />
          <Text style={s.healthPrivacyText}>
            Foreground sync only. Background access is not requested in this
            release.
          </Text>
        </View>
      </Card>
    </>
  );
}

/**
 * Twenty-eight days, as a pattern.
 *
 * Four rows of seven. A day with something is filled, a quiet day is simply
 * lighter — no cross, no red, no gap count. This is what one member sees of
 * another instead of a rank, because the evidence on activity apps is that
 * ranking drives beginners out and most members here are beginners.
 */
function ConsistencyGrid({
  summary,
  compact,
}: {
  summary?: ConsistencySummary;
  compact?: boolean;
}) {
  if (!summary?.days?.length) return null;
  const size = compact ? 9 : 11;
  return (
    <View
      style={s.grid}
      accessibilityRole="image"
      accessibilityLabel={`Active on ${summary.activeDays} of the last ${summary.windowDays} days`}
    >
      {summary.days.map((day) => (
        <View
          key={day.date}
          style={[
            s.gridCell,
            { width: size, height: size },
            day.level === 1 && s.gridCell1,
            day.level === 2 && s.gridCell2,
            day.level === 3 && s.gridCell3,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * The circle: other members, and how their month is going.
 *
 * Built on social support rather than social comparison. The published research
 * on activity apps separates the two clearly — support helps broadly, while
 * comparison backfires for beginners, who withdraw or hide the app rather than
 * be seen at the bottom of a table. So there is no rank number, no last place,
 * and no leaderboard; there are patterns, people, encouragement, and one shared
 * figure the group moves together.
 *
 * What crosses between members is still only the projection built on the server:
 * completion counts, days shown up, optionally steps and water. Meals, photos,
 * reports, mood, symptoms and coach messages never leave a member's own record.
 */
function Circle({
  token,
  onUnreadChange,
}: {
  token: string;
  onUnreadChange?: (count: number) => void;
}) {
  const [state, setState] = useState<CircleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [nudges, setNudges] = useState<
    { from: string; message: string; at: string }[]
  >([]);
  const [nearby, setNearby] = useState<
    {
      memberId: string;
      displayName: string;
      bio?: string;
      city?: string;
      proximityLabel?: string;
    }[]
  >([]);
  const [nearbyNote, setNearbyNote] = useState<string | null>(null);
  /**
   * What the phone read, in words, for her eyes only.
   *
   * The server holds two grid integers and nothing else, so nothing on the
   * screen could tell her whether the app had understood where she was — she
   * shared her area and got no acknowledgement at all. This is reverse-geocoded
   * on the device and never sent; see mobile/src/location.ts.
   */
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [citySuggestions, setCitySuggestions] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await loadCircle(token);
      if (!next) return;
      setState(next);
      setCityDraft(next.profile.city ?? "");
      setNameDraft(next.profile.displayName ?? "");
      setBioDraft(next.profile.bio ?? "");
      onUnreadChange?.(next.requests.incoming.length);
      const inbox = await loadNudges(token).catch(() => ({ nudges: [] }));
      setNudges(inbox.nudges ?? []);
    } catch (error) {
      Alert.alert(
        "Circle unavailable",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, onUnreadChange]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (patch: Partial<CircleState["profile"]>) => {
    if (!state) return;
    setState({ ...state, profile: { ...state.profile, ...patch } });
    try {
      await saveCircleSettings(token, patch);
      await load();
    } catch (error) {
      setState(state);
      Alert.alert(
        "Not saved",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  /**
   * Share an area, having explained what that means.
   *
   * The permission prompt is preceded by a plain explanation, because a system
   * dialog appearing without warning is how people learn to refuse everything.
   */
  const shareArea = () =>
    Alert.alert(
      "Find members near you",
      "Bharosa can introduce you to other members in your area — the idea is that this is easier with company, and less solitary.\n\nYour phone works out roughly which 3km area you are in and sends only that. No exact location leaves your phone, there is no map, and nobody is ever shown a distance. You can turn this off whenever you like.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Share my area",
          onPress: async () => {
            const result = await currentCell();
            if (result.status === "denied") {
              Alert.alert(
                "Location is switched off for Bharosa",
                "You can turn it on in your phone settings, or find members by city instead.",
                [
                  { text: "Not now", style: "cancel" },
                  {
                    text: "Open settings",
                    onPress: () => Linking.openSettings(),
                  },
                ],
              );
              return;
            }
            if (result.status === "unavailable") {
              Alert.alert(
                "Could not read your area",
                "You can still find members by city.",
              );
              return;
            }
            if (result.label) setAreaLabel(result.label);
            await saveSettings({ cell: result.cell });
          },
        },
      ],
    );

  const findNearby = async () => {
    setBusy(true);
    try {
      const result = await discoverCircle(token);
      setNearby(result.members);
      setNearbyNote(
        result.message ??
          (result.members.length
            ? result.basis === "city"
              ? `Nobody in your immediate area yet, so this is everyone in ${result.city ?? "your city"}.`
              : null
            : state?.profile.city || state?.profile.hasLocation
              ? "Nobody else near you has chosen to be found yet. This gets better as more members join."
              : "Add your city or share your area first, so there is somewhere to look."),
      );
    } catch (error) {
      Alert.alert(
        "Could not look",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const invite = async (memberId: string) => {
    setBusy(true);
    try {
      const result = await requestConnection(token, memberId);
      setAddUsername("");
      setNearby((rows) => rows.filter((row) => row.memberId !== memberId));
      Alert.alert("Request sent", result.message);
      await load();
    } catch (error) {
      Alert.alert(
        "Not sent",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const answer = async (
    memberId: string,
    decision: "accepted" | "declined" | "blocked",
  ) => {
    setBusy(true);
    try {
      await answerConnection(token, memberId, decision);
      await load();
    } catch (error) {
      Alert.alert(
        "Not saved",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Decline, then offer to block.
   *
   * Declining alone does not stop someone requesting again, and repeated
   * requests from a person already turned down is exactly the case a block
   * exists for. The decline happens immediately on one tap — that is the
   * common, unremarkable case — and blocking is offered after, so nobody has
   * to think about it who does not need it.
   *
   * Nothing tells the other person either outcome.
   */
  const declineThen = async (memberId: string, name: string) => {
    await answer(memberId, "declined");
    Alert.alert(
      "Declined",
      `${name} has not been told. If you would rather they could not ask again, you can block them.`,
      [
        { text: "That's all", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => answer(memberId, "blocked"),
        },
      ],
    );
  };

  /** One tap, from a fixed list. Nothing here can be composed. */
  const nudge = (memberId: string, name: string) =>
    Alert.alert(`Send ${name} a word`, undefined, [
      ...NUDGE_OPTIONS.map((option) => ({
        text: option.label,
        onPress: async () => {
          try {
            await sendNudge(token, memberId, option.kind);
          } catch (error) {
            Alert.alert(
              "Not sent",
              error instanceof Error ? error.message : "Please try again.",
            );
          }
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);

  const remove = (memberId: string, name: string) =>
    Alert.alert(
      `Remove ${name}?`,
      "You will stop seeing each other's activity. Neither of you is told.\n\nRemoving leaves them able to send a new request. Blocking does not.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          onPress: async () => {
            await removeConnection(token, memberId).catch(() => undefined);
            await load();
          },
        },
        {
          text: "Block",
          style: "destructive",
          onPress: () => answer(memberId, "blocked"),
        },
      ],
    );

  if (token === DEMO_TOKEN)
    return (
      <Card>
        <Text style={s.cardTitle}>Your circle</Text>
        <Text style={s.profileCopy}>
          The demo account is not stored, so it cannot connect to other members.
        </Text>
      </Card>
    );

  if (loading)
    return (
      <Card>
        <ActivityIndicator color={C.green} />
      </Card>
    );

  if (!state)
    return (
      <Card>
        <Text style={s.cardTitle}>Your circle</Text>
        <Text style={s.profileCopy}>This could not be loaded.</Text>
        <Pressable style={s.secondaryButton} onPress={() => load()}>
          <Text style={s.secondaryButtonText}>Try again</Text>
        </Pressable>
      </Card>
    );

  const together = state.together;

  return (
    <>
      <Text style={s.eyebrow}>YOUR CIRCLE</Text>
      <Text style={s.hero}>Better with company.</Text>
      <Text style={s.heroCopy}>
        Bharosa connects members who are going through the same thing, because
        it is easier with people around you. You see how their month is going;
        they see the same about yours, and nothing else.
      </Text>

      {nudges.length > 0 && (
        <Card style={s.nudgeCard}>
          <Text style={s.cardTitle}>
            {nudges.length === 1
              ? "Someone was thinking of you"
              : "Your circle has been in touch"}
          </Text>
          {nudges.slice(0, 4).map((item, index) => (
            <Text key={`${item.at}-${index}`} style={s.nudgeLine}>
              <Text style={s.nudgeFrom}>{item.from}</Text> · {item.message}
            </Text>
          ))}
        </Card>
      )}

      {state.requests.incoming.length > 0 && (
        <Card>
          <Text style={s.cardTitle}>
            {state.requests.incoming.length === 1
              ? "Someone would like to connect"
              : `${state.requests.incoming.length} people would like to connect`}
          </Text>
          {state.requests.incoming.map((request) => (
            <View key={request.memberId} style={s.requestRow}>
              <View style={s.flex}>
                <Text style={s.requestName}>{request.displayName}</Text>
                {request.city ? (
                  <Text style={s.requestMeta}>{request.city}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decline ${request.displayName}`}
                style={s.requestDecline}
                disabled={busy}
                onPress={() =>
                  declineThen(request.memberId, request.displayName)
                }
              >
                <Text style={s.requestDeclineText}>Not now</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Accept ${request.displayName}`}
                style={s.requestAccept}
                disabled={busy}
                onPress={() => answer(request.memberId, "accepted")}
              >
                <Text style={s.requestAcceptText}>Accept</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={s.cardTitle}>Your last four weeks</Text>
        <ConsistencyGrid summary={state.me.consistency} />
        <Text style={s.profileCopy}>
          {state.me.consistency
            ? consistencySentence(state.me.consistency)
            : "Your first day is whenever you decide it is."}
        </Text>
      </Card>

      {together && together.people > 1 && (
        <LinearGradient colors={["#E7EFF0", "#F3EBDD"]} style={s.circleCard}>
          <Text style={s.circleKicker}>TOGETHER THIS MONTH</Text>
          <Text style={s.circleTitle}>
            {together.activeDays} days between {together.people} of you.
          </Text>
          <Text style={s.profileCopy}>
            Every day anyone shows up adds to this. Nobody's quiet week takes
            anything away from it.
          </Text>
        </LinearGradient>
      )}

      {state.circle.length > 0 ? (
        <>
          <Text style={s.sectionTitle}>Your circle</Text>
          {state.circle.map((row) => (
            <Card key={row.memberId} style={s.personCard}>
              <View style={s.rowBetween}>
                <View style={s.flex}>
                  <Text style={s.personName}>{row.displayName}</Text>
                  {row.proximity ? (
                    <Text style={s.personMeta}>{row.proximity}</Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${row.displayName}`}
                  hitSlop={10}
                  onPress={() => remove(row.memberId, row.displayName)}
                >
                  <Text style={s.habitRemove}>×</Text>
                </Pressable>
              </View>
              {row.bio ? <Text style={s.personBio}>{row.bio}</Text> : null}
              <ConsistencyGrid summary={row.consistency} compact />
              <Text style={s.personMeta}>
                {row.consistency
                  ? `${row.consistency.activeDays} days in the last ${row.consistency.windowDays}`
                  : "Not sharing her activity"}
                {row.actionsTotal
                  ? ` · ${row.actionsCompleted}/${row.actionsTotal} today`
                  : ""}
                {typeof row.steps === "number"
                  ? ` · ${row.steps.toLocaleString()} steps`
                  : ""}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.nudgeButton}
                onPress={() => nudge(row.memberId, row.displayName)}
              >
                <Text style={s.nudgeButtonText}>Send a word</Text>
              </Pressable>
            </Card>
          ))}
        </>
      ) : (
        <Card>
          <Users size={20} color={C.faint} />
          <Text style={s.cardTitle}>No one here yet</Text>
          <Text style={s.profileCopy}>
            Add someone by username, or let members near you find you.
          </Text>
        </Card>
      )}

      <Card>
        <Text style={s.cardTitle}>Add someone</Text>
        <Text style={s.profileCopy}>
          Enter the username she signs in with. She has to accept before either
          of you sees anything.
        </Text>
        <View style={s.habitAddRow}>
          <TextInput
            style={[s.input, s.flex]}
            value={addUsername}
            onChangeText={setAddUsername}
            placeholder="username"
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            accessibilityRole="button"
            style={s.habitAddButton}
            disabled={busy || !addUsername.trim()}
            onPress={() => invite(addUsername.trim())}
          >
            <UserPlus size={16} color={C.greenDeep} />
          </Pressable>
        </View>
        {state.requests.outgoing.length > 0 && (
          <Text style={s.circleMeta}>
            Waiting on{" "}
            {state.requests.outgoing.map((r) => r.displayName).join(", ")}.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={s.cardTitle}>Members near you</Text>
        <Text style={s.profileCopy}>
          Your phone works out roughly which 3km area you are in and sends only
          that. No exact location leaves your phone, there is no map, and nobody
          is shown a distance.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.waterAdd}
          onPress={shareArea}
        >
          <MapPin size={15} color={C.green} />
          <Text style={s.waterAddText}>
            {state.profile.hasLocation ? "Update my area" : "Share my area"}
          </Text>
        </Pressable>
        {/* Read back what was captured. Without this, sharing a location was a
            button that appeared to do nothing. */}
        {state.profile.hasLocation ? (
          <Text style={s.areaCaptured}>
            {areaLabel
              ? `Set from your location — around ${areaLabel}. Only the 3km square was sent; the name stays on this phone.`
              : "Your area is set. Tap again if you have moved."}
          </Text>
        ) : null}

        <View style={s.habitAddRow}>
          <TextInput
            style={[s.input, s.flex]}
            value={cityDraft}
            onChangeText={(text) => {
              setCityDraft(text);
              setCitySuggestions(true);
            }}
            placeholder="Or just your city"
            placeholderTextColor={C.faint}
            autoCorrect={false}
            onFocus={() => setCitySuggestions(true)}
            onBlur={() => {
              // Store the canonical spelling. Discovery matches on lower(city),
              // so "Bangalore" and "Bengaluru" were two cities whose members
              // never saw each other.
              const typed = cityDraft.trim();
              const settled = canonicalCity(typed) ?? typed;
              if (settled !== typed) setCityDraft(settled);
              if (settled !== (state.profile.city ?? ""))
                saveSettings({ city: settled });
            }}
          />
        </View>
        {citySuggestions && (
          <View style={s.cityList}>
            {suggestCities(cityDraft).map((city) => (
              <Pressable
                key={city.name}
                accessibilityRole="button"
                accessibilityLabel={`${city.name}, ${city.region}`}
                style={({ pressed }) => [s.cityRow, pressed && s.pressed]}
                onPress={() => {
                  setCityDraft(city.name);
                  setCitySuggestions(false);
                  if (city.name !== (state.profile.city ?? ""))
                    saveSettings({ city: city.name });
                }}
              >
                <Text style={s.cityName}>{city.name}</Text>
                <Text style={s.cityRegion}>{city.region}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={s.rowBetween}>
          <View style={s.flex}>
            <Text style={s.settingLabel}>Let other members find me</Text>
            <Text style={s.settingCopy}>
              They see your name, your note and your area. Nothing else, until
              you accept.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Let other members find me"
            value={state.profile.discoverable}
            onValueChange={(value) => saveSettings({ discoverable: value })}
            trackColor={{ false: C.line, true: C.greenTint }}
            thumbColor={state.profile.discoverable ? C.green : C.faint}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          style={s.waterAdd}
          disabled={busy}
          onPress={findNearby}
        >
          <Text style={s.waterAddText}>Look for members near me</Text>
        </Pressable>
        {nearbyNote ? <Text style={s.circleMeta}>{nearbyNote}</Text> : null}
        {nearby.map((row) => (
          <View key={row.memberId} style={s.requestRow}>
            <View style={s.flex}>
              <Text style={s.requestName}>{row.displayName}</Text>
              <Text style={s.requestMeta}>
                {row.proximityLabel || row.city}
              </Text>
              {row.bio ? <Text style={s.personBio}>{row.bio}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Send a request to ${row.displayName}`}
              style={s.requestAccept}
              disabled={busy}
              onPress={() => invite(row.memberId)}
            >
              <Text style={s.requestAcceptText}>Add</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.cardTitle}>What your circle can see</Text>
        <Text style={s.profileCopy}>
          Your meals, photos, reports, check-ins, symptoms and messages with
          your coach are never shared. Only what is below, and only with people
          you have accepted.
        </Text>
        <View style={s.habitAddRow}>
          <TextInput
            style={[s.input, s.flex]}
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="What your circle calls you"
            placeholderTextColor={C.faint}
            onBlur={() => {
              if (nameDraft.trim() !== state.profile.displayName)
                saveSettings({ displayName: nameDraft.trim() });
            }}
          />
        </View>
        <TextInput
          style={[s.input, s.bioInput]}
          value={bioDraft}
          onChangeText={setBioDraft}
          placeholder="A line about you — why you started, what you are working on"
          placeholderTextColor={C.faint}
          multiline
          maxLength={240}
          onBlur={() => {
            if (bioDraft.trim() !== (state.profile.bio ?? ""))
              saveSettings({ bio: bioDraft.trim() });
          }}
        />
        <View style={s.rowBetween}>
          <View style={s.flex}>
            <Text style={s.settingLabel}>Share my daily activity</Text>
            <Text style={s.settingCopy}>
              Which days you showed up, and how much of today's plan you have
              done.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Share my daily activity"
            value={state.profile.shareActivity}
            onValueChange={(value) => saveSettings({ shareActivity: value })}
            trackColor={{ false: C.line, true: C.greenTint }}
            thumbColor={state.profile.shareActivity ? C.green : C.faint}
          />
        </View>
        <View style={s.rowBetween}>
          <View style={s.flex}>
            <Text style={s.settingLabel}>Share my step count</Text>
            <Text style={s.settingCopy}>
              Only if you have connected {CONNECTED_HEALTH_NAME}.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Share my step count"
            value={state.profile.shareSteps}
            onValueChange={(value) => saveSettings({ shareSteps: value })}
            trackColor={{ false: C.line, true: C.greenTint }}
            thumbColor={state.profile.shareSteps ? C.green : C.faint}
          />
        </View>
        <Text style={s.settingCopy}>
          You can turn any of these off at any time, and remove anyone from your
          circle without them being told.
        </Text>
      </Card>
    </>
  );
}

/**
 * The You tab, as a hub.
 *
 * This screen used to stack four full screens on top of each other — profile
 * and settings, the whole circle, health connection, and reports — roughly
 * twelve hundred lines of one continuous scroll. Each is now a row that opens
 * on its own, the same pattern as the movement session.
 *
 * What stays on the hub is what answers "how am I doing" without a tap: the
 * four weeks of consistency she has built, and what her phone and health source
 * are actually contributing. Everything that needs a decision from her is a
 * door rather than a wall of controls.
 */
/**
 * What she is training for, asked only when she has said she is training.
 *
 * These three answers are not optional detail. An event goal without them is
 * a goal the plan cannot act on — lib/endurance.ts needs the distance, the
 * date and her honest current volume before it can build a single week — so
 * they sit with the goal itself rather than behind the detail gate.
 *
 * All three are chips. There is no date picker in this app, and a typed date
 * or a typed distance is a typo that quietly changes a training block.
 */
function EventQuestions({
  kind,
  setKind,
  weeksAway,
  setWeeksAway,
  weeklyKm,
  setWeeklyKm,
}: {
  kind: EventKind | undefined;
  setKind: (value: EventKind) => void;
  weeksAway: number | undefined;
  setWeeksAway: (value: number) => void;
  weeklyKm: number | undefined;
  setWeeklyKm: (value: number) => void;
}) {
  return (
    <View style={s.eventBlock}>
      <Text style={s.detailLabel}>What are you training for?</Text>
      <View style={s.chipWrap}>
        {EVENT_KINDS.map((option) => {
          const selected = kind === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[s.chip, selected && s.chipActive]}
              onPress={() => setKind(option.id)}
            >
              <Text style={[s.chipText, selected && s.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.detailBlock}>
        <Text style={s.detailLabel}>When is it?</Text>
        <View style={s.chipWrap}>
          {WEEKS_AWAY_OPTIONS.map((option) => {
            const selected = weeksAway === option.weeks;
            return (
              <Pressable
                key={option.weeks}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.chip, selected && s.chipActive]}
                onPress={() => setWeeksAway(option.weeks)}
              >
                <Text style={[s.chipText, selected && s.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.detailBlock}>
        <Text style={s.detailLabel}>
          How far do you run in a normal week right now?
        </Text>
        <Text style={s.detailHint}>
          Be honest rather than hopeful — every week of your plan is built up
          from this number, so rounding it up makes the whole block too hard.
        </Text>
        <View style={s.chipWrap}>
          {WEEKLY_KM_OPTIONS.map((option) => {
            const selected = weeklyKm === option.km;
            return (
              <Pressable
                key={option.km}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.chip, selected && s.chipActive]}
                onPress={() => setWeeklyKm(option.km)}
              >
                <Text style={[s.chipText, selected && s.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/**
 * Everything she has told us about herself, in one editable place.
 *
 * The promise made by the consent gate during onboarding: whatever she
 * declined to answer then, she can answer here, and whatever she answered can
 * be changed. That promise is why the gate is safe to offer — declining costs
 * her nothing permanent.
 *
 * Saving writes doc.profile and mirrors her goal labels back onto
 * member.goals, which is what her coach reads and what the daily-action rules
 * match on. The generator reads the ids. Keeping both in step is the whole
 * job of this screen's save.
 */
function AboutYou({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const saved = doc.profile;
  const [ageBand, setAgeBand] = useState<AgeBand | undefined>(saved?.ageBand);
  const [goals, setGoals] = useState<string[]>(
    saved?.goals?.length
      ? saved.goals
      : goalIdsFrom(doc.onboarding?.goals ?? doc.member.goals ?? []),
  );
  const [equipment, setEquipment] = useState<Equipment[]>(
    saved?.equipment ?? [],
  );
  const [lifeStage, setLifeStage] = useState<LifeStage | undefined>(
    saved?.lifeStage,
  );
  const [sleepBaseline, setSleepBaseline] = useState<SleepBaseline | undefined>(
    saved?.sleepBaseline,
  );
  const [trainingDays, setTrainingDays] = useState<Weekday[]>(
    saved?.trainingDays ?? [],
  );
  const [wontDo, setWontDo] = useState(saved?.wontDo ?? "");
  const [savedJustNow, setSavedJustNow] = useState(false);
  /*
   * Her event, held as three separate answers while she edits.
   *
   * Assembled into a stored EventTarget only on save, which is where the
   * week count becomes a real date and the block start is stamped.
   */
  const [eventKind, setEventKind] = useState<EventKind | undefined>(
    saved?.event?.kind,
  );
  const [weeksAway, setWeeksAway] = useState<number | undefined>(
    saved?.event ? weeksUntil(saved.event.dateIso) : undefined,
  );
  const [weeklyKm, setWeeklyKm] = useState<number | undefined>(
    saved?.event?.currentWeeklyKm,
  );
  const wantsEvent = needsEventDetail(goals);
  /** Assembled on save. Undefined until all three are answered. */
  const eventTarget =
    wantsEvent && eventKind && weeksAway !== undefined && weeklyKm !== undefined
      ? {
          kind: eventKind,
          dateIso: isoWeeksFromToday(weeksAway),
          currentWeeklyKm: weeklyKm,
          startedOn: saved?.event?.startedOn ?? isoWeeksFromToday(0),
        }
      : undefined;


  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];

  const toggleGoal = (id: string) =>
    setGoals((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );

  const save = () => {
    const labels = goals.map(goalLabel);
    update({
      ...doc,
      member: {
        ...doc.member,
        goals: [
          ...labels,
          ...doc.member.goals.filter((item) => !labels.includes(item)),
        ],
      },
      onboarding: { ...doc.onboarding, goals: labels },
      profile: {
        ageBand,
        goals,
        // Editing anything here is itself the consent the gate asked for.
        detailConsent: "given",
        event: eventTarget,
        equipment,
        lifeStage,
        sleepBaseline,
        trainingDays,
        wontDo: wontDo.trim() || undefined,
      },
    });
    setSavedJustNow(true);
  };

  /* Any edit puts the save button back, so the confirmation cannot go stale. */
  const edited = () => setSavedJustNow(false);

  return (
    <>
      <Text style={s.hero}>About you</Text>
      <Text style={s.heroCopy}>
        These answers decide what your plan reaches for — how hard it starts,
        which movements it can use, and which it leaves alone. Change any of
        them whenever they stop being true.
      </Text>

      <Card>
        <Text style={s.detailLabel}>Which decade are you in?</Text>
        <Text style={s.detailHint}>
          Sets where your plan starts and how quickly it builds.
        </Text>
        <View style={s.chipWrap}>
          {AGE_BANDS.map((option) => {
            const selected = ageBand === option.band;
            return (
              <Pressable
                key={option.band}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.chip, selected && s.chipActive]}
                onPress={() => {
                  setAgeBand(option.band);
                  edited();
                }}
              >
                <Text style={[s.chipText, selected && s.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.detailBlock}>
          <Text style={s.detailLabel}>What are you working towards?</Text>
          <Text style={s.detailHint}>
            Up to three. The order you pick decides what leads your sessions.
          </Text>
        </View>
        {GOAL_GROUP_LABELS.map((group) => (
          <View key={group.group} style={s.goalGroup}>
            <Text style={s.goalGroupLabel}>{group.label}</Text>
            <View style={s.optionStack}>
              {GOAL_OPTIONS.filter(
                (option) => option.group === group.group,
              ).map((option) => {
                const selected = goals.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={[s.option, selected && s.optionActive]}
                    onPress={() => {
                      toggleGoal(option.id);
                      edited();
                    }}
                  >
                    <View style={s.goalOptionText}>
                      <Text
                        style={[s.optionText, selected && s.optionTextActive]}
                      >
                        {option.label}
                      </Text>
                      <Text style={s.goalDetail}>{option.detail}</Text>
                    </View>
                    {selected && (
                      <Text style={s.goalPriority}>
                        {goals.indexOf(option.id) + 1}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {wantsEvent && (
          <EventQuestions
            kind={eventKind}
            setKind={(value) => {
              setEventKind(value);
              edited();
            }}
            weeksAway={weeksAway}
            setWeeksAway={(value) => {
              setWeeksAway(value);
              edited();
            }}
            weeklyKm={weeklyKm}
            setWeeklyKm={(value) => {
              setWeeklyKm(value);
              edited();
            }}
          />
        )}

        <DetailQuestions
          equipment={equipment}
          setEquipment={(value) => {
            setEquipment(value);
            edited();
          }}
          lifeStage={lifeStage}
          setLifeStage={(value) => {
            setLifeStage(value);
            edited();
          }}
          sleepBaseline={sleepBaseline}
          setSleepBaseline={(value) => {
            setSleepBaseline(value);
            edited();
          }}
          trainingDays={trainingDays}
          setTrainingDays={(value) => {
            setTrainingDays(value);
            edited();
          }}
          wontDo={wontDo}
          setWontDo={(value) => {
            setWontDo(value);
            edited();
          }}
          toggleIn={toggleIn}
          showGymEquipment={wantsEvent}
        />

        <Pressable
          accessibilityRole="button"
          onPress={save}
          disabled={savedJustNow}
          style={[s.primaryButton, savedJustNow && s.disabledButton]}
        >
          <Text style={s.primaryButtonText}>
            {savedJustNow ? "Saved" : "Save"}
          </Text>
        </Pressable>
        {savedJustNow && (
          <Text style={s.aboutSummary}>
            Your next plan will be built from these answers. Today's plan stays
            as it is.
          </Text>
        )}
      </Card>

      <Text style={s.disclaimer}>
        These answers guide coaching. They are not a medical assessment, and
        nothing here is shared outside your account.
      </Text>
    </>
  );
}

/** The screens the You tab opens on their own. */
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
