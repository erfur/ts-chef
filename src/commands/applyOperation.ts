import * as vscode from "vscode";
import type { Operation } from "../chef/Operation";
import { log } from "../logger";
import { presentPipelineResult, type ResultRenderers } from "./pipelineResult";
import { resolveDefaultArg, runOp } from "./runner";

export type OperationEntry = {
  displayName: string;
  factory: () => Operation;
};

export function resultToString(result: unknown): string {
  if (Array.isArray(result))
    return Buffer.from(result as number[]).toString("utf-8");
  if (typeof result === "string") return result;
  if (result === null || result === undefined) return "";
  return JSON.stringify(result, null, 2);
}

export async function promptForArgs(op: Operation): Promise<unknown[] | null> {
  const result: unknown[] = [];
  for (const argDef of op.args) {
    if (argDef.type === "toggleString" && (argDef.value as string) === "") {
      const strVal = await vscode.window.showInputBox({
        prompt: argDef.name,
        placeHolder: `Enter ${argDef.name.toLowerCase()} (encoding: ${argDef.toggleValues?.join(" / ") ?? "Hex"})`,
      });
      if (strVal === undefined) return null;
      const encoding =
        argDef.toggleValues && argDef.toggleValues.length > 1
          ? await vscode.window.showQuickPick(argDef.toggleValues, {
              placeHolder: `Encoding for "${argDef.name}"`,
            })
          : argDef.toggleValues?.[0];
      if (encoding === undefined) return null;
      result.push({ string: strVal, option: encoding });
    } else {
      result.push(resolveDefaultArg(argDef));
    }
  }
  return result;
}

export async function applyOperation(
  opName: string,
  entry: OperationEntry | undefined,
  renderers: ResultRenderers,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("ts-chef: No active editor.");
    return;
  }
  if (!entry) return;

  const operation = entry.factory();
  const text = editor.document.getText(editor.selection);
  if (!text && operation.inputMode === "required") {
    vscode.window.showWarningMessage("ts-chef: Select text first.");
    return;
  }

  const args = await promptForArgs(operation);
  if (args === null) return;
  const capturedArgs = structuredClone(args);

  const target = editor.selection.isEmpty
    ? new vscode.Selection(editor.selection.active, editor.selection.active)
    : editor.selection;

  try {
    const result = await runOp(opName, text, capturedArgs);
    const str = resultToString(result);
    if (str === "" && text !== "") {
      vscode.window.showWarningMessage(
        `ts-chef: "${entry.displayName}" produced an empty result — nothing replaced.`,
      );
      return;
    }
    await presentPipelineResult(
      editor,
      str,
      entry.displayName,
      renderers,
      target,
      {
        recipe: {
          name: "",
          steps: [{ opName, args: structuredClone(capturedArgs) }],
        },
        evaluate: async (input) =>
          resultToString(
            await runOp(opName, input, structuredClone(capturedArgs)),
          ),
      },
    );
    log(`applyOperation: "${entry.displayName}" applied`);
  } catch (error) {
    log(`applyOperation error: ${error}`);
    vscode.window.showErrorMessage(`ts-chef: ${error}`);
  }
}
