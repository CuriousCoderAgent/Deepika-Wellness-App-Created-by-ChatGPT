/**
 * The daily reminder.
 *
 * Profile has offered "a quiet prompt at 8:00 AM" since the first build, and
 * nothing was ever scheduled — the switch moved and no notification existed.
 * This is that switch, made real.
 *
 * Everything here is a *local* notification scheduled on the device. There is
 * no push server, no device token leaving the phone, and nothing about a
 * member's health is sent anywhere to make a reminder fire.
 *
 * Tone matters more than usual here. A reminder that arrives on a day someone
 * has already decided not to train should not read as a reprimand — the
 * product's north star is a graceful return after imperfect days, so the copy
 * is an invitation and never mentions a streak, a miss, or being behind.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const DAILY_IDENTIFIER = "bharosa-daily-check-in";
const ANDROID_CHANNEL = "bharosa-reminders";

/** A notification arriving while the app is open should be quiet, not modal. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export interface ReminderTime {
  hour: number;
  minute: number;
}

/** "8:00 AM" — how the time is stored in the member document. */
export function formatReminderTime({ hour, minute }: ReminderTime): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/**
 * Parse the stored label back into a time. Documents written by earlier builds
 * hold whatever string was displayed, so anything unrecognised falls back to
 * the 8:00 AM default rather than failing to schedule at all.
 */
export function parseReminderTime(value: string | undefined): ReminderTime {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return { hour: 8, minute: 0 };
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return { hour: 8, minute: 0 };
  return { hour, minute };
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: "Daily check-in",
    // Deliberately below the "heads-up" level. This is a gentle prompt, not an
    // alarm, and it should never interrupt what someone is doing.
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 120],
    enableVibrate: true,
  });
}

/**
 * Ask once, and report honestly. A member who declines keeps a working app —
 * the caller turns the switch back off rather than pretending it is on.
 */
export async function requestReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_IDENTIFIER).catch(
    () => {
      // Nothing scheduled. Cancelling something that is not there is success.
    },
  );
}

/**
 * Schedule the one daily reminder, replacing any previous one.
 *
 * Returns false when permission is missing so the caller can leave the switch
 * off instead of showing an enabled reminder that will never arrive.
 */
export async function scheduleDailyReminder(
  time: ReminderTime,
  checkIn: "morning" | "evening" = "morning",
): Promise<boolean> {
  const allowed = await requestReminderPermission();
  if (!allowed) return false;
  await ensureAndroidChannel();
  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_IDENTIFIER,
    content: {
      title: "Bharosa Wellness",
      body:
        checkIn === "evening"
          ? "A minute to note how today went, whenever suits you."
          : "Whenever you have a minute today, your plan is here.",
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL } : {}),
    },
  });
  return true;
}

/**
 * Tell a member her coach has replied.
 *
 * Delivered immediately and locally, when the app notices new coach messages
 * while it is running. It is not a substitute for real push — a reply that
 * arrives while the app is closed is still seen at the next open — but it
 * closes the gap that made members miss replies entirely.
 *
 * The message body is never included: a coach's words about someone's health
 * should not sit on a lock screen.
 */
export async function notifyCoachReply(count: number): Promise<void> {
  const granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your coach replied",
      body:
        count === 1
          ? "There is a new message waiting in Bharosa Wellness."
          : `There are ${count} new messages waiting in Bharosa Wellness.`,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL } : {}),
    },
    trigger: null,
  });
}

/** Sign-out should not leave reminders firing for someone who has left. */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {
    // Best effort on sign-out.
  });
}
