/**
 * @file browser.ts
 * @description MSW browser worker setup for Storybook
 *
 * This file configures the MSW service worker for browser-based mocking.
 * The worker intercepts network requests and routes them to the mock handlers.
 *
 * SETUP REQUIRED:
 * 1. Install MSW: pnpm add -D msw
 * 2. Generate service worker: pnpm exec msw init public/
 * 3. Uncomment the code below
 * 4. Add initialization to preview.tsx (see example below)
 *
 * Usage in preview.tsx:
 * ```ts
 * import { worker } from './mocks/browser';
 *
 * // Initialize MSW before rendering stories
 * if (typeof window !== 'undefined') {
 *   worker.start({
 *     onUnhandledRequest: 'bypass', // Don't warn on unhandled requests
 *     quiet: true, // Reduce console noise
 *   });
 * }
 * ```
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export default worker;
