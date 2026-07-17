# No-Input Operation Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow explicitly annotated input-free and optional-input operations to run without an editor selection and insert replacement results at the cursor.

**Architecture:** Add safe-default input semantics to the operation model, then let direct operation execution use those semantics when validating selected text. Extend the existing result presentation path with an explicit target range so direct operations can target the cursor while pipelines retain their whole-document default.

**Tech Stack:** TypeScript, VS Code extension API, Jest, ts-jest

## Global Constraints

- `Operation.inputMode` must be `"required" | "optional" | "none"` and default to `"required"`.
- Input behavior must be explicit metadata, never inferred from an operation name or argument definition.
- Empty-selection replacement for direct optional/input-free operations inserts at the cursor.
- Existing pipeline and recipe empty-selection replacement continues to target the whole document.
- Quick Convert behavior and pipeline input selection do not change.
- Direct operation execution must still require an active editor.
- Do not modify or stage the pre-existing worktree change in `src/generated/opsRegistry.ts`.

---

### Task 1: Operation Input Semantics

**Files:**
- Create: `test/commands/operationInputMode.test.ts`
- Modify: `src/chef/Operation.ts:46-121`
- Modify: `src/chef/operations/GenerateLoremIpsum.ts:30-39`
- Modify: `src/chef/operations/GenerateDeBruijnSequence.ts:24-34`
- Modify: `src/chef/operations/GeneratePGPKeyPair.ts:27-36`
- Modify: `src/chef/operations/GenerateRSAKeyPair.ts:25-34`
- Modify: `src/chef/operations/GenerateECDSAKeyPair.ts:25-35`
- Modify: `src/chef/operations/PseudoRandomNumberGenerator.ts:26-36`
- Modify: `src/chef/operations/PseudoRandomIntegerGenerator.ts:27-36`
- Modify: `src/chef/operations/GetTime.ts:19-28`
- Modify: `src/chef/operations/XKCDRandomNumber.ts:17-26`
- Modify: `src/chef/operations/GenerateUUID.ts:21-30`
- Modify: `src/chef/operations/GenerateHOTP.ts:24-35`
- Modify: `src/chef/operations/GenerateTOTP.ts:24-34`
- Modify: `src/chef/operations/Numberwang.ts:30-39`

**Interfaces:**
- Consumes: Existing `Operation` subclasses and their constructor metadata.
- Produces: `InputMode = "required" | "optional" | "none"` and `Operation.inputMode: InputMode` for Task 3.

- [ ] **Step 1: Write the failing metadata tests**

Create `test/commands/operationInputMode.test.ts`:

```ts
import { Operation } from "../../src/chef/Operation";
import { GenerateLoremIpsum } from "../../src/chef/operations/GenerateLoremIpsum";
import { GenerateUUID } from "../../src/chef/operations/GenerateUUID";

class DefaultInputOperation extends Operation {
  run(input: string): string {
    return input;
  }
}

describe("operation input modes", () => {
  test("operations require input by default", () => {
    expect(new DefaultInputOperation().inputMode).toBe("required");
  });

  test("input-independent generators declare no input", () => {
    expect(new GenerateLoremIpsum().inputMode).toBe("none");
  });

  test("generators that can consume input declare optional input", () => {
    expect(new GenerateUUID().inputMode).toBe("optional");
  });
});
```

- [ ] **Step 2: Run the metadata tests to verify they fail**

Run: `npm test -- --runTestsByPath test/commands/operationInputMode.test.ts --runInBand`

Expected: FAIL because `inputMode` does not exist on `Operation` and the generator classes.

- [ ] **Step 3: Add the input mode type and safe default**

In `src/chef/Operation.ts`, add the type near the other exported types:

```ts
/** Whether an operation requires, optionally consumes, or ignores source data. */
export type InputMode = "required" | "optional" | "none";
```

Add this property to `Operation` immediately after `presentType`:

```ts
  /** Whether direct execution requires selected source data. */
  inputMode: InputMode = "required";
```

