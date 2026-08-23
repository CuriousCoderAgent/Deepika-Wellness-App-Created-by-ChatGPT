import assert from "node:assert/strict";
import crypto from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;

loadEnvConfig(process.cwd());

const expectedStagingOrigin = "https://bharosa-wellness-staging.vercel.app";
const configuredBaseUrl = (
  process.env.BHAROSA_SMOKE_URL ||
  process.env.BHAROSA_APP_URL ||
  expectedStagingOrigin
).replace(/\/$/, "");
const parsedBaseUrl = new URL(configuredBaseUrl);
if (
  parsedBaseUrl.origin !== expectedStagingOrigin ||
  parsedBaseUrl.pathname !== "/"
) {
  throw new Error(
    `Refusing to send staging credentials to ${parsedBaseUrl.origin}.`,
  );
}
const baseUrl = parsedBaseUrl.origin;
const signupCode = process.env.SIGNUP_CODE;
const coachPassword = process.env.COACH_PASSWORD;
const databaseUrl = process.env.BHAROSA_DATABASE_URL;

if (!signupCode || !coachPassword || !databaseUrl) {
  throw new Error(
    "Pull the linked Vercel development environment before running the staging smoke test.",
  );
}

const suffix = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`;
const username = `smoke${suffix}`.toLowerCase();
const email = `${username}@example.invalid`;
const password = `Smoke!${crypto.randomUUID()}Aa1`;
const authHeaders = () => ({ Authorization: `Bearer ${memberToken}` });
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: true },
  max: 1,
});

let memberToken = "";
let fileId = "";
let accountCreated = false;
let databaseAccountVerified = false;

function report(check, status) {
  console.log(JSON.stringify({ check, status }));
}

async function jsonRequest(path, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function removeSmokeData() {
  if (!accountCreated) return;

  const account = await pool.query(
    "select user_id, name, email from account where user_id = $1",
    [username],
  );
  const row = account.rows[0];
  databaseAccountVerified = Boolean(
    account.rowCount === 1 &&
      row?.user_id === username &&
      row?.name === "Bharosa staging smoke test" &&
      row?.email === email,
  );
  if (!databaseAccountVerified) {
    throw new Error(
      "The smoke target and cleanup database do not contain the same disposable account; no direct deletion was attempted.",
    );
  }

  if (fileId && memberToken) {
    const response = await fetch(
      `${baseUrl}/api/files/${encodeURIComponent(fileId)}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      },
    );
    if (response.status !== 204) {
      throw new Error(
        `Private-file cleanup failed with HTTP ${response.status}; its registry record was retained.`,
      );
    }
    fileId = "";
  }

  await pool.query("delete from private_file where owner_id = $1", [username]);
  await pool.query("delete from member_state where user_id = $1", [username]);
  await pool.query("delete from account where user_id = $1", [username]);

  const accountCount = await pool.query(
    "select count(*)::int as count from account where user_id = $1",
    [username],
  );
  const fileCount = await pool.query(
    "select count(*)::int as count from private_file where owner_id = $1",
    [username],
  );
  assert.equal(accountCount.rows[0].count, 0);
  assert.equal(fileCount.rows[0].count, 0);
}

