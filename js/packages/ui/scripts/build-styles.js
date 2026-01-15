#!/usr/bin/env node

/**
 * @datarecce/ui - CSS Build Script
 *
 * This script builds the CSS bundle for the @datarecce/ui package.
 * It compiles Tailwind CSS, processes imports, and outputs a single
 * bundled stylesheet to dist/styles.css.
 *
 * Usage: node scripts/build-styles.js
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// Configuration
const config = {
  input: join(rootDir, "src/styles/globals.css"),
  componentsInput: join(rootDir, "src/styles/components.css"),
  output: join(rootDir, "dist/styles.css"),
  tempDir: join(rootDir, "dist"),
};

/**
 * Ensure the output directory exists
 */
function ensureDistDir() {
  if (!existsSync(config.tempDir)) {
    mkdirSync(config.tempDir, { recursive: true });
    console.log("Created dist directory");
  }
}

/**
 * Build CSS using Tailwind CLI
 * Uses @tailwindcss/cli which is installed as a devDependency
 */
function buildTailwindCSS() {
  console.log("Building Tailwind CSS...");

  try {
    // Use Tailwind CLI v4 to process the globals.css file
    // The --minify flag produces minified output for production
    // We use pnpm exec to ensure we use the local installation
    execSync(
      `pnpm exec tailwindcss -i "${config.input}" -o "${config.output}" --minify`,
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );
    console.log("Tailwind CSS compiled successfully");
  } catch (error) {
    console.error("Failed to compile Tailwind CSS:", error.message);
    throw error;
  }
}

/**
 * Append components.css to the output
 */
function appendComponentStyles() {
  console.log("Appending component styles...");

  try {
    // Read the current output
    let output = readFileSync(config.output, "utf8");

    // Read components.css
    const componentsCSS = readFileSync(config.componentsInput, "utf8");

    // Append components CSS with a separator comment
    output += `\n/* Third-party component overrides */\n${componentsCSS}`;

    // Write the combined output
    writeFileSync(config.output, output);
    console.log("Component styles appended successfully");
  } catch (error) {
    console.error("Failed to append component styles:", error.message);
    throw error;
  }
}

/**
 * Add banner comment to the output
 */
function addBanner() {
  console.log("Adding banner...");

  const banner = `/**
 * @datarecce/ui - Bundled Styles
 *
 * This file contains all CSS for @datarecce/ui components including:
 * - Tailwind CSS utilities
 * - CSS custom properties for theming
 * - React Flow styles
 * - Third-party component overrides (ag-Grid, CodeMirror, etc.)
 *
 * Usage: import '@datarecce/ui/styles';
 *
 * @license MIT
 */
`;

  try {
    const output = readFileSync(config.output, "utf8");
    writeFileSync(config.output, banner + output);
    console.log("Banner added successfully");
  } catch (error) {
    console.error("Failed to add banner:", error.message);
    throw error;
  }
}

/**
 * Calculate and log the output size
 */
function logOutputSize() {
  try {
    const stats = readFileSync(config.output);
    const sizeKB = (stats.length / 1024).toFixed(2);
    console.log(`\nOutput: ${config.output}`);
    console.log(`Size: ${sizeKB} KB`);
  } catch (error) {
    console.error("Failed to get output size:", error.message);
  }
}

/**
 * Main build function
 */
function main() {
  console.log("@datarecce/ui CSS Build\n");

  try {
    ensureDistDir();
    buildTailwindCSS();
    appendComponentStyles();
    addBanner();
    logOutputSize();
    console.log("\nCSS build completed successfully!");
  } catch (error) {
    console.error("\nCSS build failed:", error.message);
    process.exit(1);
  }
}

// Run the build
main();