- [ ] **Step 4: Annotate operations that never consume source data**

In each listed constructor, place this assignment after `inputType` and before `outputType`:

```ts
    this.inputMode = "none";
```

Apply it to exactly these classes:

```text
GenerateLoremIpsum
GenerateDeBruijnSequence
GeneratePGPKeyPair
GenerateRSAKeyPair
GenerateECDSAKeyPair
PseudoRandomNumberGenerator
PseudoRandomIntegerGenerator
GetTime
XKCDRandomNumber
```

- [ ] **Step 5: Annotate operations that accept empty source data**

In each listed constructor, place this assignment after `inputType` and before `outputType`:

```ts
    this.inputMode = "optional";
```

Apply it to exactly these classes:

```text
GenerateUUID
GenerateHOTP
GenerateTOTP
Numberwang
```

Do not annotate Generate QR Code, Generate Image, Generate all hashes, or Generate all checksums; they must inherit `"required"`.

- [ ] **Step 6: Run the metadata tests to verify they pass**

Run: `npm test -- --runTestsByPath test/commands/operationInputMode.test.ts --runInBand`

Expected: PASS with 3 tests.

- [ ] **Step 7: Run type checking**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit the operation model**

```bash
git add src/chef/Operation.ts src/chef/operations/GenerateLoremIpsum.ts src/chef/operations/GenerateDeBruijnSequence.ts src/chef/operations/GeneratePGPKeyPair.ts src/chef/operations/GenerateRSAKeyPair.ts src/chef/operations/GenerateECDSAKeyPair.ts src/chef/operations/PseudoRandomNumberGenerator.ts src/chef/operations/PseudoRandomIntegerGenerator.ts src/chef/operations/GetTime.ts src/chef/operations/XKCDRandomNumber.ts src/chef/operations/GenerateUUID.ts src/chef/operations/GenerateHOTP.ts src/chef/operations/GenerateTOTP.ts src/chef/operations/Numberwang.ts test/commands/operationInputMode.test.ts
```

---

### Task 2: Explicit Result Targets

**Files:**
- Modify: `src/commands/pipelineResult.ts:10-84`
- Modify: `src/commands/inlineResult.ts:1-45`
- Modify: `src/commands/webviewResult.ts:1-88`
- Modify: `test/commands/pipelineResult.test.ts`
- Modify: `test/commands/inlineResult.test.ts`
- Modify: `test/commands/webviewResult.test.ts`

**Interfaces:**
- Consumes: Existing `replaceTarget(editor)` fallback behavior.
- Produces: `ResultRenderer`, `ResultRenderers`, `presentPipelineResult(..., renderers?, target?)`, `InlineResultController.show(..., targetRange?)`, and `WebviewResultController.show(..., targetRange?)` for Task 3.

- [ ] **Step 1: Add failing tests for explicit targets in direct and popup replacement**

In `test/commands/pipelineResult.test.ts`, import `Range` from `../vscode-mock`, add `Range as VsCodeRange` to the `vscode` type import, then add:

```ts
  test.each(["replace", "popup"] as const)(
    "%s mode uses an explicit replacement target",
    async (mode) => {
      __setConfig({ pipelineResultAction: mode });
      if (mode === "popup") {
        window.showInformationMessage.mockResolvedValue("Replace");
      }
      const { editor, editBuilder } = makeEditor({ selectionEmpty: true });
      const target = new Range(0, 2, 0, 2) as unknown as VsCodeRange;

      await presentPipelineResult(
        editor as unknown as TextEditor,
        "RESULT",
        "Result",
        undefined,
        target,
      );

      expect(editBuilder.replace).toHaveBeenCalledWith(target, "RESULT");
    },
  );

  test("renderer receives the explicit replacement target", async () => {
    __setConfig({ pipelineResultAction: "inline" });
    const showInline = jest.fn();
    const { editor } = makeEditor({ selectionEmpty: true });
    const target = new Range(0, 2, 0, 2) as unknown as VsCodeRange;

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      { inline: showInline },
      target,
    );

    expect(showInline).toHaveBeenCalledWith(editor, "RESULT", target);
  });
```

