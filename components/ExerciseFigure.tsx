import type { MovementFigure } from "@/lib/types";

/**
 * Line-drawn figures for each movement pattern.
 *
 * Drawn as inline SVG rather than photographed or illustrated bitmaps, for
 * reasons that are practical rather than aesthetic: they are sharp at any
 * size on any screen, they add no network requests to a page a woman might
 * open on patchy mobile data mid-session, they take the theme's colours, and
 * there is no licensing question about who is in the picture.
 *
 * They are not a substitute for Deepika teaching a movement in person. They
 * exist so that when she is not there, "half-kneeling press" is a shape you
 * recognise rather than three words you have to guess at.
 */

const STROKE = { stroke: "currentColor", strokeWidth: 3.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const GHOST = { stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none", opacity: 0.28 };

/** A dumbbell / kettlebell mass. */
function Weight({ x, y, r = 5 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="currentColor" opacity={0.55} />;
}

function Ground() {
  return <line x1={8} y1={92} x2={92} y2={92} stroke="currentColor" strokeWidth={2} opacity={0.18} strokeLinecap="round" />;
}

function Figure({ figure }: { figure: MovementFigure }) {
  switch (figure) {
    case "goblet-squat":
      return (
        <>
          <Ground />
          {/* standing ghost behind the squat position */}
          <g {...GHOST}>
            <circle cx={50} cy={22} r={6} />
            <path d="M50 28 L50 56 M50 56 L46 92 M50 56 L56 92" />
          </g>
          <g {...STROKE}>
            <circle cx={47} cy={30} r={6.5} />
            <path d="M47 37 L42 60" />
            <path d="M42 60 L60 66 L57 92" />
            <path d="M42 60 L40 78 L44 92" />
            <path d="M47 42 L55 47" />
          </g>
          <Weight x={57} y={48} />
        </>
      );

    case "hip-hinge":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={70} cy={38} r={6.5} />
            <path d="M64 41 L38 55" />
            <path d="M38 55 L44 72 L44 92" />
            <path d="M38 55 L36 73 L38 92" />
            <path d="M60 44 L58 62" />
          </g>
          {/* the dowel: three points of contact along the spine */}
          <line x1={74} y1={33} x2={35} y2={54} stroke="currentColor" strokeWidth={2.4} opacity={0.5} strokeLinecap="round" />
        </>
      );

    case "incline-push-up":
      return (
        <>
          <Ground />
          {/* raised surface */}
          <path d="M62 58 L92 58 L92 92 L62 92 Z" fill="currentColor" opacity={0.1} />
          <line x1={62} y1={58} x2={92} y2={58} stroke="currentColor" strokeWidth={2.6} opacity={0.4} strokeLinecap="round" />
          <g {...STROKE}>
            <circle cx={66} cy={48} r={6.5} />
            <path d="M61 52 L30 78" />
            <path d="M64 54 L70 58" />
            <path d="M30 78 L20 90" />
          </g>
        </>
      );

    case "suitcase-carry":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={48} cy={22} r={6.5} />
            <path d="M48 29 L48 58" />
            <path d="M48 58 L43 92" />
            <path d="M48 58 L54 92" />
            <path d="M48 34 L58 56" />
            <path d="M48 34 L39 54" />
          </g>
          <Weight x={59} y={64} r={6} />
        </>
      );

    case "split-squat":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={48} cy={26} r={6.5} />
            <path d="M48 33 L47 58" />
            {/* front leg, bent */}
            <path d="M47 58 L64 68 L64 92" />
            {/* back leg, knee toward the floor */}
            <path d="M47 58 L34 78 L26 88" />
            <path d="M48 38 L60 50" />
          </g>
          {/* the chair you hold for as long as you need */}
          <line x1={72} y1={48} x2={72} y2={92} stroke="currentColor" strokeWidth={2.4} opacity={0.35} strokeLinecap="round" />
          <line x1={66} y1={48} x2={80} y2={48} stroke="currentColor" strokeWidth={2.4} opacity={0.35} strokeLinecap="round" />
        </>
      );

    case "romanian-deadlift":
      return (
        <>
          <Ground />
          <g {...GHOST}>
            <circle cx={52} cy={22} r={6} />
            <path d="M52 28 L50 56 M50 56 L46 92 M50 56 L55 92" />
          </g>
          <g {...STROKE}>
            <circle cx={68} cy={40} r={6.5} />
            <path d="M62 43 L40 56" />
            <path d="M40 56 L44 74 L44 92" />
            <path d="M40 56 L38 74 L38 92" />
            <path d="M58 46 L52 66" />
          </g>
          <Weight x={50} y={70} />
        </>
      );

    case "half-kneeling-press":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={48} cy={38} r={6.5} />
            <path d="M48 45 L48 66" />
            {/* front foot planted */}
            <path d="M48 66 L62 72 L62 92" />
            {/* back knee down */}
            <path d="M48 66 L36 84 L28 92" />
            {/* pressing arm overhead */}
            <path d="M48 48 L54 26" />
          </g>
          <Weight x={55} y={20} />
        </>
      );

    case "farmer-carry":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={50} cy={22} r={6.5} />
            <path d="M50 29 L50 58" />
            <path d="M50 58 L45 92" />
            <path d="M50 58 L56 92" />
            <path d="M50 34 L38 54" />
            <path d="M50 34 L62 54" />
          </g>
          <Weight x={36} y={62} r={6} />
          <Weight x={64} y={62} r={6} />
        </>
      );

    case "cat-cow":
      return (
        <>
          <Ground />
          {/* rounded (cat) as the ghost, neutral/extended as the solid */}
          <g {...GHOST}>
            <path d="M30 62 Q50 44 72 60" />
          </g>
          <g {...STROKE}>
            <circle cx={76} cy={62} r={6} />
            <path d="M70 60 Q50 54 30 62" />
            {/* arms */}
            <path d="M68 62 L68 88" />
            {/* legs */}
            <path d="M32 62 L32 88" />
            <path d="M32 62 L40 74" />
          </g>
        </>
      );

    case "hip-switch":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={50} cy={30} r={6.5} />
            <path d="M50 37 L50 62" />
            {/* one shin forward, one behind — the 90/90 shape */}
            <path d="M50 62 L74 62 L74 78" />
            <path d="M50 62 L28 68 L28 82" />
            <path d="M50 44 L62 54" />
          </g>
        </>
      );

    case "thoracic-opener":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            {/* side-lying, top arm sweeping open */}
            <circle cx={26} cy={72} r={6.5} />
            <path d="M33 72 L66 72" />
            <path d="M66 72 L78 84" />
            <path d="M66 72 L76 60" />
            {/* the arm that follows your eyes */}
            <path d="M36 70 L54 40" />
          </g>
          <g {...GHOST}>
            <path d="M36 70 L60 66" />
          </g>
        </>
      );

    case "standing-stretch":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={44} cy={30} r={6.5} />
            <path d="M44 37 L42 58" />
            {/* front leg straight, heel down */}
            <path d="M42 58 L66 84 L74 88" />
            {/* back leg supporting */}
            <path d="M42 58 L36 92" />
            {/* reaching toward the front foot */}
            <path d="M44 42 L60 62" />
          </g>
        </>
      );

    case "walk":
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={48} cy={24} r={6.5} />
            <path d="M48 31 L47 56" />
            <path d="M47 56 L60 74 L64 90" />
            <path d="M47 56 L34 74 L30 90" />
            <path d="M48 36 L60 46" />
            <path d="M48 36 L36 48" />
          </g>
        </>
      );

    default:
      return (
        <>
          <Ground />
          <g {...STROKE}>
            <circle cx={50} cy={26} r={6.5} />
            <path d="M50 33 L50 60 M50 60 L44 90 M50 60 L56 90 M50 40 L38 52 M50 40 L62 52" />
          </g>
        </>
      );
  }
}

/**
 * Movements that have a supplied artwork file in `public/exercises/`.
 *
 * Add a key here once `public/exercises/<key>.png` exists and that movement
 * renders the image instead of the drawing. Anything not listed keeps its
 * SVG, so the set can be swapped over one at a time without a half-finished
 * screen — and if a supplied image ever turns out wrong, deleting one line
 * puts the drawing back.
 */
const HAS_ARTWORK: Partial<Record<MovementFigure, true>> = {
  // "goblet-squat": true,
};

export default function ExerciseFigure({
  figure = "generic",
  size = 56,
  className = "text-effort-stretch",
}: {
  figure?: MovementFigure;
  size?: number;
  className?: string;
}) {
  if (HAS_ARTWORK[figure]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/exercises/${figure}.png`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <Figure figure={figure} />
    </svg>
  );
}
