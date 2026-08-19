"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Bottom sheet.
 *
 * Portals into `#sheet-root`, which lives inside the phone shell — so on a
 * desktop the sheet stays inside the phone frame instead of covering the
 * whole browser window, and on a real phone it fills the screen the way a
 * native sheet does.
 *
 * Behaviour it needs to get right, per the design review: dismissable by
 * backdrop tap, by the grab handle, by Escape; it traps nothing it shouldn't
 * but does return focus; and it honours prefers-reduced-motion, which the
 * global stylesheet already enforces on the transition.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById("sheet-root"));
  }, []);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Give the sheet focus so screen readers and keyboards land inside it.
    const t = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      returnFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!host) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end transition-opacity duration-200 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <button
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`safe-bottom relative max-h-[88%] overflow-y-auto overscroll-contain rounded-t-[1.5rem] bg-paper-card shadow-lift outline-none transition-transform duration-300 ease-[cubic-bezier(.16,.84,.44,1)] ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Grab handle — the affordance people reach for before they look for
            a close button. Tapping it dismisses too. */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="sticky top-0 z-10 flex w-full justify-center bg-paper-card/95 pb-1 pt-2.5 backdrop-blur"
        >
          <span className="h-1 w-9 rounded-full bg-ink-line" />
        </button>

        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-1">
          <h2 className="text-[17px] font-semibold leading-snug">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="tap -mr-2 -mt-1.5 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>,
    host
  );
}
