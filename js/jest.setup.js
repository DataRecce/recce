// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Polyfill for structuredClone (not available in jsdom)
// Required by Chakra UI v3 and other modern libraries
if (typeof structuredClone === "undefined") {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Polyfill for ResizeObserver (not available in jsdom)
// Required by many UI libraries including Chakra UI
if (typeof ResizeObserver === "undefined") {
  global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Polyfill for matchMedia (not fully implemented in jsdom)
if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock next/navigation for App Router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();
let mockParams = {};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useParams: () => mockParams,
  notFound: jest.fn(),
  redirect: jest.fn(),
}));

// Export helpers to control mock state in tests
global.mockNextNavigation = {
  setPathname: (pathname) => {
    mockPathname = pathname;
  },
  setSearchParams: (params) => {
    mockSearchParams = new URLSearchParams(params);
  },
  setParams: (params) => {
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

// Reset mocks before each test
beforeEach(() => {
  global.mockNextNavigation.reset();
});

// ============================================================================
// Global mocks for ESM-only modules
// ============================================================================

// Mock react-markdown to avoid ESM issues
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="mock-markdown">{children}</div>,
}));

// Mock remark-gfm
jest.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => null,
}));

// Mock react-syntax-highlighter
jest.mock("react-syntax-highlighter", () => ({
  Prism: ({ children, language }) => (
    <pre data-testid="syntax-highlighter" data-language={language}>
      <code>{children}</code>
    </pre>
  ),
}));

jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

// Mock ag-grid-community for theme configuration
jest.mock("ag-grid-community", () => ({
  themeQuartz: {
    withParams: jest.fn(() => "mocked-theme"),
  },
  AllCommunityModule: {},
  ModuleRegistry: {
    registerModules: jest.fn(),
  },
}));

// Mock ag-grid-react to avoid module resolution issues
jest.mock("ag-grid-react", () => ({
  AgGridReact: ({ children }) => (
    <div data-testid="ag-grid-mock">{children}</div>
  ),
}));
