# Inline Pipeline-Result Mode (CodeLens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `inline` value to `tschef.pipelineResultAction` that shows a pipeline's result as a persistent, clickable CodeLens row (Replace / Copy / Close) above the selection.

**Architecture:** A new `InlineResultController` implements `vscode.CodeLensProvider`, holds one "active inline result", and renders a lens row anchored at the selection line; it stays until cleared (Close, Replace, or a document edit). `presentPipelineResult` gains an injected `showInline` callback and an `inline` branch; `extension.ts` constructs the controller, registers it, and wires `showInline` at both pipeline call sites.

**Tech Stack:** TypeScript, VS Code stable CodeLens API, Jest + ts-jest (with `vscode` mocked via `test/vscode-mock.ts`), esbuild.

---

## File Structure

- **Modify** `src/commands/pipelineResult.ts` — export `replaceTarget`; extend the union with `"inline"`; add an optional `showInline` callback param + an `inline` branch (defensive fallback to popup).
- **Create** `src/commands/inlineResult.ts` — `InlineResultController` (CodeLens provider + state + `register`/`show`).
- **Modify** `test/vscode-mock.ts` — add `languages`, `commands`, `window.activeTextEditor`, `workspace.onDidChangeTextDocument`, and `EventEmitter`/`Range`/`CodeLens` classes.
- **Modify** `test/commands/pipelineResult.test.ts` — add `inline`-mode tests.
- **Create** `test/commands/inlineResult.test.ts` — controller tests.
- **Modify** `src/extension.ts` — construct + register the controller; pass `showInline` at both call sites.
- **Modify** `package.json` — add `"inline"` to the enum + a 4th enumDescription.
- **Modify** `docs/usage.md` — document the `inline` value.

---

## Task 1: Extend `presentPipelineResult` for `inline` mode (TDD)

**Files:**
- Modify: `src/commands/pipelineResult.ts`
- Test: `test/commands/pipelineResult.test.ts`

- [ ] **Step 1: Add the failing tests**

In `test/commands/pipelineResult.test.ts`, add these two tests inside the `describe("presentPipelineResult", ...)` block (e.g. after the existing "popup mode does nothing when dismissed" test):

