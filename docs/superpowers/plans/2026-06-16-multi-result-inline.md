# Multiple Inline Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `InlineResultController` show multiple inline CodeLens result rows at once, each with its own Replace/Copy/Close acting on the right result.

**Architecture:** Replace the controller's single `state` with a `results: InlineResult[]` collection keyed by an incrementing `id`. `show()` appends; `provideCodeLenses()` emits a 4-lens row per matching-document result with `[action, id]` command args; `apply(action, id)` looks up by id (Replace edits+removes, Copy keeps, Close removes).

**Tech Stack:** TypeScript, VS Code CodeLens API, Jest + ts-jest (`vscode` mocked via `test/vscode-mock.ts`).

---

## File Structure

- **Modify** `src/commands/inlineResult.ts` — collection state + id in command args (full rewrite).
- **Modify** `test/commands/inlineResult.test.ts` — multi-result tests (full rewrite).

No other files change (the `tschef.applyInlineResult` command is internal, not contributed in `package.json`).

---

## Task 1: Multi-result inline controller (TDD)

**Files:**
- Test: `test/commands/inlineResult.test.ts`
- Modify: `src/commands/inlineResult.ts`

- [ ] **Step 1: Rewrite the test file**

Replace the ENTIRE contents of `test/commands/inlineResult.test.ts` with:

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

type Lens = InstanceType<typeof CodeLens>;

/** Fake editor whose non-empty selection sits on `line` of `uri`. */
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

/** The registered apply(action, id) command handler. */
function getApply() {
  const call = commands.registerCommand.mock.calls.find(
    (c) => c[0] === "tschef.applyInlineResult",
  );
  return call?.[1] as (action: string, id: number) => Promise<void>;
}

/** Command of a lens (preview lens has command "" and no arguments). */
function cmd(lens: Lens) {
  return lens.command as {
    command: string;
    title: string;
    arguments?: [string, number];
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (window as { activeTextEditor: unknown }).activeTextEditor = undefined;
});

