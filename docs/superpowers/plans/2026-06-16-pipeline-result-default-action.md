# Configurable Pipeline Result Action — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set a default for what happens to a pipeline's result — show the popup (current behavior), replace directly, or copy to the clipboard — via a new `tschef.pipelineResultAction` setting.

**Architecture:** Extract the duplicated result-handling logic from the `runPipeline` and `runSavedPipeline` commands into a single `presentPipelineResult` helper in its own module (`src/commands/pipelineResult.ts`). The helper reads the new setting and branches to popup / replace / copy. A new VS Code configuration property exposes the setting. The helper is unit-tested against the existing `vscode` jest mock (extended as needed).

**Tech Stack:** TypeScript, VS Code extension API, Jest + ts-jest (with `vscode` mocked via `test/vscode-mock.ts`), esbuild bundling.

**Deviation from spec:** The design doc placed the helper "in `extension.ts`". This plan puts it in a dedicated module `src/commands/pipelineResult.ts` instead, so it can be unit-tested in isolation (importing `extension.ts` would pull in the registry, panel, and providers). Behavior is identical.

---

## File Structure

- **Create** `src/commands/pipelineResult.ts` — exports `PipelineResultAction` type and `presentPipelineResult(editor, result, label)`. Imports only `vscode`. One responsibility: present a pipeline result per the configured action.
- **Modify** `test/vscode-mock.ts` — extend the mock with the API surface the helper uses (`window.showInformationMessage`, `window.setStatusBarMessage`, `workspace.getConfiguration().get`, `env.clipboard.writeText`, `Position`, `Selection`) plus a `__setConfig` test helper.
- **Create** `test/commands/pipelineResult.test.ts` — unit tests for all three modes.
- **Modify** `package.json` — add the `configuration` contribution with the new property.
- **Modify** `src/extension.ts` — import the helper; replace the two inline result blocks with helper calls.
- **Modify** `docs/usage.md` — document the new setting.

---

## Task 1: `presentPipelineResult` helper (TDD)

**Files:**
- Modify: `test/vscode-mock.ts`
- Test: `test/commands/pipelineResult.test.ts` (create)
- Create: `src/commands/pipelineResult.ts`

- [ ] **Step 1: Extend the vscode mock**

Replace the entire contents of `test/vscode-mock.ts` with:

```ts
/**
 * Minimal `vscode` mock for unit tests. Implements the surface used by
 * src/storage/store.ts and src/commands/pipelineResult.ts.
 *
 * `workspace.workspaceFolders` is settable so tests can simulate an
 * open/closed folder. Values returned by
 * `workspace.getConfiguration(...).get(key, default)` are settable via
 * `__setConfig`.
 */
export const window = {
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  setStatusBarMessage: jest.fn(),
};

let configValues: Record<string, unknown> = {};

/** Test helper: set the values returned by getConfiguration(...).get(). */
export function __setConfig(values: Record<string, unknown>): void {
  configValues = values;
}

export const workspace: {
  workspaceFolders: { uri: { fsPath: string } }[] | undefined;
  getConfiguration: (section?: string) => {
    get: <T>(key: string, defaultValue: T) => T;
  };
} = {
  workspaceFolders: undefined,
  getConfiguration: () => ({
    get: <T>(key: string, defaultValue: T): T =>
      key in configValues ? (configValues[key] as T) : defaultValue,
  }),
};

export const env = {
  clipboard: {
    writeText: jest.fn(),
  },
};

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Selection {
  constructor(
    public readonly anchor: unknown,
    public readonly active: unknown,
  ) {}
}
```

- [ ] **Step 2: Write the failing test**

Create `test/commands/pipelineResult.test.ts`:

```ts
import { presentPipelineResult } from "../../src/commands/pipelineResult";
import { window, env, __setConfig, Position, Selection } from "../vscode-mock";
import type { TextEditor } from "vscode";

/** Build a fake TextEditor with a spyable edit builder. */
function makeEditor(opts?: { selectionEmpty?: boolean; text?: string }) {
  const editBuilder = { replace: jest.fn() };
  const editor = {
    selection: { isEmpty: opts?.selectionEmpty ?? false },
    document: {
      getText: () => opts?.text ?? "input",
      positionAt: (n: number) => new Position(0, n),
    },
    edit: jest.fn(async (cb: (eb: { replace: jest.Mock }) => void) => {
      cb(editBuilder);
      return true;
    }),
  };
  return { editor, editBuilder };
}

beforeEach(() => {
  jest.clearAllMocks();
  __setConfig({});
});

describe("presentPipelineResult", () => {
  test("copy mode copies to clipboard without a popup", async () => {
    __setConfig({ pipelineResultAction: "copy" });
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(env.clipboard.writeText).toHaveBeenCalledWith("RESULT");
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(window.setStatusBarMessage).toHaveBeenCalled();
  });

  test("replace mode edits the selection without a popup", async () => {
    __setConfig({ pipelineResultAction: "replace" });
    const { editor, editBuilder } = makeEditor({ selectionEmpty: false });

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(editor.edit).toHaveBeenCalled();
    expect(editBuilder.replace).toHaveBeenCalledWith(editor.selection, "RESULT");
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(window.setStatusBarMessage).toHaveBeenCalled();
  });

  test("replace mode with empty selection targets the whole document", async () => {
    __setConfig({ pipelineResultAction: "replace" });
    const { editor, editBuilder } = makeEditor({
      selectionEmpty: true,
      text: "abcd",
    });

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(editBuilder.replace).toHaveBeenCalledTimes(1);
    const [range] = editBuilder.replace.mock.calls[0];
    expect(range).toBeInstanceOf(Selection);
  });

  test("popup mode shows the message and replaces when Replace is chosen", async () => {
    __setConfig({}); // default -> popup
    window.showInformationMessage.mockResolvedValue("Replace");
    const { editor, editBuilder } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      "Result: RESULT",
      "Replace",
      "Copy",
    );
    expect(editBuilder.replace).toHaveBeenCalledWith(editor.selection, "RESULT");
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });

  test("popup mode copies when Copy is chosen", async () => {
    window.showInformationMessage.mockResolvedValue("Copy");
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(env.clipboard.writeText).toHaveBeenCalledWith("RESULT");
  });

  test("popup mode does nothing when dismissed", async () => {
    window.showInformationMessage.mockResolvedValue(undefined);
    const { editor, editBuilder } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(editBuilder.replace).not.toHaveBeenCalled();
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest test/commands/pipelineResult.test.ts`
Expected: FAIL — `Cannot find module '../../src/commands/pipelineResult'`.

- [ ] **Step 4: Implement the helper**

Create `src/commands/pipelineResult.ts`:

```ts
import * as vscode from "vscode";

export type PipelineResultAction = "popup" | "replace" | "copy";

/**
 * Range to overwrite when replacing: the current selection, or the whole
 * document when the selection is empty.
 */
function replaceTarget(editor: vscode.TextEditor): vscode.Selection {
  return editor.selection.isEmpty
    ? new vscode.Selection(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
      )
    : editor.selection;
}

/**
 * Present a pipeline's result according to the `tschef.pipelineResultAction`
 * setting: show a popup with Replace/Copy buttons (default, "popup"), replace
 * the selection directly ("replace"), or copy to the clipboard ("copy").
 *
 * @param label Prefix shown in the popup message (e.g. `Result` or
 *   `Pipeline "name"`). Unused in the replace/copy modes.
 */
export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
): Promise<void> {
  const mode = vscode.workspace
    .getConfiguration("tschef")
    .get<PipelineResultAction>("pipelineResultAction", "popup");

  if (mode === "replace") {
    await editor.edit((eb) => eb.replace(replaceTarget(editor), result));
    vscode.window.setStatusBarMessage(
      "ts-chef: Pipeline result replaced selection",
      3000,
    );
    return;
  }

  if (mode === "copy") {
    vscode.env.clipboard.writeText(result);
    vscode.window.setStatusBarMessage("ts-chef: Pipeline result copied", 3000);
    return;
  }

  const preview = `${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
  const action = await vscode.window.showInformationMessage(
    `${label}: ${preview}`,
    "Replace",
    "Copy",
  );
  if (action === "Replace") {
    await editor.edit((eb) => eb.replace(replaceTarget(editor), result));
  }
  if (action === "Copy") {
    vscode.env.clipboard.writeText(result);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest test/commands/pipelineResult.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 6: Run the full suite + typecheck (mock change must not break existing tests)**

Run: `npm test && npm run typecheck`
Expected: all suites pass (including `test/storage/store.test.ts`); typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/commands/pipelineResult.ts test/commands/pipelineResult.test.ts test/vscode-mock.ts
git commit -m "feat: add presentPipelineResult helper with configurable action"
```

---

## Task 2: Register the `tschef.pipelineResultAction` setting

**Files:**
- Modify: `package.json` (add a `configuration` contribution after `menus`)

- [ ] **Step 1: Add the configuration contribution**

In `package.json`, find the end of the `contributes.menus` block:

```json
        {
          "command": "tschef.runSavedPipelinePicker",
          "when": "view == tschef.pipelinesView",
          "group": "navigation"
        }
      ]
    }
  },
```

Replace it with (adds a comma after the `menus` closing brace and a new `configuration` block):

```json
        {
          "command": "tschef.runSavedPipelinePicker",
          "when": "view == tschef.pipelinesView",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "tschef",
      "properties": {
        "tschef.pipelineResultAction": {
          "type": "string",
          "enum": ["popup", "replace", "copy"],
          "enumDescriptions": [
            "Show a notification with Replace/Copy buttons (current behavior)",
            "Replace the selection (or whole document if nothing is selected) with the result",
            "Copy the result to the clipboard"
          ],
          "default": "popup",
          "description": "What to do with a pipeline's result. 'popup' asks each time."
        }
      }
    }
  },