```ts
  test("inline mode delegates to the injected showInline callback", async () => {
    __setConfig({ pipelineResultAction: "inline" });
    const showInline = jest.fn();
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      showInline,
    );

    expect(showInline).toHaveBeenCalledWith(editor, "RESULT");
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });

  test("inline mode falls back to popup when no showInline is provided", async () => {
    __setConfig({ pipelineResultAction: "inline" });
    window.showInformationMessage.mockResolvedValue(undefined);
    const { editor } = makeEditor();

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
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/commands/pipelineResult.test.ts`
Expected: the "delegates to the injected showInline" test FAILS (showInline not called — the param/branch doesn't exist yet). The fallback test may already pass (inline falls through to popup today).

- [ ] **Step 3: Update the helper**

In `src/commands/pipelineResult.ts`:

(a) Change the union (line 3) from:
```ts
export type PipelineResultAction = "popup" | "replace" | "copy";
```
to:
```ts
export type PipelineResultAction = "popup" | "replace" | "copy" | "inline";
```

(b) Export `replaceTarget` — change its declaration from:
```ts
function replaceTarget(editor: vscode.TextEditor): vscode.Selection {
```
to:
```ts
export function replaceTarget(editor: vscode.TextEditor): vscode.Selection {
```

(c) Replace the JSDoc + signature of `presentPipelineResult`. Change:
```ts
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
```
to:
```ts
/**
 * Present a pipeline's result according to the `tschef.pipelineResultAction`
 * setting: show a popup with Replace/Copy buttons (default, "popup"), replace
 * the selection directly ("replace"), copy to the clipboard ("copy"), or show
 * an inline CodeLens row via the injected `showInline` callback ("inline").
 *
 * @param label Prefix shown in the popup message (e.g. `Result` or
 *   `Pipeline "name"`). Unused in the replace/copy/inline modes.
 * @param showInline Renders the result inline (CodeLens). When the mode is
 *   "inline" but this is not provided, falls back to the popup.
 */
export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
  showInline?: (
    editor: vscode.TextEditor,
    result: string,
  ) => void | Promise<void>,
): Promise<void> {
  const mode = vscode.workspace
    .getConfiguration("tschef")
    .get<PipelineResultAction>("pipelineResultAction", "popup");
```

(d) Add the `inline` branch immediately AFTER the `copy` block and BEFORE the popup code. Find:
```ts
  if (mode === "copy") {
    vscode.env.clipboard.writeText(result);
    vscode.window.setStatusBarMessage("ts-chef: Pipeline result copied", 3000);
    return;
  }

  const preview = `${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
```
Replace with:
```ts
  if (mode === "copy") {
    vscode.env.clipboard.writeText(result);
    vscode.window.setStatusBarMessage("ts-chef: Pipeline result copied", 3000);
    return;
  }

  if (mode === "inline" && showInline) {
    await showInline(editor, result);
    return;
  }

  const preview = `${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/commands/pipelineResult.test.ts`
Expected: PASS — 9 tests total (7 existing + 2 new).

- [ ] **Step 5: Typecheck + prettier**

Run: `npm run typecheck && npx prettier --check src/commands/pipelineResult.ts test/commands/pipelineResult.test.ts`
Expected: typecheck exits 0; "All matched files use Prettier code style!" (run `npx prettier --write` on a file if needed, then re-check).

- [ ] **Step 6: Commit**

```bash
git add src/commands/pipelineResult.ts test/commands/pipelineResult.test.ts
git commit -m "feat: add inline branch + showInline hook to presentPipelineResult"
```

---

## Task 2: `InlineResultController` (CodeLens) — TDD

**Files:**
- Modify: `test/vscode-mock.ts`
- Test: `test/commands/inlineResult.test.ts` (create)
- Create: `src/commands/inlineResult.ts`

- [ ] **Step 1: Extend the vscode mock**

In `test/vscode-mock.ts`, make these additions (do NOT remove anything existing):

(a) Replace the existing `window` export with one that adds `activeTextEditor`:
```ts
export const window = {
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  setStatusBarMessage: jest.fn(),
  activeTextEditor: undefined as unknown,
};
```

(b) Replace the `workspace` export to add `onDidChangeTextDocument`:
```ts
export const workspace: {
  workspaceFolders: { uri: { fsPath: string } }[] | undefined;
  getConfiguration: (section?: string) => {
    get: <T>(key: string, defaultValue: T) => T;
  };
  onDidChangeTextDocument: jest.Mock;
} = {
  workspaceFolders: undefined,
  getConfiguration: () => ({
    get: <T>(key: string, defaultValue: T): T =>
      key in configValues ? (configValues[key] as T) : defaultValue,
  }),
  onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
};
```

(c) Append these new exports at the end of the file:
```ts
export const languages = {
  registerCodeLensProvider: jest.fn(() => ({ dispose: jest.fn() })),
};

export const commands = {
  registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  executeCommand: jest.fn(),
};

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(data?: T): void {
    for (const l of this.listeners) l(data as T);
  }
  dispose(): void {
    this.listeners = [];
  }
}

export class Range {
  readonly start: { line: number; character: number };
  readonly end: { line: number; character: number };
  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
  ) {
    this.start = { line: startLine, character: startCharacter };
    this.end = { line: endLine, character: endCharacter };
  }
}

export class CodeLens {
  constructor(
    public readonly range: unknown,
    public readonly command?: unknown,
  ) {}
}
```

- [ ] **Step 2: Write the failing test**

Create `test/commands/inlineResult.test.ts`:

```ts
import { InlineResultController } from "../../src/commands/inlineResult";
import {
  window,
  env,
  commands,
  languages,
  workspace,
  CodeLens,
} from "../vscode-mock";
import type { ExtensionContext, TextDocument, TextEditor } from "vscode";

/** Fake editor whose non-empty selection sits on `line`. */
function makeEditor(line = 2, uri = "file:///doc") {
  const editBuilder = { replace: jest.fn() };
  const editor = {
    selection: {
      isEmpty: false,
      start: { line, character: 0 },
      end: { line, character: 5 },
    },
    document: { uri: { toString: () => uri } },
    edit: jest.fn(async (cb: (eb: { replace: jest.Mock }) => void) => {
      cb(editBuilder);
      return true;
    }),
  };
  return { editor, editBuilder };
}

function fakeDoc(uri = "file:///doc"): TextDocument {
  return { uri: { toString: () => uri } } as unknown as TextDocument;
}

function fakeContext(): ExtensionContext {
  return { subscriptions: [] } as unknown as ExtensionContext;
}

/** Pull the command/doc-change handlers the controller registered. */
function getRegisteredHandlers() {
  const applyCall = commands.registerCommand.mock.calls.find(
    (c) => c[0] === "tschef.applyInlineResult",
  );
  return {
    apply: applyCall?.[1] as (action: string) => Promise<void>,
    onDocChange: workspace.onDidChangeTextDocument.mock
      .calls[0][0] as (e: { document: TextDocument }) => void,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (window as { activeTextEditor: unknown }).activeTextEditor = undefined;
});

describe("InlineResultController", () => {
  test("register wires the code lens provider, command, and doc listener", () => {
    const c = new InlineResultController();
    const ctx = fakeContext();
    c.register(ctx);

    expect(languages.registerCodeLensProvider).toHaveBeenCalledTimes(1);
    expect(commands.registerCommand).toHaveBeenCalledWith(
      "tschef.applyInlineResult",
      expect.any(Function),
    );
    expect(workspace.onDidChangeTextDocument).toHaveBeenCalledTimes(1);
    expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(3);
  });

  test("show stores state and fires onDidChangeCodeLenses", () => {
    const c = new InlineResultController();
    const fired = jest.fn();
    c.onDidChangeCodeLenses(fired);
    const { editor } = makeEditor();

    c.show(editor as unknown as TextEditor, "RESULT");

    expect(fired).toHaveBeenCalled();
  });

  test("provideCodeLenses returns the 4-lens row for the matching document", () => {
    const c = new InlineResultController();
    const { editor } = makeEditor(2, "file:///doc");
    c.show(editor as unknown as TextEditor, "Hello world");

    const lenses = c.provideCodeLenses(fakeDoc("file:///doc")) as InstanceType<
      typeof CodeLens
    >[];

    expect(lenses).toHaveLength(4);
    const commandsList = lenses.map(
      (l) => (l.command as { command: string }).command,
    );
    expect(commandsList).toEqual([
      "",
      "tschef.applyInlineResult",
      "tschef.applyInlineResult",
      "tschef.applyInlineResult",
    ]);
    const args = lenses
      .slice(1)
      .map((l) => (l.command as { arguments: string[] }).arguments[0]);
    expect(args).toEqual(["replace", "copy", "close"]);
    // anchored on the selection's line
    expect((lenses[0].range as { start: { line: number } }).start.line).toBe(2);
  });

  test("provideCodeLenses returns [] with no active result", () => {
    const c = new InlineResultController();
    expect(c.provideCodeLenses(fakeDoc())).toEqual([]);
  });

  test("provideCodeLenses returns [] for a different document", () => {
    const c = new InlineResultController();
    const { editor } = makeEditor(2, "file:///doc");
    c.show(editor as unknown as TextEditor, "RESULT");

    expect(c.provideCodeLenses(fakeDoc("file:///other"))).toEqual([]);
  });

  test("apply('replace') edits the target range and clears the row", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor, editBuilder } = makeEditor();
    (window as { activeTextEditor: unknown }).activeTextEditor = editor;
    c.show(editor as unknown as TextEditor, "RESULT");

    const { apply } = getRegisteredHandlers();
    await apply("replace");

    expect(editor.edit).toHaveBeenCalled();
    expect(editBuilder.replace).toHaveBeenCalledWith(editor.selection, "RESULT");
    expect(c.provideCodeLenses(fakeDoc())).toEqual([]); // cleared
  });

  test("apply('copy') copies and keeps the row open", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor } = makeEditor();
    c.show(editor as unknown as TextEditor, "RESULT");

    const { apply } = getRegisteredHandlers();
    await apply("copy");

    expect(env.clipboard.writeText).toHaveBeenCalledWith("RESULT");
    expect(window.setStatusBarMessage).toHaveBeenCalled();
    expect(c.provideCodeLenses(fakeDoc())).toHaveLength(4); // still open
  });

  test("apply('close') clears the row", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor } = makeEditor();
    c.show(editor as unknown as TextEditor, "RESULT");

    const { apply } = getRegisteredHandlers();
    await apply("close");

    expect(c.provideCodeLenses(fakeDoc())).toEqual([]);
  });

  test("editing the stored document auto-closes the row", () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor } = makeEditor(2, "file:///doc");
    c.show(editor as unknown as TextEditor, "RESULT");

    const { onDocChange } = getRegisteredHandlers();
    onDocChange({ document: fakeDoc("file:///doc") });

    expect(c.provideCodeLenses(fakeDoc("file:///doc"))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest test/commands/inlineResult.test.ts`
Expected: FAIL — `Cannot find module '../../src/commands/inlineResult'`.

- [ ] **Step 4: Implement the controller**

Create `src/commands/inlineResult.ts`:

```ts
import * as vscode from "vscode";
import { replaceTarget } from "./pipelineResult";

type InlineState = {
  uri: vscode.Uri;
  targetRange: vscode.Range;
  result: string;
};

type InlineAction = "replace" | "copy" | "close";

/**
 * Shows a pipeline result as a persistent CodeLens row anchored above the
 * selection, with Replace / Copy / Close actions. One active result at a time;
 * it stays until Close, Replace, or an edit to the document clears it.
 */
export class InlineResultController implements vscode.CodeLensProvider {
  private state: InlineState | undefined;
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ scheme: "*" }, this),
      vscode.commands.registerCommand(
        "tschef.applyInlineResult",
        (action: InlineAction) => this.apply(action),
      ),
      vscode.workspace.onDidChangeTextDocument((e) =>
        this.onDocumentChanged(e.document),
      ),
      this._onDidChangeCodeLenses,
    );
  }

  /** Show `result` as an inline CodeLens row for the editor's selection. */
  show(editor: vscode.TextEditor, result: string): void {
    this.state = {
      uri: editor.document.uri,
      targetRange: replaceTarget(editor),
      result,
    };
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const state = this.state;
    if (!state || document.uri.toString() !== state.uri.toString()) return [];

    const line = state.targetRange.start.line;
    const range = new vscode.Range(line, 0, line, 0);
    const preview =
      state.result.replace(/\s+/g, " ").slice(0, 80) +
      (state.result.length > 80 ? "…" : "");

    return [
      new vscode.CodeLens(range, { title: `$(output) ${preview}`, command: "" }),
      new vscode.CodeLens(range, {
        title: "$(replace) Replace",
        command: "tschef.applyInlineResult",
        arguments: ["replace"],
      }),
      new vscode.CodeLens(range, {
        title: "$(clippy) Copy",
        command: "tschef.applyInlineResult",
        arguments: ["copy"],
      }),
      new vscode.CodeLens(range, {
        title: "$(close) Close",
        command: "tschef.applyInlineResult",
        arguments: ["close"],
      }),
    ];
  }

  private async apply(action: InlineAction): Promise<void> {
    const state = this.state;
    if (!state) return;

    if (action === "replace") {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit((eb) => eb.replace(state.targetRange, state.result));
      }
      this.clear();
      return;
    }

    if (action === "copy") {
      vscode.env.clipboard.writeText(state.result);
      vscode.window.setStatusBarMessage(
        "ts-chef: Pipeline result copied",
        3000,
      );
      return; // keep the row open (non-destructive)
    }

    // close
    this.clear();
  }

  private onDocumentChanged(document: vscode.TextDocument): void {
    if (this.state && document.uri.toString() === this.state.uri.toString()) {
      this.clear();
    }
  }

  private clear(): void {
    this.state = undefined;
    this._onDidChangeCodeLenses.fire();
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest test/commands/inlineResult.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 6: Full suite + typecheck + prettier (mock change must not break others)**

Run: `npm test && npm run typecheck && npx prettier --check src/commands/inlineResult.ts test/commands/inlineResult.test.ts test/vscode-mock.ts`
Expected: all suites pass (including `store.test.ts` and `pipelineResult.test.ts`); typecheck exits 0; prettier clean (run `npx prettier --write <file>` on any that need it, then re-check).

- [ ] **Step 7: Commit**

```bash
git add src/commands/inlineResult.ts test/commands/inlineResult.test.ts test/vscode-mock.ts
git commit -m "feat: add InlineResultController (CodeLens) for inline pipeline results"
```

---

## Task 3: Wire the controller into `extension.ts`

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Add the import**

In `src/extension.ts`, find:
```ts
import { presentPipelineResult } from "./commands/pipelineResult";
```
Insert immediately AFTER it:
```ts
import { InlineResultController } from "./commands/inlineResult";
```

- [ ] **Step 2: Construct and register the controller**

In `activate()`, find:
```ts
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("tschef.variablesView", varTree),
    vscode.window.registerTreeDataProvider("tschef.pipelinesView", pipeTree),
  );

  // ---- Commands ----
```
Replace with:
```ts
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("tschef.variablesView", varTree),
    vscode.window.registerTreeDataProvider("tschef.pipelinesView", pipeTree),
  );

  const inlineResult = new InlineResultController();
  inlineResult.register(context);

  // ---- Commands ----
