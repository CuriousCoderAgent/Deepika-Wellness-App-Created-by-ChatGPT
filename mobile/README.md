# Bharosa Wellness mobile app

Expo/React Native member application for Android and iOS. The coach console and API remain in the repository root.

## Configure

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the deployed Next.js application. That deployment must have `AUTH_SECRET`, `COACH_PASSWORD`, `MEMBERS`, and a pooled `DATABASE_URL` configured.

The mobile login sends `client: "mobile"`; the server returns a signed, 30-day member token. The token is stored with Expo SecureStore and sent only as a Bearer token to `/api/state`.

## Develop

```bash
npm install
npx expo start
```

## Android builds

Initialize the project once with `eas init`, which replaces the placeholder project ID in `app.json`.

```bash
npm install --global eas-cli
eas login
eas init
eas build --platform android --profile preview     # installable APK
eas build --platform android --profile production  # Play Store AAB
eas submit --platform android --profile production # internal track draft
```

The permanent Android application ID is `com.bharosawellness.app`. Changing it after the first Play Console upload creates a different app.
