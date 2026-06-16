# Persist Inline Row + Panel Result Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `inline` (CodeLens) result row persist until explicitly closed, and add a new `panel` mode that shows the full multi-line result in a reusable webview beside the editor with Replace/Copy/Close.

**Architecture:** Part 1 removes the edit-driven auto-close from `InlineResultController`. Part 2 generalizes `presentPipelineResult`'s injected callback into a small renderer map (`{ inline?, panel? }`), adds a `WebviewResultController` (singleton webview panel), wires both controllers in `extension.ts`, and registers the new `panel` enum value.

**Tech Stack:** TypeScript, VS Code stable APIs (CodeLens, Webview), Jest + ts-jest (`vscode` mocked via `test/vscode-mock.ts`), esbuild.

---

## File Structure

- **Modify** `src/commands/inlineResult.ts` — drop the doc-change auto-close.
- **Modify** `src/commands/pipelineResult.ts` — `"panel"` in the union; `showInline?` → `render?` map; combined `inline`/`panel` branch.
- **Create** `src/commands/webviewResult.ts` — `WebviewResultController` (webview panel).
- **Modify** `src/extension.ts` — construct/register the panel controller; pass the `render` map at both call sites.
- **Modify** `test/vscode-mock.ts` — add `window.createWebviewPanel` + `ViewColumn`.
- **Modify** `test/commands/inlineResult.test.ts` — persistence test changes.
- **Modify** `test/commands/pipelineResult.test.ts` — render-map dispatch tests.
- **Create** `test/commands/webviewResult.test.ts` — panel controller tests.
- **Modify** `package.json` / `docs/usage.md` — `panel` value.

---

## Task 1: Persist the inline CodeLens row

**Files:**
- Modify: `src/commands/inlineResult.ts`
- Test: `test/commands/inlineResult.test.ts`

- [ ] **Step 1: Update the tests to expect persistence**

In `test/commands/inlineResult.test.ts`:

(a) Replace the `getRegisteredHandlers` helper:
```ts
/** Pull the command/doc-change handlers the controller registered. */
function getRegisteredHandlers() {
  const applyCall = commands.registerCommand.mock.calls.find(
    (c) => c[0] === "tschef.applyInlineResult",
  );
  return {
    apply: applyCall?.[1] as (action: string) => Promise<void>,
    onDocChange: workspace.onDidChangeTextDocument.mock.calls[0][0] as (e: {
      document: TextDocument;
    }) => void,
  };
}
```
with:
```ts
/** Pull the command handler the controller registered. */
function getRegisteredHandlers() {
  const applyCall = commands.registerCommand.mock.calls.find(
    (c) => c[0] === "tschef.applyInlineResult",
  );
  return {
    apply: applyCall?.[1] as (action: string) => Promise<void>,
  };
}
```

(b) Replace the "register wires..." test:
```ts
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
```
with:
```ts
  test("register wires the code lens provider and command, not a doc listener", () => {
    const c = new InlineResultController();
    const ctx = fakeContext();
    c.register(ctx);

    expect(languages.registerCodeLensProvider).toHaveBeenCalledTimes(1);
    expect(commands.registerCommand).toHaveBeenCalledWith(
      "tschef.applyInlineResult",
      expect.any(Function),
    );
    expect(workspace.onDidChangeTextDocument).not.toHaveBeenCalled();
    expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(2);
  });
```

(c) Delete the entire "editing the stored document auto-closes the row" test:
```ts
  test("editing the stored document auto-closes the row", () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor } = makeEditor(2, "file:///doc");
    c.show(editor as unknown as TextEditor, "RESULT");

    const { onDocChange } = getRegisteredHandlers();
    onDocChange({ document: fakeDoc("file:///doc") });

    expect(c.provideCodeLenses(fakeDoc("file:///doc"))).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify the register test fails**

Run: `npx jest test/commands/inlineResult.test.ts`
Expected: FAIL — "register wires... not a doc listener" fails because the current code still calls `workspace.onDidChangeTextDocument`.

- [ ] **Step 3: Remove the auto-close from the controller**

In `src/commands/inlineResult.ts`:

(a) Update the class JSDoc — change:
```ts
 * selection, with Replace / Copy / Close actions. One active result at a time;
 * it stays until Close, Replace, or an edit to the document clears it.
 */
