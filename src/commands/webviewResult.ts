import * as vscode from "vscode";
import { replaceTarget } from "./pipelineResult";

type PanelState = {
  editor: vscode.TextEditor;
  range: vscode.Range;
  result: string;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(result: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: var(--vscode-editor-font-family, monospace);
        color: var(--vscode-foreground);
        padding: 0.5rem;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 70vh;
        overflow: auto;
        background: var(--vscode-textCodeBlock-background);
        padding: 0.5rem;
        border-radius: 4px;
      }
      .actions {
        margin-top: 0.5rem;
      }
      button {
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        padding: 4px 10px;
        margin-right: 6px;
        cursor: pointer;
        border-radius: 2px;
      }
      button:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(result)}</pre>
    <div class="actions">
      <button id="replace">Replace</button>
      <button id="copy">Copy</button>
      <button id="close">Close</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      for (const id of ["replace", "copy", "close"]) {
        document
          .getElementById(id)
          .addEventListener("click", () => vscode.postMessage({ type: id }));
      }
    </script>
  </body>
</html>`;
}

/**
 * Shows a pipeline result in a reusable webview panel beside the editor —
 * multi-line and scrollable, with Replace / Copy / Close actions. The panel
 * persists until the user closes it (Replace and Copy keep it open).
 */
export class WebviewResultController {
  private panel: vscode.WebviewPanel | undefined;
  private state: PanelState | undefined;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push({ dispose: () => this.panel?.dispose() });
  }

  /** Show `result` in the panel for the editor's selection. */
  show(editor: vscode.TextEditor, result: string): void {
    this.state = { editor, range: replaceTarget(editor), result };
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "tschef.result",
        "ts-chef result",
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true },
      );
      this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.state = undefined;
      });
    }
    this.panel.webview.html = renderHtml(result);
    this.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  private async onMessage(msg: { type?: string }): Promise<void> {
    const state = this.state;
    if (!state) return;
    if (msg.type === "replace") {
      await state.editor.edit((eb) => eb.replace(state.range, state.result));
    } else if (msg.type === "copy") {
      vscode.env.clipboard.writeText(state.result);
      vscode.window.setStatusBarMessage(
        "ts-chef: Pipeline result copied",
        3000,
      );
    } else if (msg.type === "close") {
      this.panel?.dispose();
    }
  }
}
