"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Radar,
  Users,
  CalendarDays,
  Library,
  MessagesSquare,
  Bell,
  MessageSquareWarning,
  LogOut,
} from "lucide-react";
import { useStore } from "@/lib/store";

const nav = [
  { href: "/coach", label: "Radar", icon: Radar, hint: "Who needs me today" },
  { href: "/coach/members", label: "Members", icon: Users, hint: "The cohort" },
  { href: "/coach/sessions", label: "Sessions", icon: CalendarDays, hint: "Today's 1:1s" },
  { href: "/coach/library", label: "Library", icon: Library, hint: "Reusable modules" },
  { href: "/coach/messages", label: "Messages", icon: MessagesSquare, hint: "Conversations" },
  { href: "/coach/notifications", label: "Notifications", icon: Bell, hint: "Trigger → copy" },
  { href: "/coach/feedback", label: "Pilot feedback", icon: MessageSquareWarning, hint: "Bugs and ideas" },
];

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { radar, messages } = useStore();

  const attention = radar.filter((r) => r.bucket === "attention" && !r.resolved).length;
  const unread = messages.filter((m) => m.from === "member" && !m.read).length;

  return (
    /* Column on a phone, row on a desktop. The sidebar is the only child that
       belongs beside the content, and it only exists at lg — so stacking below
       that keeps the mobile header full-width above the page instead of
       becoming a second column next to it. */
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-line bg-paper-card lg:flex">
        <div className="px-5 pt-6">
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink"
            >
              <LogOut size={13} /> Sign out
            </button>
          </form>
          <p className="label mt-4">Coach console</p>
          <p className="mt-1 font-display text-xl leading-tight">Deepika</p>
        </div>

        <nav className="mt-6 flex-1 px-3">
          {nav.map((n) => {
            const active = path === n.href || (n.href !== "/coach" && path.startsWith(n.href));
            const Icon = n.icon;
            const badge =
              n.label === "Radar" ? attention : n.label === "Messages" ? unread : 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-ink text-white"
                    : "text-ink-soft hover:bg-paper-sunk hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1">{n.label}</span>
                {badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-attention-tint text-attention"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-line p-4">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Vision prototype. Fictional members, no real health data.
          </p>
        </div>
      </aside>

      {/* Mobile header. The sidebar holds the only way to sign out, and it is
          hidden below lg — which left Deepika signed in on her phone with no
          way out short of clearing cookies. */}
      <div
        className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-ink-line bg-paper-card/95 px-4 py-2.5 backdrop-blur lg:hidden"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
      >
        <div>
          <p className="label">Coach console</p>
          <p className="font-display text-lg leading-tight">Deepika</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="tap inline-flex items-center gap-1.5 rounded-xl px-3 text-[13px] text-ink-soft hover:bg-paper-sunk hover:text-ink"
          >
            <LogOut size={15} /> Sign out
          </button>
        </form>
      </div>

      {/* Mobile nav */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-ink-line bg-paper-card/95 backdrop-blur lg:hidden">
        <div className="scroll-hide flex overflow-x-auto">
          {nav.map((n) => {
            const active = path === n.href || (n.href !== "/coach" && path.startsWith(n.href));
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex min-w-[76px] flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${
                  active ? "text-ink" : "text-ink-faint"
                }`}
              >
                <Icon size={17} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
    </div>
  );
}
