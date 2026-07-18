import type {
  ExtensionContext,
  Range as VsCodeRange,
  TextDocument,
  TextEditor,
} from "vscode";
import { ResultsController } from "../../src/commands/resultsController";
import type { RenderedResultSource } from "../../src/commands/pipelineResult";
import type {
  ResultsViewMessage,
  ResultsViewProvider,
  ResultsViewState,
} from "../../src/providers/resultsViewProvider";
import {
  env,
  Position,
  Range,
  window,
  workspace,
} from "../vscode-mock";

type FakeDocument = TextDocument & { isClosed: boolean };

function makeDocument(name: string, text = "0123456789"): FakeDocument {
  const uri = `file:///${name}`;
  return {
    uri: { toString: () => uri },
    fileName: `/workspace/${name}`,
    isClosed: false,
    getText: () => text,
    offsetAt: (position: { character: number }) => position.character,
    positionAt: (offset: number) => new Position(0, offset),
  } as unknown as FakeDocument;
}

function makeEditor(document: FakeDocument, start = 1, end = 4) {
  const editBuilder = { replace: jest.fn() };
  const editor = {
    document,
    selection: {
      isEmpty: start === end,
      start: document.positionAt(start),
      end: document.positionAt(end),
    },
    viewColumn: 2,
    edit: jest.fn(async (callback: (builder: typeof editBuilder) => void) => {
      callback(editBuilder);
      return true;
    }),
    revealRange: jest.fn(),
  };
  return { editor: editor as unknown as TextEditor, editBuilder };
}

function source(label: string): RenderedResultSource {
  return {
    label,
    recipe: {
      name: label,
      steps: [{ opName: "From Hex", args: [{ alphabet: "standard" }] }],
    },
    evaluate: jest.fn((input: string) => input),
  };
}

function target(start: number, end: number): VsCodeRange {
  return new Range(0, start, 0, end) as unknown as VsCodeRange;
}