```
to:
```ts
 * selection, with Replace / Copy / Close actions. One active result at a time;
 * it stays until Close or Replace clears it.
 */
```

(b) Remove the doc-change registration in `register()` — change:
```ts
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
```
to:
```ts
  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ scheme: "*" }, this),
      vscode.commands.registerCommand(
        "tschef.applyInlineResult",
        (action: InlineAction) => this.apply(action),
      ),
      this._onDidChangeCodeLenses,
    );
  }
```

(c) Delete the `onDocumentChanged` method entirely:
```ts
  private onDocumentChanged(document: vscode.TextDocument): void {
    if (this.state && document.uri.toString() === this.state.uri.toString()) {
      this.clear();
    }
  }

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest test/commands/inlineResult.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Typecheck + prettier**

Run: `npm run typecheck && npx prettier --check src/commands/inlineResult.ts test/commands/inlineResult.test.ts`
Expected: typecheck exits 0; prettier clean (run `npx prettier --write <file>` if needed, re-check).

- [ ] **Step 6: Commit**

```bash
git add src/commands/inlineResult.ts test/commands/inlineResult.test.ts
git commit -m "feat: persist inline CodeLens row across edits"
```

---

## Task 2: Generalize dispatch to a renderer map

**Files:**
- Modify: `src/commands/pipelineResult.ts`
- Modify: `src/extension.ts` (call sites only — keep build green)
- Test: `test/commands/pipelineResult.test.ts`

- [ ] **Step 1: Update the dispatch tests**

In `test/commands/pipelineResult.test.ts`:

