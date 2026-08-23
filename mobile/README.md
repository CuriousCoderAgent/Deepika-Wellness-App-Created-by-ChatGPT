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
