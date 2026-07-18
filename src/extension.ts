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
import {
  presentPipelineResult,
  type RenderedResultSource,
  type ResultRenderers,
} from "./commands/pipelineResult";
import {
  applyOperation,
  promptForArgs,
  resultToString,
} from "./commands/applyOperation";
import { InlineResultController } from "./commands/inlineResult";
import { WebviewResultController } from "./commands/webviewResult";
import { ResultsController } from "./commands/resultsController";
import { createPipelineResultSource } from "./commands/resultSource";
import { ResultsViewProvider } from "./providers/resultsViewProvider";
import { initOutputChannel, log } from "./logger";
import registry from "./generated/opsRegistry";
import type { ArgConfig } from "./chef/Operation";

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

  // Recipe callbacks require this map before its controller dependencies exist.
  // eslint-disable-next-line prefer-const
  let resultRenderers: ResultRenderers;

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
      onApply: async (name, steps) => {
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
          await presentPipelineResult(
            editor,
            result,
            "Recipe",
            resultRenderers,
            undefined,
            createPipelineResultSource(name, steps),
          );
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

  const resultsView = new ResultsViewProvider();
  const resultsController = new ResultsController(resultsView, {
    loadRecipe: (recipe) => {
      vscode.commands.executeCommand("tschef.recipeView.focus");
      recipeView.load(recipe);
    },
    showPanel: (editor, result, target) =>
      panelResult.show(editor, result, target),
  });
  resultsController.register(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "tschef.resultsView",
      resultsView,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  resultRenderers = {
    inline: (editor: vscode.TextEditor, result: string, target: vscode.Range) =>
      inlineResult.show(editor, result, target),
    panel: (editor: vscode.TextEditor, result: string, target: vscode.Range) =>
      panelResult.show(editor, result, target),
    sidebar: (
      editor: vscode.TextEditor,
      result: string,
      target: vscode.Range,
      source?: RenderedResultSource,
    ) => {
      if (source) resultsController.show(editor, result, target, source);
    },
  };

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
        const entry = registry.find((e) => e.opName === opName);
        await applyOperation(opName, entry, resultRenderers);
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
        await presentPipelineResult(
          editor,
          result,
          "Result",
          resultRenderers,
          undefined,
          createPipelineResultSource("", steps),
        );
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
          await presentPipelineResult(
            editor,
            result,
            `Pipeline "${name}"`,
            resultRenderers,
            undefined,
            createPipelineResultSource(pipeline.name, pipeline.steps),
          );
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