```

- [ ] **Step 2: Verify package.json is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add tschef.pipelineResultAction setting"
```

---

## Task 3: Wire the helper into the pipeline commands

**Files:**
- Modify: `src/extension.ts` (import + two result blocks)

- [ ] **Step 1: Add the import**

In `src/extension.ts`, find:

```ts
import {
  runOp,
  parsePipeline,
  runPipeline,
  resolveDefaultArg,
} from "./commands/runner";
```

Insert immediately after it:

```ts
import { presentPipelineResult } from "./commands/pipelineResult";
```

- [ ] **Step 2: Replace the `runPipeline` result block**

In `src/extension.ts`, find this block (inside the `tschef.runPipeline` command):

```ts
        const action = await vscode.window.showInformationMessage(
          `Result: ${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`,
          "Replace Selection",
          "Copy",
        );
        if (action === "Replace Selection") {
          await editor.edit((eb) => {
            const sel = editor.selection.isEmpty
              ? new vscode.Selection(
                  editor.document.positionAt(0),
                  editor.document.positionAt(editor.document.getText().length),
                )
              : editor.selection;
            eb.replace(sel, result);
          });
        }
        if (action === "Copy") vscode.env.clipboard.writeText(result);
```

Replace it with:

```ts
        await presentPipelineResult(editor, result, "Result");
```

- [ ] **Step 3: Replace the `runSavedPipeline` result block**

In `src/extension.ts`, find this block (inside the `tschef.runSavedPipeline` command):

```ts
          const action = await vscode.window.showInformationMessage(
            `Pipeline "${name}": ${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`,
            "Replace",
            "Copy",
          );
          if (action === "Replace") {
            await editor.edit((eb) => {
              const sel = editor.selection.isEmpty
                ? new vscode.Selection(
                    editor.document.positionAt(0),
                    editor.document.positionAt(
                      editor.document.getText().length,
                    ),
                  )
                : editor.selection;
              eb.replace(sel, result);
            });
          }
          if (action === "Copy") vscode.env.clipboard.writeText(result);
```

Replace it with:

```ts
          await presentPipelineResult(editor, result, `Pipeline "${name}"`);
```

- [ ] **Step 4: Typecheck and bundle**

Run: `npm run typecheck && npm run compile`
Expected: typecheck exits 0; esbuild produces `dist/extension.js` with no errors (pre-existing d3 warnings are fine).

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts
git commit -m "feat: route pipeline command results through presentPipelineResult"
```

---

## Task 4: Document the setting

**Files:**
- Modify: `docs/usage.md`

- [ ] **Step 1: Add a section to usage.md**

In `docs/usage.md`, find the start of the Variables section:

```markdown
## Variables
```

Insert this new section immediately before it:

```markdown
## Pipeline result action

When you run a pipeline from a command (**ts-chef: Run Pipeline on Selection** or **ts-chef: Run Saved Pipeline**), ts-chef shows the result in a notification with **Replace** and **Copy** buttons by default. Set `tschef.pipelineResultAction` to change this default:

-   `popup` (default) — ask each time with Replace/Copy buttons.
-   `replace` — replace the selection (or the whole document if nothing is selected) with the result.
-   `copy` — copy the result to the clipboard.

```

- [ ] **Step 2: Commit**

```bash
git add docs/usage.md
git commit -m "docs: document tschef.pipelineResultAction setting"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck exits 0; all test suites pass (including the 6 new `presentPipelineResult` tests); build produces `dist/extension.js` (pre-existing d3 warnings only).

- [ ] **Step 2: Confirm no dangling references to the old inline logic**

Run: `grep -n "Replace Selection" src/extension.ts || echo "clean"`
Expected: prints `clean` (the old "Replace Selection" button label is gone).

---

## Self-Review

**Spec coverage:**
- Config option with popup/replace/copy + default popup → Task 2 ✓
- popup = current behavior; replace = replace selection/whole-doc; copy = clipboard, each with status-bar feedback for non-popup → Task 1 helper + Task 3 wiring ✓
- Applies to `runPipeline` and `runSavedPipeline` only; panel untouched → Task 3 (panel not referenced) ✓
- Shared helper removes duplication; popup button unified to `Replace` → Task 1 + Task 3 ✓
- Unit tests for the three modes via the vscode mock → Task 1 ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code.

**Type consistency:** `presentPipelineResult(editor, result, label)` and `PipelineResultAction` are defined in Task 1 and used identically in Task 3. Mock exports (`window`, `env`, `__setConfig`, `Position`, `Selection`) defined in Task 1 Step 1 and consumed in Task 1 Step 2. Config key `pipelineResultAction` matches across helper, test, and package.json.