```

- [ ] **Step 3: Pass `showInline` at the `runPipeline` call site**

In `src/extension.ts`, find:
```ts
        await presentPipelineResult(editor, result, "Result");
```
Replace with:
```ts
        await presentPipelineResult(editor, result, "Result", (ed, res) =>
          inlineResult.show(ed, res),
        );
```

- [ ] **Step 4: Pass `showInline` at the `runSavedPipeline` call site**

In `src/extension.ts`, find:
```ts
          await presentPipelineResult(editor, result, `Pipeline "${name}"`);
```
Replace with:
```ts
          await presentPipelineResult(
            editor,
            result,
            `Pipeline "${name}"`,
            (ed, res) => inlineResult.show(ed, res),
          );
```

- [ ] **Step 5: Verify**

Run:
```
npm run typecheck && npm run compile && npx prettier --check src/extension.ts && npx eslint src/extension.ts
```
Expected: typecheck exits 0; esbuild emits `dist/extension.js` with no ERRORS (pre-existing d3 warnings are fine); prettier clean (run `npx prettier --write src/extension.ts` if needed); eslint exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire InlineResultController into pipeline commands"
```

---

## Task 4: Register the `inline` value + docs

**Files:**
- Modify: `package.json`
- Modify: `docs/usage.md`

