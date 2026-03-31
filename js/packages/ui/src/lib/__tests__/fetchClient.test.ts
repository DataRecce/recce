import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ApiResponse,
  createFetchClient,
  HttpError,
  isHttpError,
} from "../fetchClient";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
): Response {
  const resHeaders = new Headers({
    "content-type": "application/json",
    ...headers,
  });
  return new Response(JSON.stringify(body), { status, headers: resHeaders });
}

function textResponse(body: string, status = 200): Response {
  const resHeaders = new Headers({ "content-type": "text/plain" });
  return new Response(body, { status, headers: resHeaders });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

describe("HttpError", () => {
  it("creates an error with status, data, and message", () => {
    const err = new HttpError(404, { detail: "not found" }, "Not Found");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.name).toBe("HttpError");
    expect(err.status).toBe(404);
    expect(err.data).toEqual({ detail: "not found" });
    expect(err.message).toBe("Not Found");
  });

  it("provides a response getter for backward compat", () => {
    const err = new HttpError(409, { conflict: true }, "Conflict");
    expect(err.response).toEqual({
      status: 409,
      data: { conflict: true },
    });
  });
});

// ---------------------------------------------------------------------------
// isHttpError
// ---------------------------------------------------------------------------

describe("isHttpError", () => {
  it("returns true for HttpError instances", () => {
    expect(isHttpError(new HttpError(500, null, "err"))).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isHttpError(new Error("boom"))).toBe(false);
  });

  it("returns false for string", () => {
    expect(isHttpError("error")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError(undefined)).toBe(false);
  });

  it("works with brand property (cross-module compat)", () => {
    // Simulate cross-module scenario: object has brand but different prototype
    const fakeCrossModuleError = {
      __isHttpError: true,
      status: 500,
      data: null,
      message: "fail",
      name: "HttpError",
      response: { status: 500, data: null },
    };
    expect(isHttpError(fakeCrossModuleError)).toBe(true);
  });

  it("narrows generic type", () => {
    const err: unknown = new HttpError<{ code: number }>(
      400,
      { code: 42 },
      "bad",
    );
    if (isHttpError<{ code: number }>(err)) {
      // TypeScript should allow accessing .data.code here
      expect(err.data.code).toBe(42);
    } else {
      throw new Error("Expected isHttpError to return true");
    }
  });
});

// ---------------------------------------------------------------------------
// createFetchClient
// ---------------------------------------------------------------------------