try {
  const signup = await jsonRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      name: "Bharosa staging smoke test",
      email,
      code: signupCode,
      client: "mobile",
    }),
  });
  assert.equal(signup.status, 200);
  accountCreated = true;
  const signupJson = await signup.json();
  assert.equal(signupJson.user?.id, username);
  assert.equal(signupJson.role, "member");
  assert.equal(typeof signupJson.token, "string");
  memberToken = signupJson.token;

  const createdAccount = await pool.query(
    "select user_id, name, email from account where user_id = $1",
    [username],
  );
  assert.equal(createdAccount.rowCount, 1);
  assert.equal(createdAccount.rows[0].user_id, username);
  assert.equal(createdAccount.rows[0].name, "Bharosa staging smoke test");
  assert.equal(createdAccount.rows[0].email, email);
  databaseAccountVerified = true;
  report("signup", signup.status);

  const state = await fetch(`${baseUrl}/api/state`, { headers: authHeaders() });
  assert.equal(state.status, 200);
  const stateJson = await state.json();
  assert.equal(stateJson.configured, true);
  assert.equal(stateJson.doc?.member?.id, username);
  report("state-read", state.status);

  const save = await jsonRequest("/api/state", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ doc: stateJson.doc }),
  });
  assert.equal(save.status, 200);
  report("state-write", save.status);

  const wrongLogin = await jsonRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password: `${password}x`,
      client: "mobile",
    }),
  });
  assert.equal(wrongLogin.status, 401);
  report("wrong-password", wrongLogin.status);

  const rightLogin = await jsonRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, client: "mobile" }),
  });
  assert.equal(rightLogin.status, 200);
  assert.equal(typeof (await rightLogin.json()).token, "string");
  report("member-login", rightLogin.status);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const form = new FormData();
  form.set("kind", "meal-photo");
  form.set("file", new Blob([png], { type: "image/png" }), "smoke.png");
  const upload = await fetch(`${baseUrl}/api/files`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  assert.equal(upload.status, 201);
  const uploadJson = await upload.json();
  fileId = uploadJson.file?.id;
  assert.equal(typeof fileId, "string");
  assert.equal(uploadJson.file.contentType, "image/png");
  assert.equal("url" in uploadJson.file, false);
  assert.equal("pathname" in uploadJson.file, false);
  report("private-file-upload", upload.status);

  const filePath = `/api/files/${encodeURIComponent(fileId)}`;
  const download = await fetch(`${baseUrl}${filePath}`, {
    headers: authHeaders(),
  });
  assert.equal(download.status, 200);
  assert.equal(
    download.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  report("private-file-read", download.status);

  const anonymousDownload = await fetch(`${baseUrl}${filePath}`);
  assert.equal(anonymousDownload.status, 401);
  report("private-file-owner-gate", anonymousDownload.status);

  const remove = await fetch(`${baseUrl}${filePath}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  assert.equal(remove.status, 204);
  fileId = "";
  report("private-file-delete", remove.status);

  const missing = await fetch(`${baseUrl}${filePath}`, {
    headers: authHeaders(),
  });
  assert.equal(missing.status, 404);
  report("private-file-after-delete", missing.status);

  const recommendation = await jsonRequest("/api/recommendations/generate", {
    method: "POST",
    headers: authHeaders(),
    body: "{}",
  });
  assert.equal(recommendation.status, 200);
  assert.ok((await recommendation.json()).recommendation);
  report("deterministic-recommendation", recommendation.status);

  const knownHelp = await jsonRequest("/api/auth/password-help", {
    method: "POST",
    body: JSON.stringify({ identifier: email }),
  });
  const knownHelpBody = await knownHelp.text();
  const unknownHelp = await jsonRequest("/api/auth/password-help", {
    method: "POST",
    body: JSON.stringify({ identifier: `${username}-unknown` }),
  });
  const unknownHelpBody = await unknownHelp.text();
  assert.equal(knownHelp.status, 200);
  assert.equal(unknownHelp.status, 200);
  assert.equal(knownHelpBody, unknownHelpBody);
  report("password-help-anti-enumeration", knownHelp.status);

  const coachLogin = await jsonRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "deepika", password: coachPassword }),
  });
  assert.equal(coachLogin.status, 200);
  assert.equal((await coachLogin.json()).role, "coach");
  report("coach-web-login", coachLogin.status);

  const coachMobile = await jsonRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: "deepika",
      password: coachPassword,
      client: "mobile",
    }),
  });
  assert.equal(coachMobile.status, 403);
  report("coach-mobile-block", coachMobile.status);
} finally {
  try {
    await removeSmokeData();
  } finally {
    await pool.end();
  }
}

console.log(JSON.stringify({ check: "cleanup", status: "complete" }));
