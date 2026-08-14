/**
 * Development-only logging. No-op in production builds (NODE_ENV is set
 * to "production" automatically by `next build`/`next start`), so user
 * input, Understanding state, question/reflection text, and Observation
 * data never reach production logs.
 */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
