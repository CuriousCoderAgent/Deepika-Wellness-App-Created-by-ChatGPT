# Deepika Wellness — Android Launch Handoff

Last updated: 19 August 2026

## Repository boundary

All active development and Android launch work belongs in:

- `https://github.com/CuriousCoderAgent/Deepika-Wellness-App-Created-by-ChatGPT`

Do **not** edit, commit, push, create branches, or open pull requests in:

- `https://github.com/CuriousCoderAgent/Deepika-Health-App`

The second repository is the owner's protected backup for other work.

## Work completed

- Consolidated the existing Deepika Wellness web application into the final repository.
- Added an Expo React Native mobile app under `mobile/`.
- Added native member login with securely stored bearer-token authentication.
- Updated the Next.js login and state APIs to support the mobile client.
- Added Today, Journey, Progress, Coach, and Profile mobile experiences.
- Added production app icon artwork.
- Added Expo Application Services (EAS) configuration for Android builds.
- Added privacy-policy and account-deletion pages for store-distribution requirements.
- Linked the local mobile app configuration to the existing Expo project.
- Verified the mobile TypeScript build and the Next.js production build.
- Published the work to a dedicated GitHub branch and opened a draft pull request.

## GitHub state

- Repository: `CuriousCoderAgent/Deepika-Wellness-App-Created-by-ChatGPT`
- Branch: `agent/add-android-mobile-app`
- Draft pull request: `https://github.com/CuriousCoderAgent/Deepika-Wellness-App-Created-by-ChatGPT/pull/1`
- Initial mobile commit: `3be0199` (`Add Android mobile app`)
- Expo slug correction commit: `ee8d124` (`Align Expo project slug`)

The pull request is intentionally a draft and has not been merged into `main` yet.

## Android and Expo identifiers

- App display name: `Deepika Wellness`
- Android application/package ID: `com.deepikawellness.app`
- App version: `1.0.0`
- Android version code: `1` (EAS production builds auto-increment remotely)
- Expo project ID: `945e60dc-4eeb-47aa-9e85-105ad698bc69`
- Expo project slug: `curious-coder`
- Expo scheme: `deepikawellness`
- Production output: Android App Bundle (`.aab`)
- Preview output: Android Package (`.apk`)

The Android package ID should be treated as permanent after the first Google Play upload.

## Software installed on Windows

The following command-line software was installed or configured:

1. GitHub CLI (`gh`)
   - Installed with: `winget install GitHub.cli`
   - Observed version: `2.97.0`
   - Authentication command: `gh auth login`
   - GitHub account: `CuriousCoderAgent`

2. Node.js LTS
   - Installed with: `winget install OpenJS.NodeJS.LTS`
   - Observed Node.js version: `v24.19.0`
   - Node.js includes npm (Node Package Manager).

3. Expo Application Services CLI (`eas-cli`)
   - Installed with: `npm.cmd install --global eas-cli`
   - Expo authentication command: `eas.cmd login`

PowerShell blocked the `npm.ps1` script because script execution was disabled. The Windows command shims `npm.cmd` and `eas.cmd` were therefore used; changing the PowerShell execution policy was not necessary.

## Important local checkout detail

Local checkout path:

`C:\Users\Eshan\Documents\Codex\2026-08-19\can-you-just-create-like-repositories\work\final-app`

Because Codex created the checkout under a sandbox identity, the owner's PowerShell may report “detected dubious ownership.” The scoped fix is:

```powershell
git config --global --add safe.directory "C:/Users/Eshan/Documents/Codex/2026-08-19/can-you-just-create-like-repositories/work/final-app"
```

EAS was once allowed to start `git init` inside `mobile/`, creating an unwanted empty nested `mobile/.git` directory. It was removed with:

```powershell
Remove-Item -LiteralPath ".git" -Recurse -Force
```

Do not initialize a second Git repository inside `mobile/`. The correct Git root is `final-app/`.

## Build commands

Run production Android builds from the mobile directory:

```powershell
cd "C:\Users\Eshan\Documents\Codex\2026-08-19\can-you-just-create-like-repositories\work\final-app\mobile"
eas.cmd build --platform android --profile production
```

Run an installable preview APK with:

```powershell
eas.cmd build --platform android --profile preview
```

Useful checks:

```powershell
eas.cmd whoami
git rev-parse --show-toplevel
npm.cmd --prefix mobile run typecheck
npm.cmd run build
```

## Android signing key (keystore)

During the first production build, EAS asked whether it should generate a new Android keystore. The owner selected **Yes**.

- The keystore is generated and managed by Expo/EAS.
- No keystore password, private key, GitHub token, or other secret is stored in this document or committed to Git.
- The same signing identity must be retained for future updates to `com.deepikawellness.app`.
- Authorized owners can inspect or download Android credentials later with:

```powershell
eas.cmd credentials --platform android
```

Store any downloaded keystore and passwords in a secure password manager or encrypted backup. Never commit them to GitHub or paste them into AI conversations.

## Backend connection

The EAS build profiles currently point the mobile app to:

`https://deepika-health-app.vercel.app`

The production backend requires securely configured environment variables, including:

- `AUTH_SECRET`
- `COACH_PASSWORD`
- `MEMBERS`
- pooled `DATABASE_URL`

The mobile app must be tested against the live backend before Google Play submission. The backend supports member mobile login and bearer-token access to the state API. Coach accounts remain web-only.

## Validation already completed

- Mobile TypeScript check: passed.
- Expo Android export: passed.
- Next.js production build: passed.
- Local member mobile login endpoint: returned a signed token.
- Bearer-authenticated state endpoint: returned HTTP 200.
- Privacy page: visually checked at a mobile viewport.

## Remaining launch steps

1. Wait for the EAS production build to finish and download the generated `.aab`.
2. Install/test a preview `.apk` on a physical Android device.
3. Confirm production backend variables and member credentials.
4. Review and merge draft pull request #1 into `main` when approved.
5. Create a Google Play Console developer account if one does not already exist.
6. Create the Play Console app using package ID `com.deepikawellness.app`.
7. Complete the store listing, privacy policy, data-safety form, content rating, app access instructions, and account-deletion declaration.
8. Upload the `.aab` to the Internal testing track first.
9. Test with invited users, resolve issues, and then promote through closed testing or production as allowed by Google Play.

## Current status

At the time this note was written, the first EAS Android production build had been started from PowerShell and the user had approved generation of a new Android keystore. The final EAS build URL and build result still need to be added when the build completes.
