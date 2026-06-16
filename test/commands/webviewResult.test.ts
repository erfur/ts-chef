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
    expect(editBuilder.replace).toHaveBeenCalledWith(
      editor.selection,
      "RESULT",
    );
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
