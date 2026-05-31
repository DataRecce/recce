/**
 * @file track.test.ts
 * @description Dual-emit telemetry tests for track.ts (Amplitude + PostHog).
 *
 * P6 of the Amplitude -> PostHog migration adds a PostHog `capture()` call to
 * every existing Amplitude wrapper WITHOUT changing the wrapper signatures or
 * the Amplitude path. These tests are written FIRST (red) and assert:
 *
 *   (1) trackInit() initializes posthog-js with the correct prod key/host and
 *       config (autocapture ON, session recording OFF, person_profiles
 *       'identified_only', NO $geoip_disable), and calls posthog.identify()
 *       with the recce_user_id cookie value (distinct_id wiring).
 *   (2) The init is gated: no recce_user_id cookie => no init; the
 *       NEXT_PUBLIC_RECCE_DISABLE_TELEMETRY kill switch => no init.
 *   (3) Each of the ~20 wrappers DUAL-emits: the Amplitude trk() path still
 *       fires AND posthog.capture() fires once with the mapped flat snake_case
 *       event name, the same props, and event_source: 'oss-web'.
 *   (4) The canonical flat schema for environment_config (nested -> flat) and
 *       lineage_view_render (dynamic nodes_<status> passthrough).
 *
 * posthog-js is mocked via a factory so the (not-yet-installed) module never
 * resolves against the filesystem. @amplitude/unified is mocked so we can spy
 * on the shared Amplitude sink.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ============================================================================
// Mocks - MUST be declared before importing the module under test
// ============================================================================

// Mock posthog-js. The default export is the singleton client used in track.ts
// (`import posthog from "posthog-js"`). A factory mock means vitest never tries
// to resolve the real (not-yet-added) package from node_modules.
const mockPosthogInit = vi.fn();
const mockPosthogIdentify = vi.fn();
const mockPosthogCapture = vi.fn();
const mockPosthogRegister = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init: mockPosthogInit,
    identify: mockPosthogIdentify,
    capture: mockPosthogCapture,
    register: mockPosthogRegister,
  },
}));

// Mock the Amplitude unified sink so we can assert the Amplitude path still
// fires (dual-emit) and that init does not throw under test.
const mockAmplitudeTrack = vi.fn();
const mockAmplitudeInitAll = vi.fn();

vi.mock("@amplitude/unified", () => ({
  track: (...args: unknown[]) => mockAmplitudeTrack(...args),
  initAll: (...args: unknown[]) => mockAmplitudeInitAll(...args),
}));

// ============================================================================
// Constants mirrored from the design (do NOT import from track.ts — these are
// the contract the implementation must satisfy)
// ============================================================================

const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_KEY_PROD = "phc_WDJMPIYB2WTasN3sVxwIasBOSTjZ9rVTkpqf5lVKeRL";
const EVENT_SOURCE = "oss-web";
const RECCE_USER_ID = "user-abc-123";

// ============================================================================
// Helpers
// ============================================================================

/** Stub document.cookie so getCookie("recce_user_id") returns the given id. */
function setRecceUserIdCookie(id: string | null) {
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => (id ? `recce_user_id=${id}` : ""),
  });
}

/**
 * Re-import track.ts fresh so module-level state (posthogInitialized /
 * amplitudeInitialized) is reset between tests. trackInit() must be called
 * before any wrapper to exercise the posthog path.
 */
async function importTrackFresh() {
  vi.resetModules();
  // Re-establish the mocks for the freshly reset module registry.
  vi.doMock("posthog-js", () => ({
    default: {
      init: mockPosthogInit,
      identify: mockPosthogIdentify,
      capture: mockPosthogCapture,
      register: mockPosthogRegister,
    },
  }));
  vi.doMock("@amplitude/unified", () => ({
    track: (...args: unknown[]) => mockAmplitudeTrack(...args),
    initAll: (...args: unknown[]) => mockAmplitudeInitAll(...args),
  }));
  return import("../track");
}

