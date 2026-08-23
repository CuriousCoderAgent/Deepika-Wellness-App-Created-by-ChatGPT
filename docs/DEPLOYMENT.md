# Deployment and environment

## Right now

The Bharosa staging backend is live at
<https://bharosa-wellness-staging.vercel.app>. It is a separate Vercel project
with its own Neon PostgreSQL database (`bharosa-wellness-staging-db`) and its
own private Blob store (`bharosa-wellness-staging-files`), both in Singapore.
It does not use or modify the protected Deepika repository, project, database,
or storage. Older mobile builds pointed to the existing
`deepika-health-app.vercel.app` backend; current EAS profiles do not. Do not use
an older APK/AAB for real customer data.

Local development with no auth variables still offers fictional-data demo
credentials:

| Who    | Username  | Password      |
| ------ | --------- | ------------- |
| Coach  | `deepika` | `deepika2026` |
| Member | `radhika` | `radhika2026` |

Those values are public and are accepted only when `NODE_ENV` is not
`production`. A production deployment never falls back to them or to the known
development signing key. Missing or short signing configuration makes sign-in
fail closed with a controlled service-unavailable response.

Database-backed signup, login, state persistence, private-file storage, coach
access, and deterministic recommendation fallback have passed staging smoke
tests. The password-help endpoint and its anti-enumeration response are live,
but reset delivery and redemption are unverified: `RESEND_API_KEY` is absent.
The temporary `onboarding@resend.dev` sender can deliver only to the email on
the Resend account. Sending to pilot customers requires an owned domain and a
verified Resend sender.

## Before real members

In Vercel → Settings → Environment Variables. Tick Production, Preview and
Development for each, then **redeploy** — Vercel does not apply new variables
to an existing build.

