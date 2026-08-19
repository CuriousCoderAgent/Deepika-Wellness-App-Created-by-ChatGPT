"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * One form for everyone, in two modes.
 *
 * Signing in does not ask you what kind of person you are — the account
 * decides which surface you land on, so a member is never shown a door marked
 * "coach". Creating an account is the same form with the fields it needs.
 */

const label = "block text-[13px] font-medium text-ink-soft";
const field =
  "tap mt-1.5 w-full rounded-xl border border-ink-line bg-paper-card px-3.5 text-[16px] focus:border-effort-target focus:outline-none";

/** A username suggestion from her name. She can overwrite it; this is only
 *  here so nobody has to invent one on the spot. */
function suggestUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 24);
}

export default function LoginForm({
  canSignUp,
  needsCode,
}: {
  canSignUp: boolean;
  needsCode: boolean;
}) {
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const creating = mode === "create";

  const switchMode = () => {
    setMode(creating ? "signin" : "create");
    setError(null);
    setPassword("");
    setConfirm("");
  };

  const onName = (v: string) => {
    setName(v);
    if (!touchedUsername) setUsername(suggestUsername(v));
  };

  const ready = creating
    ? name.trim() && username.trim() && password.length >= 8 && confirm.length > 0 &&
      (!needsCode || code.trim())
    : username.trim() && password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (creating && password !== confirm) {
      // Checked here rather than server-side because there is no password
      // reset in this build: a typo now is an account she cannot get back into.
      setError("Those two passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(creating ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creating ? { username, password, name, code } : { username, password }
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      const { role } = await res.json();
      // Full navigation so the middleware and the server layout both see the
      // new cookie — the store is namespaced by account and has to be built
      // from the right session.
      window.location.assign(role === "coach" ? "/coach" : "/member");
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {creating && (
        <div>
          <label htmlFor="name" className={label}>
            Your name
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => onName(e.target.value)}
            className={field}
          />
        </div>
      )}

      <div>
        <label htmlFor="username" className={label}>
          {creating ? "Choose a username" : "Username"}
        </label>
        <input
          id="username"
          name="username"
          autoComplete={creating ? "off" : "username"}
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => {
            setTouchedUsername(true);
            setUsername(e.target.value);
          }}
          className={field}
        />
        {creating && (
          <p className="mt-1 text-[11px] text-ink-faint">
            This is what you'll type to sign in. Letters, numbers, dots and
            dashes.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className={label}>
          {creating ? "Create a password" : "Password"}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
        {creating && (
          <p className="mt-1 text-[11px] text-ink-faint">
            At least 8 characters. Keep it somewhere safe — there's no way to
            reset it yet.
          </p>
        )}
      </div>

      {creating && (
        <div>
          <label htmlFor="confirm" className={label}>
            Type it again
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={field}
          />
        </div>
      )}

      {creating && needsCode && (
        <div>
          <label htmlFor="code" className={label}>
            Join code
          </label>
          <input
            id="code"
            name="code"
            autoCapitalize="none"
            autoCorrect="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={field}
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            The code Deepika sent with the link.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger-tint px-3 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !ready}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-effort-stretch text-sm font-medium text-white transition-opacity disabled:opacity-40"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {busy
          ? creating
            ? "Creating your account…"
            : "Signing in…"
          : creating
            ? "Create my account"
            : "Sign in"}
      </button>

      {canSignUp && (
        <p className="pt-1 text-center text-[13px] text-ink-soft">
          {creating ? "Already have an account?" : "First time here?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="font-medium text-effort-stretch underline underline-offset-2"
          >
            {creating ? "Sign in" : "Create your account"}
          </button>
        </p>
      )}
    </form>
  );
}