describe("createFetchClient", () => {
  const client = createFetchClient({ baseURL: "http://localhost:8000" });

  describe("HTTP methods", () => {
    it("GET with baseURL resolution", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      const res = await client.get<never, ApiResponse<{ ok: boolean }>>(
        "/api/health",
      );

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:8000/api/health");
      expect(init.method).toBe("GET");
      expect(res.data).toEqual({ ok: true });
      expect(res.status).toBe(200);
    });

    it("POST with JSON body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }, 201));

      const res = await client.post("/api/items", { name: "thing" });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ name: "thing" }));
      expect(init.headers.get("Content-Type")).toBe("application/json");
      expect(res.status).toBe(201);
    });

    it("PATCH with JSON body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ updated: true }));

      await client.patch("/api/items/1", { name: "updated" });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("PATCH");
      expect(init.body).toBe(JSON.stringify({ name: "updated" }));
    });

    it("DELETE", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      const res = await client.delete("/api/items/1");

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("DELETE");
      expect(res.status).toBe(204);
      expect(res.data).toBeNull();
    });
  });

  describe("query params", () => {
    it("serializes params to URL search params", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.get("/api/items", {
        params: { page: 1, limit: 10 },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("page=1");
      expect(url).toContain("limit=10");
    });

    it("skips undefined values", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.get("/api/items", {
        params: { page: 1, filter: undefined },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("page=1");
      expect(url).not.toContain("filter");
    });

    it("supports array values", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.get("/api/items", {
        params: { ids: [1, 2, 3] },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("ids=1");
      expect(url).toContain("ids=2");
      expect(url).toContain("ids=3");
    });
  });

  describe("headers", () => {
    it("applies default headers from config", async () => {
      const authClient = createFetchClient({
        baseURL: "http://localhost:8000",
        headers: { Authorization: "Bearer token123" },
      });
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await authClient.get("/api/me");

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers.get("Authorization")).toBe("Bearer token123");
    });

    it("sets JSON Content-Type for object bodies", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      await client.post("/api/data", { key: "value" });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers.get("Content-Type")).toBe("application/json");
    });

    it("does NOT set Content-Type for FormData", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      const form = new FormData();
      form.append("file", "data");

      await client.post("/api/upload", form);

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers.has("Content-Type")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws HttpError on 404", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ detail: "Not Found" }, 404),
      );

      await expect(client.get("/api/missing")).rejects.toThrow(HttpError);

      try {
        mockFetch.mockResolvedValueOnce(
          jsonResponse({ detail: "Not Found" }, 404),
        );
        await client.get("/api/missing");
      } catch (e) {
        expect(isHttpError(e)).toBe(true);
        if (isHttpError(e)) {
          expect(e.status).toBe(404);
          expect(e.data).toEqual({ detail: "Not Found" });
        }
      }
    });

    it("wraps network TypeError in HttpError with status 0", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      try {
        await client.get("/api/info");
        throw new Error("Expected HttpError");
      } catch (e) {
        expect(isHttpError(e)).toBe(true);
        if (!isHttpError(e)) throw e;
        expect(e.status).toBe(0);
        expect(e.data).toBeNull();
        expect(e.message).toBe("Failed to fetch");
      }
    });

    it("wraps AbortError (timeout) in HttpError with status 0", async () => {
      const abortError = new DOMException("Signal timed out", "AbortError");
      mockFetch.mockRejectedValueOnce(abortError);

      try {
        await client.get("/api/slow");
        throw new Error("Expected HttpError");
      } catch (e) {
        expect(isHttpError(e)).toBe(true);
        if (!isHttpError(e)) throw e;
        expect(e.status).toBe(0);
        expect(e.message).toBe("Signal timed out");
      }
    });

    it("throws HttpError on 409 with parsed data", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ conflict: true }, 409));

      try {
        await client.post("/api/items", { name: "dup" });
        throw new Error("Expected HttpError");
      } catch (e) {
        if (!isHttpError(e)) throw e;
        expect(e.status).toBe(409);
        expect(e.data).toEqual({ conflict: true });
        expect(e.response).toEqual({
          status: 409,
          data: { conflict: true },
        });
      }
    });
  });

  describe("response parsing", () => {
    it("parses JSON responses", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ items: [1, 2] }));
      const res = await client.get("/api/items");
      expect(res.data).toEqual({ items: [1, 2] });
    });

    it("returns text for non-JSON responses", async () => {
      mockFetch.mockResolvedValueOnce(textResponse("hello world"));
      const res = await client.get("/api/text");
      expect(res.data).toBe("hello world");
    });

    it("returns null data for 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());
      const res = await client.delete("/api/items/1");
      expect(res.data).toBeNull();
      expect(res.status).toBe(204);
    });
  });

  describe("middleware", () => {
    it("modifies URL via middleware", async () => {
      const mwClient = createFetchClient({
        baseURL: "http://localhost:8000",
        middleware: (url, init) => ({
          url: url.replace("/api/", "/v2/api/"),
          init,
        }),
      });
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await mwClient.get("/api/test");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:8000/v2/api/test");
    });

    it("injects headers via middleware", async () => {
      const mwClient = createFetchClient({
        baseURL: "http://localhost:8000",
        middleware: (url, init) => {
          init.headers.set("X-Custom", "injected");
          return { url, init };
        },
      });
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await mwClient.get("/api/test");

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers.get("X-Custom")).toBe("injected");
    });
  });

  describe("timeout", () => {
    it("passes AbortSignal.timeout when configured", async () => {
      const timeoutClient = createFetchClient({
        baseURL: "http://localhost:8000",
        timeout: 5000,
      });
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await timeoutClient.get("/api/slow");

      const [, init] = mockFetch.mock.calls[0];
      expect(init.signal).toBeDefined();
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("empty baseURL (OSS mode)", () => {
    it("works with empty baseURL", async () => {
      const ossClient = createFetchClient({ baseURL: "" });
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      const result = await ossClient.get("/api/info");

      expect(mockFetch).toHaveBeenCalledWith("/api/info", expect.any(Object));
      expect(result.data).toEqual({ ok: true });
    });

    it("works with empty baseURL and params", async () => {
      const ossClient = createFetchClient({ baseURL: "" });
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await ossClient.get("/api/test", { params: { a: "1" } });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test?a=1",
        expect.any(Object),
      );
    });
  });

  describe("malformed response", () => {
    it("throws HttpError for malformed JSON response", async () => {
      const ossClient = createFetchClient({ baseURL: "" });
      mockFetch.mockResolvedValueOnce(
        new Response("not json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(ossClient.get("/test")).rejects.toThrow(HttpError);
    });
  });
});