| Variable                | What it is                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SECRET`           | Random string used to sign session cookies. Generate with `openssl rand -base64 32`. Changing it signs everyone out.           |
| `COACH_PASSWORD`        | Deepika's password. Her username is always `deepika`.                                                                          |
| `MEMBERS`               | The cohort. See below.                                                                                                         |
| `BHAROSA_DATABASE_URL`  | Dedicated, pooled PostgreSQL connection for Bharosa. Required in production. Never point it at the protected Deepika database. |
| `SIGNUP_CODE`           | Private pilot invitation code. Required for production self-signup until email verification is added.                          |
| `RESEND_API_KEY`        | Server-side Resend key used only to send password-reset email.                                                                 |
| `BHAROSA_EMAIL_FROM`    | Verified sender, for example `Bharosa Wellness <care@example.com>`.                                                            |
| `BHAROSA_APP_URL`       | Canonical HTTPS origin used to construct reset links.                                                                          |
| `FILE_TOKEN_SECRET`     | Independent random value of at least 32 bytes used for opaque private-file references. Keep it stable.                         |
| `BLOB_READ_WRITE_TOKEN` | Credential for a Vercel Blob store configured for private access.                                                              |
| `OPENAI_VISION_MODEL`   | Optional. Model used to read meal photos. Defaults to `gpt-5`. Needs `OPENAI_API_KEY`.                                        |
| `BHAROSA_TIMEZONE`      | Optional. The timezone the day rolls over in. Defaults to `Asia/Kolkata`. See below.                                          |

### Which day is "today"

Actions, pulses, messages and sessions are stored against a relative day
offset, and `lib/day-offset.ts` moves those offsets forward whenever a document
is read. The day boundary is computed in `BHAROSA_TIMEZONE`, not UTC: a member
logging a pulse at 05:00 IST is logging it today, and a UTC boundary would
record it as yesterday. Leave it unset unless the practice moves out of India.

Documents written before this existed carry no anchor. They are treated as
having been written today, which is exactly how the app behaved previously, and
are stamped on the first read so they are correct from the following day
onwards. No migration or backfill is required.

These are server-only Vercel variables and must never be copied into EAS or an
`EXPO_PUBLIC_*` variable. In EAS, configure only `EXPO_PUBLIC_API_URL` with the
canonical HTTPS URL of the new Bharosa backend. The current EAS profiles
intentionally contain no backend URL.

`AUTH_SECRET` and `FILE_TOKEN_SECRET` must each be independent values of at
least 32 bytes. Production account creation also requires `SIGNUP_CODE`; this
keeps the closed pilot invite-only until email verification is implemented.

### MEMBERS

One entry per member, `username:password:Display Name`, separated by commas or
newlines:

```
radhika:demo123:Radhika,meera:herpassword:Meera,anjali:otherpass:Anjali
```

The username is also the key her data is stored under, so changing it later
gives her a blank app. Malformed entries are skipped rather than breaking the
deployment, so a stray comma costs you one account, not all of them.

**Reserved usernames.** The demo cohort already occupies `radhika`, `megha`,
`anita`, `shreya`, `nidhi` and `priya`. Giving one of those to a real member
drops her into a fictional woman's history. `radhika` is the exception and is
meant to be used — it is the seeded demo account.

## Signing up

With `BHAROSA_DATABASE_URL` set, the login screen offers **Create your
account**: a member enters her name and email, picks a username (suggested from
her name, editable) and a password, and is signed straight in to the first-run
flow. The coach
shares one link with her group rather than minting twenty credentials by hand
and sending them out one at a time.

These passwords are stored as scrypt hashes with a per-account salt. Nobody
can read them back — not Deepika, and not anyone who gets a copy of the
database. The `MEMBERS` passwords stay plaintext because they belong to
whoever runs the deployment and are already visible in Vercel.

Both kinds of account work at once. Login checks `MEMBERS` first, then the
database.

**Who can sign up.** A link shared in a group chat travels further than the
group. Production requires `SIGNUP_CODE` and the form asks for it — Deepika
includes it in the invitation. Account creation is limited per network address
and the account plus its empty member document are committed atomically.
Without a production join code, direct signup fails closed.

Without `BHAROSA_DATABASE_URL` the option is not shown at all, rather than shown and
broken: an environment variable is read-only at runtime, so there is nowhere
for a new account to go.

Email ownership verification is not implemented yet. Keep the pilot invited
and manually confirm addresses before members enter real health information.
Verified-email activation is a launch gate before opening signup to the public.

## Password recovery

Self-created accounts have a real email reset flow. A request always returns
the same message whether the username/email exists, which prevents account
enumeration. The server stores only a hash of a random, single-use token; it
expires after 30 minutes. A successful reset changes the scrypt password hash,
consumes the token, and advances the account's session version so older mobile
and web sessions no longer authorize protected data APIs.

Delivery requires `RESEND_API_KEY`, a verified `BHAROSA_EMAIL_FROM`, and the
correct HTTPS `BHAROSA_APP_URL`. Existing accounts created before the email
field was introduced need an email added through a controlled migration before
self-service reset can work. Environment-variable `MEMBERS` accounts remain
operator-managed and cannot use this database reset flow.

## Storage

Structured member data and uploaded files use separate services.

**Web preview without `BHAROSA_DATABASE_URL`** — fictional member documents
can live in browser `localStorage`, namespaced per account. Data does not
follow the user between devices and clearing browser data removes it. This is
a demo-only mode. The native app requires a configured backend for non-demo
members and does not treat device storage as a production member database.

**With `BHAROSA_DATABASE_URL`** — each member document is stored in Postgres,
read on sign-in, and written after changes. The web client also keeps a
browser-local mirror. The React Native client stores its session token in
protected device credential storage, but member state is written through to
the API rather than maintained as an offline database.

### Private meal photos and reports

Meal photos and reports are stored separately in a private Vercel Blob store.
Web and mobile clients upload them through authenticated server routes and save
only an opaque, owner-bound file reference in the member document. Raw Blob
URLs and internal object paths are not exposed. The owning member and the
coach role can retrieve a referenced file through the authenticated API.

Meal photos accept JPEG, PNG or WebP. Reports accept PDF, JPEG or PNG. Each
file is limited to 4 MB and checked against both its declared MIME type and
file signature. The database maintains an active ownership registry, a
500-file/500-MB per-member ceiling, and upload rate limits. Blob creation is
attempted only after ownership is registered; failed object writes are cleaned
up and the registry entry is retired.

`BLOB_READ_WRITE_TOKEN` and a stable, independent `FILE_TOKEN_SECRET` must be
configured. Production never falls back to `AUTH_SECRET`; rotating the session
key therefore cannot orphan private uploads. Changing `FILE_TOKEN_SECRET`
makes existing opaque references unreadable.

The explicit mobile demo mode does not upload selected files; it retains only
a device-local URI.

**Current staging:** the separate `bharosa-wellness-staging` Vercel project has
the `bharosa-wellness-staging-db` Neon integration attached. Its pooled
connection is mapped to the server-only `BHAROSA_DATABASE_URL` variable. Keep
this resource independent of every Deepika project/database.

Marketplace integrations often inject `DATABASE_URL`. For this app, map that
new Bharosa-owned value into `BHAROSA_DATABASE_URL`. Production deliberately
does not fall back to generic legacy names, preventing an accidentally linked
project from sharing the older database.

Setting it by hand works too — any Postgres will do (Supabase, Neon, Railway).
Point it at a **pooled** endpoint (Supabase's pooler port, Neon's `-pooler`
host): serverless functions open many short-lived connections and a free-tier
database will run out of direct ones. Vercel's own integrations already give
you the pooled one. Bharosa verifies the database server's TLS certificate for
non-local connections; do not disable certificate verification for health
data.

The schema creates itself on first request. On a genuinely empty database the
six demo personas are written once, so the Radar has all four buckets
populated on day one instead of being empty until real members start logging.
Delete them when the pilot is real — they will not come back.

### Before the pilot is real

`npm run db:reset` is not a thing, on purpose. To clear the demo cohort:

```sql
delete from member_state where user_id in
  ('radhika','megha','anita','shreya','nidhi','priya');
