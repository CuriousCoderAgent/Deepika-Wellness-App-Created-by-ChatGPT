import { useEffect, useState } from "react";
import { Alert, Image, Pressable, Share, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Dumbbell, Footprints, Info, MessageCircle, MoonStar, ShieldCheck, Sparkles, Users, Utensils } from "lucide-react-native";
import { activeDays } from "../activity";
import { DEMO_TOKEN, loadCircle } from "../api";
import { COACH_NAME } from "../coach";
import { DOMAIN_META, type DomainIcon } from "../content";
import {
  PAIN_KINDS,
  PAIN_SITES,
  PAIN_TIMINGS,
  describePain,
  routePain,
  type PainKind,
  type PainReport,
  type PainSite,
  type PainTiming,
} from "../pain";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { exerciseMediaFor } from "../exerciseMedia";
import { newId } from "../ids";
import { liveMeals } from "../meals";
import { isoDate, offsetFromDate } from "../normalize";
import { SKIP_OPTIONS, type SkipReason } from "../outcomes";
import { latestRecommendation, needsHumanReview } from "../recommendations";
import { type ActionDomain, type AiRecommendation, type CircleState, type DailyAction, type EffortLevel, type MemberDoc, type PlanNotice } from "../types";
import { Card, useScrollToTop } from "../ui";
import { Coach } from "./Coach";
import { Food } from "./Log";
import { Onboarding } from "./Onboarding";
import { Awards } from "./PlanSections";
import { Pulse } from "./Pulse";

