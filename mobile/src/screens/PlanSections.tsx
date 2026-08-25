import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CalendarDays, Check, ChevronDown, ChevronUp, Dumbbell, Footprints, HeartPulse, Home, MoonStar, ShieldCheck, Sparkles, Trophy, Users, Utensils } from "lucide-react-native";
import { AWARDS, awardMetrics, type AwardIcon } from "../awards";
import { moduleName } from "../content";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { LEARNING_ARTICLES } from "../learning";
import { liveMeals } from "../meals";
import { isoDate } from "../normalize";
import { describeSkip } from "../outcomes";
import { PHASES, weekPlansFor } from "../plan";
import { type MemberDoc } from "../types";
import { Card, useScrollToTop } from "../ui";
import { findWeekWin } from "../week-win";

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

export function Journey({ doc }: { doc: MemberDoc }) {
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

export function LearningLibrary({ weekFocus }: { weekFocus?: string[] }) {
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
        <Pressable accessibilityRole="button" accessibilityLabel="Back to all articles" onPress={() => openArticle(null)}>
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
            {article.provenance.kind === "bharosa_guidance"
              ? `${article.provenance.author}'s own guidance`
              : "General education"}
            {article.provenance.reviewedBy
              ? ` · reviewed by ${article.provenance.reviewedBy} on ${article.provenance.reviewedOn}`
              : " · not reviewed by a clinician"}
          </Text>
          <Text style={s.educationNoteText}>
            Education only—not diagnosis or individual medical advice.
          </Text>
          {article.provenance.sources?.length ? (
            <Text style={s.educationNoteText}>
              Sources: {article.provenance.sources.map((x) => x.title).join("; ")}
            </Text>
          ) : null}
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

export function History({ doc }: { doc: MemberDoc }) {
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

export function Progress({ doc }: { doc: MemberDoc }) {
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
 */
export function Awards({ doc }: { doc: MemberDoc }) {
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