- [ ] **Step 2: Add failing tests for stored inline and panel targets**

In `test/commands/inlineResult.test.ts`, import `Range` from `../vscode-mock`, add `Range as VsCodeRange` to the existing `vscode` type import, then add:

```ts
  test("apply replace uses an explicit target supplied to show", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor, editBuilder } = makeEditor();
    const target = new Range(2, 3, 2, 3) as unknown as VsCodeRange;
    c.show(editor as unknown as TextEditor, "RESULT", target);

    const lenses = c.provideCodeLenses(fakeDoc()) as Lens[];
    const id = cmd(lenses[1]).arguments?.[1] as number;
    await getApply()("replace", id);

    expect(editBuilder.replace).toHaveBeenCalledWith(target, "RESULT");
  });
```

In `test/commands/webviewResult.test.ts`, import `Range` from `../vscode-mock`, add `Range as VsCodeRange` to the `vscode` type import, then add:

```ts
  test("replace uses an explicit target supplied to show", async () => {
    const panel = makeFakePanel();
    window.createWebviewPanel.mockReturnValue(panel);
    const c = new WebviewResultController();
    const { editor, editBuilder } = makeEditor();
    const target = new Range(1, 3, 1, 3) as unknown as VsCodeRange;
    c.show(editor as unknown as TextEditor, "RESULT", target);

    const onMessage = panel.webview.onDidReceiveMessage.mock.calls[0][0];
    await onMessage({ type: "replace" });

    expect(editBuilder.replace).toHaveBeenCalledWith(target, "RESULT");
  });
```

- [ ] **Step 3: Run result tests to verify they fail**

Run: `npm test -- --runTestsByPath test/commands/pipelineResult.test.ts test/commands/inlineResult.test.ts test/commands/webviewResult.test.ts --runInBand`

Expected: FAIL because the presentation and controller methods do not accept explicit targets.

- [ ] **Step 4: Extend the result presentation interface**

In `src/commands/pipelineResult.ts`, replace the private renderer type with exported types:

```ts
export type ResultRenderer = (
  editor: vscode.TextEditor,
  result: string,
  target: vscode.Range,
) => void | Promise<void>;

export type ResultRenderers = Partial<
  Record<"inline" | "panel", ResultRenderer>
>;
```

Change `presentPipelineResult` to accept an optional explicit target after the renderer map:

```ts
export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
  render?: ResultRenderers,
  target: vscode.Range = replaceTarget(editor),
): Promise<void> {
```

Inside that function, replace both `replaceTarget(editor)` calls with `target`, and pass `target` to a selected renderer:

```ts
  if (mode === "replace") {
    await editor.edit((eb) => eb.replace(target, result));
    vscode.window.setStatusBarMessage(
      "ts-chef: Pipeline result replaced selection",
      3000,
    );
    return;
  }
```

```ts
  if (mode === "inline" || mode === "panel") {
    const renderer = render?.[mode];
    if (renderer) {
      await renderer(editor, result, target);
      return;
    }
  }
```

```ts
  if (action === "Replace") {
    await editor.edit((eb) => eb.replace(target, result));
  }
```

Update the existing inline and panel delegation assertions in `test/commands/pipelineResult.test.ts` because renderers now receive the resolved target:

```ts
    expect(showInline).toHaveBeenCalledWith(
      editor,
      "RESULT",
      editor.selection,
    );
```

```ts
    expect(showPanel).toHaveBeenCalledWith(
      editor,
      "RESULT",
      editor.selection,
    );
```

- [ ] **Step 5: Let inline and panel controllers store a supplied target**

Change `InlineResultController.show` in `src/commands/inlineResult.ts` to:

```ts
  /** Add `result` as a new inline CodeLens row for the supplied target. */
  show(
    editor: vscode.TextEditor,
    result: string,
    targetRange: vscode.Range = replaceTarget(editor),
  ): void {
    this.results.push({
      id: this.seq++,
      editor,
      uri: editor.document.uri,
      targetRange,
      result,
    });
    this._onDidChangeCodeLenses.fire();
  }
```

