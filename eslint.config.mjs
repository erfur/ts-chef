import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "warn"
    }
  },
  {
    files: ["src/chef/**"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-array-constructor": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-async-promise-executor": "warn",
      "no-case-declarations": "warn",
      "no-control-regex": "warn",
      "no-empty": "warn",
      "no-prototype-builtins": "warn",
      "no-useless-assignment": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      "preserve-caught-error": "warn"
    }
  },
  {
    files: ["jest.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly" }
    }
  },
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "out/**",
      "scripts/**",
      "src/generated/**",
      "test-report/**"
    ]
  }
);