describe("InlineResultController (multi-result)", () => {
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

  test("show adds a row and fires onDidChangeCodeLenses", () => {
    const c = new InlineResultController();
    const fired = jest.fn();
    c.onDidChangeCodeLenses(fired);
    const { editor } = makeEditor();

    c.show(editor as unknown as TextEditor, "RESULT");

    expect(fired).toHaveBeenCalled();
    expect(c.provideCodeLenses(fakeDoc())).toHaveLength(4);
  });

  test("a single result renders a 4-lens row with [action, id] args", () => {
    const c = new InlineResultController();
    const { editor } = makeEditor(2, "file:///doc");
    c.show(editor as unknown as TextEditor, "Hello world");

    const lenses = c.provideCodeLenses(fakeDoc("file:///doc")) as Lens[];
    expect(lenses).toHaveLength(4);
    expect(cmd(lenses[0]).command).toBe("");
    expect(lenses.slice(1).map((l) => cmd(l).command)).toEqual([
      "tschef.applyInlineResult",
      "tschef.applyInlineResult",
      "tschef.applyInlineResult",
    ]);
    expect(lenses.slice(1).map((l) => cmd(l).arguments?.[0])).toEqual([
      "replace",
      "copy",
      "close",
    ]);
    expect(typeof cmd(lenses[1]).arguments?.[1]).toBe("number");
    expect((lenses[0].range as { start: { line: number } }).start.line).toBe(2);
  });

  test("two shows render two rows (8 lenses) with distinct ids", () => {
    const c = new InlineResultController();
    const { editor: e1 } = makeEditor(2, "file:///doc");
    const { editor: e2 } = makeEditor(5, "file:///doc");
    c.show(e1 as unknown as TextEditor, "first");
    c.show(e2 as unknown as TextEditor, "second");

    const lenses = c.provideCodeLenses(fakeDoc("file:///doc")) as Lens[];
    expect(lenses).toHaveLength(8);
    expect(cmd(lenses[1]).arguments?.[1]).not.toBe(
      cmd(lenses[5]).arguments?.[1],
    );
  });

  test("provideCodeLenses truncates a long preview with an ellipsis", () => {
    const c = new InlineResultController();
    const { editor } = makeEditor(2, "file:///doc");
    c.show(editor as unknown as TextEditor, "x".repeat(100));

    const lenses = c.provideCodeLenses(fakeDoc("file:///doc")) as Lens[];
    expect(cmd(lenses[0]).title).toBe(`$(output) ${"x".repeat(80)}…`);
  });

  test("provideCodeLenses returns [] with no results", () => {
    const c = new InlineResultController();
    expect(c.provideCodeLenses(fakeDoc())).toEqual([]);
  });

  test("provideCodeLenses returns only rows for the matching document", () => {
    const c = new InlineResultController();
    const { editor } = makeEditor(2, "file:///doc");
    c.show(editor as unknown as TextEditor, "RESULT");

    expect(c.provideCodeLenses(fakeDoc("file:///other"))).toEqual([]);
    expect(c.provideCodeLenses(fakeDoc("file:///doc"))).toHaveLength(4);
  });

  test("apply('replace', id) edits that row's range and removes only it", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor, editBuilder } = makeEditor(2, "file:///doc");
    (window as { activeTextEditor: unknown }).activeTextEditor = editor;
    c.show(editor as unknown as TextEditor, "ONE");
    c.show(editor as unknown as TextEditor, "TWO");

    const before = c.provideCodeLenses(fakeDoc("file:///doc")) as Lens[];
    const firstId = cmd(before[1]).arguments?.[1] as number;
    await getApply()("replace", firstId);

    expect(editBuilder.replace).toHaveBeenCalledWith(editor.selection, "ONE");
    expect(c.provideCodeLenses(fakeDoc("file:///doc"))).toHaveLength(4);
  });

  test("apply('copy', id) copies and keeps the row", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor } = makeEditor();
    c.show(editor as unknown as TextEditor, "RESULT");

    const lenses = c.provideCodeLenses(fakeDoc()) as Lens[];
    const id = cmd(lenses[1]).arguments?.[1] as number;
    await getApply()("copy", id);

    expect(env.clipboard.writeText).toHaveBeenCalledWith("RESULT");
    expect(window.setStatusBarMessage).toHaveBeenCalled();
    expect(c.provideCodeLenses(fakeDoc())).toHaveLength(4);
  });

  test("apply('close', id) removes only that row", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor } = makeEditor();
    c.show(editor as unknown as TextEditor, "ONE");
    c.show(editor as unknown as TextEditor, "TWO");

    const lenses = c.provideCodeLenses(fakeDoc()) as Lens[];
    const firstId = cmd(lenses[1]).arguments?.[1] as number;
    await getApply()("close", firstId);

    const after = c.provideCodeLenses(fakeDoc()) as Lens[];
    expect(after).toHaveLength(4);
    expect(cmd(after[0]).title).toContain("TWO");
  });

  test("apply ignores an unknown id", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor } = makeEditor();
    c.show(editor as unknown as TextEditor, "RESULT");

    await getApply()("close", 999);
    expect(c.provideCodeLenses(fakeDoc())).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/commands/inlineResult.test.ts`
Expected: FAIL — the current controller has single `state`, `apply` takes one arg, and lens args are `[action]` without an id, so the id/multi-row tests fail.

- [ ] **Step 3: Rewrite the controller**

Replace the ENTIRE contents of `src/commands/inlineResult.ts` with:

```ts
import * as vscode from "vscode";
import { replaceTarget } from "./pipelineResult";

type InlineResult = {
  id: number;
  uri: vscode.Uri;
  targetRange: vscode.Range;
  result: string;
};

type InlineAction = "replace" | "copy" | "close";

/**
 * Shows pipeline results as persistent CodeLens rows anchored above each
 * source selection, with Replace / Copy / Close actions. Multiple results can
 * be shown at once; each row stays until its Close or Replace removes it.
 */
