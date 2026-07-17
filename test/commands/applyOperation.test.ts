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