/** Import track.ts and run trackInit() with a valid cookie + prod key. */
async function importInitialized() {
  const mod = await importTrackFresh();
  setRecceUserIdCookie(RECCE_USER_ID);
  mod.trackInit();
  return mod;
}

const originalEnv = { ...process.env };

beforeEach(() => {
  mockPosthogInit.mockClear();
  mockPosthogIdentify.mockClear();
  mockPosthogCapture.mockClear();
  mockAmplitudeTrack.mockClear();
  mockAmplitudeInitAll.mockClear();
  // Default to a non-development env so userId comes from the cookie, mirroring
  // production. Individual tests override NODE_ENV / kill-switch as needed.
  process.env = { ...originalEnv };
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.AMPLITUDE_API_KEY = "amp_test_key";
  delete process.env.NEXT_PUBLIC_RECCE_DISABLE_TELEMETRY;
  delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ============================================================================
// (2) Init config + (3) distinct_id wiring
// ============================================================================

describe("trackInit() — PostHog initialization", () => {
  test("calls posthog.init once with prod key, host, and canonical config", async () => {
    await importInitialized();

    expect(mockPosthogInit).toHaveBeenCalledTimes(1);
    const [key, config] = mockPosthogInit.mock.calls[0];

    expect(key).toBe(POSTHOG_KEY_PROD);
    expect(config).toMatchObject({
      api_host: POSTHOG_HOST,
      autocapture: true,
      disable_session_recording: true,
      person_profiles: "identified_only",
    });
  });

  test("does NOT disable geoip (country resolution depends on it)", async () => {
    await importInitialized();
    const [, config] = mockPosthogInit.mock.calls[0];
    // $geoip_disable must be absent (or explicitly falsy) — recce-insight
    // country_distribution depends on IP-based country resolution.
    expect(config?.$geoip_disable).toBeFalsy();
  });

  test("does NOT enable session replay / load a replay plugin", async () => {
    await importInitialized();
    const [, config] = mockPosthogInit.mock.calls[0];
    expect(config?.disable_session_recording).toBe(true);
  });

  test("calls posthog.identify with the recce_user_id cookie value (distinct_id wiring)", async () => {
    await importInitialized();
    expect(mockPosthogIdentify).toHaveBeenCalledWith(RECCE_USER_ID);
  });

  test("registers event_source as a super-property so autocapture events are tagged", async () => {
    await importInitialized();
    expect(mockPosthogRegister).toHaveBeenCalledWith({
      event_source: EVENT_SOURCE,
    });
  });

  test("honors NEXT_PUBLIC_POSTHOG_API_KEY override when present", async () => {
    const mod = await importTrackFresh();
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "phc_override_key";
    setRecceUserIdCookie(RECCE_USER_ID);
    mod.trackInit();

    expect(mockPosthogInit).toHaveBeenCalledTimes(1);
    expect(mockPosthogInit.mock.calls[0][0]).toBe("phc_override_key");
  });
});

// ============================================================================
// (2) Gate / kill-switch
// ============================================================================

describe("trackInit() — gate and kill switch", () => {
  test("does NOT init PostHog when recce_user_id cookie is absent", async () => {
    const mod = await importTrackFresh();
    setRecceUserIdCookie(null);
    mod.trackInit();
    expect(mockPosthogInit).not.toHaveBeenCalled();
    expect(mockPosthogIdentify).not.toHaveBeenCalled();
  });

  test("does NOT init PostHog when NEXT_PUBLIC_RECCE_DISABLE_TELEMETRY=true even with cookie + key", async () => {
    const mod = await importTrackFresh();
    process.env.NEXT_PUBLIC_RECCE_DISABLE_TELEMETRY = "true";
    setRecceUserIdCookie(RECCE_USER_ID);
    mod.trackInit();
    expect(mockPosthogInit).not.toHaveBeenCalled();
  });
});

// ============================================================================
// (3) Per-wrapper dual-emit — non-onboarding wrappers (P6a)
// ============================================================================

describe("dual-emit — non-onboarding wrappers", () => {
  test("trackMultiNodesAction emits multi_nodes_action with exact {type,selected} + event_source", async () => {
    const mod = await importInitialized();
    const props = { type: "value_diff", selected: "multi" } as const;
    mockAmplitudeTrack.mockClear();
    mod.trackMultiNodesAction(props);

    // Amplitude path still fires
    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    // PostHog dual-emit with flat name + exact props (recce-insight depends on values)
    expect(mockPosthogCapture).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("multi_nodes_action", {
      type: "value_diff",
      selected: "multi",
      event_source: EVENT_SOURCE,
    });
  });

  test("trackHistoryAction emits history_action with exact {name} + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackHistoryAction({ name: "click_run" });

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("history_action", {
      name: "click_run",
      event_source: EVENT_SOURCE,
    });
  });

  test("trackSingleEnvironment emits single_environment + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = { action: "preview_changes", from: "onboarding" } as const;
    mod.trackSingleEnvironment(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("single_environment", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });

  test("trackColumnLevelLineage emits column_level_lineage + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = { action: "view", source: "cll_column" } as const;
    mod.trackColumnLevelLineage(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("column_level_lineage", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });

  test("trackShareState emits share_state + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackShareState({ name: "create" });

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("share_state", {
      name: "create",
      event_source: EVENT_SOURCE,
    });
  });

  test("trackStateAction emits state_action + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackStateAction({ name: "export" });

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("state_action", {
      name: "export",
      event_source: EVENT_SOURCE,
    });
  });

  test("trackCopyToClipboard emits copy_to_clipboard + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = { from: "run", type: "sql" } as const;
    mod.trackCopyToClipboard(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("copy_to_clipboard", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });

  test("trackNavigation emits navigation_change + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = { from: "lineage", to: "query" };
    mod.trackNavigation(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("navigation_change", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });

  test("trackExploreAction emits explore_action + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = {
      action: mod.EXPLORE_ACTION.VALUE_DIFF,
      source: mod.EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
      node_count: 3,
    };
    mod.trackExploreAction(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("explore_action", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });

  test("trackExploreActionForm emits explore_action_form + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = {
      action: mod.EXPLORE_ACTION.ROW_COUNT,
      event: mod.EXPLORE_FORM_EVENT.EXECUTE,
    };
    mod.trackExploreActionForm(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("explore_action_form", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });

  test("trackLineageSelection emits lineage_selection + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = {
      action: mod.LINEAGE_SELECTION_ACTION.SELECT_PARENT_NODES,
      node_count: 5,
    };
    mod.trackLineageSelection(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("lineage_selection", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });
});

// ============================================================================
// (4) Canonical flat schema — lineage_view_render passthrough
// ============================================================================

describe("dual-emit — lineage_view_render canonical flat schema", () => {
  test("passes dynamic nodes_<status> keys + canonical keys through unchanged + event_source", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    const props = {
      node_count: 10,
      view_mode: "changed",
      impact_radius_enabled: true,
      right_sidebar_open: false,
      cll_column_active: true,
      nodes_added: 2,
      nodes_removed: 1,
      nodes_modified: 3,
      nodes_unchanged: 4,
    };
    mod.trackLineageViewRender(props);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith("lineage_view_render", {
      ...props,
      event_source: EVENT_SOURCE,
    });
  });
});

// ============================================================================
// (4) Canonical flat schema — environment_config flatten
// ============================================================================

describe("dual-emit — environment_config flatten", () => {
  const nestedProps = {
    review_mode: true,
    adapter_type: "duckdb",
    has_git_info: true,
    has_pr_info: false,
    schemas_match: true,
    base: {
      schema_count: 3,
      dbt_version: "1.7.0",
      timestamp: "2026-05-01T00:00:00Z",
      has_env: false,
    },
    current: {
      schema_count: 4,
      dbt_version: "1.8.0",
      timestamp: "2026-05-31T00:00:00Z",
      has_env: false,
    },
  };

  test("PostHog receives FLAT base_*/current_* keys and NO nested base/current", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackEnvironmentConfig(nestedProps);

    expect(mockPosthogCapture).toHaveBeenCalledTimes(1);
    const [eventName, payload] = mockPosthogCapture.mock.calls[0];

    expect(eventName).toBe("environment_config");
    // Flat canonical fields
    expect(payload).toMatchObject({
      review_mode: true,
      adapter_type: "duckdb",
      has_git_info: true,
      has_pr_info: false,
      schemas_match: true,
      base_schema_count: 3,
      current_schema_count: 4,
      base_dbt_version: "1.7.0",
      current_dbt_version: "1.8.0",
      event_source: EVENT_SOURCE,
    });
    // No nested objects in the PostHog payload
    expect(payload.base).toBeUndefined();
    expect(payload.current).toBeUndefined();
    // Nested timestamps are dropped from the flat payload
    expect(payload.base_timestamp).toBeUndefined();
    expect(payload.current_timestamp).toBeUndefined();
  });

  test("Amplitude still receives the ORIGINAL nested props (unchanged)", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackEnvironmentConfig(nestedProps);

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    const [ampEvent, ampProps] = mockAmplitudeTrack.mock.calls[0];
    expect(ampEvent).toBe("[Web] environment_config");
    // Amplitude path is untouched: nested base/current preserved verbatim.
    expect(ampProps).toEqual(nestedProps);
  });
});

