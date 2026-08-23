# Bharosa Wellness mobile app

Expo/React Native member application for Android and iOS. The coach console and API remain in the repository root.

## Configure

For Android Emulator development, `.env.example` points at
`http://10.0.2.2:3000`, which is the emulator's route to a Bharosa API running
locally with `npm run dev`. Do not point local development at the protected
Deepika deployment.

For EAS preview and production, set `EXPO_PUBLIC_API_URL` in the Bharosa EAS
environment to the new Bharosa backend URL. The URL is deliberately not
committed in `eas.json`; authentication and uploads fail clearly instead of
silently using the older backend when it is not configured.

The backend must have `AUTH_SECRET`, `BHAROSA_DATABASE_URL`, the Resend
password-reset variables, and a private Vercel Blob store configured. See
`../.env.example` and `../docs/DEPLOYMENT.md`.

The mobile login sends `client: "mobile"`; the server returns a signed member
token. The token is stored with Expo SecureStore and sent as a Bearer token to
member APIs. Meal photos and reports are uploaded to private object storage;
member documents keep only opaque, owner-bound file references.

## Develop with Fast Refresh

```bash
npm install
npx expo start --dev-client
```

Health Connect uses native Android code, so use the Bharosa development build
rather than Expo Go. The development profile installs as
`com.bharosawellness.app.dev`, alongside the production package. It does not
replace an installed Play Store build.

The app requests read access separately for steps, resting heart rate, heart
rate variability, and VO2 max. A user can continue without connecting Health
Connect, and unavailable metrics remain explicitly marked as unavailable.

## Android builds

Initialize the project once with `eas init`, which replaces the placeholder project ID in `app.json`.

```bash
npm install --global eas-cli
eas login
eas init
eas build --platform android --profile development # development-client APK
eas build --platform android --profile preview     # installable preview APK
eas build --platform android --profile production  # Play Store AAB
eas submit --platform android --profile production # internal track draft
```

The permanent Android application ID is `com.bharosawellness.app`. Changing it after the first Play Console upload creates a different app.

Do not create a production AAB until the redesigned member flows have been
approved and the Google Play Health Connect declarations are complete.

## iOS builds from Windows

The JavaScript application, Expo configuration and EAS build submission can be
prepared from Windows. Xcode and the iOS Simulator cannot run here, so native
HealthKit behaviour still needs a physical iPhone before release.

```bash
eas build --platform ios --profile ios-simulator # cloud simulator artifact; usable on a Mac simulator
eas build --platform ios --profile development   # development client for registered devices
eas build --platform ios --profile ios-preview   # internal non-dev-client build, development bundle id
eas build --platform ios --profile testflight    # App Store-signed TestFlight build
eas submit --platform ios --profile testflight
```

Development and internal-preview builds use
`com.bharosawellness.app.dev`. TestFlight and production use the permanent
`com.bharosawellness.app` identifier. This prevents a test build replacing an
eventual App Store installation.

Apple Health access is read-only and foreground-only in this release: steps,
resting heart rate, HRV-SDNN and VO2 max. iOS does not reveal whether the user
granted each individual read permission, so the UI says **Requested** rather
than claiming access was granted. Empty results can mean no data, a limited
history, or a declined read permission.

The app asks only for foreground location. It reduces the coordinate to a rough
grid cell on the iPhone and never sends coordinates to the server. Always
location, motion activity and microphone permission descriptions are
deliberately omitted because the current product does not use them.

## Bounded AI recommendations

Recommendations are generated only by the authenticated server endpoint. Set
`OPENAI_API_KEY` on the Next.js server and optionally set
`OPENAI_RECOMMENDATION_MODEL`. Never expose either value through an
`EXPO_PUBLIC_*` mobile variable. If AI is unavailable, Today continues using
the last approved plan and deterministic safety rules.

## Reminders

The daily reminder is a **local** notification scheduled on the device by
`src/notifications.ts`. There is no push service, no device token leaves the
phone, and nothing about a member's health is sent anywhere to make one fire.

