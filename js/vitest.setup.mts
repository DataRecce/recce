// Testing library matchers for Vitest
import "@testing-library/jest-dom/vitest";
import { beforeEach, type Mock, vi } from "vitest";

// ============================================================================
// Type Declarations
// ============================================================================

import React, { ReactNode } from "react";

interface MockRouter {
  push: Mock;
  replace: Mock;
  back: Mock;
  forward: Mock;
  refresh: Mock;
  prefetch: Mock;
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

// ============================================================================
// Polyfills for jsdom (same as current jest.setup.js)
// ============================================================================

// Polyfill for structuredClone (not available in jsdom)
// Required by Chakra UI v3 and other modern libraries
if (typeof structuredClone === "undefined") {
  (global as Record<string, unknown>).structuredClone = <T,>(obj: T): T =>
    JSON.parse(JSON.stringify(obj));
}

// Polyfill for ResizeObserver (not available in jsdom)
// Required by many UI libraries including Chakra UI
if (typeof ResizeObserver === "undefined") {
  (global as Record<string, unknown>).ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      /* void on purpose */
    }
    unobserve() {
      /* void on purpose */
    }
    disconnect() {
      /* void on purpose */
    }
  };
}

// Polyfill for matchMedia (not fully implemented in jsdom)
if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ============================================================================
// Next.js Navigation Mock
// ============================================================================

const mockRouter: MockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();
let mockParams: Record<string, string> = {};

vi.mock("next/navigation", () => {
  // Create the mock function inside the factory to avoid hoisting issues
  const useRouterMock = vi.fn(() => mockRouter);
  return {
    useRouter: useRouterMock,
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
    useParams: () => mockParams,
    notFound: vi.fn(),
    redirect: vi.fn(),
  };
});

// Export helpers to control mock state in tests
const mockNextNavigation: MockNextNavigation = {
  setPathname: (pathname: string) => {
    mockPathname = pathname;
  },
  setSearchParams: (params: string | Record<string, string>) => {
    mockSearchParams = new URLSearchParams(params);
  },
  setParams: (params: Record<string, string>) => {
    mockParams = params;
  },
  getRouter: () => mockRouter,
  reset: () => {
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
    mockParams = {};
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.back.mockClear();
    mockRouter.forward.mockClear();
    mockRouter.refresh.mockClear();
    mockRouter.prefetch.mockClear();
  },
};

// Make available globally
global.mockNextNavigation = mockNextNavigation;

// Reset mocks before each test
beforeEach(() => {
  global.mockNextNavigation.reset();
});

// ============================================================================
// Global Mocks for ESM-only Modules
// ============================================================================

// Mock react-markdown to avoid ESM issues
// Using simple string return instead of JSX to avoid parsing issues in .mts
vi.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

// Mock remark-gfm
vi.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => null,
}));

// Mock react-syntax-highlighter
// Using simple string return instead of JSX
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => children,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

// ag-grid-community is handled via alias in vitest.config.mts
// pointing to __mocks__/ag-grid-community.ts

// Mock react-icons/lu - returns simple span elements for used icons
vi.mock("react-icons/lu", () => {
  const createIconMock = (name: string) => {
    const IconComponent = (props: Record<string, unknown>) =>
      React.createElement("span", { "data-testid": name, ...props });
    IconComponent.displayName = name;
    return IconComponent;
  };

  // Explicitly export the icons that are used in the codebase
  return {
    LuChartBarBig: createIconMock("LuChartBarBig"),
    LuExternalLink: createIconMock("LuExternalLink"),
    LuSave: createIconMock("LuSave"),
  };
});

// Mock ag-grid-react for component rendering
vi.mock("ag-grid-react", () => {
  return {
    AgGridReact: ({ children }: { children?: ReactNode }) =>
      React.createElement(
        "div",
        { "data-testid": "ag-grid-mock" },
        children ?? null,
      ),
  };
});

// Note: ScreenshotDataGrid mock is handled via alias in vitest.config.mts
// pointing to packages/ui/src/components/data/__mocks__/ScreenshotDataGrid.tsx
