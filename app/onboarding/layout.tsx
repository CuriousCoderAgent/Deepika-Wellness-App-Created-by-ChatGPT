/**
 * Onboarding lives outside the member tab shell on purpose: it is a linear
 * flow, and a bottom navigation bar during it would invite people to wander
 * off halfway through setting up their own plan.
 *
 * Same phone framing as the rest of the member app so it doesn't feel like a
 * different product.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper-sunk/60">
      <div className="flex min-h-0 flex-1 justify-center sm:items-center sm:p-4">
        <div
          className="relative flex w-full flex-col overflow-hidden bg-paper shadow-lift sm:h-[760px] sm:max-h-full sm:rounded-[2.25rem] sm:border-[10px] sm:border-ink"
          style={{ maxWidth: "var(--phone-reference)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
