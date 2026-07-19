import type { Range as VsCodeRange, TextDocument } from "vscode";
import { SelectionReferenceTracker } from "../../src/commands/selectionReference";
import type { OffsetChange } from "../../src/commands/trackedRange";
import { Position, Range, Selection, window, workspace } from "../vscode-mock";

type FakeDocument = TextDocument & {
  applyChanges: (changes: readonly OffsetChange[]) => void;
};

function makeDocument(text: string): FakeDocument {
  let contents = text;
  return {
    getText: (range?: VsCodeRange) =>
      range
        ? contents.slice(range.start.character, range.end.character)
        : contents,
    offsetAt: (position: { character: number }) => position.character,
    positionAt: (offset: number) => new Position(0, offset),
    applyChanges: (changes: readonly OffsetChange[]) => {
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
}

function setup(text: string, start: number, end: number) {
  const document = makeDocument(text);
  const otherDocument = makeDocument(text);
  const owner = new SelectionReferenceTracker();
  const tracker = {
    reference: owner.create(
      document,
      new Range(0, start, 0, end) as unknown as VsCodeRange,
    ),
  };

  return {
    tracker,
    document,
    otherDocument,
    change: (changedDocument: FakeDocument, changes: OffsetChange[]) => {
      changedDocument.applyChanges(changes);
      const listener = workspace.onDidChangeTextDocument.mock.calls[0][0];
      listener({ document: changedDocument, contentChanges: changes });
    },
    close: (closedDocument: FakeDocument) => {
      const listener = workspace.onDidCloseTextDocument.mock.calls[0][0];
      listener(closedDocument);
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("updates text and emits for an edit inside the tracked range", () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const reference = tracker.reference;
  const listener = jest.fn();
  reference.onDidChange(listener);

  change(document, [{ rangeOffset: 3, rangeLength: 1, text: "XYZ" }]);

  expect(reference.text).toBe("2XYZ4");
  expect(listener).toHaveBeenCalledTimes(1);
});

test("shifts for an edit before the range without emitting", () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const listener = jest.fn();
  tracker.reference.onDidChange(listener);

  change(document, [{ rangeOffset: 0, rangeLength: 1, text: "abc" }]);

  expect(tracker.reference.text).toBe("234");
  expect(listener).not.toHaveBeenCalled();
});

test("ignores unrelated document changes", () => {
  const { tracker, otherDocument, change } = setup("0123456789", 2, 5);
  const listener = jest.fn();
  tracker.reference.onDidChange(listener);
  change(otherDocument, [{ rangeOffset: 0, rangeLength: 1, text: "x" }]);
  expect(tracker.reference.text).toBe("234");
  expect(listener).not.toHaveBeenCalled();
});

test("freezes the final text when its document closes", () => {
  const { tracker, document, close, change } = setup("0123456789", 2, 5);
  close(document);
  change(document, [{ rangeOffset: 2, rangeLength: 3, text: "new" }]);
  expect(tracker.reference.text).toBe("234");
});

test("reveals and selects the transformed source range", async () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const editor = { selection: undefined, revealRange: jest.fn() };
  window.showTextDocument.mockResolvedValue(editor);
  change(document, [{ rangeOffset: 0, rangeLength: 1, text: "abc" }]);

  await tracker.reference.reveal();

  expect(window.showTextDocument).toHaveBeenCalledWith(document, {
    preserveFocus: false,
  });
  expect(editor.selection).toEqual(
    new Selection(new Position(0, 4), new Position(0, 7)),
  );
  expect(editor.revealRange).toHaveBeenCalledWith(
    expect.objectContaining({
      start: new Position(0, 4),
      end: new Position(0, 7),
    }),
  );
});

test("silently skips reveal after the source document closes", async () => {
  const { tracker, document, close } = setup("0123456789", 2, 5);
  close(document);

  await expect(tracker.reference.reveal()).resolves.toBeUndefined();

  expect(window.showTextDocument).not.toHaveBeenCalled();
});

test("silently ignores editor reveal failures", async () => {
  const { tracker } = setup("0123456789", 2, 5);
  window.showTextDocument.mockRejectedValue(new Error("closed while opening"));

  await expect(tracker.reference.reveal()).resolves.toBeUndefined();
});

test("clone tracks independently and disposal stops updates", () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const clone = tracker.reference.clone();
  tracker.reference.dispose();
  change(document, [{ rangeOffset: 3, rangeLength: 1, text: "X" }]);
  expect(tracker.reference.text).toBe("234");
  expect(clone.text).toBe("2X4");
});
