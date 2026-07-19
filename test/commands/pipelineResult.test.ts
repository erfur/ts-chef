import {
  presentPipelineResult,
  type PipelineResultSource,
} from "../../src/commands/pipelineResult";
import {
  window,
  env,
  __setConfig,
  Position,
  Range,
  Selection,
} from "../vscode-mock";
import type { Range as VsCodeRange, TextEditor } from "vscode";
import type { PipelineStep } from "../../src/storage/store";

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

function disposableSource(): PipelineResultSource {
  return {
    recipe: { name: "r", steps: [] },
    evaluate: jest.fn(),
    dispose: jest.fn(),
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  __setConfig({});
});

describe("presentPipelineResult", () => {
  test.each(["popup", "copy", "replace", "inline", "panel"] as const)(
    "%s mode disposes a runtime result source after presentation",
    async (mode) => {
      __setConfig({ pipelineResultAction: mode });
      const source = disposableSource();
      const { editor } = makeEditor();
      const render = { inline: jest.fn(), panel: jest.fn() };
      await presentPipelineResult(
        editor as unknown as TextEditor,
        "RESULT",
        "Result",
        render,
        undefined,
        source,
      );
      expect(source.dispose).toHaveBeenCalledTimes(1);
    },
  );

  test("sidebar transfers runtime source ownership to its renderer", async () => {
    __setConfig({ pipelineResultAction: "sidebar" });
    const source = disposableSource();
    const showSidebar = jest.fn();
    const { editor } = makeEditor();
    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      { sidebar: showSidebar },
      undefined,
      source,
    );
    expect(showSidebar).toHaveBeenCalled();
    expect(source.dispose).not.toHaveBeenCalled();
  });

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

  test.each(["replace", "popup"] as const)(
    "%s mode uses an explicit replacement target",
    async (mode) => {
      __setConfig({ pipelineResultAction: mode });
      if (mode === "popup") {
        window.showInformationMessage.mockResolvedValue("Replace");
      }
      const { editor, editBuilder } = makeEditor({ selectionEmpty: true });
      const target = new Range(0, 2, 0, 2) as unknown as VsCodeRange;

      await presentPipelineResult(
        editor as unknown as TextEditor,
        "RESULT",
        "Result",
        undefined,
        target,
      );

      expect(editBuilder.replace).toHaveBeenCalledWith(target, "RESULT");
    },
  );

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

  test("popup mode resolves an omitted replacement target when Replace is chosen", async () => {
    let resolveAction!: (action: "Replace") => void;
    window.showInformationMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const { editor, editBuilder } = makeEditor();
    const updatedSelection = { isEmpty: false };

    const presenting = presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
    );
    editor.selection = updatedSelection;
    resolveAction("Replace");
    await presenting;

    expect(editBuilder.replace.mock.calls[0][0]).toBe(updatedSelection);
    expect(editBuilder.replace.mock.calls[0][1]).toBe("RESULT");
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

    expect(showInline).toHaveBeenCalledWith(
      editor,
      "RESULT",
      editor.selection,
      undefined,
    );
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

    expect(showPanel).toHaveBeenCalledWith(
      editor,
      "RESULT",
      editor.selection,
      undefined,
    );
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(env.clipboard.writeText).not.toHaveBeenCalled();
  });

  test("inline mode falls back to popup when no renderer is provided", async () => {
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

  test("renderer receives the explicit replacement target", async () => {
    __setConfig({ pipelineResultAction: "inline" });
    const showInline = jest.fn();
    const { editor } = makeEditor({ selectionEmpty: true });
    const target = new Range(0, 2, 0, 2) as unknown as VsCodeRange;

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      { inline: showInline },
      target,
    );

    expect(showInline).toHaveBeenCalledWith(
      editor,
      "RESULT",
      target,
      undefined,
    );
  });

  test("sidebar mode delegates with source context", async () => {
    __setConfig({ pipelineResultAction: "sidebar" });
    const showSidebar = jest.fn();
    const { editor } = makeEditor();
    const source = {
      recipe: {
        name: "decode",
        steps: [{ opName: "FromBase64", args: [] }] as PipelineStep[],
      },
      evaluate: jest.fn((input: string) => input),
    };

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Recipe",
      { sidebar: showSidebar },
      undefined,
      source,
    );

    expect(showSidebar).toHaveBeenCalledWith(
      editor,
      "RESULT",
      editor.selection,
      { ...source, label: "Recipe" },
    );
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  test("sidebar mode falls back to popup without source context", async () => {
    __setConfig({ pipelineResultAction: "sidebar" });
    window.showInformationMessage.mockResolvedValue(undefined);
    const { editor } = makeEditor();

    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      { sidebar: jest.fn() },
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
