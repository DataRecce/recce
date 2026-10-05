/**
 * Type bridge between @testing-library/jest-dom and Vitest 5.
 *
 * Vitest 5 changed `Assertion` to `Assertion<R, T>` and no longer reads custom
 * matcher declarations from the global `jest.Matchers` namespace. jest-dom's own
 * `Assertion<T>` augmentation therefore no longer merges, and matchers such as
 * `toBeInTheDocument` lose their types (testing-library/jest-dom#738).
 * Vitest 5's extension point is `Matchers<R, T>`.
 *
 * The runtime side is unchanged: `@testing-library/jest-dom/vitest` is still
 * imported in `vitest.setup.mts` and registers the matchers with `expect.extend`.
 *
 * The type parameter list must repeat Vitest's own declaration exactly, or
 * TypeScript rejects the augmentation.
 *
 * Remove this file once jest-dom ships Vitest 5 types.
 */

import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