Android 13 and above require `POST_NOTIFICATIONS` at runtime. If a member
declines, the switch in Profile goes back off rather than sitting on for a
reminder that will never arrive, and she is offered a link to system settings.

Coach replies are announced locally when the app notices new messages while it
is running. The message body is never included — a coach's words about
someone's health should not sit on a lock screen. A reply that arrives while
the app is closed is still seen at the next open.

## Working offline

`src/storage.ts` caches the last known document and holds a save that cannot
reach the server. The app opens on the cached copy, so it is usable on a train
or in a lift, and a queued change is sent when the connection returns.

The queue holds only the most recent document rather than a log of edits. Saves
are whole-document and the server merges field-scoped, so the newest copy
already contains every earlier change and replaying an older one could undo a
newer edit.

A save the server actively rejects — a 4xx — is not queued. Retrying a
rejection forever would not help, so the stored record is reloaded and the
member is told. Only network failures and 5xx responses are held.

Sign-out and account deletion both clear the cache and cancel scheduled
reminders.

## Your data

**You → Your data** offers a member her own export and a real account
deletion, both without going through the coach. Deletion asks for the password
again and cannot be undone. See `docs/DEPLOYMENT.md` for what the server
removes.

## Meal estimates

`src/nutrition.ts` reads a description into an estimate: it finds each food it
recognises, reads the quantity in front of it, and adds them up. Protein values
are deliberately the same numbers as the coach console's food table in
`lib/seed.ts`, so a member and Deepika looking at one meal do not see two
different figures.

It reports what it recognised, and the Food screen shows that under the entry.
When nothing is recognised it returns a generic meal marked as unrecognised
rather than presenting an invented total as measured.

## Building the Android development client on Windows

Three environment facts will each stop the native build with an error that does
not name its own cause. All three are environment, not code.

**Use JDK 17, not Android Studio's bundled JDK.** Android Studio ships JBR 25.
The Android Gradle Plugin supports 17 and 21; on 25 the CMake configure step
fails with `[CXX1428] exception while building Json`, because a JEP 472
native-access warning is printed into the output AGP parses as JSON. Temurin 17
is usually already present at `~/.gradle/jdks/`.

```bash
export JAVA_HOME="C:/Users/<you>/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2"
export ANDROID_HOME="C:/Users/<you>/AppData/Local/Android/Sdk"
```

**Enable Windows long paths.** CMake writes each object file to a path that
embeds the mangled full source path, and `CMAKE_OBJECT_PATH_MAX` is 250. With
this repository's depth the C++ objects for `expo-modules-core` and
`react-native-nitro-modules` exceed it, and ninja loops on "Re-running CMake"
until the task fails. In an **administrator** terminal, then reboot:

```
reg add "HKLMSYSTEMCurrentControlSetControlFileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
```

Keeping the checkout somewhere short — `C:harosa` rather than a deep
`Documents...` path — buys back around ninety characters and is worth doing
as well.

**`local.properties` is regenerated.** `expo prebuild --clean` deletes
`android/`, taking `local.properties` with it. Setting `ANDROID_HOME` in the
environment is the durable fix; recreating the file by hand is not.

After changing the package layout — a reinstall, or switching `nodeLinker` —
delete the stale autolinking caches or Gradle will keep resolving packages to
paths that no longer exist:

```bash
rm -rf android/build/generated/autolinking android/app/build/generated/autolinking
```

### Package layout

`pnpm-workspace.yaml` sets `nodeLinker: hoisted`. React Native's Gradle, CMake
and prefab steps resolve packages to their real paths on disk, and pnpm's
default layout nests every package under
`.pnpm/<name>@<hash>/node_modules/<name>` — around eighty characters that a
symlink hides from `ls` but not from the toolchain. Hoisted is what React
Native expects and what EAS builds with.

This setting belongs in `pnpm-workspace.yaml`, not `.npmrc`: pnpm 11 reads its
own settings from that file and silently ignores an `.npmrc` entry. Check it
took effect with `pnpm config get node-linker`.
