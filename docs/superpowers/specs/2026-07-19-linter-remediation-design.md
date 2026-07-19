# Linter Remediation Design

## Goal

Make `npm run lint` exit successfully while preserving useful warnings for the
ported CyberChef core and strict error handling for handwritten extension and
test code.

## Scope

- Exclude generated or reproducible content from ESLint: `coverage/**`,
  `test-report/**`, and `src/generated/**`.
- Continue linting `src/chef/**`, but downgrade its existing inherited error
  rule violations to warnings so they remain visible without blocking lint.
- Keep the recommended ESLint and TypeScript ESLint rules unchanged for other
  source and test files.
- Declare the CommonJS `module` global for `jest.config.js`.
- Replace the dynamic `require()` calls reported in the two affected tests with
  static imports and remove imports or constants made visibly unnecessary by
  those edits.

## Rationale

The current lint command scans generated test reports and the generated
operation registry, producing thousands of errors in files that should not be
edited by hand. The ported core also has a bounded set of inherited violations
across rules whose mechanical correction could alter transformation behavior.
Ignoring the core completely would hide future lint feedback, while fixing all
legacy violations would make this task broad and behavior-sensitive. A
file-scoped warning baseline keeps the debt observable and lets new extension
code remain strict.

## Verification

- Run `npm run lint` and require a zero exit status with no ESLint errors.
- Run the affected operation tests.
- Run `npm run typecheck` to verify static imports and configuration changes do
  not introduce TypeScript failures.
- Confirm the pre-existing modification to `src/generated/opsRegistry.ts`
  remains untouched.