Change `WebviewResultController.show` in `src/commands/webviewResult.ts` to:

```ts
  /** Show `result` in the panel for the supplied target. */
  show(
    editor: vscode.TextEditor,
    result: string,
    targetRange: vscode.Range = replaceTarget(editor),
  ): void {
    this.state = { editor, targetRange, result };
```

Keep the remainder of `show` unchanged.

- [ ] **Step 6: Run result tests to verify they pass**

Run: `npm test -- --runTestsByPath test/commands/pipelineResult.test.ts test/commands/inlineResult.test.ts test/commands/webviewResult.test.ts --runInBand`

Expected: PASS with all existing and new tests. In particular, the existing `replace mode with empty selection targets the whole document` test must still pass.

- [ ] **Step 7: Run type checking**

Run: `npm run typecheck`

Expected: PASS. Existing two-argument renderer callbacks remain valid TypeScript functions even though the renderer receives a third argument.

- [ ] **Step 8: Commit explicit result targets**

```bash
git add src/commands/pipelineResult.ts src/commands/inlineResult.ts src/commands/webviewResult.ts test/commands/pipelineResult.test.ts test/commands/inlineResult.test.ts test/commands/webviewResult.test.ts
```

---

### Task 3: Direct Operation Execution Without Selection

**Files:**
- Create: `src/commands/applyOperation.ts`
- Create: `test/commands/applyOperation.test.ts`
- Modify: `src/extension.ts:11-31,105-109,123-140,202-239,285-340`

**Interfaces:**
- Consumes: `Operation.inputMode`, `ResultRenderers`, `runOp`, `resolveDefaultArg`, and `presentPipelineResult(..., renderers?, target?)`.
- Produces: `OperationEntry` and `applyOperation(opName: string, entry: OperationEntry | undefined, renderers: ResultRenderers): Promise<void>`.

- [ ] **Step 1: Write failing direct-execution tests**

Create `test/commands/applyOperation.test.ts`:

```ts
import {
  applyOperation,
  type OperationEntry,
} from "../../src/commands/applyOperation";
import { runOp } from "../../src/commands/runner";
import { presentPipelineResult } from "../../src/commands/pipelineResult";
import { window, Position } from "../vscode-mock";
import type { InputMode, Operation } from "../../src/chef/Operation";
import type { TextEditor } from "vscode";

jest.mock("../../src/commands/runner", () => ({
  ...jest.requireActual("../../src/commands/runner"),
  runOp: jest.fn(),
}));

jest.mock("../../src/commands/pipelineResult", () => ({
  ...jest.requireActual("../../src/commands/pipelineResult"),
  presentPipelineResult: jest.fn(),
}));

const runOpMock = runOp as jest.MockedFunction<typeof runOp>;
const presentMock = presentPipelineResult as jest.MockedFunction<
  typeof presentPipelineResult
>;

function entry(inputMode: InputMode): OperationEntry {
  return {
    displayName: "Test operation",
    factory: () => ({ args: [], inputMode }) as unknown as Operation,
  };
}

function makeEditor(text = "") {
  const active = new Position(0, 4);
  const selection = {
    isEmpty: text === "",
    active,
    start: active,
    end: active,
  };
  const editor = {
    selection,
    document: { getText: jest.fn(() => text) },
  } as unknown as TextEditor;
  return { editor, selection, active };
}

beforeEach(() => {
  jest.resetAllMocks();
  presentMock.mockResolvedValue(undefined);
});

describe("applyOperation", () => {
  test("rejects a required-input operation when selection is empty", async () => {
    const { editor } = makeEditor();
    (window as { activeTextEditor: unknown }).activeTextEditor = editor;

    await applyOperation("Required", entry("required"), {});

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      "ts-chef: Select text first.",
    );
    expect(runOpMock).not.toHaveBeenCalled();
  });

  test.each(["optional", "none"] as const)(
    "runs a %s-input operation with empty input",
    async (inputMode) => {
      const { editor } = makeEditor();
      (window as { activeTextEditor: unknown }).activeTextEditor = editor;
      runOpMock.mockReturnValue("RESULT");

      await applyOperation("Generator", entry(inputMode), {});

      expect(runOpMock).toHaveBeenCalledWith("Generator", "", []);
    },
  );

  test("awaits asynchronous output before presenting it", async () => {
    const { editor } = makeEditor();
    (window as { activeTextEditor: unknown }).activeTextEditor = editor;
    let resolveResult!: (value: unknown) => void;
    runOpMock.mockReturnValue(
      new Promise((resolve) => {
        resolveResult = resolve;
      }),
    );

    const applying = applyOperation("Generator", entry("none"), {});
    expect(presentMock).not.toHaveBeenCalled();
    resolveResult("ASYNC RESULT");
    await applying;

    expect(presentMock).toHaveBeenCalledWith(
      editor,
      "ASYNC RESULT",
      "Test operation",
      {},
      expect.anything(),
    );
  });

  test("targets the cursor when selection is empty", async () => {
    const { editor, active } = makeEditor();
    (window as { activeTextEditor: unknown }).activeTextEditor = editor;
    runOpMock.mockReturnValue("RESULT");

    await applyOperation("Generator", entry("none"), {});

    const target = presentMock.mock.calls[0][4] as unknown as {
      anchor: Position;
      active: Position;
    };
    expect(target.anchor).toEqual(active);
    expect(target.active).toEqual(active);
  });

  test("targets a non-empty selection and passes its text", async () => {
    const { editor, selection } = makeEditor("selected");
    (window as { activeTextEditor: unknown }).activeTextEditor = editor;
    runOpMock.mockReturnValue("RESULT");

    await applyOperation("Required", entry("required"), {});

    expect(runOpMock).toHaveBeenCalledWith("Required", "selected", []);
    expect(presentMock.mock.calls[0][4]).toBe(selection);
  });
});
```

- [ ] **Step 2: Run the direct-execution test to verify it fails**

Run: `npm test -- --runTestsByPath test/commands/applyOperation.test.ts --runInBand`

Expected: FAIL because `src/commands/applyOperation.ts` does not exist.

- [ ] **Step 3: Implement the focused direct-operation handler**

Create `src/commands/applyOperation.ts`:

```ts
import * as vscode from "vscode";
import type { Operation } from "../chef/Operation";
import { log } from "../logger";
import {
  presentPipelineResult,
  type ResultRenderers,
} from "./pipelineResult";
import { resolveDefaultArg, runOp } from "./runner";

export type OperationEntry = {
  displayName: string;
  factory: () => Operation;
};

export function resultToString(result: unknown): string {
  if (Array.isArray(result))
    return Buffer.from(result as number[]).toString("utf-8");
  if (typeof result === "string") return result;
  if (result === null || result === undefined) return "";
  return JSON.stringify(result, null, 2);
}

export async function promptForArgs(
  op: Operation,
): Promise<unknown[] | null> {
  const result: unknown[] = [];
  for (const argDef of op.args) {
    if (argDef.type === "toggleString" && (argDef.value as string) === "") {
      const strVal = await vscode.window.showInputBox({
        prompt: argDef.name,
        placeHolder: `Enter ${argDef.name.toLowerCase()} (encoding: ${argDef.toggleValues?.join(" / ") ?? "Hex"})`,
      });
      if (strVal === undefined) return null;
      const encoding =
        argDef.toggleValues && argDef.toggleValues.length > 1
          ? await vscode.window.showQuickPick(argDef.toggleValues, {
              placeHolder: `Encoding for "${argDef.name}"`,
            })
          : argDef.toggleValues?.[0];
      if (encoding === undefined) return null;
      result.push({ string: strVal, option: encoding });
    } else {
      result.push(resolveDefaultArg(argDef));
    }
  }
  return result;
}

export async function applyOperation(
  opName: string,
  entry: OperationEntry | undefined,
  renderers: ResultRenderers,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("ts-chef: No active editor.");
    return;
  }
  if (!entry) return;

  const operation = entry.factory();
  const text = editor.document.getText(editor.selection);
  if (!text && operation.inputMode === "required") {
    vscode.window.showWarningMessage("ts-chef: Select text first.");
    return;
  }

  const args = await promptForArgs(operation);
  if (args === null) return;

  const target = editor.selection.isEmpty
    ? new vscode.Selection(editor.selection.active, editor.selection.active)
    : editor.selection;

  try {
    const result = await runOp(opName, text, args);
    const str = resultToString(result);
    if (str === "" && text !== "") {
      vscode.window.showWarningMessage(
        `ts-chef: "${entry.displayName}" produced an empty result — nothing replaced.`,
      );
      return;
    }
    await presentPipelineResult(
      editor,
      str,
      entry.displayName,
      renderers,
      target,
    );
    log(`applyOperation: "${entry.displayName}" applied`);
  } catch (error) {
    log(`applyOperation error: ${error}`);
    vscode.window.showErrorMessage(`ts-chef: ${error}`);
  }
}
```

