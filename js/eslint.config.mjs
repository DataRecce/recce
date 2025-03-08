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
      // TODO
      //  ------------------------------------------------------------------------------------
      //  Marking the below as warnings ""for now"" - They need to be addressed in the future
      //  ------------------------------------------------------------------------------------
      "react/no-array-index-key": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-extra-non-null-assertion": "warn",
      "@typescript-eslint/restrict-plus-operands": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",
      "@typescript-eslint/no-unnecessary-type-arguments": "warn",
      "@typescript-eslint/consistent-indexed-object-style": "warn",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "@typescript-eslint/consistent-generic-constructors": "warn",
      "@typescript-eslint/no-unnecessary-template-expression": "warn",
      "@typescript-eslint/consistent-type-definitions": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-confusing-void-expression": "warn",
    },
  },
);
