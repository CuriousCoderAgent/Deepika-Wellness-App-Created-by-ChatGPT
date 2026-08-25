import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Activity, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Dumbbell, Pencil, PencilLine, Utensils, X } from "lucide-react-native";
import { DEMO_TOKEN, estimateMealPhoto, privateMemberFileSource, uploadMemberFile } from "../api";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { newId } from "../ids";
import { buildLogFeed, loggedToday, whenLabel, type LogKind } from "../log-feed";
import { adjustQuantity, describeItems, preferred, removeItem, totalOf, wasAdjusted, type EstimateItem, type EstimateSource, type MealProposal } from "../meal-estimate";
import { checkMacros } from "../meal-values";
import { compactKcal, liveMeals } from "../meals";
import { isoDate, offsetFromDate } from "../normalize";
import { describeMatches, estimateMeal } from "../nutrition";
import { type FoodEntry, type MemberDoc } from "../types";
import { Card, useScrollToTop } from "../ui";
import { Pulse } from "./Pulse";

export function Log({
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

export function NoteCapture({
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

export function Food({
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
              accessibilityRole="radio"
              accessibilityState={{ checked: meal === value }}
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
            accessibilityRole="button"
            onPress={addPhoto}
            disabled={uploadingPhoto}
          >
            <Text style={s.photoButtonText}>
              {photoUri ? "✓ Photo added" : "＋ Add photo"}
            </Text>
          </Pressable>
          <Pressable
            style={[s.primaryButton, s.estimateButton]}
            accessibilityRole="button"
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
                    accessibilityRole="button"
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