// ============================================================================
// (3) Per-wrapper dual-emit — onboarding wrappers (P6b, oss_onboarding_ prefix)
// ============================================================================

describe("dual-emit — onboarding wrappers (oss_onboarding_ prefix)", () => {
  test("trackOssShareButtonClicked emits oss_onboarding_share_button_clicked with {authed}", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackOssShareButtonClicked({ authed: true });

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_share_button_clicked",
      { authed: true, event_source: EVENT_SOURCE },
    );
  });

  test("trackSignupRedirectInitiated emits oss_onboarding_signup_redirect_initiated", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackSignupRedirectInitiated();

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_signup_redirect_initiated",
      { event_source: EVENT_SOURCE },
    );
  });

  test("trackSignupCompleted emits oss_onboarding_signup_completed", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackSignupCompleted();

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_signup_completed",
      { event_source: EVENT_SOURCE },
    );
  });

  test("trackArtifactUploadStarted emits oss_onboarding_artifact_upload_started", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackArtifactUploadStarted();

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_artifact_upload_started",
      { event_source: EVENT_SOURCE },
    );
  });

  test("trackRedirectToCloudSession emits oss_onboarding_redirect_to_cloud_session", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackRedirectToCloudSession();

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_redirect_to_cloud_session",
      { event_source: EVENT_SOURCE },
    );
  });

  test("trackDwSetupShown emits oss_onboarding_dw_setup_shown", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackDwSetupShown();

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_dw_setup_shown",
      { event_source: EVENT_SOURCE },
    );
  });

  test("trackDwSetupCompleted emits oss_onboarding_dw_setup_completed", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackDwSetupCompleted();

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_dw_setup_completed",
      { event_source: EVENT_SOURCE },
    );
  });

  test("trackDwSetupSkipped emits oss_onboarding_dw_setup_skipped", async () => {
    const mod = await importInitialized();
    mockAmplitudeTrack.mockClear();
    mod.trackDwSetupSkipped();

    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
    expect(mockPosthogCapture).toHaveBeenCalledWith(
      "oss_onboarding_dw_setup_skipped",
      { event_source: EVENT_SOURCE },
    );
  });
});

// ============================================================================
// No-init safety: wrappers must not call posthog.capture before trackInit()
// ============================================================================

describe("no-init safety", () => {
  test("calling a wrapper before trackInit() does NOT throw and does NOT call posthog.capture", async () => {
    const mod = await importTrackFresh();
    // No trackInit() call -> posthogInitialized is false.
    expect(() => mod.trackHistoryAction({ name: "show" })).not.toThrow();
    expect(mockPosthogCapture).not.toHaveBeenCalled();
    // Amplitude path (or console fallback) still runs.
    expect(mockAmplitudeTrack).toHaveBeenCalledTimes(1);
  });
});
