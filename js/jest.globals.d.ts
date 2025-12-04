/**
 * Jest type declarations
 *
 * This file extends Jest's types with:
 * - @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 * - Custom mock helpers for Next.js navigation
 */

import "@testing-library/jest-dom";

interface MockRouter {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  forward: jest.Mock;
  refresh: jest.Mock;
  prefetch: jest.Mock;
}

interface MockNextNavigation {
  setPathname: (pathname: string) => void;
  setSearchParams: (params: string | Record<string, string>) => void;
  setParams: (params: Record<string, string>) => void;
  getRouter: () => MockRouter;
  reset: () => void;
}

declare global {
  var mockNextNavigation: MockNextNavigation;
}

export {};