export function Today({
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
    report?: PainReport,
    skipKind?: SkipReason,
  ) => {
    const action = doc.actions.find((item) => item.id === id);
    const movement = action?.title ?? "That movement";
    /*
     * How far to step back, and who should hear about it.
     *
     * Pain used to be a boolean, so a twinge the next morning and a sharp
     * catch that made her stop produced the same response. See src/pain.ts.
     */
    const route = report
      ? routePain(report, {
          coached: doc.coaching?.mode === "coached",
          movement,
        })
      : null;
    const pain = Boolean(report);
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
              painReport: report,
              painNote: report ? describePain(report) : undefined,
              // Only when a coach exists to perform the review.
              coachReviewRequired: Boolean(route?.coachReview),
            },
          ]
        : doc.workoutLogs;
    /*
     * Written for a coach, so only written when there is one.
     *
     * This used to be created for every member. An uncoached member — the
     * default — got a message saying her coach would review the movement,
     * addressed to a person who did not exist.
     */
    const painMessage = route?.coachReview
      ? [
          {
            id: newId("pain"),
            memberId: doc.member.id,
            from: "system" as const,
            kind: "plan_update" as const,
            body: `${doc.member.name} reported ${describePain(report!).toLowerCase()} during ${movement}. Review before this movement is repeated.`,
            dayOffset: 0,
            time: "just now",
            read: false,
          },
        ]
      : [];
    const painRecommendation: AiRecommendation[] = route?.coachReview
      ? [
          {
            id: newId("recommendation"),
            createdAt: new Date().toISOString(),
            kind: "coach_review",
            actionId: id,
            evidence: [`${describePain(report!)} — during ${movement}`],
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
      // Only the bands that warrant it. Stiffness the next day should not
      // remove a movement she may simply be new to.
      pausedExerciseIds: route?.pause
        ? [
            ...new Set([
              ...(doc.pausedExerciseIds ?? []),
              ...(action?.exercise?.exerciseId
                ? [action.exercise.exerciseId]
                : []),
            ]),
          ]
        : doc.pausedExerciseIds,
    });
    /*
     * One source of truth for what happens next.
     *
     * This used to be a fixed sentence saying the movement was paused and
     * her flag was queued for coach review — shown for every report,
     * including the ones the rules deliberately do not pause, and to the
     * many members who have no coach. It now says whatever routePain
     * actually decided, which is the same thing she was shown before she
     * pressed save.
     */
    if (route) Alert.alert(route.title, route.body);
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
                    coached={doc.coaching?.mode === "coached"}
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
                    onComplete={(level, effort, report) =>
                      complete(a.id, level, effort, report)
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

export function ActionCard({
  action,
  recommendation,
  coached,
  onComplete,
  inline,
}: {
  action: DailyAction;
  recommendation?: AiRecommendation;
  /** Whether a coach exists to review a pain report. Decides the copy. */
  coached?: boolean;
  onComplete: (
    level: EffortLevel | "rest",
    effort?: 1 | 2 | 3 | 4 | 5,
    report?: PainReport,
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
  /* Sensible starting answers, so reporting pain is three taps and not six. */
  const [painSite, setPainSite] = useState<PainSite>("knee");
  const [painKind, setPainKind] = useState<PainKind>("ache");
  const [painTiming, setPainTiming] = useState<PainTiming>("during");
  const [painStopped, setPainStopped] = useState(false);
  const domain = DOMAIN_META[action.domain];
  const DomainIconComponent = DOMAIN_ICONS[domain.icon];
  const chooseLevel = (level: EffortLevel) =>
    action.exercise ? setPendingLevel(level) : onComplete(level);
  const saveWorkout = () => {
    if (!pendingLevel) return;
    onComplete(
      pendingLevel,
      effort,
      pain
        ? {
            site: painSite,
            kind: painKind,
            timing: painTiming,
            stopped: painStopped,
          }
        : undefined,
    );
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
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: action.completed === level || pendingLevel === level,
                  }}
                  accessibilityLabel={`${level}: ${action[level].label}`}
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: !pain }}
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: pain }}
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
              {/*
                Three short questions rather than a box to type in. A
                checkbox could not tell soreness from injury, so both got
                the same response — and typing while your knee hurts is not
                something people do. See src/pain.ts for what each answer
                changes.
              */}
              {pain && (
                <View style={s.painDetail}>
                  <Text style={s.detailLabel}>Where?</Text>
                  <View style={s.chipWrap}>
                    {PAIN_SITES.map((option) => (
                      <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: painSite === option.id }}
                        style={[
                          s.chip,
                          painSite === option.id && s.chipActive,
                        ]}
                        onPress={() => setPainSite(option.id)}
                      >
                        <Text
                          style={[
                            s.chipText,
                            painSite === option.id && s.chipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[s.detailLabel, s.painDetailGap]}>
                    What did it feel like?
                  </Text>
                  <View style={s.chipWrap}>
                    {PAIN_KINDS.map((option) => (
                      <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: painKind === option.id }}
                        accessibilityLabel={`${option.label}. ${option.detail}`}
                        style={[
                          s.chip,
                          painKind === option.id && s.chipActive,
                        ]}
                        onPress={() => setPainKind(option.id)}
                      >
                        <Text
                          style={[
                            s.chipText,
                            painKind === option.id && s.chipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[s.detailLabel, s.painDetailGap]}>When?</Text>
                  <View style={s.chipWrap}>
                    {PAIN_TIMINGS.map((option) => (
                      <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: painTiming === option.id,
                        }}
                        style={[
                          s.chip,
                          painTiming === option.id && s.chipActive,
                        ]}
                        onPress={() => setPainTiming(option.id)}
                      >
                        <Text
                          style={[
                            s.chipText,
                            painTiming === option.id && s.chipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: painStopped }}
                    style={[s.chip, s.painStopped, painStopped && s.chipActive]}
                    onPress={() => setPainStopped(!painStopped)}
                  >
                    <Text
                      style={[s.chipText, painStopped && s.chipTextActive]}
                    >
                      {painStopped ? "✓ " : ""}It made me stop
                    </Text>
                  </Pressable>

                  {/* What will happen, said before she commits to saying it. */}
                  <Text style={s.painWarning}>
                    {
                      routePain(
                        {
                          site: painSite,
                          kind: painKind,
                          timing: painTiming,
                          stopped: painStopped,
                        },
                        {
                          coached: Boolean(coached),
                          movement: action.title,
                        },
                      ).body
                    }
                  </Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [s.logButton, pressed && s.pressed]}
                accessibilityRole="button"
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
                    onComplete("rest", undefined, undefined, option.reason);
                  }}
                >
                  <Text style={s.skipOptionText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Not today" onPress={() => setSkipping(true)}>
              <Text style={s.notToday}>Not today</Text>
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

export function DomainRow({
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

export function MovementSession({
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
    report?: PainReport,
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
          coached={doc.coaching?.mode === "coached"}
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
export function PlanNotices({ notices }: { notices: PlanNotice[] }) {
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

export function DailySnapshot({
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

export function DailyInsight({ doc }: { doc: MemberDoc }) {
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

export function CircleToday({
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

export function EngagementPanel({ doc }: { doc: MemberDoc }) {
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
        <Pressable accessibilityRole="button" onPress={shareWin} style={s.shareWin}>
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

export function CoachConnectionCard({
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

export const DOMAIN_ICONS: Record<DomainIcon, typeof Dumbbell> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  utensils: Utensils,
  moon: MoonStar,
  brain: Brain,
};

export function isToday(date: string): boolean {
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

export function freshness(date: string): string {
  if (isToday(date)) return "Today";
  const days = Math.max(0, -offsetFromDate(date));
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Over a week ago";
  return "Over a fortnight ago";
}
