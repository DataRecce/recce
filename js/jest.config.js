const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  // Module name mapper for path aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@theme/(.*)$": "<rootDir>/theme/$1",
    "^app/(.*)$": "<rootDir>/app/$1",
    // Workspace packages - specific subpaths first, then catch-all
    "^@datarecce/ui/result$": "<rootDir>/packages/ui/src/result.ts",
    "^@datarecce/ui$": "<rootDir>/packages/ui/src/index.ts",
    "^@datarecce/ui/(.*)$": "<rootDir>/packages/ui/src/$1",
    "^(.*)agGridTheme$": "<rootDir>/__mocks__/agGridTheme.ts",
  },
  // Test file patterns
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  // Ignore worktrees to prevent duplicate module detection
  testPathIgnorePatterns: ["/node_modules/", "/.worktrees/"],
  modulePathIgnorePatterns: ["/.worktrees/"],
  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "app/**/*.{js,jsx,ts,tsx}",
    "packages/ui/src/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  // Transform ignore patterns for ES modules
  transformIgnorePatterns: [
    "/node_modules/(?!(react-data-grid|@emotion|@mui|react-markdown|remark-gfm|remark-parse|remark-rehype|unified|unist-util-visit|micromark|mdast-util-from-markdown|mdast-util-to-hast|mdast-util-gfm|hast-util-to-jsx-runtime|micromark-util-.*|vfile|vfile-message|unist-util-.*|devlop|bail|trough|decode-named-character-reference|character-entities|property-information|space-separated-tokens|comma-separated-tokens|hast-util-whitespace|trim-lines|ccount|escape-string-regexp|zwitch|html-url-attributes)/)",
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
