import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete Your Account — Bharosa Wellness",
};

export default function AccountDeletion() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12 text-ink">
      <p className="label text-effort-stretch">BHAROSA WELLNESS</p>
      <h1 className="mt-3 font-display text-4xl">Delete your account</h1>
      <p className="mt-5 text-[16px] leading-7 text-ink-soft">
        You can delete your account yourself, from inside the app. Open{" "}
        <strong className="font-semibold text-ink">You</strong>, find{" "}
        <strong className="font-semibold text-ink">Your data</strong>, and
        choose{" "}
        <strong className="font-semibold text-ink">
          Delete my account and data
        </strong>
        . You will be asked for your password to confirm. Deletion happens
        immediately and cannot be undone.
      </p>
      <p className="mt-4 text-[16px] leading-7 text-ink-soft">
        The same screen offers{" "}
        <strong className="font-semibold text-ink">
          Download a copy of my data
        </strong>
        , so you can keep your own record before you remove it.
      </p>
      <p className="mt-4 text-[16px] leading-7 text-ink-soft">
        If you would rather not do it yourself, send your coach an
        account-deletion request through the coaching conversation in the app,
        including the username used to sign in. For security, the coach will
        confirm the request with you before removing the account.
      </p>
      <div className="mt-8 rounded-2xl bg-paper-sunk p-5">
        <h2 className="font-semibold">What will be deleted</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          The production account and its member record, including check-ins,
          activity history, messages, coaching-plan data, nutrition and workout
          logs, uploaded report records, and the associated private report or
          meal-photo files. Limited information may be retained only where
          required by law or until protected backup copies complete their normal
          rotation.
        </p>
      </div>
      <p className="mt-8 text-sm leading-6 text-ink-soft">
        If you cannot sign in, contact your coach through the same channel used
        to receive your programme invitation and ask for an account-deletion
        request to be opened.
      </p>
      <Link
        href="/privacy"
        className="mt-8 inline-block font-medium text-effort-stretch underline"
      >
        Read the privacy policy
      </Link>
    </main>
  );
}
