/**
 * Thin native `fetch` wrapper that replaces Axios.
 * Provides HttpError, ApiClient interface, and createFetchClient factory.
 */

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

export class HttpError<T = unknown> extends Error {
  public readonly status: number;
  public readonly data: T;
  readonly __isHttpError = true as const;

  constructor(status: number, data: T, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }

  /** Backward-compat shim matching AxiosError.response shape */
  get response(): { status: number; data: T } {
    return { status: this.status, data: this.data };
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isHttpError<T = unknown>(
  error: unknown,
): error is HttpError<T> {
  return (
    error instanceof HttpError ||
    (error != null &&
      typeof error === "object" &&
      "__isHttpError" in error &&
      (error as { __isHttpError: unknown }).__isHttpError === true)
  );
}

// ---------------------------------------------------------------------------
// Interfaces & types
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

export interface RequestConfig {
  params?: Record<string, string | number | string[] | number[] | undefined>;
}

export type RequestMiddleware = (
  url: string,
  init: { headers: Headers; [key: string]: unknown },
) => { url: string; init: { headers: Headers; [key: string]: unknown } };

export interface ApiClient {
  get<_TBody = never, TResponse = ApiResponse>(
    url: string,
    config?: RequestConfig,
  ): Promise<TResponse>;

  post<_TBody = unknown, TResponse = ApiResponse>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<TResponse>;

  patch<_TBody = unknown, TResponse = ApiResponse>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<TResponse>;

  delete<_TBody = never, TResponse = ApiResponse>(
    url: string,
    config?: RequestConfig,
  ): Promise<TResponse>;
}

// ---------------------------------------------------------------------------
// Factory config
// ---------------------------------------------------------------------------

export interface FetchClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  middleware?: RequestMiddleware;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeParams(params: NonNullable<RequestConfig["params"]>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        sp.append(key, String(item));
      }
    } else {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function buildURL(
  baseURL: string,
  path: string,
  params?: RequestConfig["params"],
): string {
  if (!baseURL) {
    // OSS mode: baseURL is empty, use path directly
    return params ? `${path}${serializeParams(params)}` : path;
  }

  const url = new URL(path, baseURL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function parseResponseBody(res: Response): Promise<unknown> | null {
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFetchClient(config: FetchClientConfig): ApiClient {
  const { baseURL, headers: defaultHeaders, timeout, middleware } = config;

  async function request<TResponse>(
    method: string,
    url: string,
    body?: unknown,
    reqConfig?: RequestConfig,
  ): Promise<TResponse> {
    const fullURL = buildURL(baseURL, url, reqConfig?.params);

    const headers = new Headers(defaultHeaders);

    const init: Record<string, unknown> = { method, headers };

    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        // Let the browser set Content-Type with boundary
        headers.delete("Content-Type");
        init.body = body;
      } else {
        headers.set("Content-Type", "application/json");
        init.body = JSON.stringify(body);
      }
    }

    if (timeout !== undefined) {
      init.signal = AbortSignal.timeout(timeout);
    }

    let resolvedURL = fullURL;
    let resolvedInit = init as { headers: Headers; [key: string]: unknown };

    if (middleware) {
      const result = middleware(resolvedURL, resolvedInit);
      resolvedURL = result.url;
      resolvedInit = result.init;
    }

    const res = await fetch(resolvedURL, resolvedInit as RequestInit);

    let data: unknown;
    try {
      data = await Promise.resolve(parseResponseBody(res));
    } catch {
      throw new HttpError(
        res.status,
        null,
        `Failed to parse response: ${res.statusText}`,
      );
    }

    if (!res.ok) {
      throw new HttpError(
        res.status,
        data,
        `Request failed with status ${res.status}`,
      );
    }

    return {
      data,
      status: res.status,
      headers: res.headers,
    } as TResponse;
  }

  return {
    get<_TBody = never, TResponse = ApiResponse>(
      url: string,
      config?: RequestConfig,
    ): Promise<TResponse> {
      return request<TResponse>("GET", url, undefined, config);
    },

    post<_TBody = unknown, TResponse = ApiResponse>(
      url: string,
      data?: unknown,
      config?: RequestConfig,
    ): Promise<TResponse> {
      return request<TResponse>("POST", url, data, config);
    },

    patch<_TBody = unknown, TResponse = ApiResponse>(
      url: string,
      data?: unknown,
      config?: RequestConfig,
    ): Promise<TResponse> {
      return request<TResponse>("PATCH", url, data, config);
    },

    delete<_TBody = never, TResponse = ApiResponse>(
      url: string,
      config?: RequestConfig,
    ): Promise<TResponse> {
      return request<TResponse>("DELETE", url, undefined, config);
    },
  };
}
