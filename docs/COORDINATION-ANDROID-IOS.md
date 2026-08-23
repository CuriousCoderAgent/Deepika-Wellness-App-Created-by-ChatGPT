# Bharosa Mobile — Android/iOS Coordination Note

**Date:** 23 August 2026  
**Audience:** Claude, Codex and Eshan  
**Purpose:** Coordinate parallel Android and iOS work without creating two divergent products or overwriting one another's changes.

## 1. Decision

Bharosa remains **one Expo/React Native mobile application** with a shared backend, product model and user experience.

- Claude will continue Android development and Android/Health Connect validation.
- Codex will own iOS integration, Apple Health, iOS permissions, iOS build configuration and EAS iOS builds.
- Shared product behaviour must remain cross-platform unless a documented operating-system constraint requires a difference.
- Both streams may run from the Windows desktop, but they must not use the same checkout or Git branch simultaneously.

Windows can prepare and submit an iOS build through EAS cloud builds. It cannot run Xcode or the iOS Simulator. Final validation of HealthKit and other native iOS behaviour must eventually happen on a physical iPhone, normally through a development build or TestFlight.

## 2. Product doctrine

Bharosa is an AI-first experience, but its health and safety architecture is:

> **Rules decide; models phrase.**

The app builds and adapts the plan from onboarding, readiness, adherence, effort, pain, sleep, nutrition, habits and available health signals. However:

- deterministic code selects actions, exercise dose, progression and safety gates;
- the model may conduct bounded conversational onboarding and phrase a personalised explanation;
- the model must not independently diagnose, prescribe around pain, relax contraindications or invent clinical guidance;
- if the model or `OPENAI_API_KEY` is unavailable, the safe plan must remain usable and materially identical;
- coach-owned domains and coach-published actions remain authoritative when `doc.coaching.mode === "coached"`.

Do not move numerical health decisions or safety rules from tested code into prompts.

## 3. Repositories and protected resources

### Authorised Bharosa repository

Use only:

`https://github.com/CuriousCoderAgent/Deepika-Wellness-App-Created-by-ChatGPT`

Current shared branch before the split:

`agent/add-android-mobile-app`

> **Updated 23 Aug 2026, after this note was written.** That branch has been
> merged to `main`. The agreed baseline for both platform branches is
> `fad76443749cc2445f64b54e684d5ece3f7880d6` on `main`, and both
> `agent/android-polish` and `agent/ios-completion` already exist from it.

### Protected backup

Do not edit, push to, deploy from or connect new infrastructure to:

`https://github.com/CuriousCoderAgent/Deepika-Health-App`

Its repository, database, storage and deployments remain protected backups/out-of-scope resources.

### Local checkouts on this desktop

- Claude/Android checkout: `C:\bharosa`
- Codex/iOS checkout: use a separate short checkout such as `C:\bharosa-ios`
- Do not use the older deeply nested checkout for Android native builds. Its path exceeds Windows native-tooling limits.
- Do not point two agents at the same working tree. Metro, Gradle, generated native directories and package installation can interfere even when Git branches differ.

## 4. Branch and synchronization protocol

Before parallel work begins:

1. Claude commits and pushes every intended shared change.
2. Claude provides the exact Git commit hash that represents the agreed mobile baseline.
3. Create two branches from that exact commit:
   - `agent/android-polish`
   - `agent/ios-completion`
4. Claude works only from the Android checkout/branch.
5. Codex works only from the iOS checkout/branch.

During development:

- Never have both agents push to the same branch.
- Never force-push a shared or integration branch.
- Each commit should have one clear responsibility: shared product behaviour, Android integration or iOS integration.
- Communicate changes to `MemberDoc`, API payloads, persistence, environment variables and package dependencies before the other stream builds on them.
- Merge or cherry-pick small shared commits frequently instead of performing one large platform merge at the end.
- Record the source and destination commit hashes after every integration.
- Preserve user-authored or unrelated work; do not reset or discard it to resolve a conflict.

Recommended integration sequence:

1. Shared model/API commit lands on the agreed integration branch.
2. Android and iOS branches rebase or merge that shared commit.
3. Platform-specific changes remain on their respective branches.
4. Run common tests on the combined integration result before preparing either store build.

## 5. Shared code and behaviour

