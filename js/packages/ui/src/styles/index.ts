/**
 * @file styles/index.ts
 * @description Entry point for @datarecce/ui/styles in development/test environments
 *
 * In production builds, @datarecce/ui/styles exports the compiled CSS file directly.
 * In development/test, this module imports the CSS files for side effects.
 */

// Import CSS files for side effects (styling)
import "./globals.css";
import "./components.css";

// Export empty object to satisfy module resolution
export {};