export class InlineResultController implements vscode.CodeLensProvider {
  private results: InlineResult[] = [];
  private seq = 0;
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ scheme: "*" }, this),
      vscode.commands.registerCommand(
        "tschef.applyInlineResult",
        (action: InlineAction, id: number) => this.apply(action, id),
      ),
      this._onDidChangeCodeLenses,
    );
  }

  /** Add `result` as a new inline CodeLens row for the editor's selection. */
  show(editor: vscode.TextEditor, result: string): void {
    this.results.push({
      id: this.seq++,
      uri: editor.document.uri,
      targetRange: replaceTarget(editor),
      result,
    });
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const uri = document.uri.toString();
    const lenses: vscode.CodeLens[] = [];

    for (const item of this.results) {
      if (item.uri.toString() !== uri) continue;

      const line = item.targetRange.start.line;
      const range = new vscode.Range(line, 0, line, 0);
      const preview =
        item.result.replace(/\s+/g, " ").slice(0, 80) +
        (item.result.length > 80 ? "…" : "");

      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(output) ${preview}`,
          command: "",
        }),
        new vscode.CodeLens(range, {
          title: "$(replace) Replace",
          command: "tschef.applyInlineResult",
          arguments: ["replace", item.id],
        }),
        new vscode.CodeLens(range, {
          title: "$(copy) Copy",
          command: "tschef.applyInlineResult",
          arguments: ["copy", item.id],
        }),
        new vscode.CodeLens(range, {
          title: "$(close) Close",
          command: "tschef.applyInlineResult",
          arguments: ["close", item.id],
        }),
      );
    }

    return lenses;
  }

  private async apply(action: InlineAction, id: number): Promise<void> {
    const item = this.results.find((r) => r.id === id);
    if (!item) return;

    if (action === "replace") {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit((eb) => eb.replace(item.targetRange, item.result));
      }
      this.remove(id);
      return;
    }

    if (action === "copy") {
      vscode.env.clipboard.writeText(item.result);
      vscode.window.setStatusBarMessage(
        "ts-chef: Pipeline result copied",
        3000,
      );
      return;
    }

    this.remove(id);
  }

  private remove(id: number): void {
    this.results = this.results.filter((r) => r.id !== id);
    this._onDidChangeCodeLenses.fire();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/commands/inlineResult.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Full suite + typecheck + prettier + eslint**

Run: `npm test && npm run typecheck && npx prettier --check src/commands/inlineResult.ts test/commands/inlineResult.test.ts && npx eslint src/commands/inlineResult.ts`
Expected: all suites pass (0 failures); typecheck exits 0; prettier clean (write + re-check if needed); eslint exits 0.

- [ ] **Step 6: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/commands/inlineResult.ts test/commands/inlineResult.test.ts
git commit -m "feat: support multiple simultaneous inline result rows"
```

---

## Task 2: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck exits 0; all suites pass; build emits `dist/extension.js` (pre-existing d3 warnings only).

- [ ] **Step 2: Restore the generated registry if the build dirtied it**

Run: `git restore src/generated/opsRegistry.ts 2>/dev/null; git status --short`
Expected: clean working tree.

---

## Self-Review

**Spec coverage:**
- Collection state + `seq` ids → Task 1 controller ✓
- `show` appends + fires → Task 1 ✓
- `provideCodeLenses` emits a row per matching-uri result with `[action, id]` args → Task 1 ✓
- `apply(action, id)`: replace edits+removes, copy keeps, close removes; unknown id no-op → Task 1 ✓
- `remove(id)` replaces `clear()` → Task 1 ✓
- Append/duplicates, no Close-all, frozen ranges → covered by behavior (no extra code) ✓
- Tests for all of the above → Task 1 Step 1 ✓

**Placeholder scan:** No TBD/TODO; both files given in full.

**Type consistency:** `InlineResult` has `id/uri/targetRange/result`; the command callback signature `(action: InlineAction, id: number)` matches the lens `arguments: [action, id]` and the test's `getApply()` call shape. `remove(id)` used by both `apply` paths. `provideCodeLenses` returns `vscode.CodeLens[]`. Preview/truncation identical to the prior single-result version.
