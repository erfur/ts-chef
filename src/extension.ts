import * as vscode from "vscode";
import { PipelinesTreeProvider } from "./providers/pipelinesTreeProvider";
import { OperationsViewProvider } from "./providers/operationsViewProvider";
import { RecipeViewProvider } from "./providers/recipeViewProvider";
import {
  PipelineStore,
  StorageScope,
  ScopedPipeline,
  removeLegacyVariableFiles,
} from "./storage/store";
import {
  runOp,
  parsePipeline,
  runPipeline,
  resolveDefaultArg,
  operationNeedsInput,
} from "./commands/runner";
import { presentPipelineResult } from "./commands/pipelineResult";
import { InlineResultController } from "./commands/inlineResult";
import { WebviewResultController } from "./commands/webviewResult";
import { initOutputChannel, log } from "./logger";
import registry from "./generated/opsRegistry";
import type { Operation, ArgConfig } from "./chef/Operation";

function resultToString(result: unknown): string {
  if (Array.isArray(result))
    return Buffer.from(result as number[]).toString("utf-8");
  if (typeof result === "string") return result;
  if (result === null || result === undefined) return "";
  return JSON.stringify(result, null, 2);
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
      const needsInput = operationNeedsInput(inst);
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
  removeLegacyVariableFiles(globalDir, log);
  const pipeStore = new PipelineStore(globalDir);
  const pipeTree = new PipelinesTreeProvider(pipeStore);

  const opItems = registry.map((e) => ({
    opName: e.opName,
    displayName: e.displayName,
    module: e.module || "Other",
  }));
  const opsView = new OperationsViewProvider(opItems);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("tschef.operationsView", opsView),
    vscode.window.registerTreeDataProvider("tschef.pipelinesView", pipeTree),
  );

  const inlineResult = new InlineResultController();
  inlineResult.register(context);

  const panelResult = new WebviewResultController();
  panelResult.register(context);

  const argDefsCache = new Map<string, ArgConfig[]>();
  const argDefsFor = (opName: string): ArgConfig[] => {
    const cached = argDefsCache.get(opName);
    if (cached) return cached;
    const entry = registry.find((e) => e.opName === opName);
    const defs = entry ? entry.factory().args : [];
    argDefsCache.set(opName, defs);
    return defs;
  };
  const recipeView = new RecipeViewProvider(
    opItems,
    {
      onApply: async (steps) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("ts-chef: No active editor.");
          return;
        }
        const text =
          editor.document.getText(editor.selection) ||
          editor.document.getText();
        try {
          const result = runPipeline(text, steps);
          await presentPipelineResult(editor, result, "Recipe", {
            inline: (ed, res) => inlineResult.show(ed, res),
            panel: (ed, res) => panelResult.show(ed, res),
          });
        } catch (e) {
          log(`Recipe apply error: ${e}`);
          vscode.window.showErrorMessage(`ts-chef recipe error: ${e}`);
        }
      },
      onSave: async (name, steps) => {
        if (!name) {
          vscode.window.showWarningMessage(
            "ts-chef: Name the recipe before saving.",
          );
          return;
        }
        if (!steps.length) {
          vscode.window.showWarningMessage("ts-chef: Recipe is empty.");
          return;
        }
        const scope = vscode.workspace
          .getConfiguration("tschef")
          .get<StorageScope>("defaultPipelineScope", "global");
        const raw = steps.map((s) => s.opName).join(" | ");
        pipeStore.upsert(scope, { name, steps, raw });
        pipeTree.refresh();
        log(`Recipe "${name}" saved as pipeline (${scope})`);
        vscode.window.showInformationMessage(
          `ts-chef: Recipe "${name}" saved (${scope}).`,
        );
      },
    },
    argDefsFor,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("tschef.recipeView", recipeView, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // ---- Commands ----

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.addToRecipe", (opName: string) => {
      const entry = registry.find((e) => e.opName === opName);
      if (!entry) return;
      const step = {
        opName,
        args: entry.factory().args.map((a) => resolveDefaultArg(a)),
      };
      recipeView.addOp(step);
      vscode.commands.executeCommand("tschef.recipeView.focus");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.loadRecipe",
      (node?: { pipeline?: ScopedPipeline }) => {
        const pipeline = node?.pipeline;
        if (!pipeline) return;
        vscode.commands.executeCommand("tschef.recipeView.focus");
        recipeView.load(pipeline);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.applyOperation",
      async (opName: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("ts-chef: No active editor.");
          return;
        }
        const text = editor.document.getText(editor.selection);
        if (!text) {
          vscode.window.showWarningMessage("ts-chef: Select text first.");
          return;
        }
        const entry = registry.find((e) => e.opName === opName);
        if (!entry) return;
        const args = await promptForArgs(entry.factory());
        if (args === null) return;
        try {
          const str = resultToString(runOp(opName, text, args));
          if (str === "" && text !== "") {
            vscode.window.showWarningMessage(
              `ts-chef: "${entry.displayName}" produced an empty result — nothing replaced.`,
            );
            return;
          }
          await presentPipelineResult(editor, str, entry.displayName, {
            inline: (ed, res) => inlineResult.show(ed, res),
            panel: (ed, res) => panelResult.show(ed, res),
          });
          log(`applyOperation: "${entry.displayName}" applied`);
        } catch (e) {
          log(`applyOperation error: ${e}`);
          vscode.window.showErrorMessage(`ts-chef: ${e}`);
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.quickConvert", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.selection;
      const text = editor.document.getText(selection);
      if (!text) {
        vscode.window.showWarningMessage("ts-chef: Select text first.");
        return;
      }

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
    vscode.commands.registerCommand("tschef.runPipeline", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text =
        editor.document.getText(editor.selection) || editor.document.getText();

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
        await presentPipelineResult(editor, result, "Result", {
          inline: (ed, res) => inlineResult.show(ed, res),
          panel: (ed, res) => panelResult.show(ed, res),
        });
      } catch (e) {
        log(`Pipeline error: ${e}`);
        vscode.window.showErrorMessage(`ts-chef pipeline error: ${e}`);
      }
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
        const text =
          editor.document.getText(editor.selection) ||
          editor.document.getText();
        try {
          const result = runPipeline(text, pipeline.steps);
          log(
            `Ran saved pipeline "${name}": ${pipeline.steps.length} step(s), ${text.length} → ${result.length} chars`,
          );
          await presentPipelineResult(editor, result, `Pipeline "${name}"`, {
            inline: (ed, res) => inlineResult.show(ed, res),
            panel: (ed, res) => panelResult.show(ed, res),
          });
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
            "ts-chef: No saved pipelines. Save one from the Recipe view first.",
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
    vscode.commands.registerCommand("tschef.refreshPipelines", () =>
      pipeTree.refresh(),
    ),
  );
}

export function deactivate(): void {}
