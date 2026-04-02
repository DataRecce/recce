import { render, renderHook, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createFetchClient } from "../../../lib/fetchClient";
import {
  ApiProvider,
  useApiClient,
  useApiConfig,
  useApiConfigOptional,
} from "../ApiContext";

function mockFetchResponse(data: unknown = {}, status = 200) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("ApiContext (@datarecce/ui)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    it("provides apiClient with HTTP methods", () => {
      const { result } = renderHook(() => useApiConfig(), {
        wrapper: ({ children }) => (
          <ApiProvider config={{ baseUrl: "https://api.example.com" }}>
            {children}
          </ApiProvider>
        ),
      });

      expect(result.current.apiClient).toBeDefined();
      expect(typeof result.current.apiClient.get).toBe("function");
      expect(typeof result.current.apiClient.post).toBe("function");
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
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Intentionally empty - suppress React error boundary output
      });

      expect(() => {
        renderHook(() => useApiConfig());
      }).toThrow("useApiConfig must be used within RecceProvider");

      consoleSpy.mockRestore();
    });

    it("throws error when useApiClient is called outside provider", () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Intentionally empty - suppress React error boundary output
      });

      expect(() => {
        renderHook(() => useApiClient());
      }).toThrow("useApiConfig must be used within RecceProvider");

      consoleSpy.mockRestore();
    });

    it("error message mentions RecceProvider", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Intentionally empty - suppress React error boundary output
      });

      try {
        renderHook(() => useApiConfig());
        expect.fail("Expected error to be thrown");
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

    it("useApiClient returns client with HTTP methods inside provider", () => {
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
    it("accepts a pre-configured fetch client", () => {
      const customClient = createFetchClient({
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
      const customClient = createFetchClient({
        baseURL: "https://example.com",
      });

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

  describe("Middleware behavior", () => {
    it("rewrites /api/... URLs with apiPrefix", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/sessions/abc123",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/api/info");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain("/sessions/abc123/info");
      expect(calledUrl).not.toContain("/api/");
    });

    it("rewrites exact /api URL with apiPrefix", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/sessions/abc123",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/api");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain("/sessions/abc123");
      expect(calledUrl).not.toMatch(/\/api(?:\/|$)/);
    });

    it("does not rewrite URLs that don't start with /api", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/sessions/abc123",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/health");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain("/health");
      expect(calledUrl).not.toContain("/sessions/abc123");
    });

    it("injects auth token as Bearer header", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              authToken: "my-secret-token",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/api/info");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledInit = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = calledInit.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer my-secret-token");
    });

    it("applies both apiPrefix and authToken together", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://api.example.com",
              apiPrefix: "/v2/sessions/xyz",
              authToken: "combo-token",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/api/checks");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain("/v2/sessions/xyz/checks");
      const calledInit = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = calledInit.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer combo-token");
    });

    it("works with empty baseUrl (OSS mode with authToken)", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "",
              authToken: "oss-token",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/api/info");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      // URL should be the relative path (no baseUrl)
      expect(fetchMock.mock.calls[0][0]).toBe("/api/info");
      // Auth header should still be injected
      const calledInit = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = calledInit.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer oss-token");
    });

    it("preserves /api in baseUrl path when rewriting with apiPrefix (DRC-3160)", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider
            config={{
              baseUrl: "https://staging.cloud.reccehq.com/api",
              apiPrefix: "/v2/sessions/abc123",
              authToken: "cloud-token",
            }}
          >
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/api/instance-info");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = fetchMock.mock.calls[0][0];
      // /api from baseUrl must be preserved — this was the DRC-3160 bug
      expect(calledUrl).toBe(
        "https://staging.cloud.reccehq.com/api/v2/sessions/abc123/instance-info",
      );
    });

    it("skips middleware when neither apiPrefix nor authToken is set", async () => {
      const { result } = renderHook(() => useApiClient(), {
        wrapper: ({ children }) => (
          <ApiProvider config={{ baseUrl: "https://api.example.com" }}>
            {children}
          </ApiProvider>
        ),
      });

      mockFetchResponse({ ok: true });
      await result.current.get("/api/info");

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      // URL should have /api intact — no rewriting
      expect(fetchMock.mock.calls[0][0]).toContain("/api/info");
    });
  });
});
