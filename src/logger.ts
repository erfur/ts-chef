import * as vscode from "vscode";

let _ch: vscode.OutputChannel | undefined;

export function initOutputChannel(context: vscode.ExtensionContext): void {
  _ch = vscode.window.createOutputChannel("vschef");
  context.subscriptions.push(_ch);
}

export function log(msg: string): void {
  _ch?.appendLine(`[vschef] ${msg}`);
}
