import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Structure — deep indigo-slate. Reads as evening, not corporate black.
        ink: {
          DEFAULT: "#15232F",
          // Darkened from the original #4A5D70/#8595A5 pair — the Aug 2026
          // design review flagged secondary/meta text as washed out. Three
          // tones, each still visibly distinct from the next.
          soft: "#3D4F60",
          faint: "#6B7A8A",
          line: "#E2E0DA",
        },
        paper: {
          DEFAULT: "#F7F4EE",
          card: "#FFFFFF",
          sunk: "#EFEDE8",
        },
        // The effort ramp. Minimum is a real, filled, valid colour — never grey.
        effort: {
          min: "#A8C2B4",
          minInk: "#4F7060",
          target: "#6E8F73",
          stretch: "#3F6B57",
          tint: "#E9F0EA",
        },
        // Reserved for Deepika's human voice — a deliberate choice, not a
        // hard rule: it's the one signal that lets a member tell a human
        // from the system at a glance, so nothing else claims this hue.
        marigold: {
          DEFAULT: "#D99A2B",
          deep: "#A9741A",
          tint: "#FBF1DC",
        },
        // Rest / not-today. Deliberately neutral, not a failure state.
        rest: {
          DEFAULT: "#B9B6AE",
          tint: "#F0EEE9",
        },
        // Muted rust, not alarm-red — Radar "needs attention", self-reported
        // "Stressed" mood. Warm enough to register, not saturated enough to
        // read as a system failure.
        attention: {
          DEFAULT: "#B4674A",
          tint: "#F8EDE8",
        },
        // A cool, calm tone for self-reported "Tired" — distinct from
        // attention/rust without borrowing marigold or introducing lavender.
        // Shares a family with the sleep sparkline already used in Progress.
        calm: {
          DEFAULT: "#6E8FB0",
          tint: "#EAF0F6",
        },
        // Navigation, and navigation only.
        //
        // Deliberately outside the effort ramp. Everything green in this app
        // means something about effort — minimum, target, stretch — and the
        // bottom bar was borrowing `effort.stretch` for "you are on this tab",
        // which quietly said "stretch" five times a day for no reason. Purple
        // and turquoise carry no meaning here beyond where you are, which is
        // exactly what navigation should say and nothing more.
        //
        // Microsoft Teams purple, and a turquoise darkened until it holds up:
        // plain #40E0D0 measures 1.8:1 on white and is unreadable at the 10px
        // the tab labels use. #0B7F7A measures 4.9:1.
        nav: {
          DEFAULT: "#6264A7",
          active: "#0B7F7A",
          tint: "#E4F2F1",
        },
        // Genuine system errors only (a save that failed, a required field).
        // Never used for a missed action or an honest "not today" — that
        // distinction is the whole reason `rest` and `danger` are separate
        // tokens instead of one red for everything.
        danger: {
          DEFAULT: "#C24A42",
          tint: "#FBECEA",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Base bumped for the 40+ audience.
        base: ["1.0625rem", { lineHeight: "1.6" }],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,43,58,0.04), 0 8px 24px -12px rgba(28,43,58,0.12)",
        lift: "0 2px 4px rgba(28,43,58,0.06), 0 20px 40px -20px rgba(28,43,58,0.22)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fill: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        rise: "rise .5s cubic-bezier(.16,.84,.44,1) both",
        fill: "fill .6s cubic-bezier(.16,.84,.44,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
