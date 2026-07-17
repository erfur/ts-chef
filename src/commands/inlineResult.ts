import * as vscode from "vscode";
import { replaceTarget } from "./pipelineResult";

type InlineResult = {
  id: number;
  editor: vscode.TextEditor;
  uri: vscode.Uri;
  targetRange: vscode.Range;
  result: string;
};

type InlineAction = "replace" | "copy" | "close";

/**
 * Shows pipeline results as persistent CodeLens rows anchored above each
 * source selection, with Replace / Copy / Close actions. Multiple results can
 * be shown at once; each row stays until its Close or Replace removes it.
 */
export class InlineResultController implements vscode.CodeLensProvider {
  private results: InlineResult[] = [];
  private seq = 0;
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ scheme: "*" }, this),
      vscode.commands.registerCommand(
        "tschef.applyInlineResult",
        (action: InlineAction, id: number) => this.apply(action, id),
      ),
      this._onDidChangeCodeLenses,
    );
  }

  /** Add `result` as a new inline CodeLens row for the supplied target. */
  show(
    editor: vscode.TextEditor,
    result: string,
    targetRange: vscode.Range = replaceTarget(editor),
  ): void {
    this.results.push({
      id: this.seq++,
      editor,
      uri: editor.document.uri,
      targetRange,
      result,
    });
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const uri = document.uri.toString();
    const lenses: vscode.CodeLens[] = [];

    for (const item of this.results) {
      if (item.uri.toString() !== uri) continue;

      const line = item.targetRange.start.line;
      const range = new vscode.Range(line, 0, line, 0);
      const preview =
        item.result.replace(/\s+/g, " ").slice(0, 80) +
        (item.result.length > 80 ? "…" : "");

      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(output) ${preview}`,
          command: "",
        }),
        new vscode.CodeLens(range, {
          title: "$(replace) Replace",
          command: "tschef.applyInlineResult",
          arguments: ["replace", item.id],
        }),
        new vscode.CodeLens(range, {
          title: "$(copy) Copy",
          command: "tschef.applyInlineResult",
          arguments: ["copy", item.id],
        }),
        new vscode.CodeLens(range, {
          title: "$(close) Close",
          command: "tschef.applyInlineResult",
          arguments: ["close", item.id],
        }),
      );
    }

    return lenses;
  }

  private async apply(action: InlineAction, id: number): Promise<void> {
    const item = this.results.find((r) => r.id === id);
    if (!item) return;

    if (action === "replace") {
      // The row outlives the editor, so edit the result's own editor (not the
      // active one — they may differ when several rows span documents).
      if (item.editor.document.isClosed) {
        vscode.window.showWarningMessage(
          "ts-chef: Cannot replace — the editor is no longer open.",
        );
        return;
      }
      try {
        await item.editor.edit((eb) =>
          eb.replace(item.targetRange, item.result),
        );
        this.remove(id);
      } catch {
        vscode.window.showWarningMessage(
          "ts-chef: Could not replace — the editor is no longer available.",
        );
      }
      return;
    }

    if (action === "copy") {
      vscode.env.clipboard.writeText(item.result);
      vscode.window.setStatusBarMessage(
        "ts-chef: Pipeline result copied",
        3000,
      );
      return;
    }

    this.remove(id);
  }

  private remove(id: number): void {
    this.results = this.results.filter((r) => r.id !== id);
    this._onDidChangeCodeLenses.fire();
  }
}
