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
function makeEditor(line = 2, uri = "file:///doc", isClosed = false) {
  const editBuilder = { replace: jest.fn() };
  const editor = {
    selection: {
      isEmpty: false,
      start: { line, character: 0 },
      end: { line, character: 5 },
    },
    document: { uri: { toString: () => uri }, isClosed },
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

  test("apply('replace', id) targets the stored editor, not the active one", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor: docA, editBuilder: ebA } = makeEditor(2, "file:///a");
    const { editBuilder: ebB } = makeEditor(2, "file:///b");
    const { editor: docBActive } = makeEditor(9, "file:///b");
    c.show(docA as unknown as TextEditor, "FROM_A");
    (window as { activeTextEditor: unknown }).activeTextEditor = docBActive;

    const lenses = c.provideCodeLenses(fakeDoc("file:///a")) as Lens[];
    const id = cmd(lenses[1]).arguments?.[1] as number;
    await getApply()("replace", id);

    expect(ebA.replace).toHaveBeenCalledWith(docA.selection, "FROM_A");
    expect(ebB.replace).not.toHaveBeenCalled();
  });

  test("apply('replace', id) on a closed editor warns and keeps the row", async () => {
    const c = new InlineResultController();
    c.register(fakeContext());
    const { editor, editBuilder } = makeEditor(2, "file:///doc", true);
    c.show(editor as unknown as TextEditor, "RESULT");

    const lenses = c.provideCodeLenses(fakeDoc()) as Lens[];
    const id = cmd(lenses[1]).arguments?.[1] as number;
    await getApply()("replace", id);

    expect(editBuilder.replace).not.toHaveBeenCalled();
    expect(window.showWarningMessage).toHaveBeenCalled();
    expect(c.provideCodeLenses(fakeDoc())).toHaveLength(4);
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
