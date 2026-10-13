// Test-only module resolution: lets Node load the site's TypeScript modules directly, which import their
// siblings without an extension (as Next allows). An extensionless relative import is tried as `.ts`.
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+(\?.*)?$/i.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      /* not a .ts sibling: fall through to the default resolution */
    }
  }
  return next(specifier, context);
}
