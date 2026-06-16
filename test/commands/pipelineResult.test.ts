import { presentPipelineResult } from "../../src/commands/pipelineResult";
import { window, env, __setConfig, Position, Selection } from "../vscode-mock";
import type { TextEditor } from "vscode";

/** Build a fake TextEditor with a spyable edit builder. */
function makeEditor(opts?: { selectionEmpty?: boolean; text?: string }) {
  const editBuilder = { replace: jest.fn() };
  const editor = {
    selection: { isEmpty: opts?.selectionEmpty ?? false },
    document: {
      getText: () => opts?.text ?? "input",
      positionAt: (n: number) => new Position(0, n),
    },
    edit: jest.fn(async (cb: (eb: { replace: jest.Mock }) => void) => {
      cb(editBuilder);
      return true;
    }),
  };
  return { editor, editBuilder };
}

beforeEach(() => {
  jest.resetAllMocks();
  __setConfig({});
});

describe("presentPipelineResult", () => {
  test("copy mode copies to clipboard without a popup", async () => {
    __setConfig({ pipelineResultAction: "copy" });
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(env.clipboard.writeText).toHaveBeenCalledWith("RESULT");
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(window.setStatusBarMessage).toHaveBeenCalled();
  });

  test("replace mode edits the selection without a popup", async () => {
    __setConfig({ pipelineResultAction: "replace" });
    const { editor, editBuilder } = makeEditor({ selectionEmpty: false });

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(editor.edit).toHaveBeenCalled();
    expect(editBuilder.replace).toHaveBeenCalledWith(
      editor.selection,
      "RESULT",
    );
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(window.setStatusBarMessage).toHaveBeenCalled();
  });

  test("replace mode with empty selection targets the whole document", async () => {
    __setConfig({ pipelineResultAction: "replace" });
    const { editor, editBuilder } = makeEditor({
      selectionEmpty: true,
      text: "abcd",
    });

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(editBuilder.replace).toHaveBeenCalledTimes(1);
    const [range] = editBuilder.replace.mock.calls[0];
    expect(range).toBeInstanceOf(Selection);
  });

  test("popup mode shows the message and replaces when Replace is chosen", async () => {
    __setConfig({}); // default -> popup
    window.showInformationMessage.mockResolvedValue("Replace");
    const { editor, editBuilder } = makeEditor();

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
    expect(editBuilder.replace).toHaveBeenCalledWith(
      editor.selection,
      "RESULT",
    );
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });

  test("popup mode copies when Copy is chosen", async () => {
    window.showInformationMessage.mockResolvedValue("Copy");
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(env.clipboard.writeText).toHaveBeenCalledWith("RESULT");
  });

  test("popup mode does nothing when dismissed", async () => {
    window.showInformationMessage.mockResolvedValue(undefined);
    const { editor, editBuilder } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );

    expect(editBuilder.replace).not.toHaveBeenCalled();
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });

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

  test("popup mode truncates a long result preview with an ellipsis", async () => {
    window.showInformationMessage.mockResolvedValue(undefined);
    const { editor } = makeEditor();
    const long = "x".repeat(100);

    await presentPipelineResult(
      editor as unknown as TextEditor,
      long,
      "Result",
    );

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      `Result: ${"x".repeat(80)}…`,
      "Replace",
      "Copy",
    );
  });
});
