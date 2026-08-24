import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Share, Switch, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MapPin, UserPlus, Users } from "lucide-react-native";
import { activeDays } from "../activity";
import { DEMO_TOKEN, answerConnection, discoverCircle, loadCircle, loadNudges, removeConnection, requestConnection, saveCircleSettings, sendNudge } from "../api";
import { canonicalCity, suggestCities } from "../cities";
import { consistencySentence, type ConsistencySummary } from "../consistency";
import { NUDGE_OPTIONS } from "../content";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { currentCell } from "../location";
import { type CircleState } from "../types";
import { Card } from "../ui";

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
export function Circle({
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

/**
 * Twenty-eight days, as a pattern.
 *
 * Four rows of seven. A day with something is filled, a quiet day is simply
 * lighter — no cross, no red, no gap count. This is what one member sees of
 * another instead of a rank, because the evidence on activity apps is that
 * ranking drives beginners out and most members here are beginners.
 */
export function ConsistencyGrid({
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
