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
import { Today, ActionCard, DomainRow, MovementSession, PlanNotices, DailySnapshot, DailyInsight, CircleToday, EngagementPanel, CoachConnectionCard, DOMAIN_ICONS, isToday, freshness } from "./src/screens/Today";
import { Profile, YouHub, YouSection } from "./src/screens/You";
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
        <Pressable accessibilityRole="button" style={s.primaryButton} onPress={() => refresh()}>
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
