import react from "eslint-plugin-react";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import importXPlugin from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tailwind from "eslint-plugin-tailwindcss";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
        ...globals.es2024,
      },
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: ["./tsconfig.json"],
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  eslint.configs.recommended,
  importXPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.typescript,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  ...tailwind.configs["flat/recommended"],
  prettierRecommended,
  {
    ignores: [
      "**/.next",
      "**/.swc",
      "*.js",
      "**/.vscode",
      "**/.husky",
      "**/.github",
      "**/public",
      "**/node_modules",
      "**/out",
      "eslint.config.*",
    ],
  },
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      "import-x/default": "off",
      "import-x/no-named-as-default": "off",
      "import-x/no-named-as-default-member": "off",
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-img-element": "off",
      "@next/next/no-duplicate-head": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      // 'react/no-array-index-key': 'error',
      "react/no-unknown-property": [
        "error",
        {
          ignore: ["jsx", "global"],
        },
      ],
      // '@typescript-eslint/no-explicit-any': 'error',
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/non-nullable-type-assertion-style": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "prettier/prettier": [
        "error",
        {
          semi: true,
          endOfLine: "auto",
          tabWidth: 2,
          printWidth: 100,
          singleQuote: false,
          trailingComma: "all",
          bracketSameLine: true,
          usePrettierrc: false,
        },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          "allowNumber": true
        }
      ],
      // TODO
      //  ------------------------------------------------------------------------------------
      //  Marking the below as warnings ""for now"" - They need to be addressed in the future
      //  ------------------------------------------------------------------------------------
      "react/no-array-index-key": "warn", // 6 errors
      "@typescript-eslint/no-explicit-any": "warn", // 124 errors
      "@typescript-eslint/no-unsafe-member-access": "warn", // 120 errors
      "@typescript-eslint/no-misused-promises": "warn", // 26 errors
      "@typescript-eslint/prefer-nullish-coalescing": "warn", // 133 errors
      "@typescript-eslint/no-floating-promises": "warn", // 49 errors
      "@typescript-eslint/no-unsafe-assignment": "warn", // 131 errors
      "@typescript-eslint/no-unsafe-argument": "warn", // 17 errors
      "@typescript-eslint/no-unsafe-call": "warn", // 8 errors
      "@typescript-eslint/no-redundant-type-constituents": "warn", // 16 errors
      "@typescript-eslint/no-unsafe-return": "warn", // 24 errors
      "@typescript-eslint/require-await": "warn", // 6 errors
      "@typescript-eslint/await-thenable": "warn", // 5 errors
      "@typescript-eslint/no-confusing-void-expression": "warn", // 5 errors (same as await-thenable)
    },
  },
);