```

Leave the `app_meta` row alone — it is what stops the demo data being
reinserted on the next request.

## Authentication status

**Does:** signed HTTP-only web sessions and bearer-token mobile sessions;
server-side route protection; coach/member role separation; per-account data
isolation; database-backed self-signup with a required unique email; and
single-use email password recovery for self-created accounts. Password-help,
reset redemption, login, and signup are rate-limited in PostgreSQL. Reset
requests use a generic response to prevent account enumeration, and a
successful reset invalidates older database-backed sessions. Unknown database
usernames perform the same scrypt work as known accounts to reduce timing
leakage. Production has no demo-password or default-signing-key fallback.

**Does not:** verify email ownership yet, offer an automated self-service
account-removal API, or reset passwords for environment-variable `MEMBERS`
accounts. Those accounts remain operator-managed. Verified-email activation
must be added before signup is opened beyond the invitation-code pilot.

## Conflict handling

Documents are per member. Mobile member saves are now field-scoped: member
check-ins, food, workouts and completion can be written, but a stale client
copy cannot replace coach-published week plans, coach-authored action
definitions, sessions, or newly arrived coach messages. Deepika also writes
only members she has actually edited. The remaining narrow race is two writes
to the same member-owned collection or a coach console write landing in the
same instant as a mobile write. Add row revisions/ETags (or split the document
into normalized tables) before scaling beyond the pilot rather than relying on
last-write-wins indefinitely.

## Data protection

Once real members sign in with `BHAROSA_DATABASE_URL` set, this holds real health
data about identifiable people, and India's DPDP Act applies: consent,
retention, and deletion on request. The onboarding flow already captures
consent in two parts (logging is required, uploading reports is optional and
separate), and it is stored on her record with a date.

There is not yet an automated end-to-end deletion workflow. Before deleting a
member document, an operator must identify and delete every active private Blob
object in that member's `private_file` registry. The operator must then remove
the `member_state` row and, for a self-created account, the `account` row;
deleting the account cascades its password-reset tokens. For an
environment-managed member, remove the `MEMBERS` entry and redeploy as well.
Backup retention and legally required records must follow the published
retention policy.

Do not describe `delete from member_state` alone as full account deletion.
Automating and verifying this complete purge is a pilot launch gate.

## Staging verification

Run `npm run smoke:staging` only from the linked staging checkout after pulling
the **Production environment of this staging Vercel project** into the ignored
`.env.local` file:

```powershell
vercel env pull .env.local --environment=production --yes
npm.cmd run smoke:staging
```

The script refuses every HTTP origin except the stable Bharosa staging URL. It
creates a uniquely named disposable member, verifies that the API and cleanup
database contain that exact account, exercises the API, removes its private
object and database rows, and never prints tokens or secrets. If target/database
verification or Blob deletion fails, it retains the database registry rather
than hiding an orphaned object.

Verified on 21 August 2026:

- signup, member login, and authenticated state read/write;
- wrong-password rejection;
- private PNG upload, owner read, anonymous denial, deletion, and subsequent
  not-found response;
- deterministic recommendation fallback without an OpenAI key;
- identical password-help responses for known and unknown identifiers;
- coach web login and coach-mobile denial; and
- deletion of the disposable account, member state, and private-file record.

Actual reset-email delivery and redemption remain pending until a Resend API
key is configured. The smoke script must use fictional data only and must never
be repointed at production or a third-party origin.

## Data export and deletion

Members export and delete their own data from **You → Your data** in the mobile
app. Both are self-service and neither needs the coach.

- `GET /api/account/export` returns the signed-in member's stored document plus
  a count of her uploaded files. Files themselves are downloaded individually
  through `/api/files/[id]`, which is the only route that authorises access to
  private object storage.
- `DELETE /api/account` removes the member document, private-file rows,
  outstanding password-reset tokens, the account row, and the uploaded blobs.
  It asks for the password again, is rate-limited to five attempts per address
  per fifteen minutes, and clears the session cookie. Blobs are deleted before
  database rows, so a failure leaves the account intact and retryable rather
  than half-erased.

Both routes are member-only. Deepika removing a member is a different decision
and belongs in the coach console, not on a route a member session can reach.

A `MEMBERS`-provisioned login has no database row to delete — the credential
lives in an environment variable this server cannot rewrite. Her data is removed
and the response says plainly that the sign-in itself has to be withdrawn by
whoever runs the deployment. Remove her entry from `MEMBERS` and redeploy.

Google Play requires an in-app deletion route for any app that creates
accounts, alongside the public `/account-deletion` page. Both now exist and
describe the same flow.

## The circle

Members can connect to each other. Two tables are created automatically:
`circle_profile` (her circle name, city, and two sharing switches, all off by
default) and `circle_connection` (one row per pair, mutual accept required).
No migration step is needed; `ensureReady()` creates them like the rest.

What crosses between members is built in `lib/circle.ts` as a projection, field
by field. It never spreads a member document, so a field added to `MemberDoc`
later cannot silently become visible to someone else. Meals, meal photos,
reports, check-ins, symptoms, mood, coach messages and the plan are not part of
it and cannot be.

`GET /api/circle` returns her settings, her connections' activity and any
requests waiting on her. `POST|PATCH|DELETE /api/circle/requests` sends,
answers and ends connections. `GET /api/circle/discover` lists members in the
same city who opted in.

**Location.** The only location this feature handles is the city a member types
herself. There is no device location, no coordinates, no distance and no map,
and discovery is symmetric — a member who is not discoverable cannot browse the
list either, so the safest setting is not "look without being seen".

**Enumeration.** Requests to an unknown username and to a member who has not
opted in return the same response, and are rate-limited to twenty per member per
hour. Without both, this route would be a way to enumerate the cohort.

Account deletion removes connections and the city listing along with everything
else.

## Meal photos

`POST /api/nutrition/estimate` reads a photo the member has already uploaded and
returns the foods it contains. It applies the same ownership checks as
`/api/files/[id]`, sends the image once with `store: false`, and is bounded to
identifying food and portions: it is instructed not to comment on whether a meal
is healthy, balanced or advisable, which is coaching and belongs to Deepika.

Every number is clamped to something a person could plausibly eat before it
reaches a food log, an unreadable photo returns an empty list rather than a
guess, and the typed estimate from `mobile/src/nutrition.ts` remains the
fallback — logging a meal never depends on a model answering.
