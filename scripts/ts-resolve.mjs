// Installs the resolver hook for `npm test`. See ts-resolve-hooks.mjs.
import { register } from "node:module";
register("./ts-resolve-hooks.mjs", import.meta.url);
