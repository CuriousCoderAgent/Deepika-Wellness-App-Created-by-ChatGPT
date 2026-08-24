import { readFileSync, writeFileSync } from "node:fs";

const edit = (path, pairs) => {
  const raw = readFileSync(path, "utf8");
  const crlf = raw.includes("\r\n");
  let s = crlf ? raw.replace(/\r\n/g, "\n") : raw;
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error("miss in " + path + ": " + a.slice(0, 60));
    s = s.replace(a, () => b);
  }
  writeFileSync(path, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("  " + path);
};

/* ------------------------------------------------------------------ *
 * Styles for the hub.
 * ------------------------------------------------------------------ */
edit("C:/bharosa/mobile/src/design/styles.ts", [
  [
    `  cardTitle: { color: C.ink, fontSize: 15, fontWeight: "700" },`,
    `  cardTitle: { color: C.ink, fontSize: 15, fontWeight: "700" },
  cardCopy: { color: C.soft, fontSize: 13, lineHeight: 19, marginTop: 6 },

  /* ---------------------------------------------------------------- */
  /* The Log hub                                                       */
  /*                                                                   */
  /* Four capture cards in a two-by-two grid rather than a list: they  */
  /* are peers, and a list would imply an order she should follow.     */
  /* ---------------------------------------------------------------- */
  captureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 18,
  },
  captureCard: {
    /* Two per row, accounting for the gap. */
    width: "48%",
    flexGrow: 1,
    minHeight: 116,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    padding: 14,
    justifyContent: "flex-start",
  },
  captureIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  captureLabel: { color: C.ink, fontSize: 15, fontWeight: "800" },
  captureDetail: {
    color: C.faint,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  /* Quiet on purpose: it marks what she has given, never what she owes. */
  captureDone: {
    color: C.green,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },
  quickCaptureCard: { marginTop: 18 },
  quickModeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  quickModeChip: {
    flex: 1,
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  quickModeChipActive: {
    backgroundColor: C.greenDeep,
    borderColor: C.greenDeep,
  },
  quickModeText: { color: C.soft, fontSize: 13, fontWeight: "700" },
  quickModeTextActive: { color: "white", fontWeight: "800" },
  /* The "· today" after a feed row's title. */
  feedWhen: { color: C.faint, fontSize: 12, fontWeight: "600" },
  removeLink: { color: C.marigoldInk, fontSize: 12, fontWeight: "700" },`,
  ],
]);

/* ------------------------------------------------------------------ *
 * App.tsx: imports and the Food prop.
 * ------------------------------------------------------------------ */
edit("C:/bharosa/mobile/App.tsx", [
  /* Icons. */
  [`  PencilLine,\n`, ``],
  [`  Home,\n`, `  Activity,\n  Dumbbell,\n  Home,\n  PencilLine,\n  PlusCircle,\n`],
  /* Feed helpers. */
  [
    `import { AWARDS, awardMetrics, type AwardIcon } from "./src/awards";`,
    `import { AWARDS, awardMetrics, type AwardIcon } from "./src/awards";
import {
  buildLogFeed,
  loggedToday,
  whenLabel,
  type LogKind,
} from "./src/log-feed";`,
  ],
  /* Food accepts a starting mode, so the hub's quick buttons mean something. */
  [
    `function Food({
  doc,
  update,
  token,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
}) {`,
    `function Food({
  doc,
  update,
  token,
  startMode,
}: {
  doc: MemberDoc;
  update: (doc: MemberDoc) => void;
  token: string;
  /**
   * Which capture the Log hub's quick buttons asked for.
   *
   * Only an opening position — she can still switch once she is here, and
   * the screen behaves identically when it is absent.
   */
  startMode?: "photo" | "describe";
}) {`,
  ],
]);
