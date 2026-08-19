import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sprout } from "lucide-react";
import {
  demoCredentials,
  readSessionToken,
  sessionCookieName,
  sessionsAreSecure,
} from "@/lib/auth";
import { isConfigured } from "@/lib/db";
import LoginForm from "./login/LoginForm";

export const dynamic = "force-dynamic";

/**
 * The way in. One login, no role picker.
 *
 * Which surface you land on is decided by the account, not by a choice on
 * screen — a member should never be shown a door marked "coach", and asking
 * someone to classify themselves before signing in is a prototype's habit,
 * not a product's.
 */
export default async function Home() {
  const session = await readSessionToken(cookies().get(sessionCookieName)?.value);
  if (session) redirect(session.role === "coach" ? "/coach" : "/member");

  const insecure = !sessionsAreSecure();
  // Self-signup needs somewhere to put the account. An environment variable is
  // read-only at runtime, so without storage there is nowhere for a new
  // account to go and the option is not offered rather than offered and broken.
  // isConfigured() knows every name a provider might have used — see lib/db.ts.
  const canSignUp = isConfigured();
  const needsCode = Boolean(process.env.SIGNUP_CODE?.trim());

  return (
    <main className="relative min-h-dvh overflow-hidden bg-paper">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-marigold/[0.10] blur-3xl" />
        <div className="absolute -right-28 top-24 h-[26rem] w-[26rem] rounded-full bg-effort-min/25 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-marigold/[0.07] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-14">
        <header className="animate-rise text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-effort-tint text-effort-stretch">
            <Sprout size={21} strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[2.1rem] leading-[1.1] tracking-tight">
            Deepika Wellness
          </h1>
          {/* Deliberately names no age and no gender. The practice is built
              around women in midlife and the coaching reflects that, but the
              first line anyone reads should not turn away someone who came
              here ready to start. What makes this different is the coach, not
              the demographic. */}
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
            Strength, energy and steadiness — built around your actual life,
            with someone who actually knows you.
          </p>
        </header>

        <div className="mt-8">
          <LoginForm canSignUp={canSignUp} needsCode={needsCode} />
        </div>

        {insecure && (
          <div className="mt-6 rounded-xl border border-dashed border-ink-line bg-paper-sunk/50 p-3.5">
            <p className="label mb-1.5">Preview access</p>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Member:{" "}
              <span className="font-mono text-ink">{demoCredentials.member.username}</span> /{" "}
              <span className="font-mono text-ink">{demoCredentials.member.password}</span>
              <br />
              Coach:{" "}
              <span className="font-mono text-ink">{demoCredentials.coach.username}</span> /{" "}
              <span className="font-mono text-ink">{demoCredentials.coach.password}</span>
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
              Shared preview credentials, fine while the app holds only sample
              data. Set AUTH_SECRET, COACH_PASSWORD and MEMBERS in the
              deployment environment before anyone real signs in.
            </p>
          </div>
        )}

        {!canSignUp && !insecure && (
          <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-faint">
            Signing up isn't open on this deployment. Deepika can add you.
          </p>
        )}

        <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-faint">
          Preview build. Sample data, not real health records.
        </p>
      </div>
    </main>
  );
}
