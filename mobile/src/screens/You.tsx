import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Share, Switch, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, ChevronLeft, ChevronRight, Download, HeartPulse, ShieldCheck, Trash2, UserRound, Users } from "lucide-react-native";
import { activeDays } from "../activity";
import { deleteAccount, exportAccount } from "../api";
import { PasswordField } from "../PasswordField";
import { s } from "../design/styles";
import { C } from "../design/tokens";
import { CONNECTED_HEALTH_NAME } from "../health";
import { cancelAllReminders, cancelDailyReminder, formatReminderTime, parseReminderTime, remindersAreSupported, scheduleDailyReminder } from "../notifications";
import { profileCompleteness } from "../profile";
import { clearCache } from "../storage";
import { type MemberDoc } from "../types";
import { Card } from "../ui";
import { Reports } from "./HealthAndReports";

export function Profile({
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
      message: `I’m building steadier wellness habits with Bharosa Wellness. Download it, and enter my username ${doc.member.id} as your join code — that is what gets you in. Add me afterwards and we’d each only see how much of our plan we’ve done, and only after we both accept.`,
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
        <Pressable accessibilityRole="button" style={s.circleButton} onPress={invite}>
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
            <PasswordField
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
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

export function YouHub({
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
      label: "Your documents",
      detail: reportCount
        ? `${reportCount} kept here`
        : "Blood work and scans, private to you",
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

export type YouSection = "about" | "circle" | "health" | "reports" | "settings";
