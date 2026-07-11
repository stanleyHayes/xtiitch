import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.expo/**",
      "**/.turbo/**",
      "**/.vercel/**",
      "**/.react-router/**",
      "apps/api/**",
    ],
  },
  {
    linterOptions: {
      noInlineConfig: false,
      reportUnusedDisableDirectives: "error",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/metro.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "complexity": ["error", 15],
      "eqeqeq": ["error", "always"],
      "max-depth": ["error", 4],
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 5],
      "no-console": "off",
      "no-implicit-coercion": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-const": "error",
    },
  },
];
