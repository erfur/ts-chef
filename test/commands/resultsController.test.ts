import type {
  ExtensionContext,
  Range as VsCodeRange,
  TextDocument,
  TextEditor,
} from "vscode";
import { ResultsController } from "../../src/commands/resultsController";
import {
  SelectionReferenceTracker,
  type SelectionReference,
} from "../../src/commands/selectionReference";
import { createPipelineResultSource } from "../../src/commands/resultSource";
import * as runner from "../../src/commands/runner";
import { transformTrackedRange } from "../../src/commands/trackedRange";
import type { RenderedResultSource } from "../../src/commands/pipelineResult";
import type {
  ResultsViewMessage,
  ResultsViewProvider,
  ResultsViewState,
} from "../../src/providers/resultsViewProvider";
import { env, Position, Range, window, workspace } from "../vscode-mock";

type OffsetChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

type FakeDocument = TextDocument & {
  isClosed: boolean;
  applyChanges: (changes: OffsetChange[]) => void;
};

function makeDocument(name: string, text = "0123456789"): FakeDocument {
  const uri = `file:///${name}`;
  let contents = text;
  const document = {
    uri: { toString: () => uri },
    fileName: `/workspace/${name}`,
    isClosed: false,
    getText: (range?: VsCodeRange) =>
      range
        ? contents.slice(range.start.character, range.end.character)
        : contents,
    offsetAt: (position: { character: number }) => position.character,
    positionAt: (offset: number) => new Position(0, offset),
    applyChanges: (changes: OffsetChange[]) => {
      for (const change of [...changes].sort(
        (a, b) => b.rangeOffset - a.rangeOffset,
      )) {
        contents =
          contents.slice(0, change.rangeOffset) +
          change.text +
          contents.slice(change.rangeOffset + change.rangeLength);
      }
    },
  } as unknown as FakeDocument;
  return document;
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

function sourceWithReference() {
  let listener: (() => void) | undefined;
  const subscription = { dispose: jest.fn() };
  const reference: SelectionReference = {
    text: "key",
    onDidChange: jest.fn((next: () => void) => {
      listener = next;
      return subscription;
    }),
    clone: jest.fn(),
    reveal: jest.fn(async () => {}),
    dispose: jest.fn(),
  };
  const value = source("Recipe");
  value.references = [
    {
      stepIndex: 0,
      argIndex: 0,
      type: "string",
      reference,
    },
  ];
  value.dispose = jest.fn();
  return {
    source: value,
    fire: () => listener?.(),
    subscription,
  };
}

function target(start: number, end: number): VsCodeRange {
  return new Range(0, start, 0, end) as unknown as VsCodeRange;
}

function setup(debounceMs?: number) {
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
  const controller = new ResultsController(view, {
    loadRecipe,
    showPanel,
    debounceMs,
  });
  const context = { subscriptions: [] } as unknown as ExtensionContext;
  controller.register(context);

  return {
    controller,
    context,
    loadRecipe,
    showPanel,
    states,
    lastState: () => states[states.length - 1],
    change: (document: FakeDocument, changes: OffsetChange[]) => {
      document.applyChanges(changes);
      const changeHandler = workspace.onDidChangeTextDocument.mock.calls[0][0];
      changeHandler({ document, contentChanges: changes });
    },
    close: (document: FakeDocument) => {
      document.isClosed = true;
      const closeHandler = workspace.onDidCloseTextDocument.mock.calls[0][0];
      closeHandler(document);
    },
    emit: async (message: ResultsViewMessage | Record<string, unknown>) => {
      listener?.(message as ResultsViewMessage);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (window as { activeTextEditor: unknown }).activeTextEditor = undefined;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("transformTrackedRange", () => {
  test.each([
    [
      "edit before",
      5,
      9,
      [{ rangeOffset: 0, rangeLength: 2, text: "1234" }],
      7,
      11,
      false,
    ],
    [
      "edit inside",
      5,
      9,
      [{ rangeOffset: 6, rangeLength: 1, text: "XYZ" }],
      5,
      11,
      true,
    ],
    [
      "insert at start",
      5,
      9,
      [{ rangeOffset: 5, rangeLength: 0, text: "X" }],
      5,
      10,
      true,
    ],
    [
      "insert text at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 0, text: "X" }],
      5,
      9,
      false,
    ],
    [
      "insert newline at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 0, text: "\n" }],
      5,
      9,
      false,
    ],
    [
      "edit after",
      5,
      9,
      [{ rangeOffset: 10, rangeLength: 1, text: "" }],
      5,
      9,
      false,
    ],
    [
      "edit ending at start",
      5,
      9,
      [{ rangeOffset: 3, rangeLength: 2, text: "X" }],
      4,
      8,
      false,
    ],
    [
      "edit starting at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 2, text: "X" }],
      5,
      9,
      false,
    ],
    [
      "edit crossing start",
      5,
      9,
      [{ rangeOffset: 3, rangeLength: 4, text: "X" }],
      3,
      6,
      true,
    ],
    [
      "edit crossing end",
      5,
      9,
      [{ rangeOffset: 7, rangeLength: 4, text: "XY" }],
      5,
      9,
      true,
    ],
    [
      "edit covering range",
      5,
      9,
      [{ rangeOffset: 3, rangeLength: 8, text: "X" }],
      3,
      4,
      true,
    ],
  ] as const)(
    "tracks %s",
    (_name, start, end, changes, nextStart, nextEnd, changed) => {
      expect(transformTrackedRange(start, end, [...changes])).toEqual({
        start: nextStart,
        end: nextEnd,
        changed,
      });
    },
  );

  test("applies cumulative deltas from unordered original-document changes once", () => {
    expect(
      transformTrackedRange(5, 9, [
        { rangeOffset: 6, rangeLength: 1, text: "XYZ" },
        { rangeOffset: 0, rangeLength: 2, text: "1234" },
      ]),
    ).toEqual({ start: 7, end: 13, changed: true });
  });

  test.each([
    [
      "ignores an edit away from a point",
      4,
      4,
      [{ rangeOffset: 6, rangeLength: 1, text: "X" }],
      4,
      4,
      false,
    ],
    [
      "shifts a point after an earlier edit",
      4,
      4,
      [{ rangeOffset: 0, rangeLength: 1, text: "XYZ" }],
      6,
      6,
      false,
    ],
    [
      "expands a point for an insertion there",
      4,
      4,
      [{ rangeOffset: 4, rangeLength: 0, text: "XY" }],
      4,
      6,
      true,
    ],
    [
      "tracks an insertion at document start",
      0,
      10,
      [{ rangeOffset: 0, rangeLength: 0, text: "X" }],
      0,
      11,
      true,
    ],
    [
      "leaves an insertion at document end outside",
      0,
      10,
      [{ rangeOffset: 10, rangeLength: 0, text: "X" }],
      0,
      10,
      false,
    ],
    [
      "tracks a whole-document replacement",
      0,
      10,
      [{ rangeOffset: 0, rangeLength: 10, text: "new" }],
      0,
      3,
      true,
    ],
  ] as const)(
    "%s",
    (_name, start, end, changes, nextStart, nextEnd, changed) => {
      expect(transformTrackedRange(start, end, [...changes])).toEqual({
        start: nextStart,
        end: nextEnd,
        changed,
      });
    },
  );
});

describe("ResultsController", () => {
  test("tracked reference clones recompute with newly materialized argument text", async () => {
    jest.useFakeTimers();
    const referenceDocument = makeDocument("reference.txt", "key-one");
    const inputDocument = makeDocument("input.txt", "input");
    const tracker = new SelectionReferenceTracker();
    const reference = tracker.create(referenceDocument, target(0, 7));
    const pipeline = createPipelineResultSource(
      "Recipe",
      [{ opName: "Test", args: ["old"] }],
      [{ stepIndex: 0, argIndex: 0, type: "string", reference }],
    );
    reference.dispose();
    const runPipeline = jest
      .spyOn(runner, "runPipeline")
      .mockImplementation(
        (input, steps) => `${input}:${String(steps[0].args[0])}`,
      );
    const { controller, lastState } = setup(10);
    const { editor } = makeEditor(inputDocument, 0, 5);
    controller.show(editor, "initial", target(0, 5), {
      ...pipeline,
      label: "Recipe",
    });

    const changes = [{ rangeOffset: 0, rangeLength: 7, text: "key-two" }];
    referenceDocument.applyChanges(changes);
    for (const [listener] of workspace.onDidChangeTextDocument.mock.calls) {
      listener({ document: referenceDocument, contentChanges: changes });
    }
    await jest.advanceTimersByTimeAsync(10);

    expect(runPipeline).toHaveBeenCalledWith("input", [
      { opName: "Test", args: ["key-two"] },
    ]);
    expect(lastState().items[0]).toMatchObject({ output: "input:key-two" });
    controller.dispose();
    tracker.dispose();
  });

  test("debounces reference changes and recomputes with current values", async () => {
    jest.useFakeTimers();
    const dynamic = sourceWithReference();
    const { controller } = setup(20);
    const { editor } = makeEditor(makeDocument("source.txt", "input"), 0, 5);
    controller.show(editor, "initial", target(0, 5), dynamic.source);

    dynamic.fire();
    dynamic.fire();
    await jest.advanceTimersByTimeAsync(20);

    expect(dynamic.source.evaluate).toHaveBeenCalledTimes(1);
    expect(dynamic.source.evaluate).toHaveBeenCalledWith("input");
  });

  test("deleting a result disposes its reference subscription and source", async () => {
    const dynamic = sourceWithReference();
    const { controller, emit, lastState } = setup();
    const { editor } = makeEditor(makeDocument("source.txt"));
    controller.show(editor, "initial", target(1, 4), dynamic.source);
    await emit({
      type: "action",
      action: "delete",
      id: lastState().items[0].id,
    });
    expect(dynamic.subscription.dispose).toHaveBeenCalledTimes(1);
    expect(dynamic.source.dispose).toHaveBeenCalledTimes(1);
  });

  test("closing the input document disposes result reference resources", () => {
    const dynamic = sourceWithReference();
    const { controller, close } = setup();
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    controller.show(editor, "initial", target(1, 4), dynamic.source);
    close(document);
    expect(dynamic.subscription.dispose).toHaveBeenCalledTimes(1);
    expect(dynamic.source.dispose).toHaveBeenCalledTimes(1);
  });

  test("closing an unrelated document preserves result reference resources", () => {
    const dynamic = sourceWithReference();
    const { controller, close, lastState } = setup();
    const { editor } = makeEditor(makeDocument("source.txt"));
    controller.show(editor, "initial", target(1, 4), dynamic.source);

    close(makeDocument("reference.txt"));

    expect(lastState().items).toHaveLength(1);
    expect(dynamic.subscription.dispose).not.toHaveBeenCalled();
    expect(dynamic.source.dispose).not.toHaveBeenCalled();
  });

  test("controller disposal releases result reference resources", () => {
    const dynamic = sourceWithReference();
    const { controller } = setup();
    const { editor } = makeEditor(makeDocument("source.txt"));
    controller.show(editor, "initial", target(1, 4), dynamic.source);
    controller.dispose();
    expect(dynamic.subscription.dispose).toHaveBeenCalledTimes(1);
    expect(dynamic.source.dispose).toHaveBeenCalledTimes(1);
  });

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

    const activeEditorHandler =
      window.onDidChangeActiveTextEditor.mock.calls[0][0];
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
    (original.recipe.steps[0].args[0] as { alphabet: string }).alphabet =
      "changed";

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

  test("warns without loading a recipe when revealing an open result rejects", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    window.showTextDocument.mockRejectedValue(new Error("reveal failed"));
    const { controller, emit, lastState, loadRecipe } = setup();
    controller.show(editor, "result", target(2, 6), source("Recipe"));
    const id = lastState().items[0].id;

    await emit({ type: "open", id });

    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(loadRecipe).not.toHaveBeenCalled();
    expect(lastState().items).toHaveLength(1);
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

  test("warns once when editing a removed replacement rejects", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    const { editor: shown } = makeEditor(document);
    window.showTextDocument.mockResolvedValue(shown);
    (shown.edit as jest.Mock).mockRejectedValue(new Error("edit failed"));
    const { controller, emit, lastState } = setup();
    controller.show(editor, "replacement", target(2, 6), source("Recipe"));
    const id = lastState().items[0].id;

    await emit({ type: "action", action: "replace", id });

    expect(lastState().items).toHaveLength(0);
    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
  });

  test("warns once when editing a removed replacement returns false", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    const { editor: shown } = makeEditor(document);
    window.showTextDocument.mockResolvedValue(shown);
    (shown.edit as jest.Mock).mockResolvedValue(false);
    const { controller, emit, lastState } = setup();
    controller.show(editor, "replacement", target(2, 6), source("Recipe"));
    const id = lastState().items[0].id;

    await emit({ type: "action", action: "replace", id });

    expect(lastState().items).toHaveLength(0);
    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
  });

  test("contains unexpected async action rejections at the message listener", async () => {
    const document = makeDocument("source.txt");
    const { editor } = makeEditor(document);
    env.clipboard.writeText.mockRejectedValue(new Error("clipboard failed"));
    const { controller, emit, lastState } = setup();
    controller.show(editor, "result", target(2, 6), source("Recipe"));
    const id = lastState().items[0].id;

    await emit({ type: "action", action: "copy", id });

    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(window.setStatusBarMessage).not.toHaveBeenCalled();
    expect(lastState().items).toHaveLength(1);
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

  test("moves action ranges for edits strictly before without recomputing", async () => {
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    const { editor: shown, editBuilder } = makeEditor(document);
    window.showTextDocument.mockResolvedValue(shown);
    const recipe = source("Recipe");
    const { controller, change, emit, lastState } = setup(10);
    controller.show(editor, "result", target(5, 9), recipe);
    const id = lastState().items[0].id;

    change(document, [{ rangeOffset: 0, rangeLength: 2, text: "1234" }]);
    await emit({ type: "open", id });

    expect(shown.selection).toEqual(
      expect.objectContaining({
        anchor: document.positionAt(7),
        active: document.positionAt(11),
      }),
    );
    await emit({ type: "action", action: "replace", id });
    expect(editBuilder.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        start: document.positionAt(7),
        end: document.positionAt(11),
      }),
      "result",
    );
    expect(recipe.evaluate).not.toHaveBeenCalled();
  });

  test("keeps an insertion at a non-empty end boundary outside the result", async () => {
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    const { editor: shown, editBuilder } = makeEditor(document);
    window.showTextDocument.mockResolvedValue(shown);
    const recipe = source("Recipe");
    const { controller, change, emit, lastState } = setup(10);
    controller.show(editor, "result", target(2, 5), recipe);
    const id = lastState().items[0].id;

    change(document, [{ rangeOffset: 5, rangeLength: 0, text: "\n" }]);
    await emit({ type: "open", id });

    expect(recipe.evaluate).not.toHaveBeenCalled();
    expect(shown.selection).toEqual(
      expect.objectContaining({
        anchor: document.positionAt(2),
        active: document.positionAt(5),
      }),
    );

    await emit({ type: "action", action: "replace", id });
    expect(editBuilder.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        start: document.positionAt(2),
        end: document.positionAt(5),
      }),
      "result",
    );
  });

  test("debounces intersecting edits and evaluates the newest tracked text", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    const recipe = source("Recipe");
    const { controller, change, lastState } = setup(10);
    controller.show(editor, "initial", target(2, 5), recipe);

    change(document, [{ rangeOffset: 3, rangeLength: 0, text: "X" }]);
    change(document, [{ rangeOffset: 4, rangeLength: 0, text: "Y" }]);
    await jest.advanceTimersByTimeAsync(10);

    expect(recipe.evaluate).toHaveBeenCalledTimes(1);
    expect(recipe.evaluate).toHaveBeenCalledWith("cXYde");
    expect(lastState().items[0]).toMatchObject({ output: "cXYde" });
  });

  test("does not publish an older evaluation after a newer one", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    let resolveOld: (value: string) => void = () => {};
    let resolveNew: (value: string) => void = () => {};
    const oldResult = new Promise<string>((resolve) => {
      resolveOld = resolve;
    });
    const newResult = new Promise<string>((resolve) => {
      resolveNew = resolve;
    });
    const recipe = source("Recipe");
    (recipe.evaluate as jest.Mock)
      .mockReturnValueOnce(oldResult)
      .mockReturnValueOnce(newResult);
    const { controller, change, lastState } = setup(10);
    controller.show(editor, "initial", target(2, 5), recipe);

    change(document, [{ rangeOffset: 3, rangeLength: 0, text: "X" }]);
    await jest.advanceTimersByTimeAsync(10);
    change(document, [{ rangeOffset: 4, rangeLength: 0, text: "Y" }]);
    await jest.advanceTimersByTimeAsync(10);
    resolveNew("NEW");
    await Promise.resolve();
    expect(lastState().items[0]).toMatchObject({ output: "NEW" });

    resolveOld("OLD");
    await Promise.resolve();
    expect(lastState().items[0]).toMatchObject({ output: "NEW" });
  });

  test("publishes an inline error and recovers after a successful edit", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    const recipe = source("Recipe");
    (recipe.evaluate as jest.Mock)
      .mockRejectedValueOnce(new Error("bad input"))
      .mockResolvedValueOnce("RECOVERED");
    const { controller, change, lastState } = setup(10);
    controller.show(editor, "initial", target(2, 5), recipe);

    change(document, [{ rangeOffset: 3, rangeLength: 0, text: "X" }]);
    await jest.advanceTimersByTimeAsync(10);
    expect(lastState().items[0]).toMatchObject({
      error: "bad input",
      output: undefined,
    });

    change(document, [{ rangeOffset: 4, rangeLength: 0, text: "Y" }]);
    await jest.advanceTimersByTimeAsync(10);
    expect(lastState().items[0]).toMatchObject({
      output: "RECOVERED",
      error: undefined,
    });
  });

  test("disables output actions in an error state but still allows delete", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    const recipe = source("Recipe");
    (recipe.evaluate as jest.Mock).mockRejectedValueOnce(
      new Error("bad input"),
    );
    const { controller, change, emit, lastState, showPanel } = setup(10);
    controller.show(editor, "initial", target(2, 5), recipe);
    const id = lastState().items[0].id;
    change(document, [{ rangeOffset: 3, rangeLength: 0, text: "X" }]);
    await jest.advanceTimersByTimeAsync(10);

    await emit({ type: "action", action: "popup", id });
    await emit({ type: "action", action: "copy", id });
    await emit({ type: "action", action: "replace", id });
    expect(showPanel).not.toHaveBeenCalled();
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
    expect(editor.edit).not.toHaveBeenCalled();

    await emit({ type: "action", action: "delete", id });
    expect(lastState().items).toHaveLength(0);
  });

  test("keeps document-end appends outside a whole-document result", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document, 0, 10);
    const recipe = source("Recipe");
    const { controller, change } = setup(10);
    controller.show(editor, "initial", target(0, 10), recipe);

    change(document, [{ rangeOffset: 10, rangeLength: 0, text: "X" }]);
    await jest.advanceTimersByTimeAsync(10);
    change(document, [{ rangeOffset: 0, rangeLength: 0, text: "Y" }]);
    await jest.advanceTimersByTimeAsync(10);

    expect(recipe.evaluate).toHaveBeenCalledTimes(1);
    expect(recipe.evaluate).toHaveBeenCalledWith("Yabcdefghij");
  });

  test("moves a zero-length range silently and expands it for an insertion there", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document, 4, 4);
    const recipe = source("Recipe");
    const { controller, change } = setup(10);
    controller.show(editor, "initial", target(4, 4), recipe);

    change(document, [{ rangeOffset: 0, rangeLength: 0, text: "X" }]);
    await jest.advanceTimersByTimeAsync(10);
    expect(recipe.evaluate).not.toHaveBeenCalled();

    change(document, [{ rangeOffset: 5, rangeLength: 0, text: "Y" }]);
    await jest.advanceTimersByTimeAsync(10);
    expect(recipe.evaluate).toHaveBeenCalledWith("Y");
  });

  test("clears pending evaluations when results are deleted or documents close", async () => {
    jest.useFakeTimers();
    const deletedDocument = makeDocument("deleted.txt", "abcdefghij");
    const closedDocument = makeDocument("closed.txt", "abcdefghij");
    const { editor: deletedEditor } = makeEditor(deletedDocument);
    const { editor: closedEditor } = makeEditor(closedDocument);
    const deletedSource = source("Deleted");
    const closedSource = source("Closed");
    const { controller, change, close, emit, lastState } = setup(10);
    controller.show(deletedEditor, "deleted", target(2, 5), deletedSource);
    const deletedId = lastState().items[0].id;
    controller.show(closedEditor, "closed", target(2, 5), closedSource);

    change(deletedDocument, [{ rangeOffset: 3, rangeLength: 0, text: "X" }]);
    change(closedDocument, [{ rangeOffset: 3, rangeLength: 0, text: "X" }]);
    await emit({ type: "action", action: "delete", id: deletedId });
    close(closedDocument);
    await jest.advanceTimersByTimeAsync(10);

    expect(deletedSource.evaluate).not.toHaveBeenCalled();
    expect(closedSource.evaluate).not.toHaveBeenCalled();
    expect(lastState().items).toHaveLength(0);
  });

  test("disposal invalidates results and clears pending evaluations", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    const recipe = source("Recipe");
    const { controller, context, change, states } = setup(10);
    controller.show(editor, "initial", target(2, 5), recipe);
    change(document, [{ rangeOffset: 3, rangeLength: 0, text: "X" }]);
    const publishedBeforeDispose = states.length;

    expect(context.subscriptions).toContain(controller);
    controller.dispose();
    await jest.advanceTimersByTimeAsync(10);

    expect(recipe.evaluate).not.toHaveBeenCalled();
    expect(states).toHaveLength(publishedBeforeDispose);
  });
});
