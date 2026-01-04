import { render, renderHook, screen } from "@testing-library/react";
import axios from "axios";
import {
  ApiProvider,
  useApiClient,
  useApiConfig,
  useApiConfigOptional,
} from "../ApiContext";

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

describe("ApiContext (@datarecce/ui)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Provider Basics", () => {
    it("renders children correctly", () => {
      render(
        <ApiProvider config={{ baseUrl: "https://api.example.com" }}>
          <div data-testid="child">Child Content</div>
        </ApiProvider>,
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
        <ApiProvider
          config={{
            baseUrl: "https://api.example.com",
            apiPrefix: "/test/prefix",
          }}
        >
          <TestComponent />
        </ApiProvider>,
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
          <ApiProvider config={{ baseUrl: "https://api.example.com" }}>
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiClient).toBeDefined();
      // Check it has axios-like properties
      expect(typeof result.current.apiClient.get).toBe("function");
      expect(typeof result.current.apiClient.post).toBe("function");
      expect(typeof result.current.apiClient.interceptors).toBe("object");
    });

    it("provides default apiPrefix as empty string when not specified", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider config={{ baseUrl: "https://api.example.com" }}>
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("");
    });

    it("provides custom apiPrefix when specified", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/api/v2/sessions/abc123",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("/api/v2/sessions/abc123");
    });

    it("provides authToken as undefined by default", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider config={{ baseUrl: "https://api.example.com" }}>
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.authToken).toBeUndefined();
    });

    it("provides custom authToken when specified", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              authToken: "test-token-123",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.authToken).toBe("test-token-123");
    });

    it("provides baseUrl from config", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider config={{ baseUrl: "https://custom.api.com" }}>
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.baseUrl).toBe("https://custom.api.com");
    });
  });

  describe("CRITICAL: Required Provider Behavior", () => {
    it("throws error when useApiConfig is called outside provider", () => {
      // Suppress console.error for expected error
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
        // Intentionally empty - suppress React error boundary output
      });

      expect(() => {
        renderHook(() => useApiConfig());
      }).toThrow("useApiConfig must be used within RecceProvider");

      consoleSpy.mockRestore();
    });

    it("throws error when useApiClient is called outside provider", () => {
      // Suppress console.error for expected error
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
        // Intentionally empty - suppress React error boundary output
      });

      expect(() => {
        renderHook(() => useApiClient());
      }).toThrow("useApiConfig must be used within RecceProvider");

      consoleSpy.mockRestore();
    });

    it("error message mentions RecceProvider", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
        // Intentionally empty - suppress React error boundary output
      });

      try {
        renderHook(() => useApiConfig());
        fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).toContain("RecceProvider");
      }

      consoleSpy.mockRestore();
    });
  });

  describe("Hook Behavior", () => {
    it("useApiConfig returns context inside provider", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/custom",
              authToken: "token123",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("/custom");
      expect(result.current.authToken).toBe("token123");
      expect(result.current.baseUrl).toBe("https://api.example.com");
    });

    it("useApiClient returns axios instance inside provider", () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider config={{ baseUrl: "https://api.example.com" }}>
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.get).toBe("function");
      expect(typeof result.current.post).toBe("function");
    });
  });

  describe("useApiConfigOptional (non-throwing)", () => {
    it("returns null when called outside provider", () => {
      const { result } = renderHook(() => useApiConfigOptional());

      expect(result.current).toBeNull();
    });

    it("returns context value when called inside provider", () => {
      const { result } = renderHook(() => useApiConfigOptional(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/optional-test",
              authToken: "optional-token",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current).not.toBeNull();
      expect(result.current?.apiPrefix).toBe("/optional-test");
      expect(result.current?.authToken).toBe("optional-token");
      expect(result.current?.baseUrl).toBe("https://api.example.com");
      expect(result.current?.apiClient).toBeDefined();
    });

    it("allows graceful fallback pattern", () => {
      // This demonstrates the intended use case:
      // OSS can use useApiConfigOptional and fall back to default config
      const TestComponent = () => {
        const config = useApiConfigOptional();
        const apiPrefix = config?.apiPrefix ?? "/api";
        return <div data-testid="prefix">{apiPrefix}</div>;
      };

      // Without provider - should use fallback
      const { unmount } = render(<TestComponent />);
      expect(screen.getByTestId("prefix")).toHaveTextContent("/api");
      unmount();

      // With provider - should use provider value
      render(
        <ApiProvider
          config={{ baseUrl: "https://example.com", apiPrefix: "/custom" }}
        >
          <TestComponent />
        </ApiProvider>,
      );
      expect(screen.getByTestId("prefix")).toHaveTextContent("/custom");
    });
  });

  describe("Custom Client Support", () => {
    it("accepts a pre-configured axios client", () => {
      const customClient = axios.create({
        baseURL: "https://custom-client.example.com",
      });

      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              client: customClient,
              baseUrl: "https://custom-client.example.com",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiClient).toBe(customClient);
    });

    it("uses custom client apiPrefix and authToken", () => {
      const customClient = axios.create();

      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              client: customClient,
              apiPrefix: "/custom-prefix",
              authToken: "custom-token",
              baseUrl: "https://example.com",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("/custom-prefix");
      expect(result.current.authToken).toBe("custom-token");
    });
  });

  describe("Config Options", () => {
    it("accepts headers in config", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              headers: { "X-Custom-Header": "custom-value" },
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiClient).toBeDefined();
    });

    it("accepts timeout in config", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              timeout: 5000,
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiClient).toBeDefined();
    });
  });

  describe("Memoization", () => {
    it("returns same apiClient reference when config unchanged", () => {
      const { result, rerender } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/test",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      const firstClient = result.current.apiClient;
      rerender();
      const secondClient = result.current.apiClient;

      expect(firstClient).toBe(secondClient);
    });
  });

  describe("Nested Providers", () => {
    it("inner provider overrides outer provider", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://outer.example.com",
              apiPrefix: "/outer",
              authToken: "outer-token",
            }}
          >
            <ApiProvider
              config={{
                baseUrl: "https://inner.example.com",
                apiPrefix: "/inner",
                authToken: "inner-token",
              }}
            >
              {children}
            </ApiProvider>
          </ApiProvider>
        ),
      });

      expect(result.current.apiPrefix).toBe("/inner");
      expect(result.current.authToken).toBe("inner-token");
      expect(result.current.baseUrl).toBe("https://inner.example.com");
    });
  });
});
