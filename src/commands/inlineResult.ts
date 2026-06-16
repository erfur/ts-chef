import * as vscode from "vscode";
import { replaceTarget } from "./pipelineResult";

type InlineState = {
  uri: vscode.Uri;
  targetRange: vscode.Range;
  result: string;
};

type InlineAction = "replace" | "copy" | "close";

/**
 * Shows a pipeline result as a persistent CodeLens row anchored above the
 * selection, with Replace / Copy / Close actions. One active result at a time;
 * it stays until Close, Replace, or an edit to the document clears it.
 */
export class InlineResultController implements vscode.CodeLensProvider {
  private state: InlineState | undefined;
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ scheme: "*" }, this),
      vscode.commands.registerCommand(
        "tschef.applyInlineResult",
        (action: InlineAction) => this.apply(action),
      ),
      vscode.workspace.onDidChangeTextDocument((e) =>
        this.onDocumentChanged(e.document),
      ),
      this._onDidChangeCodeLenses,
    );
  }

  /** Show `result` as an inline CodeLens row for the editor's selection. */
  show(editor: vscode.TextEditor, result: string): void {
    this.state = {
      uri: editor.document.uri,
      targetRange: replaceTarget(editor),
      result,
    };
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const state = this.state;
    if (!state || document.uri.toString() !== state.uri.toString()) return [];

    const line = state.targetRange.start.line;
    const range = new vscode.Range(line, 0, line, 0);
    const preview =
      state.result.replace(/\s+/g, " ").slice(0, 80) +
      (state.result.length > 80 ? "…" : "");

    return [
      new vscode.CodeLens(range, {
        title: `$(output) ${preview}`,
        command: "",
      }),
      new vscode.CodeLens(range, {
        title: "$(replace) Replace",
        command: "tschef.applyInlineResult",
        arguments: ["replace"],
      }),
      new vscode.CodeLens(range, {
        title: "$(copy) Copy",
        command: "tschef.applyInlineResult",
        arguments: ["copy"],
      }),
      new vscode.CodeLens(range, {
        title: "$(close) Close",
        command: "tschef.applyInlineResult",
        arguments: ["close"],
      }),
    ];
  }

  private async apply(action: InlineAction): Promise<void> {
    const state = this.state;
    if (!state) return;

    if (action === "replace") {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit((eb) => eb.replace(state.targetRange, state.result));
      }
      this.clear();
      return;
    }

    if (action === "copy") {
      vscode.env.clipboard.writeText(state.result);
      vscode.window.setStatusBarMessage(
        "ts-chef: Pipeline result copied",
        3000,
      );
      return;
    }

    this.clear();
  }

  private onDocumentChanged(document: vscode.TextDocument): void {
    if (this.state && document.uri.toString() === this.state.uri.toString()) {
      this.clear();
    }
  }

  private clear(): void {
    this.state = undefined;
    this._onDidChangeCodeLenses.fire();
  }
}
