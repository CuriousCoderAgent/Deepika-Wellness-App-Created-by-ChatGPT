import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { s } from "../design/styles";
import { type DietPattern, AGE_BANDS, GOAL_OPTIONS, goalIdsFrom, goalLabel, isoWeeksFromToday, needsEventDetail, weeksUntil, type AgeBand, type Equipment, type EventKind, type LifeStage, type SleepBaseline, type Weekday } from "../profile";
import { type MemberDoc } from "../types";
import { Card } from "../ui";
import { DetailQuestions, EventQuestions, GOAL_GROUP_LABELS } from "./Onboarding";

export function AboutYou({
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
  const [dietPattern, setDietPattern] = useState<DietPattern | undefined>(
    saved?.dietPattern,
  );
  const [avoidFoods, setAvoidFoods] = useState(saved?.avoidFoods ?? "");
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
        dietPattern,
        avoidFoods: avoidFoods.trim() || undefined,
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
          dietPattern={dietPattern}
          setDietPattern={(value) => {
            setDietPattern(value);
            edited();
          }}
          avoidFoods={avoidFoods}
          setAvoidFoods={(value) => {
            setAvoidFoods(value);
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
