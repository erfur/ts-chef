# Linter Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run lint` exit successfully while retaining visible warnings for inherited CyberChef lint debt.

**Architecture:** ESLint will exclude reproducible outputs and the generated operation registry, apply a warning-only baseline to the ported core's existing error rules, and remain strict everywhere else. The remaining strict-scope errors will be corrected with file-specific CommonJS configuration and static test imports.

**Tech Stack:** ESLint 10 flat config, typescript-eslint, TypeScript, Jest, npm

## Global Constraints

- `npm run lint` must exit successfully with no ESLint errors.
- Existing `src/chef/**` violations remain visible as warnings rather than being ignored.
- Recommended ESLint rules remain errors outside the explicitly scoped legacy override.
- Generated or reproducible content under `coverage/**`, `test-report/**`, and `src/generated/**` is not linted.
- Do not modify `src/generated/opsRegistry.ts`; it contains a pre-existing user change.
- Do not create commits unless the user explicitly requests one.

---

### Task 1: Establish A Passing Lint Baseline

**Files:**
- Modify: `eslint.config.mjs:4-17`
- Modify: `test/operations/Argon2Compare.test.ts:1-35`
- Modify: `test/operations/CipherSaber2Decrypt.test.ts:1-18`
- Test: `npm run lint`
- Test: `test/operations/Argon2Compare.test.ts`
- Test: `test/operations/CipherSaber2Decrypt.test.ts`

**Interfaces:**
- Consumes: ESLint flat-config file matching, named exports `Argon2` and `CipherSaber2Encrypt`.
- Produces: a lint command with zero errors and unchanged operation-test behavior.

- [ ] **Step 1: Verify the lint regression**

Run:

```bash
npm run lint
```

Expected: FAIL with errors from generated reports, `src/generated/opsRegistry.ts`, inherited rules under `src/chef/**`, CommonJS `module` in `jest.config.js`, and three dynamic test imports.

- [ ] **Step 2: Scope generated content and inherited core debt in ESLint**

Update `eslint.config.mjs` so its project-specific blocks are:

```js
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
```

- [ ] **Step 3: Replace forbidden dynamic imports in operation tests**

Add the static imports:

```ts
import { Argon2 } from "../../src/chef/operations/Argon2";
import { Argon2Compare } from "../../src/chef/operations/Argon2Compare";
```

Replace both dynamic constructions in `Argon2Compare.test.ts` with:

```ts
const argon2Op = new Argon2();
```

Add the static import in `CipherSaber2Decrypt.test.ts`:

```ts
import { CipherSaber2Decrypt } from "../../src/chef/operations/CipherSaber2Decrypt";
import { CipherSaber2Encrypt } from "../../src/chef/operations/CipherSaber2Encrypt";
```

Remove the unused `Utils` import and replace the dynamic construction with:

```ts
const encrypt = new CipherSaber2Encrypt();
```

- [ ] **Step 4: Verify the focused tests**

Run:

```bash
npm test -- --runInBand test/operations/Argon2Compare.test.ts test/operations/CipherSaber2Decrypt.test.ts
```

Expected: PASS for both test suites.

- [ ] **Step 5: Verify lint and type safety**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both commands exit 0; lint reports warnings but no errors.

- [ ] **Step 6: Inspect the final diff**

Run:

```bash
git status --short
```

Expected: only the lint configuration, two operation tests, design, and plan are changed by this task; `src/generated/opsRegistry.ts` remains pre-existing and untouched.
