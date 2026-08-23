import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bharosa Wellness — get the app",
};

/**
 * The member experience lives in the phone app.
 *
 * There used to be a second, browser-based member app here, built when the
 * product was coach-led. It fell behind: no readiness screen before it offered
 * exercise, no generated plan, no circle, and a consent screen still promising
 * that data was seen by "you and Deepika, nobody else" — which stopped being
 * true the day members could connect to each other.
 *
 * Two member front-ends drifting apart is how a product ends up showing people
 * a privacy promise it no longer keeps. Rather than maintain both, this is now
 * a signpost, and the phone app is the member experience.
 *
 * The coach console is unaffected and remains a full browser application.
 */
export default function MemberApp() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-ink">
      <p className="label text-effort-stretch">BHAROSA WELLNESS</p>
      <h1 className="mt-3 font-display text-4xl">Your plan is in the app.</h1>
      <p className="mt-5 text-[16px] leading-7 text-ink-soft">
        Bharosa is built for your phone — it needs your step count, it reminds
        you at the right time of day, and it lets you photograph a meal in the
        moment. A browser does none of those well, so the member experience
        lives entirely in the app.
      </p>

      <div className="mt-8 rounded-2xl bg-paper-sunk p-5">
        <h2 className="font-semibold">What you can still do here</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-soft">
          <li>
            <Link href="/privacy" className="underline">
              Read the privacy policy
            </Link>{" "}
            — what is stored, and what your circle can see.
          </li>
          <li>
            <Link href="/account-deletion" className="underline">
              Delete your account
            </Link>{" "}
            — though it is quicker in the app, under You.
          </li>
          <li>
            <Link href="/reset-password" className="underline">
              Reset your password
            </Link>
            .
          </li>
        </ul>
      </div>

      <p className="mt-8 text-sm leading-6 text-ink-faint">
        If you do not have the app yet, your coach will send you the link.
      </p>
    </main>
  );
}
