import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { BODY_SIGNALS } from "../content";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { newId } from "../ids";
import { type MemberDoc, type PulseEntry } from "../types";
import { Card } from "../ui";
import { Coach } from "./Coach";

export function Pulse({
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
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={mood.label}
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