(a) Replace the inline-delegate test:
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
```
with:
```ts
  test("inline mode delegates to the inline renderer", async () => {
    __setConfig({ pipelineResultAction: "inline" });
    const showInline = jest.fn();
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      { inline: showInline },
    );

    expect(showInline).toHaveBeenCalledWith(editor, "RESULT");
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });

  test("panel mode delegates to the panel renderer", async () => {
    __setConfig({ pipelineResultAction: "panel" });
    const showPanel = jest.fn();
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      { panel: showPanel },
    );

    expect(showPanel).toHaveBeenCalledWith(editor, "RESULT");
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });
```

(b) Rename the fallback test title (body unchanged) — change:
```ts
  test("inline mode falls back to popup when no showInline is provided", async () => {
```
to:
```ts
  test("inline mode falls back to popup when no renderer is provided", async () => {
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/commands/pipelineResult.test.ts`
Expected: FAIL — the inline/panel delegate tests fail (the 4th arg is now an object, but the current signature expects a function; runtime tries to call the object).

- [ ] **Step 3: Refactor `presentPipelineResult`**

In `src/commands/pipelineResult.ts`:

(a) Extend the union (line 3):
```ts
export type PipelineResultAction = "popup" | "replace" | "copy" | "inline" | "panel";
```

(b) Replace the JSDoc + signature + inline branch. Change:
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

  if (mode === "inline" && showInline) {
    await showInline(editor, result);
    return;
  }

  const preview = `${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
```
to:
```ts
type ResultRenderer = (
  editor: vscode.TextEditor,
  result: string,
) => void | Promise<void>;

/**
 * Present a pipeline's result according to the `tschef.pipelineResultAction`
 * setting: show a popup with Replace/Copy buttons (default, "popup"), replace
 * the selection directly ("replace"), copy to the clipboard ("copy"), or
 * render via an injected renderer ("inline" = CodeLens, "panel" = webview).
 *
 * @param label Prefix shown in the popup message (e.g. `Result` or
 *   `Pipeline "name"`). Unused in the replace/copy/inline/panel modes.
 * @param render Custom renderers keyed by mode. When the mode is "inline" or
 *   "panel" but no matching renderer is provided, falls back to the popup.
 */
export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
  render?: Partial<Record<"inline" | "panel", ResultRenderer>>,
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

  if (mode === "inline" || mode === "panel") {
    const renderer = render?.[mode];
    if (renderer) {
      await renderer(editor, result);
      return;
    }
  }

  const preview = `${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
```

- [ ] **Step 4: Update the extension.ts call sites to the render map (inline only for now)**

In `src/extension.ts`, change the `runPipeline` call:
```ts
        await presentPipelineResult(editor, result, "Result", (ed, res) =>
          inlineResult.show(ed, res),
        );
```
to:
```ts
        await presentPipelineResult(editor, result, "Result", {
          inline: (ed, res) => inlineResult.show(ed, res),
        });
```

And change the `runSavedPipeline` call:
```ts
          await presentPipelineResult(
            editor,
            result,
            `Pipeline "${name}"`,
            (ed, res) => inlineResult.show(ed, res),
          );
```
to:
```ts
          await presentPipelineResult(editor, result, `Pipeline "${name}"`, {
            inline: (ed, res) => inlineResult.show(ed, res),
          });
```

- [ ] **Step 5: Run tests + typecheck + prettier**

Run: `npx jest test/commands/pipelineResult.test.ts && npm run typecheck && npx prettier --check src/commands/pipelineResult.ts src/extension.ts test/commands/pipelineResult.test.ts`
Expected: pipelineResult tests pass (10 total); typecheck exits 0 (call sites pass valid render maps); prettier clean (write + re-check if needed).

- [ ] **Step 6: Commit**

```bash
git add src/commands/pipelineResult.ts src/extension.ts test/commands/pipelineResult.test.ts
git commit -m "feat: generalize pipeline-result dispatch to a renderer map"
```

---

## Task 3: `WebviewResultController` (panel) — TDD

**Files:**
- Modify: `test/vscode-mock.ts`
- Test: `test/commands/webviewResult.test.ts` (create)
- Create: `src/commands/webviewResult.ts`

- [ ] **Step 1: Extend the vscode mock**

In `test/vscode-mock.ts`:

(a) Replace the `window` export to add `createWebviewPanel`:
```ts
export const window = {
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  setStatusBarMessage: jest.fn(),
  activeTextEditor: undefined as unknown,
  createWebviewPanel: jest.fn(),
};
```

(b) Append at the END of the file:
```ts
export const ViewColumn = {
  Active: -1,
  Beside: -2,
};
```

- [ ] **Step 2: Write the failing test**

Create `test/commands/webviewResult.test.ts`:
```ts
import { WebviewResultController } from "../../src/commands/webviewResult";
import { window, env, ViewColumn } from "../vscode-mock";
import type { TextEditor } from "vscode";

function makeFakePanel() {
  const webview = {
    html: "",
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  };
  return {
    webview,
    onDidDispose: jest.fn(),
    reveal: jest.fn(),
    dispose: jest.fn(),
  };
}

function makeEditor() {
  const editBuilder = { replace: jest.fn() };
  const editor = {
    selection: {
      isEmpty: false,
      start: { line: 1, character: 0 },
      end: { line: 1, character: 5 },
    },
    document: { uri: { toString: () => "file:///doc" } },
    edit: jest.fn(async (cb: (eb: { replace: jest.Mock }) => void) => {
      cb(editBuilder);
      return true;
    }),
  };
  return { editor, editBuilder };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("WebviewResultController", () => {
  test("show opens a panel beside the editor with scripts and result HTML", () => {
    const panel = makeFakePanel();
    window.createWebviewPanel.mockReturnValue(panel);
    const c = new WebviewResultController();
    const { editor } = makeEditor();

    c.show(editor as unknown as TextEditor, "multi\nline\nresult");

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(1);
    const args = window.createWebviewPanel.mock.calls[0];
    expect(args[0]).toBe("tschef.result");
    expect(args[2]).toEqual({
      viewColumn: ViewColumn.Beside,
      preserveFocus: true,
    });
    expect(args[3]).toEqual({ enableScripts: true });
    expect(panel.webview.html).toContain("multi\nline\nresult");
    expect(panel.webview.html).toContain("Replace");
    expect(panel.webview.html).toContain("Copy");
    expect(panel.webview.html).toContain("Close");
    expect(panel.reveal).toHaveBeenCalled();
  });

  test("a second show reuses the same panel", () => {
    const panel = makeFakePanel();
    window.createWebviewPanel.mockReturnValue(panel);
    const c = new WebviewResultController();
    const { editor } = makeEditor();

    c.show(editor as unknown as TextEditor, "one");
    c.show(editor as unknown as TextEditor, "two");

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(panel.webview.html).toContain("two");
  });

  test("replace message edits the stored range", async () => {
    const panel = makeFakePanel();
    window.createWebviewPanel.mockReturnValue(panel);
    const c = new WebviewResultController();
    const { editor, editBuilder } = makeEditor();
    c.show(editor as unknown as TextEditor, "RESULT");

    const onMessage = panel.webview.onDidReceiveMessage.mock.calls[0][0];
    await onMessage({ type: "replace" });

    expect(editor.edit).toHaveBeenCalled();
    expect(editBuilder.replace).toHaveBeenCalledWith(editor.selection, "RESULT");
  });

  test("copy message writes to the clipboard", async () => {
    const panel = makeFakePanel();
    window.createWebviewPanel.mockReturnValue(panel);
    const c = new WebviewResultController();
    const { editor } = makeEditor();
    c.show(editor as unknown as TextEditor, "RESULT");

    const onMessage = panel.webview.onDidReceiveMessage.mock.calls[0][0];
    await onMessage({ type: "copy" });

    expect(env.clipboard.writeText).toHaveBeenCalledWith("RESULT");
    expect(window.setStatusBarMessage).toHaveBeenCalled();
  });

  test("close message disposes the panel", async () => {
    const panel = makeFakePanel();
    window.createWebviewPanel.mockReturnValue(panel);
    const c = new WebviewResultController();
    const { editor } = makeEditor();
    c.show(editor as unknown as TextEditor, "RESULT");

    const onMessage = panel.webview.onDidReceiveMessage.mock.calls[0][0];
    await onMessage({ type: "close" });

    expect(panel.dispose).toHaveBeenCalled();
  });

  test("after the panel is disposed, show creates a new one", () => {
    const panel1 = makeFakePanel();
    const panel2 = makeFakePanel();
    window.createWebviewPanel
      .mockReturnValueOnce(panel1)
      .mockReturnValueOnce(panel2);
    const c = new WebviewResultController();
    const { editor } = makeEditor();

    c.show(editor as unknown as TextEditor, "one");
    const onDispose = panel1.onDidDispose.mock.calls[0][0];
    onDispose();
    c.show(editor as unknown as TextEditor, "two");

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest test/commands/webviewResult.test.ts`
Expected: FAIL — `Cannot find module '../../src/commands/webviewResult'`.

- [ ] **Step 4: Implement the controller**

Create `src/commands/webviewResult.ts`:
```ts
import * as vscode from "vscode";
import { replaceTarget } from "./pipelineResult";

type PanelState = {
  editor: vscode.TextEditor;
  range: vscode.Range;
  result: string;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(result: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: var(--vscode-editor-font-family, monospace);
        color: var(--vscode-foreground);
        padding: 0.5rem;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 70vh;
        overflow: auto;
        background: var(--vscode-textCodeBlock-background);
        padding: 0.5rem;
        border-radius: 4px;
      }
      .actions {
        margin-top: 0.5rem;
      }
      button {
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        padding: 4px 10px;
        margin-right: 6px;
        cursor: pointer;
        border-radius: 2px;
      }
      button:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(result)}</pre>
    <div class="actions">
      <button id="replace">Replace</button>
      <button id="copy">Copy</button>
      <button id="close">Close</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      for (const id of ["replace", "copy", "close"]) {
        document
          .getElementById(id)
          .addEventListener("click", () => vscode.postMessage({ type: id }));
      }
    </script>
  </body>
</html>`;
}

/**
 * Shows a pipeline result in a reusable webview panel beside the editor —
 * multi-line and scrollable, with Replace / Copy / Close actions. The panel
 * persists until the user closes it (Replace and Copy keep it open).
 */
export class WebviewResultController {
  private panel: vscode.WebviewPanel | undefined;
  private state: PanelState | undefined;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push({ dispose: () => this.panel?.dispose() });
  }

  /** Show `result` in the panel for the editor's selection. */
  show(editor: vscode.TextEditor, result: string): void {
    this.state = { editor, range: replaceTarget(editor), result };
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "tschef.result",
        "ts-chef result",
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true },
      );
      this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.state = undefined;
      });
    }
    this.panel.webview.html = renderHtml(result);
    this.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  private async onMessage(msg: { type?: string }): Promise<void> {
    const state = this.state;
    if (!state) return;
    if (msg.type === "replace") {
      await state.editor.edit((eb) => eb.replace(state.range, state.result));
    } else if (msg.type === "copy") {
      vscode.env.clipboard.writeText(state.result);
      vscode.window.setStatusBarMessage(
        "ts-chef: Pipeline result copied",
        3000,
      );
    } else if (msg.type === "close") {
      this.panel?.dispose();
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest test/commands/webviewResult.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Full suite + typecheck + prettier**

Run: `npm test && npm run typecheck && npx prettier --check src/commands/webviewResult.ts test/commands/webviewResult.test.ts test/vscode-mock.ts`
Expected: all suites pass (0 failures); typecheck exits 0; prettier clean (write + re-check if needed).

- [ ] **Step 7: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/commands/webviewResult.ts test/commands/webviewResult.test.ts test/vscode-mock.ts
git commit -m "feat: add WebviewResultController (panel) for multi-line results"
```

---

## Task 4: Wire the panel controller into `extension.ts`

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Add the import**

In `src/extension.ts`, find:
```ts
import { InlineResultController } from "./commands/inlineResult";
```
Insert immediately AFTER it:
```ts
import { WebviewResultController } from "./commands/webviewResult";
```

- [ ] **Step 2: Construct + register the panel controller**

In `src/extension.ts`, find:
```ts
  const inlineResult = new InlineResultController();
  inlineResult.register(context);
```
Replace with:
```ts
  const inlineResult = new InlineResultController();
  inlineResult.register(context);

  const panelResult = new WebviewResultController();
  panelResult.register(context);
```

- [ ] **Step 3: Add the `panel` renderer at both call sites**

In `src/extension.ts`, change the `runPipeline` call:
```ts
        await presentPipelineResult(editor, result, "Result", {
          inline: (ed, res) => inlineResult.show(ed, res),
        });
```
to:
```ts
        await presentPipelineResult(editor, result, "Result", {
          inline: (ed, res) => inlineResult.show(ed, res),
          panel: (ed, res) => panelResult.show(ed, res),
        });
```

And change the `runSavedPipeline` call:
```ts
          await presentPipelineResult(editor, result, `Pipeline "${name}"`, {
            inline: (ed, res) => inlineResult.show(ed, res),
          });
```
to:
```ts
          await presentPipelineResult(editor, result, `Pipeline "${name}"`, {
            inline: (ed, res) => inlineResult.show(ed, res),
            panel: (ed, res) => panelResult.show(ed, res),
          });
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run compile && npx prettier --check src/extension.ts && npx eslint src/extension.ts`
Expected: typecheck exits 0; esbuild emits `dist/extension.js` with no ERRORS (pre-existing d3 warnings only); prettier clean; eslint exits 0.

- [ ] **Step 5: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/extension.ts
git commit -m "feat: wire WebviewResultController into pipeline commands"
```

---

## Task 5: Register the `panel` value + docs

**Files:**
- Modify: `package.json`
- Modify: `docs/usage.md`

- [ ] **Step 1: Add `panel` to the enum**

In `package.json`, find:
```json
          "enum": [
            "popup",
            "replace",
            "copy",
            "inline"
          ],
```
Replace with:
```json
          "enum": [
            "popup",
            "replace",
            "copy",
            "inline",
            "panel"
          ],
```

- [ ] **Step 2: Add the 5th enumDescription**

In `package.json`, find:
```json
          "enumDescriptions": [
            "Show a notification with Replace/Copy buttons (current behavior)",
            "Replace the selection (or whole document if nothing is selected) with the result",
            "Copy the result to the clipboard",
            "Show the result in a CodeLens row above the selection with Replace/Copy/Close actions"
          ],
```
Replace with:
```json
          "enumDescriptions": [
            "Show a notification with Replace/Copy buttons (current behavior)",
            "Replace the selection (or whole document if nothing is selected) with the result",
            "Copy the result to the clipboard",
            "Show the result in a CodeLens row above the selection with Replace/Copy/Close actions",
            "Show the result in a webview panel beside the editor (multi-line, with Replace/Copy/Close actions)"
          ],
```

- [ ] **Step 3: Document the value in usage.md**

In `docs/usage.md`, find:
```markdown
- `inline` — show the result in a CodeLens row above the selection, with Replace/Copy/Close actions (stays open until you close it).
```
Replace with:
```markdown
- `inline` — show the result in a CodeLens row above the selection, with Replace/Copy/Close actions (stays open until you close it).
- `panel` — show the full multi-line result in a webview panel beside the editor, with Replace/Copy/Close actions (stays open until you close it).
```

- [ ] **Step 4: Verify**

Run:
```
node -e "console.log(require('./package.json').contributes.configuration.properties['tschef.pipelineResultAction'].enum.join(','))" && npx prettier --check package.json docs/usage.md
```
Expected: prints `popup,replace,copy,inline,panel`; prettier clean (write + re-check if needed).

- [ ] **Step 5: Commit**

```bash
git add package.json docs/usage.md
git commit -m "feat: add panel option to tschef.pipelineResultAction + docs"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck exits 0; all suites pass (inline persistence + render-map dispatch + WebviewResultController tests); build emits `dist/extension.js` (pre-existing d3 warnings only).

- [ ] **Step 2: Confirm enum + wiring**

Run:
```
node -e "console.log(require('./package.json').contributes.configuration.properties['tschef.pipelineResultAction'].enum.join(','))"
grep -c "panelResult.show" src/extension.ts
grep -c "inlineResult.show" src/extension.ts
```
Expected: prints `popup,replace,copy,inline,panel`; both greps print `2`.

- [ ] **Step 3: Restore the generated registry if the build dirtied it**

Run: `git restore src/generated/opsRegistry.ts 2>/dev/null; git status --short`
Expected: clean working tree.

---

## Self-Review

**Spec coverage:**
- Part 1 persist inline (remove auto-close + tests) → Task 1 ✓
- `panel` enum value + enumDescription → Task 5 ✓
- Dispatch refactor to `render` map (`inline`/`panel`) → Task 2 ✓
- `WebviewResultController`: reusable panel Beside, enableScripts, multi-line `<pre>` + Replace/Copy/Close, messages do replace/copy/close, Replace/Copy keep open, Close/onDidDispose dispose, reuses `replaceTarget` → Task 3 ✓
- extension wiring (construct/register + render map at both call sites) → Tasks 2 (inline) & 4 (panel) ✓
- docs → Task 5 ✓
- Mock additions (`createWebviewPanel`, `ViewColumn`) → Task 3 ✓
- Tests for dispatch + controller → Tasks 2 & 3 ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code.

**Type consistency:** `PipelineResultAction` gains `"panel"` (Task 2). `render?: Partial<Record<"inline" | "panel", ResultRenderer>>` (Task 2) matches the call-site object shapes (Tasks 2 & 4) and `WebviewResultController.show(editor, result)` / `InlineResultController.show(editor, result)`. `replaceTarget` (exported) reused in `webviewResult.ts` (Task 3). Build stays green at every task: Task 2 changes the signature AND both call sites together; Task 4 only adds the `panel` key.
