import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  Buffer: "readonly",
  console: "readonly",
  process: "readonly",
  structuredClone: "readonly"
};

const browserGlobals = {
  document: "readonly",
  HTMLElement: "readonly",
  localStorage: "readonly",
  navigator: "readonly",
  window: "readonly"
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/generated/**",
      "**/out/**",
      "artifacts/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{mjs,cjs,js}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: nodeGlobals
    }
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        require: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    files: ["apps/desktop/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: browserGlobals
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }]
    }
  }
];