function setup() {
  let listener: ((message: ResultsViewMessage) => void) | undefined;
  const states: ResultsViewState[] = [];
  const view = {
    setState: jest.fn((state: ResultsViewState) => states.push(state)),
    onDidMessage: jest.fn((next: (message: ResultsViewMessage) => void) => {
      listener = next;
      return { dispose: jest.fn() };
    }),
    dispose: jest.fn(),
  } as unknown as ResultsViewProvider;
  const loadRecipe = jest.fn();
  const showPanel = jest.fn();
  const controller = new ResultsController(view, { loadRecipe, showPanel });
  const context = { subscriptions: [] } as unknown as ExtensionContext;
  controller.register(context);

  return {
    controller,
    loadRecipe,
    showPanel,
    states,
    lastState: () => states[states.length - 1],
    emit: async (message: ResultsViewMessage | Record<string, unknown>) => {
      listener?.(message as ResultsViewMessage);
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (window as { activeTextEditor: unknown }).activeTextEditor = undefined;
});

describe("ResultsController", () => {
  test("collects newest first and filters by the active editor", async () => {
    const documentA = makeDocument("a.txt");
    const documentB = makeDocument("b.txt");
    const { editor: editorA } = makeEditor(documentA);
    const { editor: editorB } = makeEditor(documentB);
    (window as { activeTextEditor: unknown }).activeTextEditor = editorA;
    const { controller, emit, lastState } = setup();

    controller.show(editorA, "first", target(1, 4), source("Recipe A"));
    controller.show(editorB, "second", target(2, 5), source("Recipe B"));

    expect(lastState()).toMatchObject({
      filter: "all",
      totalCount: 2,
      items: [
        { label: "Recipe B", source: "b.txt", output: "second" },
        { label: "Recipe A", source: "a.txt", output: "first" },
      ],
    });

    await emit({ type: "filter", filter: "current" });
    expect(lastState().items).toHaveLength(1);
    expect(lastState().items[0].source).toBe("a.txt");

    const activeEditorHandler = window.onDidChangeActiveTextEditor.mock.calls[0][0];
    activeEditorHandler(editorB);
    expect(lastState().items).toHaveLength(1);
    expect(lastState().items[0].source).toBe("b.txt");
  });

  test("opens the source range and loads an immutable recipe snapshot", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    const shown = makeEditor(document).editor;
    window.showTextDocument.mockResolvedValue(shown);
    const original = source("Original");
    const { controller, emit, lastState, loadRecipe } = setup();
    controller.show(editor, "result", target(2, 6), original);
    const id = lastState().items[0].id;
    original.recipe.name = "Mutated";
    (original.recipe.steps[0].args[0] as { alphabet: string }).alphabet = "changed";

    await emit({ type: "open", id });

    expect(window.showTextDocument).toHaveBeenCalledWith(document, {
      viewColumn: editor.viewColumn,
      preserveFocus: false,
    });
    expect(shown.selection).toEqual(
      expect.objectContaining({
        anchor: document.positionAt(2),
        active: document.positionAt(6),
      }),
    );
    expect(shown.revealRange).toHaveBeenCalledWith(
      expect.objectContaining({
        start: document.positionAt(2),
        end: document.positionAt(6),
      }),
    );
    expect(loadRecipe).toHaveBeenCalledWith({
      name: "Original",
      steps: [{ opName: "From Hex", args: [{ alphabet: "standard" }] }],
    });
  });

  test("popup and copy act on output without removing the row", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    const { controller, emit, lastState, showPanel } = setup();
    controller.show(editor, "result", target(2, 6), source("Recipe"));
    const id = lastState().items[0].id;

    await emit({ type: "action", action: "popup", id });
    expect(showPanel).toHaveBeenCalledWith(
      editor,
      "result",
      expect.objectContaining({
        start: document.positionAt(2),
        end: document.positionAt(6),
      }),
    );
    expect(lastState().items).toHaveLength(1);

    await emit({ type: "action", action: "copy", id });
    expect(env.clipboard.writeText).toHaveBeenCalledWith("result");
    expect(window.setStatusBarMessage).toHaveBeenCalledWith(
      "ts-chef: Pipeline result copied",
      3000,
    );
    expect(lastState().items).toHaveLength(1);
  });

  test("delete removes only the selected row", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    const { controller, emit, lastState } = setup();
    controller.show(editor, "first", target(1, 2), source("First"));
    controller.show(editor, "second", target(3, 4), source("Second"));
    const id = lastState().items[1].id;

    await emit({ type: "action", action: "delete", id });

    expect(lastState()).toMatchObject({
      totalCount: 1,
      items: [{ label: "Second", output: "second" }],
    });
  });

  test("replace removes the row before editing the revealed source", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    const { editor: shown, editBuilder } = makeEditor(document);
    window.showTextDocument.mockResolvedValue(shown);
    const { controller, emit, lastState } = setup();
    controller.show(editor, "replacement", target(2, 6), source("Recipe"));
    const id = lastState().items[0].id;
    (shown.edit as jest.Mock).mockImplementation(
      async (callback: (builder: typeof editBuilder) => void) => {
        expect(lastState().items).toHaveLength(0);
        callback(editBuilder);
        return true;
      },
    );

    await emit({ type: "action", action: "replace", id });

    expect(editBuilder.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        start: document.positionAt(2),
        end: document.positionAt(6),
      }),
      "replacement",
    );
    expect(lastState().totalCount).toBe(0);
  });

  test("closing a source removes all its rows and keeps other documents", () => {
    const documentA = makeDocument("a.txt");
    const documentB = makeDocument("b.txt");
    const { editor: editorA } = makeEditor(documentA);
    const { editor: editorB } = makeEditor(documentB);
    const { controller, lastState } = setup();
    controller.show(editorA, "a1", target(1, 2), source("A1"));
    controller.show(editorB, "b", target(1, 2), source("B"));
    controller.show(editorA, "a2", target(2, 3), source("A2"));

    const closeHandler = workspace.onDidCloseTextDocument.mock.calls[0][0];
    closeHandler(documentA);

    expect(lastState()).toMatchObject({
      totalCount: 1,
      items: [{ label: "B", source: "b.txt", output: "b" }],
    });
  });

  test("closed sources and unknown IDs or actions are ignored safely", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    const { controller, emit, lastState, loadRecipe, showPanel } = setup();
    controller.show(editor, "result", target(2, 6), source("Recipe"));
    const id = lastState().items[0].id;
    document.isClosed = true;

    await emit({ type: "open", id });
    await emit({ type: "open", id: 999 });
    await emit({ type: "action", action: "unknown", id });
    await emit({ type: "action", action: "delete", id: 999 });

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      "ts-chef: Cannot open result - the source document is closed.",
    );
    expect(window.showTextDocument).not.toHaveBeenCalled();
    expect(loadRecipe).not.toHaveBeenCalled();
    expect(showPanel).not.toHaveBeenCalled();
    expect(lastState().items).toHaveLength(1);
  });
});
