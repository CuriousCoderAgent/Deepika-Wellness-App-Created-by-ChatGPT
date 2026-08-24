/**
 * Move one or more top-level components out of App.tsx into a screen module.
 *
 * Usage: node scripts/_extract.mjs <outfile> <Name> [<Name>...]
 *
 * Moves the source verbatim, writes a module with a resolved import header,
 * and adds the import back into App.tsx. Anything it cannot place is reported
 * so it can be added by hand rather than guessed at.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const [out, ...names] = process.argv.slice(2);
if (!out || !names.length) throw new Error("usage: <outfile> <Name>...");

const APP = "C:/bharosa/mobile/App.tsx";
const raw = readFileSync(APP, "utf8");
const crlf = raw.includes("\r\n");
let app = crlf ? raw.replace(/\r\n/g, "\n") : raw;

/** Where every top-level declaration begins, so a block can be sliced out. */
const boundaries = () => {
  const lines = app.split("\n");
  const marks = [];
  lines.forEach((line, i) => {
    if (/^(function|const|type|interface|class) [A-Za-z]/.test(line))
      marks.push(i);
  });
  marks.push(lines.length);
  return { lines, marks };
};

const taken = [];
for (const name of names) {
  const { lines, marks } = boundaries();
  const startLine = lines.findIndex((l) =>
    new RegExp(`^(function|const) ${name}\\b`).test(l),
  );
  if (startLine === -1) throw new Error("not found: " + name);
  /* Carry any doc comment sitting directly above it. */
  let from = startLine;
  if (lines[from - 1]?.endsWith("*/")) {
    let i = from - 1;
    while (i > 0 && !lines[i].startsWith("/**")) i -= 1;
    from = i;
  }
  const end = marks.find((m) => m > startLine);
  const block = lines.slice(from, end).join("\n").replace(/\n+$/, "");
  taken.push(block);
  app = lines.slice(0, from).concat(lines.slice(end)).join("\n");
}

/* Where a bare identifier comes from. */
const SOURCES = {
  "react-native": "Alert ActivityIndicator FlatList Image Keyboard Linking Modal Platform Pressable RefreshControl ScrollView StyleSheet Switch Text TextInput View useWindowDimensions".split(" "),
  react: "useCallback useEffect useMemo useRef useState useContext createContext memo".split(" "),
  "./ui": ["Card", "useScrollToTop", "ScrollTopContext"],
  "./design/styles": ["s"],
  "./design/tokens": ["C", "SURFACES", "TEXT_COLOURS"],
};

const header = (body) => {
  const need = (list) => list.filter((n) => new RegExp(`\\b${n}\\b`).test(body));
  const parts = [];
  const rn = need(SOURCES["react-native"]);
  const rc = need(SOURCES.react);
  if (rc.length) parts.push(`import { ${rc.sort().join(", ")} } from "react";`);
  if (rn.length)
    parts.push(`import { ${rn.sort().join(", ")} } from "react-native";`);
  const ui = need(SOURCES["./ui"]);
  if (ui.length) parts.push(`import { ${ui.sort().join(", ")} } from "./ui";`);
  if (/\bs\./.test(body)) parts.push(`import { s } from "./design/styles";`);
  if (/\bC\./.test(body)) parts.push(`import { C } from "./design/tokens";`);
  return parts.join("\n");
};

const body = taken.join("\n\n");
const file = `${header(body)}\n\n${body}\n`;
writeFileSync(out, crlf ? file.replace(/\n/g, "\r\n") : file);

/* Import them back into App.tsx, after the ui import. */
const rel = "./" + out.replace(/^C:\/bharosa\/mobile\//, "").replace(/\.tsx$/, "");
app = app.replace(
  `import { Card, ScrollTopContext, useScrollToTop } from "./src/ui";`,
  `import { Card, ScrollTopContext, useScrollToTop } from "./src/ui";\nimport { ${names.join(", ")} } from "${rel}";`,
);
writeFileSync(APP, crlf ? app.replace(/\n/g, "\r\n") : app);

/* Export them from the new module. */
let mod = readFileSync(out, "utf8");
for (const name of names)
  mod = mod.replace(
    new RegExp(`^(function|const) ${name}\\b`, "m"),
    (m) => "export " + m,
  );
writeFileSync(out, mod);

console.log(`moved ${names.join(", ")} -> ${rel}`);
try {
  execSync("npm --prefix mobile run typecheck", {
    cwd: "C:/bharosa",
    stdio: "pipe",
  });
  console.log("typecheck clean");
} catch (e) {
  const errs = String(e.stdout ?? "")
    .split("\n")
    .filter((l) => /error TS/.test(l));
  const missing = new Set();
  for (const line of errs) {
    const m = line.match(/Cannot find name '([^']+)'/);
    if (m) missing.add(m[1]);
  }
  console.log(
    missing.size
      ? "\nstill needs: " + [...missing].sort().join(", ")
      : "\n" + errs.slice(0, 12).join("\n"),
  );
}
