import type { Metadata } from "next";
import { Sprout } from "lucide-react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password · Bharosa Wellness",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-paper">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-marigold/[0.10] blur-3xl" />
        <div className="absolute -right-28 top-24 h-[26rem] w-[26rem] rounded-full bg-effort-min/25 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-14">
        <header className="text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-effort-tint text-effort-stretch">
            <Sprout size={21} strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[2.1rem] leading-[1.1] tracking-tight">
            Reset your password
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
            Choose a private password for your Bharosa Wellness account.
          </p>
        </header>
        <div className="mt-8 rounded-2xl border border-ink-line bg-paper-card p-5 shadow-sm">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
