/**
 * The privacy policy, rewritten to describe what the product actually does.
 *
 * The previous version was written for a different product and had drifted
 * into saying things that were no longer true. Three in particular:
 *
 * - "the app does not collect device location, coordinates or distance" — the
 *   app now asks for coarse location and reads coordinates, even though it
 *   destroys them on the device and sends only a ~3km grid cell.
 * - No mention of OpenAI anywhere, while plan explanations, Vera, meal-photo
 *   estimates and recommendations all send member context to it.
 * - No mention of Apple Health / Health Connect import, which now uploads
 *   normalised snapshots to the server.
 *
 * A privacy notice that is out of date is not a documentation problem. It is
 * the document people rely on to decide what to tell the app, so this one
 * lists what is actually collected, who actually receives it, and what is
 * genuinely optional — including the parts that reflect badly on us, like the
 * consent switches that cannot yet be withdrawn from inside the app.
 *
 * This is written to be accurate, not to be legal advice. It has not been
 * reviewed by counsel, and Indian DPDP compliance in particular needs someone
 * qualified to look at it before members outside the pilot rely on it.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Bharosa Wellness",
};

/**
 * Raised whenever the substance changes, not the wording. Consent records
 * should capture the version a member agreed to.
 */
const POLICY_VERSION = "2.0";
const EFFECTIVE = "24 August 2026";