The following must remain common across Android and iOS:

- account creation, login, password help/reset and session behaviour;
- onboarding fields, multi-goal selection and readiness screening;
- deterministic plan generation and daily adaptation;
- Today actions across movement, walking, nutrition, sleep/recovery and stress/reflection;
- exercise library, contraindications, dose ladder, pain pause and RPE progression;
- food descriptions, meal-photo upload contract, calorie/protein estimates and food calendar;
- hydration, habits, reminders configuration and completion data;
- Circle privacy projection, discovery rules, requests and nudges;
- coach ownership, published weeks, messages and member/coach role separation;
- offline cache/queue semantics and day rollover;
- data export, account deletion and private-file ownership;
- shared TypeScript domain types and server API contracts;
- non-punitive language: no streak pressure, shame, red failure states or "missed/failed/behind" framing.

Shared client or backend logic should not be copied into separate Android and iOS implementations. Where a native difference exists, expose it through a small platform adapter with a common interface.

## 6. Platform-specific ownership

### Claude — Android

- Android Gradle/native build reliability.
- JDK 17 and Android SDK configuration.
- Health Connect availability, permissions and aggregation.
- Android steps, resting heart rate, HRV-RMSSD and VO2 max reads.
- Android notification permission and notification icon.
- Android camera/photo-picker behaviour.
- Android back button, keyboard and system navigation behaviour.
- Android emulator and physical-device testing.
- APK development/preview builds and, after approval, Play Store AAB preparation.
- Google Play Health Connect declarations.

### Codex — iOS

- Apple bundle identifiers, entitlements and EAS iOS profiles.
- HealthKit availability, permissions and read-only integration.
- Apple steps, resting heart rate, HRV-SDNN and VO2 max reads.
- Honest HealthKit permission and no-data states.
- iOS notification permissions and settings links.
- iOS camera/photo-library usage descriptions and behaviour.
- iOS coarse-location permission wording and privacy behaviour.
- Keychain/SecureStore session behaviour.
- iPhone safe areas, keyboard avoidance, status bar and screen-size review.
- Password-reset/deep-link behaviour on iOS.
- EAS development/TestFlight builds and App Store configuration preparation.

### Important health-data distinction

Apple HRV is represented as **SDNN** while the Android implementation currently handles **RMSSD**. They must retain method/provenance metadata and must not be compared as if they were the same measurement. The UI and recommendation inputs must preserve that distinction.

Neither platform should imply that every device supplies every health metric. Missing, denied, stale and partially available data are normal states.

## 7. Native-module rule

Several native modules can throw during module evaluation when an older development binary does not contain their native counterpart. Existing storage and network modules are loaded lazily behind guards for this reason.

For every new native module:

- load it through a guarded platform adapter when feasible;
- provide an explicit unavailable state;
- ensure an older development build degrades rather than red-screening;
- rebuild the native development client when native dependencies or config plugins change;
- do not silently pretend a permission or data source is connected.

## 8. Large shared-file conflict control

`mobile/App.tsx` is approximately 6,000 lines and is the highest merge-conflict risk.

- Only one agent should make broad structural edits to it at a time.
- Platform code should be kept in dedicated modules rather than added inline to `App.tsx`.
- If a shared screen must change in both streams, land that shared change first and then branch from it.
- Do not undertake a large refactor merely to ease one platform fix while the other agent has unmerged work.
- Component extraction is desirable, but it should be a separately agreed, tested change.

## 9. Backend and environment rules

- Mobile clients use the same authenticated Bharosa API and `MemberDoc` contract.
- Bharosa staging has its own Neon PostgreSQL database and private Blob store.
- Never use generic legacy database variables as a fallback. Use `BHAROSA_DATABASE_URL` only.
- Never expose `OPENAI_API_KEY`, database credentials, Blob credentials or authentication secrets through `EXPO_PUBLIC_*` variables.
- The only client-public service value should be the intended API origin and other genuinely public configuration.
- Use fictional accounts/data for development and smoke tests.
- Server-derived state such as `doseSteps`, `pausedExerciseIds`, `coaching` and `readiness.outcome` must not become client-writable.
- New day-based records should store a calendar date. If they use `dayOffset`, they must participate in the existing rollover/rebasing mechanism.