- [ ] **Step 4: Run the direct-execution test to verify it passes**

Run: `npm test -- --runTestsByPath test/commands/applyOperation.test.ts --runInBand`

Expected: PASS with 6 tests (the `test.each` case contributes two tests).

- [ ] **Step 5: Wire the handler and shared renderers into extension activation**

In `src/extension.ts`:

1. Import the new handler and the shared Quick Convert helpers:

```ts
import {
  applyOperation,
  promptForArgs,
  resultToString,
} from "./commands/applyOperation";
```

2. Remove the local `resultToString` and `promptForArgs` functions.

3. Remove only the `Operation` type from the imports. Keep `runOp` for Quick Convert, keep `resolveDefaultArg` because recipe steps use it, and keep `ArgConfig`.

4. After registering `panelResult`, define shared renderers:

```ts
  const resultRenderers = {
    inline: (editor: vscode.TextEditor, result: string, target: vscode.Range) =>
      inlineResult.show(editor, result, target),
    panel: (editor: vscode.TextEditor, result: string, target: vscode.Range) =>
      panelResult.show(editor, result, target),
  };
```

5. Replace each inline/panel object literal passed to `presentPipelineResult` with `resultRenderers`. This applies to recipe execution, ad hoc pipeline execution, and saved pipeline execution.

6. Replace the `tschef.applyOperation` registration with:

```ts
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.applyOperation",
      async (opName: string) => {
        const entry = registry.find((candidate) => candidate.opName === opName);
        await applyOperation(opName, entry, resultRenderers);
      },
    ),
  );
```

Do not change `tschef.quickConvert`; it continues to require selected text.

- [ ] **Step 6: Run command and result regression tests**

Run: `npm test -- --runTestsByPath test/commands/applyOperation.test.ts test/commands/operationInputMode.test.ts test/commands/pipelineResult.test.ts test/commands/inlineResult.test.ts test/commands/webviewResult.test.ts test/commands/operationsViewProvider.test.ts --runInBand`

Expected: PASS with all suites and tests.

- [ ] **Step 7: Run full verification**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

Run: `npm run lint`

Expected: PASS with no ESLint errors.

Run: `npm test -- --runInBand`

Expected: PASS with all test suites.

Run: `git status --short`

Expected: Only intended Task 3 files plus the pre-existing `src/generated/opsRegistry.ts` modification are listed. Do not stage the registry file.

- [ ] **Step 8: Commit direct operation execution**

```bash
git add src/commands/applyOperation.ts src/extension.ts test/commands/applyOperation.test.ts
```

- [ ] **Step 9: Confirm final branch state**

Run: `git status --short --branch`

Expected: The feature branch is ahead by the design and implementation commits; only the pre-existing `src/generated/opsRegistry.ts` modification remains unstaged.