- [ ] **Step 1: Add `inline` to the enum**

In `package.json`, find:
```json
          "enum": [
            "popup",
            "replace",
            "copy"
          ],
```
Replace with:
```json
          "enum": [
            "popup",
            "replace",
            "copy",
            "inline"
          ],
```

- [ ] **Step 2: Add the 4th enumDescription**

In `package.json`, find:
```json
          "enumDescriptions": [
            "Show a notification with Replace/Copy buttons (current behavior)",
            "Replace the selection (or whole document if nothing is selected) with the result",
            "Copy the result to the clipboard"
          ],
```
Replace with:
```json
          "enumDescriptions": [
            "Show a notification with Replace/Copy buttons (current behavior)",
            "Replace the selection (or whole document if nothing is selected) with the result",
            "Copy the result to the clipboard",
            "Show the result in a CodeLens row above the selection with Replace/Copy/Close actions"
          ],
```

- [ ] **Step 3: Document the value in usage.md**

In `docs/usage.md`, find:
```markdown
- `copy` — copy the result to the clipboard.
```
Replace with:
```markdown
- `copy` — copy the result to the clipboard.
- `inline` — show the result in a CodeLens row above the selection, with Replace/Copy/Close actions (stays open until you close it).
```

- [ ] **Step 4: Verify**

