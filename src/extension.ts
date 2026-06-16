import * as vscode from "vscode";
import { VariablesTreeProvider } from "./providers/variablesTreeProvider";
import { PipelinesTreeProvider } from "./providers/pipelinesTreeProvider";
import { VariableStore, PipelineStore, StorageScope } from "./storage/store";
import { PipelinePanel } from "./panels/pipelinePanel";
import {
  runOp,
  parsePipeline,
  runPipeline,
  resolveDefaultArg,
} from "./commands/runner";
import { initOutputChannel, log } from "./logger";
import registry from "./generated/opsRegistry";
import type { Operation } from "./chef/Operation";

function resultToString(result: unknown): string {
  if (Array.isArray(result))
    return Buffer.from(result as number[]).toString("utf-8");
  if (typeof result === "string") return result;
  if (result === null || result === undefined) return "";
  return JSON.stringify(result, null, 2);
}

/** Replace $varName / {{varName}} references with stored variable values. */
function resolveVars(text: string, varStore: VariableStore): string {
  return text
    .replace(
      /\{\{([^}]+)\}\}/g,
      (_, name) => varStore.get(name.trim()) ?? `{{${name}}}`,
    )
    .replace(
      /\$([A-Za-z_][A-Za-z0-9_-]*)/g,
      (_, name) => varStore.get(name) ?? `$${name}`,
    );
}

/**
 * Ask where to save. Defaults to global. When no workspace folder is open,
 * global is the only option, so it is returned without prompting.
 * Returns undefined if the user cancels.
 */
async function pickScope(): Promise<StorageScope | undefined> {
  const hasWorkspace = !!vscode.workspace.workspaceFolders?.length;
  if (!hasWorkspace) return "global";
  const pick = await vscode.window.showQuickPick(
    [
      { label: "Global (all workspaces)", scope: "global" as const },
      { label: "Workspace", scope: "workspace" as const },
    ],
    { placeHolder: "Save to which scope?" },
  );
  return pick?.scope;
}

