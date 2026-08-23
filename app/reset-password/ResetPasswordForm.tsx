"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const label = "block text-[13px] font-medium text-ink-soft";
const field =
  "tap mt-1.5 w-full rounded-xl border border-ink-line bg-paper-card px-3.5 text-[16px] focus:border-effort-target focus:outline-none";

export default function ResetPasswordForm() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const value = params.get("token");
    setToken(value && value.length <= 256 ? value : null);
    // Remove the bearer token from browser history as soon as it is held in
    // component memory. The URL fragment was never sent in the page request.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!token) return;
    if (password !== confirm) {
      setError("Those two passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          body.error || "We couldn’t reset the password. Request a new link.",
        );
        setBusy(false);
        return;
      }
      setPassword("");
      setConfirm("");
      setToken(null);
      setComplete(true);
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  if (token === undefined) {
    return (
      <div
        className="flex min-h-32 items-center justify-center"
        aria-label="Loading reset link"
      >
        <Loader2 size={22} className="animate-spin text-effort-stretch" />
      </div>
    );
  }

  if (complete) {
    return (
      <div className="text-center">
        <CheckCircle2 size={34} className="mx-auto text-effort-stretch" />
        <h2 className="mt-4 font-display text-2xl text-ink">
          Password changed
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          Your old sessions have been revoked. Sign in again with your new
          password.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="tap mt-6 w-full rounded-xl bg-effort-stretch text-sm font-medium text-white"
        >
          Return to sign in
        </button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="font-display text-2xl text-ink">
          This link can’t be used
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          It may be incomplete. Return to sign in and request a fresh
          password-reset email.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="tap mt-6 w-full rounded-xl bg-effort-stretch text-sm font-medium text-white"
        >
          Return to sign in
        </button>
      </div>
    );
  }

  const ready = password.length >= 8 && confirm.length > 0;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className={label}>
          New password
        </label>
        <input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={field}
        />
        <p className="mt-1 text-[11px] text-ink-faint">
          Use at least 8 characters.
        </p>
      </div>
      <div>
        <label htmlFor="confirm-password" className={label}>
          Type it again
        </label>
        <input
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={field}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-tint px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !ready}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-effort-stretch text-sm font-medium text-white transition-opacity disabled:opacity-40"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {busy ? "Changing password…" : "Change password"}
      </button>
    </form>
  );
}
