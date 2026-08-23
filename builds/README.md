# Built APKs

Installable Android builds, kept so a working version can always be put back
on a phone without waiting for a rebuild.

Named `bharosa-YYYY-MM-DD-HHMM-<commit>.apk` — the timestamp is when EAS
finished the build, and the short commit is the code that went into it. The
commit is the part that actually identifies the version; the timestamp is
there so the newest is obvious at a glance.

**These are deliberately not committed.** They are ~85 MB each, which would
bloat the repository permanently and sits close to GitHub's per-file limit.
The authoritative copies live on EAS, which keeps them indefinitely:
`eas build:list --platform android`.

| File | Notes |
| --- | --- |
| `bharosa-2026-08-24-0007-13a066e.apk` | First standalone release build put on a real phone. Points at `bharosa-wellness-staging.vercel.app`. Includes Vera, the awards row, the day-by-day record, and the scroll-position fix. Signed by EAS — will not install over a locally built debug APK. |
