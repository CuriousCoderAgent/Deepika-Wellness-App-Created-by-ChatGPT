import { useState, type ReactNode } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { CONNECTED_HEALTH_NAME } from "../health";
import { preferred } from "../meal-estimate";
import { AGE_BANDS, EQUIPMENT_OPTIONS, EVENT_KINDS, GOAL_OPTIONS, LIFE_STAGES, SLEEP_BASELINES, WEEKDAYS, WEEKLY_KM_OPTIONS, WEEKS_AWAY_OPTIONS, goalIdsFrom, goalLabel, isoWeeksFromToday, needsEventDetail, weeksUntil, type AgeBand, type Equipment, type EventKind, type GoalGroup, type LifeStage, type SleepBaseline, type Weekday } from "../profile";
import { READINESS_QUESTIONS, evaluateReadiness, readinessIsComplete, readinessMessage, type ReadinessAnswer } from "../readiness";
import { type MemberDoc } from "../types";
import { Card } from "../ui";

export function Onboarding({
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
  /**
   * Write down what she has answered so far.
   *
   * Called on every step, not only at the end. The flow is ten questions
   * long and used to keep all of them in component state until the last
   * button, so a member who put the phone down, took a call, or simply let
   * the screen lock came back to an empty first question. She had answered
   * everything and the app had kept none of it.
   *
   * `completed` stays false until she reaches the end, which is what decides
   * whether the app shows her the flow or her plan. Everything else is
   * written as it arrives.
   *
   * Three things are deliberately withheld until `done`:
   *
   * - **onboardedAt** starts her twelve weeks. Setting it at step two would
   *   have her in week three of a plan she has not been given yet.
   * - **readiness** is only written once the answers are complete, because
   *   the server recomputes the verdict from them and a half-answered screen
   *   evaluates to "clear" — which is the one outcome that unlocks movement.
   * - **detailConsent** stays undefined until she has actually been asked.
   *   Writing "declined" before the gate would record a refusal she never
   *   made, and About you would stop offering the questions.
   */
  const save = (nextStep: number, done: boolean) =>
    update({
      ...doc,
      member: done
        ? {
            ...doc.member,
            // The one thing lib/day-offset.ts's programWeek() counts her
            // twelve weeks from. Never previously set anywhere, which is why
            // every member's program week silently froze at 1 forever — see
            // that file's rebaseMemberDoc(). Keeps an existing value rather
            // than overwriting it, in case she is ever routed back through
            // this flow after already finishing it once.
            onboardedAt: doc.member.onboardedAt ?? new Date().toISOString(),
            // Labels, not ids. This list is read by her coach and by the
            // daily-action rules, both of which work in her language. The
            // ids live in doc.profile, which is what the generator reads.
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
          }
        : doc.member,
      readiness: readinessIsComplete(readinessAnswers)
        ? {
            answers: readinessAnswers,
            completedAt: new Date().toISOString(),
            ...evaluateReadiness(readinessAnswers),
          }
        : doc.readiness,
      profile: {
        ageBand,
        goals,
        // Recorded either way once she has answered. "She said no" and "she
        // was never asked" lead to the same empty profile otherwise, and only
        // one of them should be asked again — which is also why this stays
        // undefined until the gate itself.
        detailConsent:
          wantsDetail === undefined
            ? undefined
            : wantsDetail
              ? "given"
              : "declined",
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
        completed: done,
        currentStep: nextStep,
        goals: goals.map(goalLabel),
        // Kept rather than re-derived: a goal she typed into the old
        // free-text box is still hers, even though nothing offers it now.
        customGoal: saved?.customGoal,
        activityLevel: activity,
        availableMinutes: minutes,
        movementCaution: caution.trim(),
        // Records that she answered, so an empty caution means "nothing to
        // declare" rather than "never asked". Only true once she has been
        // past that question.
        movementCautionAnswered: step > 4 || done,
        preferredCheckIn: checkIn,
        consent: {
          wellness: wellnessConsent,
          healthConnect: healthConsent,
          aiPersonalisation: aiConsent,
        },
      },
    });
  /** Move, and keep what she has given us so far. */
  const goTo = (next: number) => {
    save(next, false);
    setStep(next);
  };
  const finish = () => save(lastStep + 1, true);

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
              accessibilityRole="radio"
              accessibilityState={{ checked: minutes === value }}
              accessibilityLabel={`${value} minutes`}
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
              accessibilityRole="radio"
              accessibilityState={{ checked: checkIn === value }}
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
            <Pressable accessibilityRole="button" onPress={() => goTo(step - 1)} style={s.backButton}>
              <Text style={s.backButtonText}>Back</Text>
            </Pressable>
          )}
          <Pressable
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            onPress={() => (step === lastStep ? finish() : goTo(step + 1))}
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
export function DetailQuestions({
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

export function EventQuestions({
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

export const GOAL_GROUP_LABELS: { group: GoalGroup; label: string }[] = [
  { group: "wellbeing", label: "How you want to feel" },
  { group: "capacity", label: "What you want to be able to do" },
  { group: "event", label: "Something you are training for" },
];
