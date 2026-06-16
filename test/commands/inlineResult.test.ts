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
    onDocChange: workspace.onDidChangeTextDocument.mock.calls[0][0] as (e: {
      document: TextDocument;
    }) => void,
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
    expect((lenses[0].range as { start: { line: number } }).start.line).toBe(2);
  });

  test("provideCodeLenses truncates a long preview with an ellipsis", () => {
    const c = new InlineResultController();
    const { editor } = makeEditor(2, "file:///doc");
    const long = "x".repeat(100);
    c.show(editor as unknown as TextEditor, long);

    const lenses = c.provideCodeLenses(fakeDoc("file:///doc")) as InstanceType<
      typeof CodeLens
    >[];
    const title = (lenses[0].command as { title: string }).title;
    expect(title).toBe(`$(output) ${"x".repeat(80)}…`);
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
    expect(editBuilder.replace).toHaveBeenCalledWith(
      editor.selection,
      "RESULT",
    );
    expect(c.provideCodeLenses(fakeDoc())).toEqual([]);
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
    expect(c.provideCodeLenses(fakeDoc())).toHaveLength(4);
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