async function promptForArgs(opInstance: Operation): Promise<unknown[] | null> {
  const result: unknown[] = [];
  for (const argDef of opInstance.args) {
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

function buildOpPickItems(): (vscode.QuickPickItem & { opName?: string })[] {
  const byModule = new Map<string, typeof registry>();
  for (const e of registry) {
    const mod = e.module || "Other";
    if (!byModule.has(mod)) byModule.set(mod, []);
    byModule.get(mod)!.push(e);
  }
  const items: (vscode.QuickPickItem & { opName?: string })[] = [];
  for (const [mod, ops] of byModule) {
    items.push({ label: mod, kind: vscode.QuickPickItemKind.Separator });
    for (const e of ops) {
      const inst = e.factory();
      const needsInput = inst.args.some(
        (a) => a.type === "toggleString" && (a.value as string) === "",
      );
      const requiredNames = inst.args
        .filter((a) => a.type === "toggleString" && (a.value as string) === "")
        .map((a) => a.name)
        .join(", ");
      items.push({
        label: e.displayName,
        description: needsInput ? `$(key) needs: ${requiredNames}` : undefined,
        opName: e.opName,
      });
    }
  }
  return items;
}

export function activate(context: vscode.ExtensionContext): void {
  initOutputChannel(context);
  log("Extension activated");

  const globalDir = context.globalStorageUri.fsPath;
  const varStore = new VariableStore(globalDir);
  const pipeStore = new PipelineStore(globalDir);

  const varTree = new VariablesTreeProvider(varStore);
  const pipeTree = new PipelinesTreeProvider(pipeStore);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("tschef.variablesView", varTree),
    vscode.window.registerTreeDataProvider("tschef.pipelinesView", pipeTree),
  );

  // ---- Commands ----

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.quickConvert", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.selection;
      const rawText = editor.document.getText(selection);
      if (!rawText) {
        vscode.window.showWarningMessage("ts-chef: Select text first.");
        return;
      }
      const text = resolveVars(rawText, varStore);

      const picked = await vscode.window.showQuickPick(buildOpPickItems(), {
        placeHolder: "Pick a ts-chef operation…",
        matchOnDescription: true,
      });
      if (!picked || !picked.opName) return;

      const entry = registry.find((e) => e.opName === picked.opName);
      if (!entry) return;
      const opInstance = entry.factory();
      const args = await promptForArgs(opInstance);
      if (args === null) return;

      try {
        const str = resultToString(runOp(picked.opName, text, args));
        if (str === "" && text !== "") {
          vscode.window.showWarningMessage(
            `ts-chef: "${picked.label}" produced an empty result — nothing replaced.`,
          );
          return;
        }
        await editor.edit((eb) => eb.replace(selection, str));
        log(`quickConvert: "${picked.label}" applied`);
        vscode.window.setStatusBarMessage(
          `ts-chef: Applied "${picked.label}"`,
          3000,
        );
      } catch (e) {
        log(`quickConvert error: ${e}`);
        vscode.window.showErrorMessage(`ts-chef: ${e}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.setVariable", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Variable name (e.g. aes-key)",
      });
      if (!name) return;
      const value = await vscode.window.showInputBox({
        prompt: `Value for "${name}"`,
      });
      if (value === undefined) return;
      const desc = await vscode.window.showInputBox({
        prompt: "Description (optional)",
        placeHolder: "e.g. AES-256 key for project X",
      });
      const scope = await pickScope();
      if (!scope) return;
      varStore.set(scope, name, value, desc ?? undefined);
      varTree.refresh();
      log(`Variable "${name}" set`);
      vscode.window.showInformationMessage(
        `ts-chef: Variable "${name}" saved.`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.showVariables", async () => {
      const vars = varStore.loadAll();
      if (!vars.length) {
        vscode.window.showInformationMessage("ts-chef: No variables defined.");
        return;
      }
      const items = vars.map((v) => ({
        label: v.name,
        description: `${v.scope === "global" ? "Global" : "Workspace"} · ${v.value}`,
        detail: v.description,
        scope: v.scope,
        value: v.value,
      }));
      const action = await vscode.window.showQuickPick(
        [
          { label: "$(add) Add variable", action: "add" as const },
          ...items.map((i) => ({ ...i, action: "inspect" as const })),
        ],
        {
          placeHolder: "Variables — pick to delete/edit",
          matchOnDescription: true,
          matchOnDetail: true,
        },
      );
      if (!action) return;
      if (action.action === "add") {
        vscode.commands.executeCommand("tschef.setVariable");
        return;
      }
      const choice = await vscode.window.showQuickPick(
        [
          { label: "$(edit) Edit value" },
          { label: "$(trash) Delete" },
          { label: "$(copy) Copy value" },
        ],
        { placeHolder: `Variable: ${action.label}` },
      );
      if (!choice) return;
      if (choice.label.includes("Delete")) {
        varStore.delete(action.scope, action.label);
        varTree.refresh();
      }
      if (choice.label.includes("Edit")) {
        const newVal = await vscode.window.showInputBox({
          value: action.value,
          prompt: "New value",
        });
        if (newVal !== undefined) {
          varStore.set(action.scope, action.label, newVal);
          varTree.refresh();
        }
      }
      if (choice.label.includes("Copy")) {
        if (action.value) vscode.env.clipboard.writeText(action.value);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.runPipeline", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const rawText =
        editor.document.getText(editor.selection) || editor.document.getText();
      const text = resolveVars(rawText, varStore);

      const raw = await vscode.window.showInputBox({
        prompt: "Pipeline (e.g. From Base64 | To Hex)",
        placeHolder: "op1 | op2(arg=val) | op3",
      });
      if (!raw) return;

      try {
        const steps = parsePipeline(raw);
        const result = runPipeline(text, steps);
        log(
          `Pipeline ran: "${raw}", input ${text.length} chars → ${result.length} chars`,
        );
        const action = await vscode.window.showInformationMessage(
          `Result: ${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`,
          "Replace Selection",
          "Copy",
        );
        if (action === "Replace Selection") {
          await editor.edit((eb) => {
            const sel = editor.selection.isEmpty
              ? new vscode.Selection(
                  editor.document.positionAt(0),
                  editor.document.positionAt(editor.document.getText().length),
                )
              : editor.selection;
            eb.replace(sel, result);
          });
        }
        if (action === "Copy") vscode.env.clipboard.writeText(result);
      } catch (e) {
        log(`Pipeline error: ${e}`);
        vscode.window.showErrorMessage(`ts-chef pipeline error: ${e}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.openPipelineEditor", () => {
      PipelinePanel.open(context, pipeStore);
      log("Pipeline editor opened");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.runSavedPipeline",
      async (name: string, scope?: StorageScope) => {
        const all = pipeStore.loadAll();
        const pipeline = scope
          ? all.find((p) => p.name === name && p.scope === scope)
          : all.find((p) => p.name === name);
        if (!pipeline) return;
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("ts-chef: No active editor.");
          return;
        }
        const rawText =
          editor.document.getText(editor.selection) ||
          editor.document.getText();
        const text = resolveVars(rawText, varStore);
        try {
          const result = runPipeline(text, pipeline.steps);
          log(
            `Ran saved pipeline "${name}": ${pipeline.steps.length} step(s), ${text.length} → ${result.length} chars`,
          );
          const action = await vscode.window.showInformationMessage(
            `Pipeline "${name}": ${result.slice(0, 80)}${result.length > 80 ? "…" : ""}`,
            "Replace",
            "Copy",
          );
          if (action === "Replace") {
            await editor.edit((eb) => {
              const sel = editor.selection.isEmpty
                ? new vscode.Selection(
                    editor.document.positionAt(0),
                    editor.document.positionAt(
                      editor.document.getText().length,
                    ),
                  )
                : editor.selection;
              eb.replace(sel, result);
            });
          }
          if (action === "Copy") vscode.env.clipboard.writeText(result);
        } catch (e) {
          log(`Saved pipeline "${name}" error: ${e}`);
          vscode.window.showErrorMessage(
            `ts-chef pipeline "${name}" error: ${e}`,
          );
        }
      },
    ),
  );

  // tschef.runSavedPipelinePicker — pick from saved pipelines via QuickPick
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.runSavedPipelinePicker",
      async () => {
        const pipelines = pipeStore.loadAll();
        if (!pipelines.length) {
          vscode.window.showInformationMessage(
            "ts-chef: No saved pipelines. Save one in the Pipeline Editor first.",
          );
          return;
        }
        const picked = await vscode.window.showQuickPick(
          pipelines.map((p) => ({
            label: p.name,
            description: `${p.scope === "global" ? "Global" : "Workspace"} · ${p.description ?? ""}`,
            detail: p.raw,
            name: p.name,
            scope: p.scope,
          })),
          {
            placeHolder: "Select a saved pipeline to run…",
            matchOnDescription: true,
            matchOnDetail: true,
          },
        );
        if (!picked) return;
        vscode.commands.executeCommand(
          "tschef.runSavedPipeline",
          picked.name,
          picked.scope,
        );
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.addVariable", () => {
      vscode.commands.executeCommand("tschef.setVariable");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.refreshPipelines", () =>
      pipeTree.refresh(),
    ),
  );
}

export function deactivate(): void {}
