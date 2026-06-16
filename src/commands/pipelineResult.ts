import * as vscode from "vscode";

export type PipelineResultAction = "popup" | "replace" | "copy" | "inline";

/**
 * Range to overwrite when replacing: the current selection, or the whole
 * document when the selection is empty.
 */
export function replaceTarget(editor: vscode.TextEditor): vscode.Selection {
  return editor.selection.isEmpty
    ? new vscode.Selection(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
      )
    : editor.selection;
}

/**
 * Present a pipeline's result according to the `tschef.pipelineResultAction`
 * setting: show a popup with Replace/Copy buttons (default, "popup"), replace
 * the selection directly ("replace"), copy to the clipboard ("copy"), or show
 * an inline CodeLens row via the injected `showInline` callback ("inline").
 *
 * @param label Prefix shown in the popup message (e.g. `Result` or
 *   `Pipeline "name"`). Unused in the replace/copy/inline modes.
 * @param showInline Renders the result inline (CodeLens). When the mode is
 *   "inline" but this is not provided, falls back to the popup.
 */
export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
  showInline?: (
    editor: vscode.TextEditor,
    result: string,
  ) => void | Promise<void>,
): Promise<void> {
  const mode = vscode.workspace
    .getConfiguration("tschef")
    .get<PipelineResultAction>("pipelineResultAction", "popup");

  if (mode === "replace") {
    await editor.edit((eb) => eb.replace(replaceTarget(editor), result));
    vscode.window.setStatusBarMessage(
      "ts-chef: Pipeline result replaced selection",
      3000,
    );
    return;
  }

  if (mode === "copy") {
    vscode.env.clipboard.writeText(result);
    vscode.window.setStatusBarMessage("ts-chef: Pipeline result copied", 3000);
    return;
  }

  if (mode === "inline" && showInline) {
    await showInline(editor, result);
    return;
  }

  const preview = `${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
  const action = await vscode.window.showInformationMessage(
    `${label}: ${preview}`,
    "Replace",
    "Copy",
  );
  if (action === "Replace") {
    await editor.edit((eb) => eb.replace(replaceTarget(editor), result));
  }
  if (action === "Copy") {
    vscode.env.clipboard.writeText(result);
  }
}
