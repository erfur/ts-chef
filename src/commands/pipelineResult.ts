import * as vscode from "vscode";

export type PipelineResultAction =
  | "popup"
  | "replace"
  | "copy"
  | "inline"
  | "panel";

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

export type ResultRenderer = (
  editor: vscode.TextEditor,
  result: string,
  target: vscode.Range,
) => void | Promise<void>;

export type ResultRenderers = Partial<
  Record<"inline" | "panel", ResultRenderer>
>;

/**
 * Present a pipeline's result according to the `tschef.pipelineResultAction`
 * setting: show a popup with Replace/Copy buttons (default, "popup"), replace
 * the selection directly ("replace"), copy to the clipboard ("copy"), or
 * render via an injected renderer ("inline" = CodeLens, "panel" = webview).
 *
 * @param label Prefix shown in the popup message (e.g. `Result` or
 *   `Pipeline "name"`). Unused in the replace/copy/inline/panel modes.
 * @param render Custom renderers keyed by mode. When the mode is "inline" or
 *   "panel" but no matching renderer is provided, falls back to the popup.
 */
export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
  render?: ResultRenderers,
  target?: vscode.Range,
): Promise<void> {
  const mode = vscode.workspace
    .getConfiguration("tschef")
    .get<PipelineResultAction>("pipelineResultAction", "popup");

  if (mode === "replace") {
    await editor.edit((eb) =>
      eb.replace(target ?? replaceTarget(editor), result),
    );
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

  if (mode === "inline" || mode === "panel") {
    const renderer = render?.[mode];
    if (renderer) {
      await renderer(editor, result, target ?? replaceTarget(editor));
      return;
    }
  }

  const preview = `${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`;
  const action = await vscode.window.showInformationMessage(
    `${label}: ${preview}`,
    "Replace",
    "Copy",
  );
  if (action === "Replace") {
    await editor.edit((eb) =>
      eb.replace(target ?? replaceTarget(editor), result),
    );
  }
  if (action === "Copy") {
    vscode.env.clipboard.writeText(result);
  }
}