Run:
```
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')" && npx prettier --check package.json docs/usage.md
```
Expected: prints `valid`; prettier clean (run `npx prettier --write` on a file if needed, then re-check).

- [ ] **Step 5: Commit**

```bash
git add package.json docs/usage.md
git commit -m "feat: add inline option to tschef.pipelineResultAction + docs"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck exits 0; all suites pass (including the new inline-mode + InlineResultController tests); build emits `dist/extension.js` (pre-existing d3 warnings only).

- [ ] **Step 2: Confirm the enum is complete and wired**

Run:
```
node -e "const p=require('./package.json');console.log(p.contributes.configuration.properties['tschef.pipelineResultAction'].enum.join(','))"
grep -c "inlineResult.show" src/extension.ts
```
Expected: prints `popup,replace,copy,inline`; the grep prints `2` (both call sites wired).

---

## Self-Review

**Spec coverage:**
- `inline` value added to enum + enumDescription → Task 4 ✓
- Persistent CodeLens row anchored at selection line, 4 lenses (preview + Replace/Copy/Close) → Task 2 `provideCodeLenses` ✓
- Action behavior: Replace edits + clears; Copy copies + retains; Close clears; doc edit auto-closes → Task 2 `apply` + `onDocumentChanged`, tested ✓
- `InlineResultController` reuses `replaceTarget`; `presentPipelineResult` gains `showInline` + inline branch with popup fallback → Tasks 1 & 2 ✓
- extension.ts constructs/registers controller and wires both call sites → Task 3 ✓
- docs updated → Task 4 ✓
- Tests for inline dispatch + controller behaviors → Tasks 1 & 2 ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code and exact commands.

**Type consistency:** `PipelineResultAction` includes `"inline"` (Task 1) and `showInline?: (editor, result) => void | Promise<void>` matches `InlineResultController.show(editor, result)` (Tasks 1–3). `replaceTarget` exported in Task 1 and imported in Task 2. The command id `tschef.applyInlineResult` and action strings `replace`/`copy`/`close` match between `provideCodeLenses` args, `apply`, and the tests. Mock additions (`languages`, `commands`, `EventEmitter`, `Range`, `CodeLens`, `window.activeTextEditor`, `workspace.onDidChangeTextDocument`) defined in Task 2 Step 1 and consumed in Task 2 Step 2.
