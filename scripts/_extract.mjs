/**
 * Move top-level components out of App.tsx into a screen module.
 *
 * Usage: node scripts/_extract.mjs <outfile> <Name> [<Name>...]
 *
 * Import resolution comes from App.tsx's own import block rather than a table
 * kept here: whatever the file already imports a name from is where the moved
 * code should import it from too, with relative paths rebased. Anything left
 * unresolved is reported rather than guessed at.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const [out, ...names] = process.argv.slice(2);
if (!out || !names.length) throw new Error("usage: <outfile> <Name>...");

const APP = "C:/bharosa/mobile/App.tsx";
const raw = readFileSync(APP, "utf8");
const crlf = raw.includes("\r\n");
let app = crlf ? raw.replace(/\r\n/g, "\n") : raw;

/* ---- what App.tsx imports, and from where ------------------------- */
const origin = new Map(); // name -> { from, isType }
for (const m of app.matchAll(/^import\s+(type\s+)?\{([^}]+)\}\s+from\s+"([^"]+)";/gms)) {
  const from = m[3];
  const blockIsType = Boolean(m[1]);
  for (const raw of m[2].split(",")) {
    const piece = raw.trim();
    if (!piece) continue;
    const isType = blockIsType || /^type\s/.test(piece);
    const name = piece.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
    if (name) origin.set(name, { from, isType });
  }
}
for (const m of app.matchAll(/^import\s+\*\s+as\s+(\w+)\s+from\s+"([^"]+)";/gm))
  origin.set(m[1], { from: m[2], isType: false, star: true });

/**
 * A relative import written from App.tsx, rewritten for the new file.
 *
 * App.tsx sits at mobile/; a screen module sits deeper. "./src/api" has to
 * become "../api" from mobile/src/screens/, and the depth is not fixed.
 */
const MOBILE = "C:/bharosa/mobile";
const rebase = (from) => {
  if (!from.startsWith(".")) return from;
  const target = path.resolve(MOBILE, from);
  let rel = path.relative(path.dirname(out), target).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
};

/* ---- slice the components out ------------------------------------- */
const boundaries = () => {
  const lines = app.split("\n");
  const marks = [];
  lines.forEach((line, i) => {
    if (/^(function|const|type|interface|class|export) [A-Za-z*]/.test(line))
      marks.push(i);
  });
  marks.push(lines.length);
  return { lines, marks };
};

const taken = [];
for (const name of names) {
  const { lines, marks } = boundaries();
  const startLine = lines.findIndex((l) =>
    new RegExp(`^(function|const|type|interface) ${name}\\b`).test(l),
  );
  if (startLine === -1) throw new Error("not found: " + name);
  let from = startLine;
  if (lines[from - 1]?.trimEnd().endsWith("*/")) {
    let i = from - 1;
    while (i > 0 && !lines[i].trimStart().startsWith("/*")) i -= 1;
    from = i;
  }
  const end = marks.find((m) => m > startLine) ?? lines.length;
  taken.push(lines.slice(from, end).join("\n").replace(/\n+$/, ""));
  app = lines.slice(0, from).concat(lines.slice(end)).join("\n");
}
const body = taken.join("\n\n");

/* ---- build the header from what the body actually references ------- */
const moved = new Set(names);
const used = new Set();
for (const m of body.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) used.add(m[0]);

const byModule = new Map();
for (const name of used) {
  if (moved.has(name)) continue;
  const src = origin.get(name);
  if (!src) continue;
  const key = rebase(src.from);
  if (!byModule.has(key)) byModule.set(key, { value: [], type: [], star: null });
  if (src.star) byModule.get(key).star = name;
  else byModule.get(key)[src.isType ? "type" : "value"].push(name);
}

const order = ["react", "react-native"];
const lines = [];
for (const key of [...byModule.keys()].sort((a, b) => {
  const ai = order.indexOf(a), bi = order.indexOf(b);
  if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  const rel = (x) => (x.startsWith(".") ? 1 : 0);
  return rel(a) - rel(b) || a.localeCompare(b);
})) {
  const g = byModule.get(key);
  if (g.star) lines.push(`import * as ${g.star} from "${key}";`);
  const both = [
    ...g.value.sort(),
    ...g.type.sort().map((t) => `type ${t}`),
  ];
  if (both.length) lines.push(`import { ${both.join(", ")} } from "${key}";`);
}

const file = `${lines.join("\n")}\n\n${body}\n`;
writeFileSync(out, crlf ? file.replace(/\n/g, "\r\n") : file);

/* ---- export them, and import them back ---------------------------- */
let mod = readFileSync(out, "utf8");
for (const name of names)
  mod = mod.replace(
    new RegExp(`^(function|const|type|interface) ${name}\\b`, "m"),
    (m) => "export " + m,
  );
writeFileSync(out, mod);

const rel = "./" + out.replace("C:/bharosa/mobile/", "").replace(/\.tsx$/, "");
const anchor = `import { Card, ScrollTopContext, useScrollToTop } from "./src/ui";`;
if (!app.includes(anchor)) throw new Error("ui import anchor missing");
app = app.replace(
  anchor,
  `${anchor}\nimport { ${names.join(", ")} } from "${rel}";`,
);
writeFileSync(APP, crlf ? app.replace(/\n/g, "\r\n") : app);

console.log(`moved ${names.join(", ")} -> ${rel}`);
try {
  execSync("npm --prefix mobile run typecheck", { cwd: "C:/bharosa", stdio: "pipe" });
  console.log("typecheck clean");
} catch (e) {
  const errs = String(e.stdout ?? "").split("\n").filter((l) => /error TS/.test(l));
  const missing = new Set();
  for (const line of errs) {
    const m = line.match(/Cannot find name '([^']+)'/);
    if (m) missing.add(m[1]);
  }
  console.log(missing.size ? "unresolved: " + [...missing].sort().join(", ") : "");
  console.log(errs.slice(0, 10).join("\n"));
}
