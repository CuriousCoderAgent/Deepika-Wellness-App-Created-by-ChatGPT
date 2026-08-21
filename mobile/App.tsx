import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useMemo, useState } from "react";
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
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  Footprints,
  HeartPulse,
  Home,
  MessageCircle,
  MoonStar,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Utensils,
} from "lucide-react-native";
import {
  ApiError,
  DEMO_TOKEN,
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
import { openHealthSettings, syncHealth } from "./src/health";
import { LEARNING_ARTICLES } from "./src/learning";
import { isoDate, offsetFromDate } from "./src/normalize";
import { PHASES, weekPlansFor } from "./src/plan";
import type {
  ActionDomain,
  AiRecommendation,
  DailyAction,
  EffortLevel,
  FoodEntry,
  HealthMetric,
  MemberDoc,
  PulseEntry,
} from "./src/types";

const C = {
  paper: "#F3F1EA",
  card: "#FCFBF7",
  ink: "#132D2E",
  soft: "#566665",
  faint: "#8A9692",
  line: "#DCE2DD",
  green: "#0B5557",
  greenDeep: "#073F43",
  greenTint: "#DCEAE5",
  marigold: "#B6914B",
  marigoldTint: "#F1E8D5",
  calm: "#3E7182",
};

type Tab = "today" | "plan" | "food" | "coach" | "profile";
const tabs = [
  { key: "today", label: "Today", Icon: Home },
  { key: "plan", label: "Plan", Icon: CalendarDays },
  { key: "food", label: "Food", Icon: Utensils },
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
        contentContainerStyle={s.authScroll}
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
              <Text style={s.inputLabel}>
                Join code <Text style={s.optional}>optional</Text>
              </Text>
              <TextInput
                style={s.input}
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={setJoinCode}
              />
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
          coach.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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

const BODY_SIGNALS = [
  "Night waking",
  "Hot flushes or night sweats",
  "Cycle change",
  "Headache",
  "Bloating",
  "Unusual soreness",
  "Low mood",
  "Coach input requested",
] as const;

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
      id: current?.id ?? `pulse-${Date.now()}`,
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

const DOMAIN_META: Record<
  ActionDomain,
  { label: string; Icon: typeof Dumbbell }
> = {
  movement: { label: "Strength & mobility", Icon: Dumbbell },
  walking: { label: "Walking", Icon: Footprints },
  nutrition: { label: "Nutrition", Icon: Utensils },
  recovery: { label: "Sleep & recovery", Icon: MoonStar },
  mindset: { label: "Stress & reflection", Icon: Brain },
};

function ActionCard({
  action,
  recommendation,
  onComplete,
}: {
  action: DailyAction;
  recommendation?: AiRecommendation;
  onComplete: (
    level: EffortLevel | "rest",
    effort?: 1 | 2 | 3 | 4 | 5,
    pain?: boolean,
  ) => void;
}) {
  const [expanded, setExpanded] = useState(
    Boolean(action.isPrimary || action.exercise),
  );
  const [pendingLevel, setPendingLevel] = useState<EffortLevel | null>(null);
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [pain, setPain] = useState(false);
  const domain = DOMAIN_META[action.domain];
  const chooseLevel = (level: EffortLevel) =>
    action.exercise ? setPendingLevel(level) : onComplete(level);
  const saveWorkout = () => {
    if (!pendingLevel) return;
    onComplete(pendingLevel, effort, pain);
    setPendingLevel(null);
  };
  return (
    <Card style={s.actionCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={s.actionTop}
        onPress={() => setExpanded((value) => !value)}
      >
        <View style={s.domainIcon}>
          <domain.Icon size={17} color={C.greenDeep} strokeWidth={2} />
        </View>
        <View style={s.actionText}>
          <Text style={s.domainLabel}>{domain.label.toUpperCase()}</Text>
          <Text style={s.actionTitle}>{action.title}</Text>
          <Text style={s.actionOutcome}>{action.target.label}</Text>
        </View>
        <View style={[s.actionStatus, action.completed && s.actionStatusDone]}>
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
              <View style={s.exerciseSequenceFrame}>
                <Image
                  source={exerciseMediaFor(action.exercise.name)}
                  style={s.exerciseSequence}
                  resizeMode="contain"
                  accessibilityLabel={`Five-step ${action.exercise.name} form guide`}
                />
              </View>
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
          <Pressable onPress={() => onComplete("rest")}>
            <Text style={s.notToday}>Not today</Text>
          </Pressable>
        </>
      )}
    </Card>
  );
}

function activeDays(doc: MemberDoc, from = -6) {
  return new Set(
    doc.actions
      .filter(
        (action) =>
          action.dayOffset >= from &&
          action.dayOffset <= 0 &&
          action.completed &&
          action.completed !== "rest",
      )
      .map((action) => action.dayOffset),
  ).size;
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
  const meals = doc.foodEntries.filter(
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
      detail: "completed",
      Icon: Check,
    },
    {
      key: "steps",
      label: "Steps",
      value: steps ? Math.round(steps.value).toLocaleString() : "—",
      detail: steps ? `Health Connect · ${steps.date}` : "Connect Health",
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
      detail: pulse?.sleep ? "Member check-in" : "Add above",
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
              <tile.Icon size={15} color={C.greenDeep} />
            </View>
            <Text style={s.snapshotLabel}>{tile.label}</Text>
            <Text style={s.snapshotValue}>{tile.value}</Text>
            <Text numberOfLines={2} style={s.snapshotDetail}>
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
  const applicable = [...doc.recommendations]
    .reverse()
    .find((item) => ["applied", "approved"].includes(item.status));
  const pendingReview = [...doc.recommendations]
    .reverse()
    .find(
      (item) =>
        item.kind === "coach_review" && item.status === "needs_coach_review",
    );
  const steps = [...doc.healthSnapshots]
    .filter((item) => item.metric === "steps" && item.available)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  let title = "Your baseline is taking shape";
  let copy =
    "Bharosa needs a few honest check-ins before it can describe a personal pattern. No plan change is being inferred today.";
  let evidence = "0–1 recent inputs · no causal conclusion";
  let label = "WHAT BHAROSA NOTICED";
  if (pendingReview) {
    title = "A human review is the right next step";
    copy = pendingReview.rationale;
    evidence = pendingReview.evidence[0] ?? "A review flag was recorded today.";
    label = "COACH REVIEW REQUESTED";
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
  const reviewPending = doc.recommendations.some(
    (item) =>
      item.kind === "coach_review" && item.status === "needs_coach_review",
  );
  return (
    <Card style={[s.coachConnection, reviewPending && s.coachConnectionReview]}>
      <View style={s.coachConnectionTop}>
        <View style={s.coachMark}>
          <MessageCircle size={19} color={C.greenDeep} />
        </View>
        <View style={s.flex}>
          <Text style={s.coachConnectionKicker}>
            {reviewPending ? "COACH REVIEW REQUESTED" : "HUMAN SUPPORT"}
          </Text>
          <Text style={s.coachConnectionTitle}>
            {reviewPending
              ? "Your coach has context to review"
              : "A coach is part of the plan"}
          </Text>
        </View>
      </View>
      <Text style={s.coachConnectionCopy}>
        {reviewPending
          ? "The flagged item is paused; Bharosa has not invented a replacement. Open Coach to add context."
          : (latestCoachMessage?.body ??
            "Ask a question, share context, or request a plan review when automated guidance is not enough.")}
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
          {reviewPending ? "Open coach review" : "Message your coach"}
        </Text>
        <ChevronRight size={17} color="white" />
      </Pressable>
    </Card>
  );
}

function Onboarding({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const saved = doc.onboarding;
  const [step, setStep] = useState(saved?.currentStep ?? 0);
  const [goals, setGoals] = useState<string[]>(saved?.goals ?? []);
  const [customGoal, setCustomGoal] = useState(saved?.customGoal ?? "");
  const [activity, setActivity] = useState(saved?.activityLevel ?? "");
  const [minutes, setMinutes] = useState(saved?.availableMinutes ?? 15);
  const [caution, setCaution] = useState(saved?.movementCaution ?? "");
  const [checkIn, setCheckIn] = useState<"morning" | "evening">(
    saved?.preferredCheckIn ?? "morning",
  );
  const [wellnessConsent, setWellnessConsent] = useState(
    saved?.consent.wellness ?? false,
  );
  const [healthConsent, setHealthConsent] = useState(
    saved?.consent.healthConnect ?? false,
  );
  const [aiConsent, setAiConsent] = useState(
    saved?.consent.aiPersonalisation ?? false,
  );
  const goalOptions = [
    "Steadier energy",
    "Feel stronger",
    "Improve mobility",
    "Manage stress",
    "Sleep more consistently",
    "Support hormonal or life-stage wellbeing",
    "Improve endurance",
  ];
  const toggleGoal = (value: string) =>
    setGoals((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length < 3
          ? [...current, value]
          : current,
    );
  const addCustomGoal = () => {
    const value = customGoal.trim();
    if (!value || goals.includes(value) || goals.length >= 3) return;
    setGoals((current) => [...current, value]);
    setCustomGoal("");
  };
  const finish = () =>
    update({
      ...doc,
      member: {
        ...doc.member,
        goals: [
          ...goals,
          ...doc.member.goals.filter((item) => !goals.includes(item)),
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
      onboarding: {
        completed: true,
        currentStep: 6,
        goals,
        customGoal: goals.find((goal) => !goalOptions.includes(goal)),
        activityLevel: activity,
        availableMinutes: minutes,
        movementCaution: caution.trim(),
        preferredCheckIn: checkIn,
        consent: {
          wellness: wellnessConsent,
          healthConnect: healthConsent,
          aiPersonalisation: aiConsent,
        },
      },
    });
  const canContinue =
    step === 0
      ? goals.length >= 1
      : step === 1
        ? Boolean(activity)
        : step === 5
          ? wellnessConsent
          : true;

  let question: React.ReactNode;
  if (step === 0)
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
        <View style={s.optionStack}>
          {goalOptions.map((value) => {
            const selected = goals.includes(value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={value}
                style={[s.option, selected && s.optionActive]}
                onPress={() => toggleGoal(value)}
              >
                <View style={s.goalOptionText}>
                  <Text style={[s.optionText, selected && s.optionTextActive]}>
                    {value}
                  </Text>
                  {selected && (
                    <Text style={s.goalPriority}>
                      Priority {goals.indexOf(value) + 1}
                    </Text>
                  )}
                </View>
                {selected && <Check size={17} color={C.greenDeep} />}
              </Pressable>
            );
          })}
        </View>
        <View style={s.customGoalRow}>
          <TextInput
            value={customGoal}
            onChangeText={setCustomGoal}
            onSubmitEditing={addCustomGoal}
            editable={goals.length < 3}
            style={[s.input, s.customGoalInput]}
            placeholder="Another goal, in your words"
            placeholderTextColor={C.faint}
          />
          <Pressable
            onPress={addCustomGoal}
            disabled={!customGoal.trim() || goals.length >= 3}
            style={[
              s.addGoalButton,
              (!customGoal.trim() || goals.length >= 3) && s.disabledButton,
            ]}
          >
            <Text style={s.addGoalText}>Add</Text>
          </Pressable>
        </View>
        {goals
          .filter((goal) => !goalOptions.includes(goal))
          .map((goal) => (
            <Pressable
              key={goal}
              onPress={() => toggleGoal(goal)}
              style={s.customGoalChip}
            >
              <Text style={s.customGoalChipText}>{goal} · remove</Text>
            </Pressable>
          ))}
      </>
    );
  else if (step === 1)
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
  else if (step === 2)
    question = (
      <>
        <Text style={s.onboardingTitle}>How much time is realistic?</Text>
        <Text style={s.onboardingCopy}>
          Choose a normal weekday—not your best-case day.
        </Text>
        <View style={s.minutesRow}>
          {[5, 10, 15, 25].map((value) => (
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
      </>
    );
  else if (step === 3)
    question = (
      <>
        <Text style={s.onboardingTitle}>
          Anything your coach should respect?
        </Text>
        <Text style={s.onboardingCopy}>
          Add pain, injury, pregnancy, a limitation, medical guidance—or write
          “none”.
        </Text>
        <TextInput
          value={caution}
          onChangeText={setCaution}
          style={[s.input, s.cautionInput]}
          multiline
          placeholder="e.g. Knee-sensitive; low impact preferred"
          placeholderTextColor={C.faint}
        />
      </>
    );
  else if (step === 4)
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
  else
    question = (
      <>
        <Text style={s.onboardingTitle}>Choose what you share.</Text>
        <Text style={s.onboardingCopy}>
          Core wellness consent is required. Health Connect and AI
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
              <Text style={s.consentTitle}>Android Health Connect</Text>
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

  return (
    <>
      <Text style={s.eyebrow}>LET’S PERSONALISE YOUR START</Text>
      <Text style={s.hero}>A plan that fits your real week.</Text>
      <Text style={s.heroCopy}>
        Six focused questions help Bharosa and your coach avoid generic
        recommendations.
      </Text>
      <View style={s.onboardingProgress}>
        {[0, 1, 2, 3, 4, 5].map((value) => (
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
            onPress={() => (step === 5 ? finish() : setStep(step + 1))}
            style={[s.continueButton, !canContinue && s.disabledButton]}
          >
            <Text style={s.continueButtonText}>
              {step === 5 ? "Create my starting plan" : "Continue"}
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

function Today({
  doc,
  update,
  onOpenCoach,
  onOpenProfile,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  onOpenCoach: () => void;
  onOpenProfile: () => void;
}) {
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
  const remaining = actions.length - actionsDone;
  const primary = actions.find((action) => action.isPrimary) ?? actions[0];
  const complete = (
    id: string,
    level: EffortLevel | "rest",
    effort: 1 | 2 | 3 | 4 | 5 = 3,
    pain = false,
  ) => {
    const action = doc.actions.find((item) => item.id === id);
    const workoutLogs =
      action?.exercise && level !== "rest"
        ? [
            ...doc.workoutLogs,
            {
              id: `workout-${Date.now()}`,
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
            id: `pain-${Date.now()}`,
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
            id: `recommendation-${Date.now()}`,
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
        a.id === id ? { ...a, completed: level } : a,
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
          ? `${remaining} supportive action${remaining === 1 ? "" : "s"} remain${remaining === 1 ? "s" : ""}. ${primary ? `Start with ${primary.title.toLowerCase()}.` : "Choose the smallest useful next step."}`
          : "Today’s plan is complete. Recovery counts as part of the work."}
      </Text>
      {doc.member.lastPlanChange && (
        <View style={s.planChange}>
          <Text style={s.planLabel}>↻ Plan adjusted</Text>
          <Text style={s.planCopy}>{doc.member.lastPlanChange.rationale}</Text>
        </View>
      )}
      <Text style={s.flowLabel}>1 · TRACK WHAT IS TRUE TODAY</Text>
      <Pulse doc={doc} onChange={update} />
      <DailySnapshot doc={doc} onOpenProfile={onOpenProfile} />
      <Text style={s.flowLabel}>2 · UNDERSTAND, WITHOUT GUESSWORK</Text>
      <DailyInsight doc={doc} />
      <Text style={s.flowLabel}>3 · TAKE THE NEXT USEFUL ACTION</Text>
      <Card style={s.dayMap}>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Your whole-health plan</Text>
          <Text style={s.sectionMeta}>
            {actionsDone} of {actions.length}
          </Text>
        </View>
        <View style={s.dayMapRow}>
          {domainOrder.map((domain) => {
            const meta = DOMAIN_META[domain];
            const action = actions.find((item) => item.domain === domain);
            const done = Boolean(
              action?.completed && action.completed !== "rest",
            );
            return (
              <View key={domain} style={s.dayMapItem}>
                <View style={[s.dayMapIcon, done && s.dayMapIconDone]}>
                  <meta.Icon size={17} color={done ? "white" : C.greenDeep} />
                </View>
                <Text numberOfLines={2} style={s.dayMapLabel}>
                  {meta.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>Your focus today</Text>
        <Text style={s.sectionMeta}>Most important first</Text>
      </View>
      {actions.length ? (
        actions.map((a) => (
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
              complete(a.id, level, effort, pain)
            }
          />
        ))
      ) : (
        <Card>
          <Text style={s.empty}>
            Nothing scheduled today. That is intentional.
          </Text>
        </Card>
      )}
      <Text style={s.flowLabel}>4 · BUILD A RHYTHM, NOT A PERFECT STREAK</Text>
      <EngagementPanel doc={doc} />
      <CoachConnectionCard doc={doc} onOpenCoach={onOpenCoach} />
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
  const completed = doc.actions.filter(
    (action) => action.completed && action.completed !== "rest",
  ).length;
  const weekEndOffset = (selectedWeek - doc.member.week) * 7;
  const weekStartOffset = weekEndOffset - 6;
  const selectedActions = doc.actions.filter(
    (action) =>
      action.dayOffset >= weekStartOffset && action.dayOffset <= weekEndOffset,
  );
  const selectedCompleted = selectedActions.filter(
    (action) => action.completed && action.completed !== "rest",
  ).length;
  const state =
    selectedWeek < doc.member.week
      ? "past"
      : selectedWeek === doc.member.week
        ? "current"
        : "future";
  const milestones = [
    {
      at: 1,
      title: "First step",
      copy: "You completed your first supportive action.",
    },
    {
      at: 5,
      title: "Finding a rhythm",
      copy: "Five actions—proof that small efforts accumulate.",
    },
    {
      at: 12,
      title: "Showing up",
      copy: "Twelve actions across real-life days.",
    },
  ];
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
              <Text style={s.moduleChipText}>
                {module.replace(/[-_]/g, " ")}
              </Text>
            </View>
          ))}
        </View>
        {state === "past" && (
          <View style={s.weekWin}>
            <Sparkles size={17} color={C.marigold} />
            <View style={s.flex}>
              <Text style={s.weekWinTitle}>Notable win</Text>
              <Text style={s.weekWinCopy}>
                {selectedCompleted
                  ? `${selectedCompleted} planned actions completed. Your minimum efforts count here.`
                  : "The week is part of your record even when life interrupted the plan."}
              </Text>
            </View>
          </View>
        )}
        {selected.rationale && (
          <View style={s.planReason}>
            <Text style={s.whyLabel}>WHY THE PLAN CHANGED</Text>
            <Text style={s.planCopy}>{selected.rationale}</Text>
          </View>
        )}
      </Card>
      <Text style={s.sectionTitle}>Milestones, not streaks</Text>
      <View style={s.milestoneRow}>
        {milestones.map((milestone) => {
          const unlocked = completed >= milestone.at;
          return (
            <View
              key={milestone.at}
              style={[s.milestone, unlocked && s.milestoneUnlocked]}
            >
              <Text style={s.milestoneIcon}>{unlocked ? "✦" : "○"}</Text>
              <Text
                style={[s.milestoneTitle, unlocked && s.milestoneTitleUnlocked]}
              >
                {milestone.title}
              </Text>
              <Text style={s.milestoneCopy}>{milestone.copy}</Text>
            </View>
          );
        })}
      </View>
      <LearningLibrary />
    </>
  );
}

function LearningLibrary() {
  const [articleId, setArticleId] = useState<string | null>(null);
  const article = LEARNING_ARTICLES.find((item) => item.id === articleId);
  if (article)
    return (
      <View style={s.learningDetail}>
        <Pressable onPress={() => setArticleId(null)}>
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
  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>Learn in five minutes</Text>
        <Text style={s.sectionMeta}>{LEARNING_ARTICLES.length} guides</Text>
      </View>
      {LEARNING_ARTICLES.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item.id}
          onPress={() => setArticleId(item.id)}
          style={({ pressed }) => [s.articleCard, pressed && s.pressed]}
        >
          <View style={s.articleMeta}>
            <Text style={s.articleCategory}>{item.category.toUpperCase()}</Text>
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

function estimateMeal(description: string) {
  const text = description.toLowerCase();
  let calories = 320;
  let protein = 12;
  let carbs = 42;
  let fat = 11;
  if (/paneer|chicken|fish|egg|tofu/.test(text)) {
    calories += 120;
    protein += 18;
    fat += 5;
  }
  if (/rice|roti|poha|upma|bread/.test(text)) {
    calories += 90;
    carbs += 20;
  }
  if (/salad|vegetable|sabzi|fruit/.test(text)) {
    calories -= 50;
    carbs += 6;
  }
  return { calories: Math.max(100, calories), protein, carbs, fat };
}

function Food({
  doc,
  update,
  token,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
}) {
  const [description, setDescription] = useState("");
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
  const selectedEntries = doc.foodEntries.filter(
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
      doc.foodEntries.reduce<
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
      const estimate = estimateMeal(description || "meal from photo");
      const entry: FoodEntry = {
        id: `food-${Date.now()}`,
        memberId: doc.member.id,
        dayOffset: offsetFromDate(selectedDate),
        loggedDate: selectedDate,
        meal,
        description: description.trim() || "Meal captured from photo",
        ...estimate,
        photoFileId: stored?.id,
        photoUri: token === DEMO_TOKEN ? photoUri : undefined,
        confidence: "estimated",
        createdAt: new Date().toISOString(),
      };
      update({ ...doc, foodEntries: [...doc.foodEntries, entry] });
      setDescription("");
      setPhotoAsset(undefined);
    } catch (error) {
      Alert.alert(
        "Photo not saved",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };
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
  const saveCorrection = () => {
    if (!editingId) return;
    update({
      ...doc,
      foodEntries: doc.foodEntries.map((entry) =>
        entry.id === editingId
          ? {
              ...entry,
              description: editValues.description.trim() || entry.description,
              calories: Number(editValues.calories) || 0,
              protein: Number(editValues.protein) || 0,
              carbs: Number(editValues.carbs) || 0,
              fat: Number(editValues.fat) || 0,
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
        Calories and protein are estimates for context, never a score. Tap any
        day to see and correct its meals.
      </Text>
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
                      {dailyTotals[cell.date]?.calories ?? 0}k
                    </Text>
                    <View
                      style={[
                        s.proteinDot,
                        (dailyTotals[cell.date]?.protein ?? 0) >= 20 &&
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
          placeholder="e.g. 2 rotis, paneer bhurji and salad"
          placeholderTextColor={C.faint}
        />
        <View style={s.captureRow}>
          <Pressable
            style={s.photoButton}
            onPress={choosePhoto}
            disabled={uploadingPhoto}
          >
            <Text style={s.photoButtonText}>
              {photoUri ? "✓ Photo added" : "＋ Add photo"}
            </Text>
          </Pressable>
          <Pressable
            style={[s.primaryButton, s.estimateButton]}
            onPress={add}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryButtonText}>Estimate & add</Text>
            )}
          </Pressable>
        </View>
        {photoUri && <Image source={{ uri: photoUri }} style={s.mealPhoto} />}
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
                        : "✦ AI-ASSISTED ESTIMATE"}
                    </Text>
                    <Pressable
                      accessibilityLabel="Correct meal estimate"
                      onPress={() => beginCorrection(entry)}
                      style={s.editFoodButton}
                    >
                      <Pencil size={13} color={C.greenDeep} />
                      <Text style={s.editFoodText}>Correct</Text>
                    </Pressable>
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

function Coach({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const [draft, setDraft] = useState("");
  const messages = [...doc.messages].sort((a, b) => a.dayOffset - b.dayOffset);
  const next = [...doc.sessions]
    .filter((x) => x.status === "scheduled" && x.dayOffset >= 0)
    .sort((a, b) => a.dayOffset - b.dayOffset)[0];
  const send = () => {
    if (!draft.trim()) return;
    update({
      ...doc,
      messages: [
        ...doc.messages,
        {
          id: `message-${Date.now()}`,
          memberId: doc.member.id,
          from: "member",
          kind: "text",
          body: draft.trim(),
          dayOffset: 0,
          time: "just now",
          read: false,
        },
      ],
    });
    setDraft("");
  };
  return (
    <>
      <Text style={s.eyebrow}>YOUR COACH</Text>
      <Text style={s.hero}>A human in your corner.</Text>
      <Text style={s.heroCopy}>
        Ask questions, share context, and see plan changes from your coach.
      </Text>
      {next && (
        <View style={s.session}>
          <Text style={s.sessionLabel}>NEXT SESSION</Text>
          <Text style={s.sessionTitle}>{next.type}</Text>
          <Text style={s.sessionMeta}>
            {next.dayOffset === 0
              ? "Today"
              : `In ${next.dayOffset} day${next.dayOffset === 1 ? "" : "s"}`}{" "}
            · {next.time}
          </Text>
        </View>
      )}
      <Text style={s.sectionTitle}>Conversation</Text>
      {messages.length ? (
        messages.slice(-12).map((m) => (
          <View
            key={m.id}
            style={[
              s.messageBubble,
              m.from === "member" ? s.memberBubble : s.coachBubble,
            ]}
          >
            <View style={s.rowBetween}>
              <Text
                style={[
                  s.messageFrom,
                  m.from === "coach" && s.messageFromCoach,
                ]}
              >
                {m.from === "coach" ? "Coach" : "You"}
              </Text>
              <Text style={s.messageTime}>{m.time}</Text>
            </View>
            <Text
              style={[
                s.messageBody,
                m.from === "member" && s.memberMessageText,
              ]}
            >
              {m.body}
            </Text>
          </View>
        ))
      ) : (
        <Card>
          <Text style={s.empty}>No messages yet.</Text>
        </Card>
      )}
      <View style={s.composer}>
        <TextInput
          style={s.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write to your coach…"
          placeholderTextColor={C.faint}
          multiline
        />
        <Pressable style={s.sendButton} onPress={send}>
          <Text style={s.sendButtonText}>↑</Text>
        </Pressable>
      </View>
      <Text style={s.responseNote}>
        Your coach replies between sessions. This is not an emergency channel.
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
            id: `report-${Date.now()}`,
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

const HEALTH_LABELS: Record<HealthMetric, { label: string; unit: string }> = {
  steps: { label: "Steps", unit: "steps" },
  restingHeartRate: { label: "Resting heart rate", unit: "bpm" },
  heartRateVariability: { label: "Heart-rate variability", unit: "ms" },
  vo2Max: { label: "VO₂ max", unit: "ml/kg/min" },
};

function HealthConnectionPanel({
  doc,
  update,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const connection = doc.healthConnection;
  const mergeSnapshots = (incoming: MemberDoc["healthSnapshots"]) => {
    const map = new Map(doc.healthSnapshots.map((item) => [item.id, item]));
    incoming.forEach((item) => map.set(item.id, item));
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  };
  const runSync = async (requestPermissions: boolean) => {
    setSyncing(true);
    const result = await syncHealth(requestPermissions);
    await update({
      ...doc,
      healthConnection: result.connection,
      healthSnapshots: mergeSnapshots(result.snapshots),
    });
    setSyncing(false);
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
            <Text style={s.cardTitle}>Android Health Connect</Text>
            <Text style={s.healthStatus}>
              {connection.status === "connected"
                ? "Connected"
                : connection.status === "partial"
                  ? "Partially connected"
                  : connection.status === "unavailable"
                    ? "Development build required"
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
                    connection.permissions[metric] === "granted" &&
                      s.permissionGranted,
                  ]}
                >
                  {connection.permissions[metric] === "granted"
                    ? "Allowed"
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
            <Text style={s.manageHealthText}>Manage Health Connect access</Text>
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

function Profile({
  doc,
  update,
  onLogout,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  onLogout: () => void;
}) {
  const website = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const engagement = doc.engagement ?? {
    weeklyGoal: 4,
    circle: {
      inviteCode: `BHAROSA-${doc.member.id.toUpperCase()}`,
      memberCount: 1,
    },
    reminders: { enabled: false, time: "8:00 AM" },
    celebratedMilestones: [],
  };
  const invite = () =>
    Share.share({
      message: `I’m building steadier wellness habits with Bharosa Wellness. Join my private support circle with code ${engagement.circle.inviteCode}. Nothing about my health is shared automatically.`,
    });
  const toggleReminder = (enabled: boolean) =>
    update({
      ...doc,
      engagement: {
        ...engagement,
        reminders: { ...engagement.reminders, enabled },
      },
    });
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
              A quiet prompt at {engagement.reminders.time}. No guilt if you
              ignore it.
            </Text>
          </View>
          <Switch
            value={engagement.reminders.enabled}
            onValueChange={toggleReminder}
            trackColor={{ false: C.line, true: C.greenTint }}
            thumbColor={engagement.reminders.enabled ? C.green : C.faint}
          />
        </View>
      </Card>
      <LinearGradient colors={["#E7EFF0", "#F3EBDD"]} style={s.circleCard}>
        <Text style={s.circleKicker}>BHAROSA CIRCLE · OPT IN</Text>
        <Text style={s.circleTitle}>
          Wellness is easier with one trusted person.
        </Text>
        <Text style={s.profileCopy}>
          Invite a friend or family member for encouragement. Your meals,
          check-ins and health information remain private.
        </Text>
        <View style={s.inviteCode}>
          <Text style={s.inviteCodeLabel}>YOUR CODE</Text>
          <Text style={s.inviteCodeValue}>{engagement.circle.inviteCode}</Text>
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
        <Text style={s.cardTitle}>Privacy and support</Text>
        <Text style={s.profileCopy}>
          Your information is used for your coaching journey. You can request an
          export or deletion at any time.
        </Text>
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
              <Text style={s.policyLink}>Delete account</Text>
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
  const [doc, setDoc] = useState<MemberDoc | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      let next = await loadMember(token);
      const today = isoDate();
      const hasTodayRecommendation = next.recommendations.some(
        (item) => item.createdAt.slice(0, 10) === today,
      );
      if (
        next.onboarding.consent.aiPersonalisation &&
        !hasTodayRecommendation &&
        token !== DEMO_TOKEN
      ) {
        try {
          const result = await generateRecommendation(token);
          if (result?.recommendation)
            next = {
              ...next,
              recommendations: [...next.recommendations, result.recommendation],
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
      setDoc(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        onSignedOut();
        return;
      }
      Alert.alert(
        "Couldn’t load your plan",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    refresh();
  }, [token]);

  const update = async (next: MemberDoc) => {
    const previous = doc;
    setDoc(next);
    setSaving(true);
    try {
      await saveMember(token, next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        onSignedOut();
        return;
      }
      setDoc(previous);
      Alert.alert(
        "Not saved",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

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
        <Pressable style={s.primaryButton} onPress={refresh}>
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
        onOpenCoach={() => setTab("coach")}
        onOpenProfile={() => setTab("profile")}
      />
    );
  else if (tab === "plan")
    content = (
      <>
        <Journey doc={doc} />
        <Progress doc={doc} />
      </>
    );
  else if (tab === "food")
    content = <Food doc={doc} update={update} token={token} />;
  else if (tab === "coach") content = <Coach doc={doc} update={update} />;
  else
    content = (
      <>
        <Profile
          doc={doc}
          update={update}
          onLogout={async () => {
            await logout();
            onSignedOut();
          }}
        />
        <HealthConnectionPanel doc={doc} update={update} />
        <Reports doc={doc} update={update} token={token} />
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
          {saving && <Text style={s.saving}>Saving…</Text>}
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
      <ScrollView
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
        {content}
        <View style={{ height: 30 }} />
      </ScrollView>
      <View style={s.tabShell}>
        <View accessibilityRole="tablist" style={s.tabBar}>
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.label} tab`}
                style={({ pressed }) => [s.tab, pressed && s.tabPressed]}
                onPress={() => setTab(item.key)}
              >
                <View style={[s.tabIcon, active && s.tabIconActive]}>
                  <item.Icon
                    size={20}
                    strokeWidth={active ? 2.35 : 1.9}
                    color={active ? C.greenDeep : C.faint}
                  />
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
      {token ? (
        <MemberApp token={token} onSignedOut={() => setToken(null)} />
      ) : (
        <Login onSuccess={setToken} onDemo={() => setToken(DEMO_TOKEN)} />
      )}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.paper },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 22 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.paper,
    padding: 28,
    gap: 14,
  },
  loadingText: { color: C.soft, fontSize: 15 },
  topBar: {
    height: 56,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.paper,
  },
  wordmark: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topLogo: { width: 36, height: 36, borderRadius: 11 },
  topBrand: {
    color: C.greenDeep,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  topBrandSub: {
    color: C.faint,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginTop: 1,
  },
  topActions: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.greenTint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  topAvatarActive: { borderColor: C.green },
  topAvatarText: { color: C.greenDeep, fontSize: 11, fontWeight: "800" },
  saving: { color: C.green, fontSize: 11 },
  loginPage: { flex: 1, backgroundColor: C.paper },
  authScroll: { flexGrow: 1, paddingBottom: 28 },
  authHero: {
    paddingHorizontal: 28,
    paddingTop: 58,
    paddingBottom: 38,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  brandIcon: { width: 64, height: 64, borderRadius: 18, marginBottom: 18 },
  brand: {
    fontSize: 12,
    color: "#D9C28D",
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  loginTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: 20,
  },
  loginCopy: {
    color: "#D6E1DD",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 9,
    maxWidth: 420,
  },
  authCard: {
    marginHorizontal: 20,
    marginTop: -14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  inputLabel: {
    color: C.ink,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 12,
    letterSpacing: 0.2,
  },
  optional: { color: C.faint, fontWeight: "500" },
  input: {
    backgroundColor: "#F7F8F4",
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 13,
    color: C.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  fieldHint: { color: C.faint, fontSize: 11, marginTop: 5 },
  error: { color: "#A34336", fontSize: 13, lineHeight: 19, marginTop: 12 },
  notice: { color: C.green, fontSize: 13, lineHeight: 19, marginTop: 12 },
  privacyNote: {
    color: C.faint,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 18,
    marginHorizontal: 28,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: C.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  primaryButtonText: { color: "white", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: C.ink, fontWeight: "600", fontSize: 14 },
  textButton: {
    color: C.green,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    paddingTop: 15,
  },
  authDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
    flex: 1,
  },
  dividerText: { color: C.faint, fontSize: 10, fontWeight: "700" },
  pressed: { opacity: 0.82 },
  eyebrow: {
    color: C.green,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  hero: { color: C.ink, fontSize: 30, lineHeight: 36, fontWeight: "700" },
  heroCopy: {
    color: C.soft,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
    marginBottom: 20,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    marginBottom: 12,
  },
  compactCard: { paddingVertical: 14 },
  cardTitle: { color: C.ink, fontSize: 15, fontWeight: "700" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saved: { color: C.green, fontSize: 11, fontWeight: "600" },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 10,
  },
  sectionMeta: { color: C.faint, fontSize: 12 },
  empty: { color: C.soft, fontSize: 14, lineHeight: 20, textAlign: "center" },
  planChange: {
    backgroundColor: C.greenTint,
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
  },
  planLabel: { color: C.green, fontSize: 12, fontWeight: "700" },
  planCopy: { color: C.soft, fontSize: 13, lineHeight: 19, marginTop: 5 },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  mood: { alignItems: "center", flex: 1 },
  moodCircle: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  moodCircleActive: { backgroundColor: C.greenTint },
  moodGlyph: { color: C.faint, fontSize: 21 },
  moodGlyphActive: { color: C.green, fontWeight: "700" },
  moodLabel: { color: C.faint, fontSize: 11, marginTop: 6 },
  moodLabelActive: { color: C.ink, fontWeight: "600" },
  pulseSummary: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    color: C.soft,
    fontSize: 12,
    marginTop: 14,
    paddingTop: 12,
  },
  pulseDetailsButton: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    marginTop: 12,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pulseDetailsText: { color: C.greenDeep, fontSize: 12, fontWeight: "800" },
  pulseDetails: { paddingTop: 2 },
  sleepRow: { flexDirection: "row", gap: 8 },
  sleepChoice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  sleepChoiceActive: { backgroundColor: C.greenDeep, borderColor: C.greenDeep },
  sleepChoiceValue: { color: C.soft, fontSize: 14, fontWeight: "800" },
  sleepChoiceValueActive: { color: "white" },
  sleepScaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  sleepScaleLabel: { color: C.faint, fontSize: 9 },
  signalWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  signalChip: {
    minHeight: 40,
    maxWidth: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  signalChipActive: { backgroundColor: C.greenTint, borderColor: C.green },
  signalChipText: { color: C.soft, fontSize: 11, fontWeight: "600" },
  signalChipTextActive: { color: C.greenDeep, fontWeight: "800" },
  signalNote: { color: C.faint, fontSize: 10, lineHeight: 15, marginTop: 11 },
  flowLabel: {
    color: C.green,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 13,
    marginBottom: 9,
  },
  snapshotCard: { padding: 15 },
  snapshotIntro: { color: C.faint, fontSize: 10, marginTop: 3 },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  snapshotTile: {
    width: "48.5%",
    minHeight: 112,
    borderRadius: 15,
    backgroundColor: C.paper,
    padding: 12,
  },
  snapshotTileAction: { borderWidth: 1, borderColor: C.greenTint },
  snapshotIcon: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: C.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  snapshotLabel: { color: C.faint, fontSize: 9, marginTop: 9 },
  snapshotValue: {
    color: C.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    marginTop: 2,
  },
  snapshotDetail: { color: C.soft, fontSize: 9, lineHeight: 13, marginTop: 2 },
  insightCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
    backgroundColor: C.marigoldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDC994",
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF90",
    alignItems: "center",
    justifyContent: "center",
  },
  insightBody: { flex: 1 },
  insightLabel: {
    color: C.marigold,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  insightTitle: { color: C.ink, fontSize: 16, fontWeight: "800", marginTop: 4 },
  insightCopy: { color: C.soft, fontSize: 12, lineHeight: 18, marginTop: 5 },
  insightEvidence: {
    color: C.faint,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 8,
  },
  coachConnection: { padding: 18, marginTop: 2 },
  coachConnectionReview: { backgroundColor: "#F8EDE7", borderColor: "#DFC0B4" },
  coachConnectionTop: { flexDirection: "row", gap: 11, alignItems: "center" },
  coachMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  coachConnectionKicker: {
    color: C.marigold,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  coachConnectionTitle: {
    color: C.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    marginTop: 3,
  },
  coachConnectionCopy: {
    color: C.soft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 13,
  },
  coachConnectionMeta: {
    color: C.faint,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },
  coachConnectionButton: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: C.greenDeep,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },
  coachConnectionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  consistencyCard: { borderRadius: 22, padding: 18, marginBottom: 12 },
  consistencyLabel: {
    color: "#BDD5CF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  consistencyCount: { color: "#E8D39E", fontSize: 12, fontWeight: "800" },
  consistencyTitle: {
    color: "white",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    marginTop: 12,
  },
  consistencyTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF28",
    overflow: "hidden",
    marginTop: 15,
  },
  consistencyFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#D7B86F",
  },
  rhythmDots: { flexDirection: "row", gap: 7, marginTop: 10 },
  rhythmDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF24",
  },
  rhythmDotDone: { backgroundColor: "#D7B86F" },
  challengeStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#FFFFFF35",
    marginTop: 16,
    paddingTop: 13,
  },
  challengeKicker: { color: "#E8D39E", fontSize: 11, fontWeight: "800" },
  challengeCopy: {
    color: "#DCE9E5",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  shareWin: {
    alignSelf: "flex-start",
    marginTop: 13,
    borderRadius: 12,
    backgroundColor: "#FFFFFF14",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  shareWinText: { color: "white", fontSize: 11, fontWeight: "700" },
  actionCard: { padding: 16 },
  actionTop: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  domainIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.greenTint,
  },
  domainLabel: {
    color: C.green,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  actionText: { flex: 1 },
  actionTitle: {
    color: C.ink,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  actionOutcome: { color: C.soft, fontSize: 11, lineHeight: 15, marginTop: 2 },
  whyBlock: {
    backgroundColor: C.paper,
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
  },
  whyLabel: {
    color: C.green,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  actionWhy: { color: C.soft, fontSize: 13, lineHeight: 19, marginTop: 4 },
  recommendationEvidence: {
    color: C.faint,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
  },
  actionStatus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  actionStatusDone: { backgroundColor: C.green, borderColor: C.green },
  effortRow: { flexDirection: "row", gap: 7, marginTop: 15 },
  effort: {
    flex: 1,
    minHeight: 62,
    borderRadius: 12,
    backgroundColor: C.paper,
    padding: 8,
    justifyContent: "center",
  },
  effortActive: { backgroundColor: C.green },
  effortLabel: { color: C.ink, fontSize: 11, fontWeight: "700" },
  effortDetail: { color: C.faint, fontSize: 9, lineHeight: 12, marginTop: 3 },
  effortLabelActive: { color: "white" },
  exerciseBlock: {
    backgroundColor: C.greenTint,
    borderRadius: 16,
    marginTop: 14,
    padding: 12,
  },
  exerciseSets: { color: C.greenDeep, fontSize: 12, fontWeight: "800" },
  exerciseCue: {
    color: C.green,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  frameRow: { flexDirection: "row", gap: 5, marginTop: 12 },
  frame: {
    flex: 1,
    minHeight: 92,
    borderRadius: 10,
    backgroundColor: C.card,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 3,
  },
  figureHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.greenDeep,
  },
  figureBody: {
    width: 3,
    height: 25,
    borderRadius: 2,
    backgroundColor: C.green,
    marginTop: 2,
  },
  figureBase: {
    width: 15,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.marigold,
    marginTop: 2,
  },
  frameLabel: {
    color: C.soft,
    textAlign: "center",
    fontSize: 8,
    lineHeight: 10,
    marginTop: 6,
  },
  formCue: { color: C.soft, fontSize: 11, lineHeight: 16, marginTop: 10 },
  notToday: {
    color: C.faint,
    fontSize: 12,
    textAlign: "center",
    paddingTop: 13,
    paddingBottom: 2,
  },
  listRow: { flexDirection: "row", gap: 10, marginTop: 13 },
  bullet: { color: C.green, fontSize: 15, fontWeight: "700" },
  listText: { flex: 1, color: C.ink, fontSize: 15, lineHeight: 21 },
  milestoneRow: { gap: 9 },
  milestone: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.line,
    padding: 15,
    backgroundColor: "#F7F8F4",
  },
  milestoneUnlocked: {
    backgroundColor: C.marigoldTint,
    borderColor: "#DDC994",
  },
  milestoneIcon: { color: C.marigold, fontSize: 18 },
  milestoneTitle: {
    color: C.faint,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 7,
  },
  milestoneTitleUnlocked: { color: C.ink },
  milestoneCopy: { color: C.soft, fontSize: 12, lineHeight: 17, marginTop: 3 },
  dotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  dayDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.line },
  dayDotDone: { backgroundColor: C.green },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 13,
  },
  metricDay: { color: C.soft, fontSize: 11, width: 48 },
  metricTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.line,
    overflow: "hidden",
  },
  metricFill: { height: "100%", backgroundColor: C.green, borderRadius: 4 },
  metricValue: { width: 25, color: C.soft, fontSize: 11 },
  sleepMetricFill: { backgroundColor: C.calm },
  trendSummary: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 9,
    marginTop: 16,
    marginBottom: 2,
  },
  trendValue: { color: C.greenDeep, fontSize: 24, fontWeight: "800" },
  trendLabel: { flex: 1, color: C.soft, fontSize: 11, lineHeight: 16 },
  trendEvidence: {
    color: C.faint,
    fontSize: 9,
    lineHeight: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 10,
    marginTop: 13,
  },
  signalHistoryRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  signalHistoryName: { flex: 1, color: C.ink, fontSize: 12, fontWeight: "600" },
  signalHistoryCount: { color: C.green, fontSize: 10, fontWeight: "800" },
  session: {
    backgroundColor: C.marigoldTint,
    borderRadius: 19,
    padding: 18,
    marginBottom: 8,
  },
  sessionLabel: {
    color: C.marigold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sessionTitle: { color: C.ink, fontSize: 18, fontWeight: "700", marginTop: 7 },
  sessionMeta: { color: C.soft, fontSize: 13, marginTop: 3 },
  messageBubble: {
    maxWidth: "88%",
    borderRadius: 18,
    padding: 14,
    marginBottom: 9,
  },
  coachBubble: { alignSelf: "flex-start", backgroundColor: C.marigoldTint },
  memberBubble: { alignSelf: "flex-end", backgroundColor: C.greenDeep },
  messageFrom: { color: C.green, fontSize: 11, fontWeight: "800" },
  messageFromCoach: { color: C.marigold },
  messageTime: { color: C.faint, fontSize: 9 },
  messageBody: { color: C.ink, fontSize: 14, lineHeight: 21, marginTop: 6 },
  memberMessageText: { color: "white" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 7,
    marginTop: 14,
  },
  composerInput: {
    flex: 1,
    color: C.ink,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: { color: "white", fontSize: 22, fontWeight: "600" },
  responseNote: {
    color: C.faint,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 8,
  },
  heroUnit: { fontSize: 15, color: C.soft, fontWeight: "500" },
  mealInput: {
    minHeight: 86,
    paddingTop: 13,
    textAlignVertical: "top",
    marginTop: 12,
  },
  captureRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  photoButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtonText: { color: C.green, fontSize: 13, fontWeight: "700" },
  estimateButton: { flex: 1.3, marginTop: 0, minHeight: 48 },
  mealPhoto: { width: "100%", height: 170, borderRadius: 14, marginTop: 12 },
  estimateNote: { color: C.faint, fontSize: 10, lineHeight: 15, marginTop: 10 },
  foodCard: { flexDirection: "row", gap: 12 },
  foodThumb: { width: 64, height: 64, borderRadius: 12 },
  foodText: { flex: 1 },
  calories: { color: C.green, fontSize: 12, fontWeight: "800" },
  macroText: { color: C.soft, fontSize: 11, marginTop: 5 },
  aiTag: {
    color: C.marigold,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 8,
  },
  profileBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.greenTint,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  profileInitials: { color: C.green, fontSize: 24, fontWeight: "700" },
  center: { textAlign: "center" },
  flex: { flex: 1, paddingRight: 14 },
  profileCopy: { color: C.soft, fontSize: 14, lineHeight: 21, marginTop: 9 },
  circleCard: { borderRadius: 22, padding: 18, marginBottom: 12 },
  circleKicker: {
    color: C.green,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  circleTitle: {
    color: C.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    marginTop: 8,
  },
  inviteCode: {
    backgroundColor: "#FFFFFF90",
    borderRadius: 13,
    padding: 12,
    marginTop: 14,
  },
  inviteCodeLabel: {
    color: C.faint,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  inviteCodeValue: {
    color: C.greenDeep,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 3,
  },
  circleButton: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: C.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  circleButtonText: { color: "white", fontSize: 13, fontWeight: "700" },
  policyLinks: { flexDirection: "row", gap: 22, marginTop: 15 },
  policyLink: {
    color: C.green,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  disclaimer: {
    color: C.faint,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 20,
  },
  tabShell: {
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  tabBar: {
    minHeight: 62,
    backgroundColor: C.card,
    flexDirection: "row",
    paddingHorizontal: 3,
  },
  tab: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabPressed: { backgroundColor: C.paper },
  tabIcon: {
    height: 28,
    minWidth: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconActive: { backgroundColor: C.greenTint },
  tabLabel: {
    color: C.faint,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  tabLabelActive: { color: C.greenDeep, fontWeight: "800" },
  exerciseSequenceFrame: {
    width: "100%",
    height: 104,
    borderRadius: 13,
    marginTop: 12,
    overflow: "hidden",
    backgroundColor: "#F7F0E7",
  },
  exerciseSequence: { width: "100%", height: "100%" },
  exerciseSteps: { flexDirection: "row", gap: 4, marginTop: 8 },
  exerciseStep: { flex: 1, alignItems: "center" },
  exerciseStepNumber: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: C.greenDeep,
    color: "white",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 9,
    fontWeight: "800",
  },
  exerciseStepLabel: {
    color: C.soft,
    textAlign: "center",
    fontSize: 8,
    lineHeight: 10,
    marginTop: 4,
  },
  workoutLog: {
    marginTop: 14,
    padding: 14,
    borderRadius: 15,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "#C9D9D3",
  },
  logTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  logLabel: {
    color: C.faint,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 7,
  },
  ratingRow: { flexDirection: "row", gap: 7 },
  ratingButton: {
    flex: 1,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.paper,
  },
  ratingButtonActive: { backgroundColor: C.greenDeep },
  ratingText: { color: C.soft, fontSize: 13, fontWeight: "700" },
  ratingTextActive: { color: "white" },
  painRow: { flexDirection: "row", gap: 8 },
  painChoice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  painChoiceActive: { backgroundColor: C.greenTint, borderColor: C.green },
  painChoiceWarning: { backgroundColor: "#F8E4DF", borderColor: "#C86A59" },
  painChoiceText: { color: C.soft, fontSize: 12, fontWeight: "700" },
  painChoiceTextActive: { color: C.greenDeep },
  painChoiceWarningText: { color: "#943D32" },
  painWarning: { color: "#943D32", fontSize: 11, lineHeight: 16, marginTop: 9 },
  logButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: C.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  logButtonText: { color: "white", fontSize: 13, fontWeight: "800" },
  onboardingProgress: { flexDirection: "row", gap: 6, marginBottom: 14 },
  onboardingProgressPart: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
  },
  onboardingProgressActive: { backgroundColor: C.green },
  onboardingCard: { padding: 20 },
  onboardingTitle: {
    color: C.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  onboardingCopy: { color: C.soft, fontSize: 14, lineHeight: 21, marginTop: 7 },
  optionStack: { gap: 9, marginTop: 18 },
  option: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionActive: { backgroundColor: C.greenTint, borderColor: C.green },
  optionText: { color: C.soft, fontSize: 14, fontWeight: "600" },
  optionTextActive: { color: C.greenDeep, fontWeight: "800" },
  minutesRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  minuteChoice: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  minuteChoiceActive: { backgroundColor: C.greenDeep },
  minuteText: { color: C.ink, fontSize: 17, fontWeight: "800" },
  minuteTextActive: { color: "white" },
  minuteUnit: { fontSize: 9, fontWeight: "600" },
  cautionInput: {
    minHeight: 94,
    textAlignVertical: "top",
    paddingTop: 13,
    marginTop: 17,
  },
  onboardingActions: { flexDirection: "row", gap: 9, marginTop: 22 },
  backButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: { color: C.soft, fontSize: 13, fontWeight: "700" },
  continueButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: C.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  continueButtonText: { color: "white", fontSize: 13, fontWeight: "800" },
  disabledButton: { opacity: 0.35 },
  articleCard: {
    borderRadius: 18,
    padding: 17,
    backgroundColor: C.card,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  articleMeta: { flexDirection: "row", justifyContent: "space-between" },
  articleCategory: {
    color: C.marigold,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  articleMinutes: { color: C.faint, fontSize: 10 },
  articleTitle: { color: C.ink, fontSize: 17, fontWeight: "700", marginTop: 9 },
  articleSummary: { color: C.soft, fontSize: 13, lineHeight: 19, marginTop: 5 },
  articleOpen: {
    color: C.green,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
  },
  learningDetail: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: C.card,
    marginTop: 16,
    marginBottom: 12,
  },
  learningBack: {
    color: C.green,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 20,
  },
  learningCategory: {
    color: C.marigold,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  learningTitle: {
    color: C.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "700",
    marginTop: 9,
    marginBottom: 9,
  },
  learningParagraph: {
    color: C.soft,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 11,
  },
  educationNote: {
    backgroundColor: C.paper,
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
  },
  educationNoteText: { color: C.faint, fontSize: 10, lineHeight: 15 },
  reportCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.greenTint,
    color: C.greenDeep,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  reportCategories: { flexDirection: "row", gap: 7, marginTop: 15 },
  reportCategory: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  reportCategoryActive: { backgroundColor: C.greenTint },
  reportCategoryText: { color: C.faint, fontSize: 11, fontWeight: "700" },
  reportCategoryTextActive: { color: C.greenDeep },
  uploadButton: {
    minHeight: 47,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },
  uploadButtonText: { color: C.greenDeep, fontSize: 13, fontWeight: "800" },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 12,
    marginTop: 12,
  },
  reportFileIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: C.marigoldTint,
    alignItems: "center",
    justifyContent: "center",
  },
  reportFileText: { color: C.marigold, fontSize: 8, fontWeight: "900" },
  reportText: { flex: 1 },
  reportName: { color: C.ink, fontSize: 12, fontWeight: "700" },
  reportMeta: { color: C.faint, fontSize: 9, marginTop: 3 },
  reportStatus: { color: C.green, fontSize: 9, fontWeight: "800" },
  reportPrivacy: { color: C.faint, fontSize: 9, lineHeight: 14, marginTop: 13 },
  dayMap: { paddingBottom: 15 },
  dayMapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
    marginTop: 15,
  },
  dayMapItem: { flex: 1, alignItems: "center" },
  dayMapIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: C.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  dayMapIconDone: { backgroundColor: C.green },
  dayMapLabel: {
    color: C.soft,
    fontSize: 8,
    lineHeight: 10,
    textAlign: "center",
    marginTop: 6,
  },
  selectionCount: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  selectionCountText: { color: C.greenDeep, fontSize: 11, fontWeight: "800" },
  selectionLimit: { color: C.marigold, fontSize: 10, fontWeight: "700" },
  goalOptionText: { flex: 1 },
  goalPriority: {
    color: C.green,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 3,
  },
  customGoalRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  customGoalInput: { flex: 1 },
  addGoalButton: {
    width: 60,
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: C.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  addGoalText: { color: "white", fontSize: 12, fontWeight: "800" },
  customGoalChip: {
    alignSelf: "flex-start",
    minHeight: 44,
    borderRadius: 18,
    backgroundColor: C.marigoldTint,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 8,
  },
  customGoalChipText: { color: C.ink, fontSize: 10, fontWeight: "700" },
  consentStack: { marginTop: 17 },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  consentTitle: { color: C.ink, fontSize: 13, fontWeight: "700" },
  consentCopy: { color: C.soft, fontSize: 10, lineHeight: 15, marginTop: 3 },
  journeyHeroRow: { flexDirection: "row", justifyContent: "space-between" },
  journeyTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: C.line,
    overflow: "hidden",
    marginTop: -7,
    marginBottom: 17,
  },
  journeyTrackFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: C.marigold,
  },
  phaseGrid: { flexDirection: "row", gap: 7, marginBottom: 6 },
  phaseCard: {
    flex: 1,
    minHeight: 130,
    borderRadius: 16,
    backgroundColor: C.card,
    padding: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  phaseCardActive: { backgroundColor: C.greenDeep, borderColor: C.greenDeep },
  phaseName: { color: C.ink, fontSize: 11, fontWeight: "800" },
  phaseNameActive: { color: "white" },
  phaseWeeks: {
    color: C.marigold,
    fontSize: 8,
    fontWeight: "800",
    marginTop: 3,
  },
  phasePromise: { color: C.faint, fontSize: 9, lineHeight: 13, marginTop: 9 },
  weekTimeline: { gap: 7, paddingBottom: 12, paddingRight: 10 },
  weekButton: {
    width: 51,
    minHeight: 58,
    borderRadius: 15,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  weekButtonPast: { backgroundColor: C.greenTint },
  weekButtonCurrent: { backgroundColor: C.greenDeep, borderColor: C.greenDeep },
  weekButtonSelected: { borderColor: C.marigold, borderWidth: 2 },
  weekNumber: { color: C.ink, fontSize: 15, fontWeight: "800" },
  weekNumberActive: { color: "white" },
  weekState: { color: C.faint, fontSize: 8, marginTop: 2 },
  weekDetail: { padding: 19 },
  weekDetailKicker: {
    color: C.green,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  weekDetailTitle: {
    color: C.ink,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 5,
  },
  weekDetailCount: { color: C.marigold, fontSize: 10, fontWeight: "800" },
  weekDetailSection: {
    color: C.faint,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 19,
  },
  moduleChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  moduleChip: {
    borderRadius: 14,
    backgroundColor: C.greenTint,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  moduleChipText: {
    color: C.greenDeep,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  weekWin: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: C.marigoldTint,
    borderRadius: 14,
    padding: 13,
    marginTop: 17,
  },
  weekWinTitle: { color: C.ink, fontSize: 12, fontWeight: "800" },
  weekWinCopy: { color: C.soft, fontSize: 11, lineHeight: 16, marginTop: 3 },
  planReason: {
    backgroundColor: C.greenTint,
    borderRadius: 14,
    padding: 13,
    marginTop: 13,
  },
  calendarCard: { paddingHorizontal: 10 },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  calendarArrow: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarMonth: { color: C.ink, fontSize: 15, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.285%",
    color: C.faint,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    paddingBottom: 8,
  },
  calendarDay: {
    width: "14.285%",
    height: 53,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDaySelected: { backgroundColor: C.greenDeep },
  calendarDayNumber: { color: C.ink, fontSize: 12, fontWeight: "700" },
  calendarDayNumberSelected: { color: "white" },
  calendarKcal: { color: C.faint, fontSize: 7, marginTop: 1 },
  proteinDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.marigoldTint,
    marginTop: 2,
  },
  proteinDotFull: { backgroundColor: C.marigold },
  calendarLegend: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    padding: 9,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.marigold,
  },
  legendText: { color: C.faint, fontSize: 8, lineHeight: 12 },
  mealChoiceRow: { flexDirection: "row", gap: 5, marginTop: 14 },
  mealChoice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  mealChoiceActive: { backgroundColor: C.greenTint },
  mealChoiceText: { color: C.faint, fontSize: 9, fontWeight: "700" },
  mealChoiceTextActive: { color: C.greenDeep },
  foodMeal: {
    color: C.marigold,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  foodFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  memberTag: { color: C.green },
  editFoodButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  editFoodText: { color: C.greenDeep, fontSize: 10, fontWeight: "700" },
  inlineEditDescription: { minHeight: 45 },
  macroEditRow: { flexDirection: "row", gap: 5, marginTop: 9 },
  macroEdit: { flex: 1 },
  macroEditLabel: {
    color: C.faint,
    fontSize: 7,
    fontWeight: "800",
    marginBottom: 4,
  },
  macroEditInput: {
    minHeight: 40,
    borderRadius: 9,
    backgroundColor: C.paper,
    color: C.ink,
    fontSize: 12,
    textAlign: "center",
  },
  saveCorrectionButton: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: C.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveCorrectionText: { color: "white", fontSize: 11, fontWeight: "800" },
  healthCard: { padding: 18 },
  healthHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  healthIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: C.greenTint,
    alignItems: "center",
    justifyContent: "center",
  },
  healthIconConnected: { backgroundColor: C.green },
  healthStatus: { color: C.faint, fontSize: 10, marginTop: 3 },
  healthMessage: {
    backgroundColor: C.marigoldTint,
    borderRadius: 12,
    padding: 11,
    marginTop: 12,
  },
  healthMessageText: { color: C.soft, fontSize: 10, lineHeight: 15 },
  permissionGrid: { gap: 7, marginTop: 14 },
  permissionItem: { borderRadius: 13, backgroundColor: C.paper, padding: 12 },
  permissionLabel: { color: C.ink, fontSize: 11, fontWeight: "700" },
  permissionState: { color: C.faint, fontSize: 8, fontWeight: "800" },
  permissionGranted: { color: C.green },
  healthValue: {
    color: C.greenDeep,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 7,
  },
  healthSource: { color: C.faint, fontSize: 8, marginTop: 3 },
  healthButtons: { marginTop: 4 },
  healthPrimary: { flexDirection: "row", gap: 7 },
  manageHealthButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  manageHealthText: { color: C.greenDeep, fontSize: 11, fontWeight: "800" },
  lastSync: { color: C.faint, textAlign: "center", fontSize: 9, marginTop: 4 },
  healthPrivacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    marginTop: 14,
    paddingTop: 12,
  },
  healthPrivacyText: { flex: 1, color: C.faint, fontSize: 9, lineHeight: 14 },
});
