# Remove Pipeline Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone Pipeline Editor webview feature while preserving all non-editor pipeline and recipe workflows.

**Architecture:** The standalone editor is isolated behind the `PipelinePanel` class, the `tschef.openPipelineEditor` command registration in `src/extension.ts`, and the contributed command in `package.json`. Remove that surface area without touching the shared pipeline runner, store, recipe view, saved pipeline tree, or result presentation code.

**Tech Stack:** TypeScript VS Code extension, `package.json` VS Code contributions, Jest tests, TypeScript typecheck, esbuild bundle.

## Global Constraints

- Remove only the standalone Pipeline Editor webview feature.
- Keep recipe-based pipeline creation, saved pipeline storage, the Pipelines sidebar, saved pipeline execution, direct text pipeline execution, and result presentation behavior.
- Do not add a compatibility command or deprecation shim for `tschef.openPipelineEditor`.
- Do not remove pipeline storage, pipeline parsing/execution, saved pipeline commands, result presentation, or recipe functionality.

---

## File Structure

- Delete: `src/panels/pipelinePanel.ts` - standalone Pipeline Editor webview implementation.
- Modify: `src/extension.ts` - remove the `PipelinePanel` import and `tschef.openPipelineEditor` command registration only.
- Modify: `package.json` - remove the contributed `tschef.openPipelineEditor` command only.
- Modify: `test/commands/recipeViewProvider.test.ts` - update copy expectations if they still point users to the removed Pipeline Editor.

### Task 1: Remove Standalone Pipeline Editor Surface

**Files:**
- Delete: `src/panels/pipelinePanel.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`
- Modify if needed: `test/commands/recipeViewProvider.test.ts`

**Interfaces:**
- Consumes: existing commands `tschef.runPipeline`, `tschef.runSavedPipeline`, `tschef.runSavedPipelinePicker`, `tschef.loadRecipe`, `tschef.refreshPipelines`.
- Produces: no new interfaces. Removes the `tschef.openPipelineEditor` command contribution and command registration.

- [ ] **Step 1: Create an implementation branch if still on `master`**

Run: `git status --short --branch`

Expected if currently on master: output starts with `## master...origin/master`.

Run when on master: `git switch -c remove-pipeline-editor`

Expected: `Switched to a new branch 'remove-pipeline-editor'`.

- [ ] **Step 2: Write the failing package contribution test**

Add this test file:

```ts
// test/packageContributions.test.ts
import pkg from "../package.json";

describe("package contributions", () => {
  test("does not contribute the standalone pipeline editor command", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);

    expect(commands).not.toContain("tschef.openPipelineEditor");
    expect(commands).toContain("tschef.runPipeline");
    expect(commands).toContain("tschef.runSavedPipelinePicker");
  });
});
```

- [ ] **Step 3: Run the new test to verify it fails**

Run: `npm test -- --runTestsByPath test/packageContributions.test.ts`

Expected: FAIL because `commands` still contains `tschef.openPipelineEditor`.

- [ ] **Step 4: Remove the contributed command from `package.json`**

In `package.json`, delete only this object from `contributes.commands`:

```json
{
  "command": "tschef.openPipelineEditor",
  "title": "tschef: Open Pipeline Editor"
}
```

Keep the neighboring command objects valid JSON with correct commas.

- [ ] **Step 5: Run the new test to verify it passes**

Run: `npm test -- --runTestsByPath test/packageContributions.test.ts`

Expected: PASS.

- [ ] **Step 6: Remove the editor implementation reference from `src/extension.ts`**

Delete this import:

```ts
import { PipelinePanel } from "./panels/pipelinePanel";
```

Delete this command registration block only:

```ts
context.subscriptions.push(
  vscode.commands.registerCommand("tschef.openPipelineEditor", () => {
    PipelinePanel.open(context, pipeStore);
    log("Pipeline editor opened");
  }),
);
```

Do not change the `pipeStore` construction because it is still used by recipe save, saved pipeline commands, and the Pipelines tree.

- [ ] **Step 7: Delete the standalone editor file**

Delete `src/panels/pipelinePanel.ts`.

- [ ] **Step 8: Update stale user-facing copy if the existing test fails**

If `test/commands/recipeViewProvider.test.ts` or another existing test fails because UI copy says `Save as pipeline`, do not change it; that workflow remains valid.

If a test or source message says `Save one in the Pipeline Editor first.`, change the message in `src/extension.ts` to:

```ts
"ts-chef: No saved pipelines. Save one from the Recipe view first."
```

Add or update the corresponding assertion to expect `Recipe view` instead of `Pipeline Editor`.

- [ ] **Step 9: Search for removed editor references**

Run: `rg "openPipelineEditor|PipelinePanel|pipelineEditor|Pipeline Editor" package.json src test`

Expected: no matches, except no action is needed for historical docs under `docs/superpowers` if they describe the removal.

- [ ] **Step 10: Run focused tests**

Run: `npm test -- --runTestsByPath test/packageContributions.test.ts test/commands/recipeViewProvider.test.ts test/commands/pipelineResult.test.ts`

Expected: PASS.

- [ ] **Step 11: Run typecheck**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 12: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 13: Review the final diff**

Run: `git diff -- package.json src/extension.ts src/panels/pipelinePanel.ts test/packageContributions.test.ts test/commands/recipeViewProvider.test.ts docs/superpowers/specs/2026-06-23-remove-pipeline-editor-design.md docs/superpowers/plans/2026-06-23-remove-pipeline-editor.md`

Expected: diff only removes the standalone editor surface and adds the spec, plan, and contribution regression test.

- [ ] **Step 14: Do not commit unless explicitly requested**

Leave changes unstaged unless the user asks for a commit. If asked to commit, inspect `git status`, `git diff`, and `git log --oneline -10` before staging only the files changed for this removal.

---

## Self-Review

- Spec coverage: Task 1 removes the contributed editor command, command registration, and `PipelinePanel` implementation while preserving the listed pipeline and recipe workflows.
- Placeholder scan: The plan contains exact paths, exact commands, and exact expected outcomes.
- Type consistency: Removed symbols are consistently named `PipelinePanel` and `tschef.openPipelineEditor`; preserved commands match existing command IDs.
