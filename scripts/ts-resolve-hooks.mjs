/**
 * Lets Node follow the extensionless relative imports TypeScript uses.
 *
 * `import { x } from "./y"` is normal TypeScript and is what the bundler
 * expects, but Node's ESM resolver requires a real filename. Rather than
 * contort the application code to suit the test runner, this appends `.ts`
 * when — and only when — the specifier fails to resolve on its own.
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    throw error;
  }
}