const COLLECTED: [what: string, why: string, optional: string][] = [
  [
    "Account: your name, email address, username, and a one-way hash of your password.",
    "To create and secure your account, and to let you reset your password.",
    "Required",
  ],
  [
    "Sign-up answers: your goals, how active you have been, the time you realistically have, anything the plan should work around, and when you prefer to be reminded.",
    "These decide which movements and daily actions you are offered.",
    "Required",
  ],
  [
    "What you do each day: which actions you complete, how hard each felt, whether anything hurt, and your energy, sleep, stress and any symptoms you record.",
    "This is what the plan adapts from. A pain report pauses that movement until a person has reviewed it.",
    "Optional — the app works if you log nothing; it just cannot adapt",
  ],
  [
    "Meals: your description, an optional photo, and estimated calories and macronutrients.",
    "To show what you have eaten and let you correct the estimate.",
    "Optional",
  ],
  [
    "Connected health: steps, resting heart rate, heart-rate variability and VO₂ max, read from Apple Health or Health Connect and copied to our server.",
    "To show your own trends, and to size walking targets.",
    "Optional — asked separately, and revocable",
  ],
  [
    "Documents you upload, such as blood work.",
    "So they are in one place. Nothing analyses them; today this is private storage only.",
    "Optional",
  ],
  [
    "Approximate area: if you allow location, your phone works out which roughly 3km square you are in and sends only two grid numbers.",
    "To suggest members near you, if you turn discovery on.",
    "Optional",
  ],
  [
    "Circle: a display name, an optional line about yourself, your city, and who you are connected to.",
    "To let other members find and connect with you.",
    "Optional — off until you turn it on",
  ],
  ["Messages you send to Vera or to a coach.", "To answer them.", "Optional"],
];

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-ink">
      <p className="label text-effort-stretch">BHAROSA WELLNESS</p>
      <h1 className="mt-3 font-display text-4xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Version {POLICY_VERSION} · Effective {EFFECTIVE}
      </p>

      <div className="mt-10 space-y-8 text-[16px] leading-7 text-ink-soft">
        <section>
          <h2 className="text-xl font-semibold text-ink">
            What this service is
          </h2>
          <p className="mt-2">
            Bharosa Wellness is a general wellness and coaching app. It builds a
            daily plan from what you tell it and, if you choose to connect them,
            from health figures your phone already holds. It explains why the
            plan looks the way it does, and adjusts it from what you log.
          </p>
          <p className="mt-2">
            Most members use it without a human coach. Where a coach has been
            assigned, that person can see your record and set parts of your
            plan. Bharosa supports wellness and education. It does not diagnose,
            treat, or replace care from a qualified medical professional, and
            nothing in it should be read as a medical opinion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">
            What we collect, and whether it is optional
          </h2>
          <p className="mt-2">
            Only the first two rows are needed to use the app at all. Everything
            else is a feature you can decline and still have a working plan.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-ink">
                  <th className="py-2 pr-4 font-semibold">Information</th>
                  <th className="py-2 pr-4 font-semibold">Why</th>
                  <th className="py-2 font-semibold">Optional?</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {COLLECTED.map(([what, why, optional]) => (
                  <tr key={what} className="border-b border-line/60">
                    <td className="py-3 pr-4">{what}</td>
                    <td className="py-3 pr-4">{why}</td>
                    <td className="py-3">{optional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">
            About location, specifically
          </h2>
          <p className="mt-2">
            If you allow it, the app reads your position on your device and
            immediately reduces it to a pair of integers naming a roughly
            three-kilometre square. Only those two numbers are sent. Your
            coordinates never leave your phone, we never store them, there is no
            map, and nobody is shown a distance to you.
          </p>
          <p className="mt-2">
            The app deliberately does not request precise location. You can skip
            this entirely and simply type your city, or use no location feature
            at all.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">
            Artificial intelligence, and what is sent where
          </h2>
          <p className="mt-2">
            Bharosa uses OpenAI&apos;s API for four things: writing the sentence
            that explains your plan, answering you as Vera in the Coach tab,
            estimating a meal from a photo or description, and drafting the
            occasional suggestion. Conversational sign-up, where offered, also
            uses it.
          </p>
          <p className="mt-2">
            <strong className="text-ink">
              What decides your plan is not the model.
            </strong>{" "}
            Which movements you are offered, how many sets and repetitions, when
            something progresses, and every safety rule are decided by ordinary
            tested code. The model writes the explanation. If it is unavailable,
            your plan is identical and the explanation is a written sentence
            instead.
          </p>
          <p className="mt-2">
            What is sent, for those features only: your first name, your
            programme week, today&apos;s actions and whether they are done, your
            readiness outcome, anything you told us to work around, how your
            recent sessions felt, and averages of your recent check-ins. For
            meal estimation, the photo or description you submit. For Vera, your
            messages in that conversation. No other member ever appears, and
            your email, password, uploaded documents and coach messages are not
            sent.
          </p>
          <p className="mt-2">
            We ask OpenAI not to retain these requests for training. Providers
            do keep limited logs for abuse monitoring under their own policies,
            so we cannot describe this as zero retention.
          </p>
          <p className="mt-2">
            You can decline AI personalisation during sign-up. Declining is not
            meant to break anything — the plan is generated the same way either
            way.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">
            Who else processes your information
          </h2>
          <p className="mt-2">
            We do not sell personal or health information, and we do not use it
            for advertising, employment, credit or insurance decisions. These
            providers process it only to run the service:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              <strong className="text-ink">Vercel</strong> — hosting, and
              private storage for the photos and documents you upload.
            </li>
            <li>
              <strong className="text-ink">Neon</strong> — the database holding
              your record.
            </li>
            <li>
              <strong className="text-ink">OpenAI</strong> — the AI features
              described above.
            </li>
            <li>
              <strong className="text-ink">Resend</strong> — sending account
              emails such as password resets.
            </li>
          </ul>
          <p className="mt-2">
            Some of these operate outside India, so your information may be
            processed abroad.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">
            Who can see your record
          </h2>
          <p className="mt-2">
            You can. An assigned coach can, where one exists, in order to coach
            you. Nobody else, other than the providers above acting on our
            instructions.
          </p>
          <p className="mt-2">
            Traffic is encrypted in transit. Your session token is kept in your
            phone&apos;s protected credential storage. Uploaded files are held
            in private storage under unguessable identifiers, are checked
            against the account that owns them on every request, and are not
            cached by browsers or intermediaries.
          </p>
          <p className="mt-2">
            One honest limitation: the app also keeps a copy of your current
            record on your phone so it works offline. That copy sits in the
            app&apos;s private storage, which the operating system protects from
            other apps, but it is not separately encrypted by us. Treat it as
            you would any health information on an unlocked device.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">
            Sharing with other members
          </h2>
          <p className="mt-2">
            The Circle is off until you turn it on, and a connection requires
            both people to accept.
          </p>
          <p className="mt-2">
            Connected members see only how much of the current day&apos;s plan
            you have completed, how many days recently you did something, and —
            if you separately switch it on — your step count. They never see
            meals, meal photos, uploaded documents, check-ins, symptoms, mood,
            messages, your plan, or your real name unless you use it as your
            circle name.
          </p>
          <p className="mt-2">
            If you turn on discovery, other members can find you by your city or
            approximate area and see your chosen name, your optional line about
            yourself, and that area — nothing else until you accept a request.
            Either person can end a connection at any time, and every switch can
            be turned off. Deleting your account removes your connections and
            your listing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Your choices</h2>
          <p className="mt-2">
            You can export everything we hold about you, and delete your account
            and its records, from inside the app under You → Settings. Deletion
            is immediate and irreversible. If a file cannot be removed from
            storage at that moment, the app tells you so rather than reporting a
            clean deletion.
          </p>
          <p className="mt-2">
            You can revoke health access at any time in Apple Health or Health
            Connect, and turn location, discovery and activity sharing off in
            the app.
          </p>
          <p className="mt-2">
            <strong className="text-ink">A gap we should name:</strong> the
            consent choices made during sign-up cannot yet be changed from a
            settings screen afterwards. Until they can, ask us using the contact
            below and we will action it — and you can delete your account at any
            time without asking anyone.
          </p>
          <Link
            href="/account-deletion"
            className="mt-3 inline-block font-medium text-effort-stretch underline"
          >
            How to delete your account
          </Link>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">
            Keeping and deleting
          </h2>
          <p className="mt-2">
            Records are kept while your account exists, and while needed for
            account security or a legal requirement. Deleting your account
            removes your record, your uploaded files, your circle connections
            and your listing from our production systems. Backups rotate on
            their own schedule, so a copy may persist there briefly before
            ageing out.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Contact</h2>
          <p className="mt-2">
            For any question about this policy, to exercise your rights, or to
            raise a grievance:
          </p>
          {/* Deliberately not invented. A privacy notice has to name a route
              that actually reaches someone; publishing an address that bounces
              is worse than showing plainly that this is outstanding. */}
          <p className="mt-2 rounded-lg border border-dashed border-line bg-paper/60 px-4 py-3 text-ink">
            Contact details to be published before the service opens beyond the
            current private pilot.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">Changes</h2>
          <p className="mt-2">
            Material changes will be dated here and the version number raised.
            This is version {POLICY_VERSION}, effective {EFFECTIVE}.
          </p>
        </section>
      </div>
    </main>
  );
}
