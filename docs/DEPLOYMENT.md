# Deployment and environment

## Right now

The local redesign is not linked to a new Bharosa Vercel project, dedicated
cloud database, private Blob store, or verified email sender yet. Older mobile
builds pointed to the existing `deepika-health-app.vercel.app` backend; current
EAS profiles do not. Do not use an older APK/AAB for real customer data.

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

This is source-level isolation only. A dedicated Bharosa Vercel project,
PostgreSQL database, private Blob store and verified Resend sender have not yet
been provisioned, so provider-backed signup, password email and successful
private-file storage are not live.

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

**Recommended:** create a new Bharosa Vercel project, then attach a new Neon
PostgreSQL integration from Vercel Marketplace. Copy its pooled connection into
the server-only `BHAROSA_DATABASE_URL` variable and redeploy. Keep the new
resource independent of every Deepika project/database.

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
