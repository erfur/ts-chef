import * as vscode from "vscode";
import type { PipelineStep } from "../storage/store";

export type PipelineResultAction =
  | "popup"
  | "replace"
  | "copy"
  | "inline"
  | "panel"
  | "sidebar";

export type PipelineResultSource = {
  recipe: { name: string; steps: PipelineStep[] };
  evaluate: (input: string) => string | Promise<string>;
};

export type RenderedResultSource = PipelineResultSource & { label: string };

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
  source?: RenderedResultSource,
) => void | Promise<void>;

export type ResultRenderers = Partial<
  Record<"inline" | "panel" | "sidebar", ResultRenderer>
>;

/**
 * Present a pipeline's result according to the `tschef.pipelineResultAction`
 * setting: show a popup with Replace/Copy buttons (default, "popup"), replace
 * the selection directly ("replace"), copy to the clipboard ("copy"), or
 * render via an injected renderer ("inline", "panel", or "sidebar").
 *
 * @param label Prefix shown in the popup message (e.g. `Result` or
 *   `Pipeline "name"`), and included in renderer source context when present.
 * @param render Custom renderers keyed by mode. When no eligible renderer is
 *   provided for the configured custom mode, falls back to the popup.
 */
export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
  render?: ResultRenderers,
  target?: vscode.Range,
  source?: PipelineResultSource,
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

  if (mode === "inline" || mode === "panel" || mode === "sidebar") {
    const renderer = render?.[mode];
    if (renderer && (mode !== "sidebar" || source)) {
      const renderedSource = source ? { ...source, label } : undefined;
      await renderer(
        editor,
        result,
        target ?? replaceTarget(editor),
        renderedSource,
      );
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
