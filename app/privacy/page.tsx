import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy — Bharosa Wellness" };

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-ink">
      <p className="label text-effort-stretch">BHAROSA WELLNESS</p>
      <h1 className="mt-3 font-display text-4xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-ink-soft">Effective 19 August 2026</p>

      <div className="mt-10 space-y-8 text-[16px] leading-7 text-ink-soft">
        <section>
          <h2 className="text-xl font-semibold text-ink">What this service is</h2>
          <p className="mt-2">
            Bharosa Wellness is a private wellness-coaching service. The app helps members follow
            coach-assigned plans, record check-ins and activities, communicate with their coach,
            and review progress. It supports coaching and education; it does not diagnose or treat
            medical conditions or replace care from a qualified medical professional.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Information we process</h2>
          <p className="mt-2">
            Depending on the features a member uses, the service may process account details,
            profile and coaching preferences, activity completion, energy, sleep and mental-state
            check-ins, symptoms entered by the member, coach messages and notes, appointments,
            nutrition logs, workout logs, and reports a member chooses to upload.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Why we process it</h2>
          <p className="mt-2">
            We use this information only to provide and operate the member&apos;s coaching journey,
            maintain account security, preserve the member&apos;s history across devices, support the
            coach-member relationship, and meet applicable legal obligations. We do not sell
            personal or health information or use it for advertising, employment, credit, or
            insurance decisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Storage and access</h2>
          <p className="mt-2">
            Production records are stored in access-controlled systems used to run Bharosa
            Wellness. A member can access her own record. An authorised coach can
            access member records where needed to provide coaching. Service providers that host
            the application or database process information only to operate those services.
            Network traffic uses encryption in transit, and the mobile app keeps its session token
            in the device&apos;s protected credential storage.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Choices and rights</h2>
          <p className="mt-2">
            Report uploads are optional. Members may ask to see or correct their information,
            withdraw optional consent, receive an export, or delete their account and associated
            records. Use the in-app coaching channel or follow the public deletion instructions.
          </p>
          <Link href="/account-deletion" className="mt-3 inline-block font-medium text-effort-stretch underline">
            Request account deletion
          </Link>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Retention and changes</h2>
          <p className="mt-2">
            Records are kept only while needed for the coaching service, account security, or an
            applicable legal requirement. A completed deletion request removes the active account
            and member record from production systems, subject to any limited retention required
            by law or backup-rotation periods. Material policy changes will be dated on this page.
          </p>
        </section>
      </div>
    </main>
  );
}
