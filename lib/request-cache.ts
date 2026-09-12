import * as React from 'react';

/**
 * 011-module-navigation-performance (research.md §2): a thin wrapper around
 * React's `cache()` that degrades to a plain (uncached) function when `cache`
 * isn't available on the resolved `react` build.
 *
 * `cache()` is only exported by the special React build Next.js's own
 * bundler substitutes in for Server Components — the plain `react` package
 * in node_modules (what Vitest resolves when a test imports a module that
 * uses this) does not export it at all. Without this guard, any test file
 * that imports `getUserContext()` (or anything else wrapped this way) would
 * crash at import time with "cache is not a function" the moment it runs
 * outside Next.js's own build — exactly the environment
 * tests/integration/*.test.ts run in.
 *
 * In the real app (Next.js dev/build/runtime), `React.cache` is present, so
 * this still gets real per-request memoization. Under Vitest, it silently
 * falls back to calling the function directly every time — no caching, but
 * fully callable and testable, which is what tests/integration/get-user-
 * context.test.ts (Constitution Principle III gate) relies on.
 */
export function requestCache<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const cacheFn = (React as { cache?: <T extends (...a: never[]) => unknown>(f: T) => T }).cache;
  return typeof cacheFn === 'function' ? cacheFn(fn) : fn;
}
