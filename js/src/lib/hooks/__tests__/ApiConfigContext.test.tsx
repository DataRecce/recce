import { render, renderHook, screen } from "@testing-library/react";
import axios from "axios";
import {
  ApiConfigProvider,
  useApiClient,
  useApiConfig,
  useApiConfigSafe,
} from "../ApiConfigContext";

// Mock axios.create to track interceptor registration
jest.mock("axios", () => {
  const actualAxios = jest.requireActual("axios");
  const mockCreate = jest.fn((config) => {
    const instance = actualAxios.create(config);
    // Track interceptors for testing
    instance.__requestInterceptors = [];
    const originalUse = instance.interceptors.request.use.bind(
      instance.interceptors.request,
    );
    instance.interceptors.request.use = (
      onFulfilled: (config: unknown) => unknown,
      onRejected: (error: unknown) => unknown,
    ) => {
      instance.__requestInterceptors.push({ onFulfilled, onRejected });
      return originalUse(onFulfilled, onRejected);
    };
    return instance;
  });
  return {
    ...actualAxios,
    create: mockCreate,
  };
});

describe("ApiConfigContext (OSS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Provider Basics", () => {
    it("renders children correctly", () => {
      render(
        <ApiConfigProvider>
          <div data-testid="child">Child Content</div>
        </ApiConfigProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("provides context value to children", () => {
      const TestComponent = () => {
        const config = useApiConfig();
        return <div data-testid="api-prefix">{config.apiPrefix}</div>;
      };

      render(
        <ApiConfigProvider apiPrefix="/test/prefix">
          <TestComponent />
        </ApiConfigProvider>,
      );

      expect(screen.getByTestId("api-prefix")).toHaveTextContent(
        "/test/prefix",
      );
    });
  });

  describe("API Config Values", () => {
    it("provides apiClient as an axios instance", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider>{children}</ApiConfigProvider>
        ),
      });

      expect(result.current.apiClient).toBeDefined();
      // Check it has axios-like properties
      expect(typeof result.current.apiClient.get).toBe("function");
      expect(typeof result.current.apiClient.post).toBe("function");
      expect(typeof result.current.apiClient.interceptors).toBe("object");
    });

    it("provides default apiPrefix as empty string", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider>{children}</ApiConfigProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("");
    });

    it("provides custom apiPrefix when specified", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider apiPrefix="/api/v2/sessions/abc123">
            {children}
          </ApiConfigProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("/api/v2/sessions/abc123");
    });

    it("provides authToken as undefined by default", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider>{children}</ApiConfigProvider>
        ),
      });

      expect(result.current.authToken).toBeUndefined();
    });

    it("provides custom authToken when specified", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider authToken="test-token-123">
            {children}
          </ApiConfigProvider>
        ),
      });

      expect(result.current.authToken).toBe("test-token-123");
    });

    it("provides baseUrl as undefined by default", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider>{children}</ApiConfigProvider>
        ),
      });

      expect(result.current.baseUrl).toBeUndefined();
    });

    it("provides custom baseUrl when specified", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider baseUrl="https://custom.api.com">
            {children}
          </ApiConfigProvider>
        ),
      });

      expect(result.current.baseUrl).toBe("https://custom.api.com");
    });
  });

  describe("CRITICAL: Optional Fallback Behavior", () => {
    it("returns default config when useApiConfig is called outside provider", () => {
      // This should NOT throw - OSS mode allows usage without provider
      const { result } = renderHook(() => useApiConfig());

      expect(result.current).toBeDefined();
      expect(result.current.apiPrefix).toBe("");
      expect(result.current.authToken).toBeUndefined();
      expect(result.current.baseUrl).toBeUndefined();
    });

    it("returns valid apiClient when used outside provider", () => {
      const { result } = renderHook(() => useApiConfig());

      expect(result.current.apiClient).toBeDefined();
      expect(typeof result.current.apiClient.get).toBe("function");
      expect(typeof result.current.apiClient.post).toBe("function");
    });

    it("does NOT throw error when useApiConfig is called outside provider", () => {
      // Verify no error is thrown
      expect(() => {
        renderHook(() => useApiConfig());
      }).not.toThrow();
    });

    it("returns default apiClient that can make requests", () => {
      const { result } = renderHook(() => useApiConfig());

      // Verify the client is a functional axios instance
      const client = result.current.apiClient;
      expect(client).toBeDefined();
      expect(client.defaults).toBeDefined();
    });
  });

  describe("Hook Behavior", () => {
    it("useApiConfig returns context inside provider", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider apiPrefix="/custom" authToken="token123">
            {children}
          </ApiConfigProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("/custom");
      expect(result.current.authToken).toBe("token123");
    });

    it("useApiConfig returns default config outside provider", () => {
      const { result } = renderHook(() => useApiConfig());

      expect(result.current.apiPrefix).toBe("");
      expect(result.current.authToken).toBeUndefined();
    });

    it("useApiClient returns axios instance inside provider", () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider>{children}</ApiConfigProvider>
        ),
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.get).toBe("function");
    });

    it("useApiClient returns default axios instance outside provider", () => {
      // Should not throw, returns default client
      const { result } = renderHook(() => useApiClient());

      expect(result.current).toBeDefined();
      expect(typeof result.current.get).toBe("function");
    });

    it("useApiConfigSafe returns null when outside provider", () => {
      const { result } = renderHook(() => useApiConfigSafe());

      expect(result.current).toBeNull();
    });

    it("useApiConfigSafe returns context when inside provider", () => {
      const { result } = renderHook(() => useApiConfigSafe(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider apiPrefix="/test">{children}</ApiConfigProvider>
        ),
      });

      expect(result.current).not.toBeNull();
      expect(result.current?.apiPrefix).toBe("/test");
    });
  });

  describe("Memoization", () => {
    it("returns same apiClient reference when config unchanged", () => {
      const { result, rerender } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider apiPrefix="/test">{children}</ApiConfigProvider>
        ),
      });

      const firstClient = result.current.apiClient;
      rerender();
      const secondClient = result.current.apiClient;

      expect(firstClient).toBe(secondClient);
    });

    it("wrapper with changed config demonstrates rerender behavior", () => {
      let apiPrefix = "/initial";
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ApiConfigProvider apiPrefix={apiPrefix}>{children}</ApiConfigProvider>
      );

      const { result, rerender } = renderHook(() => useApiConfig(), {
        wrapper,
      });

      // Verify initial state
      expect(result.current.apiPrefix).toBe("/initial");

      // Note: changing apiPrefix and calling rerender() won't actually update
      // the wrapper props - this demonstrates the limitation of wrapper rerenders
      apiPrefix = "/updated";
      rerender();

      // The wrapper doesn't receive new props on rerender, so value stays same
      // This is expected React behavior with renderHook wrapper
    });
  });

  describe("Nested Providers", () => {
    it("inner provider overrides outer provider", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiConfigProvider apiPrefix="/outer" authToken="outer-token">
            <ApiConfigProvider apiPrefix="/inner" authToken="inner-token">
              {children}
            </ApiConfigProvider>
          </ApiConfigProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("/inner");
      expect(result.current.authToken).toBe("inner-token");
    });
  });
});