> **Superseded 23 Aug 2026.** Production was promoted with Eshan's explicit
> approval and now serves `fad7644`. All new API routes are live and smoke
> tested, and `OPENAI_API_KEY` plus the three model variables are set on Vercel
> — the account's available model is `gpt-5.6-luna`, not `gpt-5`, so
> `OPENAI_RECOMMENDATION_MODEL`, `OPENAI_VISION_MODEL` and
> `OPENAI_ONBOARDING_MODEL` must all be set or the features fail silently.
>
> The browser member app at `/member` was retired the same day; it had fallen a
> product pivot behind and its consent copy was no longer true. The member
> experience is the phone app. The coach console is unaffected.
>
> The original warning, for the record: the stable deployment served `02e3b47`
> and newer work had only preview deployments.

## 10. Build identifiers

- Production Android package: `com.bharosawellness.app`
- Development Android package: `com.bharosawellness.app.dev`
- Production iOS bundle identifier: `com.bharosawellness.app`
- Development iOS bundle identifier: `com.bharosawellness.app.dev`

These production identifiers should be treated as permanent once their respective store records are created.

## 11. Testing responsibilities

### Common checks before merging

- `npm test` from the repository root.
- Root TypeScript/build validation.
- Mobile TypeScript check.
- Expo Doctor/dependency alignment.
- Authentication and state API compatibility.
- No secrets or local environment files committed.
- No accidental references to the protected Deepika database/deployment.

### Required common end-to-end journey

Test with a new fictional member:

1. Create account and sign in.
2. Complete onboarding and readiness.
3. Generate the first holistic plan.
4. Complete a movement session and report effort.
5. Trigger and verify the pain safety path.
6. Log food through text and photo.
7. Review calories/protein in the monthly history.
8. Log water and habits.
9. Connect or decline health permissions and handle missing data.
10. Exercise Circle privacy and connection flows.
11. Send/receive a coach message where coaching is enabled.
12. Export data.
13. Verify offline behaviour and reconnection.
14. Advance to the next day and confirm rollover/adaptation.
15. Delete the disposable account and its private files.

### Android-specific matrix

- Health Connect unavailable, denied, partially granted, granted/no-data and granted/with-data.
- Multiple step sources without double counting.
- Android notification permission denied/granted.
- Small and large screens, font scaling, back navigation and keyboard.
- Development APK installation and Fast Refresh.

### iOS-specific matrix

- HealthKit unavailable, not requested, denied, partially available and available/no-data.
- SDNN provenance retained and never labelled RMSSD.
- Camera denied, photos denied/limited/full and successful capture/upload.
- Notifications denied/granted and settings recovery.
- Safe areas on Face ID and non-Face ID devices.
- Offline launch, Keychain session recovery and logout cleanup.
- Physical-iPhone HealthKit verification before release.
- TestFlight installation and update behaviour.

## 12. Release gates

Do not create a public production release merely because a platform build succeeds.

Required gates:

- the complete two-day member journey passes;
- coach ownership cannot be overwritten by member or AI state;
- pain and readiness safety paths pass;
- private uploads remain owner-bound;
- password reset is verified with a real, owned sender domain;
- account deletion removes the account, state, tokens and private objects;
- Apple and Google health/privacy disclosures are complete;
- current staging is deployed from the intended commit and passes smoke tests;
- Eshan approves the member experience on both platforms.

## 13. Handoff format between Claude and Codex

Every handoff should include:

```text
Branch:
Commit hash:
Files changed:
Shared types/API changes:
Native dependencies/config changes:
Environment-variable changes:
Tests run and results:
Known failures or untested states:
Migration or data-compatibility notes:
What the other agent must integrate:
```

Avoid handoffs such as "everything is pushed" without a commit hash and test result.

## 14. Immediate next action for Claude

Before continuing Android work, please:

1. Confirm `C:\bharosa` is clean or identify every uncommitted file.
2. Push the intended common baseline.
3. Share its exact commit hash.
4. Create/switch to `agent/android-polish`.
5. Tell Codex about any planned change to shared types, `mobile/App.tsx`, native dependencies or API contracts before implementing it.

Codex will then create the independent iOS checkout and branch from the same baseline, preserve all newer product features, and continue the iOS-specific work through EAS from the Windows desktop.
