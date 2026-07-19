import * as path from "path";
import * as vscode from "vscode";
import { log } from "../logger";
import type { PipelineStep } from "../storage/store";
import type {
  PipelineArgReference,
  RenderedResultSource,
} from "./pipelineResult";
import {
  ResultsViewProvider,
  type ResultFilter,
  type ResultsViewMessage,
} from "../providers/resultsViewProvider";
import { transformTrackedRange } from "./trackedRange";

type ResultRecord = {
  id: number;
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
  startOffset: number;
  endOffset: number;
  output?: string;
  error?: string;
  source: RenderedResultSource;
  referenceSubscriptions: vscode.Disposable[];
  generation: number;
  timer?: ReturnType<typeof setTimeout>;
};

type ResultsDependencies = {
  loadRecipe: (
    recipe: { name: string; steps: PipelineStep[] },
    references?: PipelineArgReference[],
  ) => void;
  showPanel: (
    editor: vscode.TextEditor,
    result: string,
    target: vscode.Range,
  ) => void;
  debounceMs?: number;
};

export class ResultsController implements vscode.Disposable {
  private results: ResultRecord[] = [];
  private filter: ResultFilter = "all";
  private seq = 0;
  private openRequest = 0;
  private activeUri: string | undefined;

  constructor(
    private readonly view: ResultsViewProvider,
    private readonly dependencies: ResultsDependencies,
  ) {}

  register(context: vscode.ExtensionContext): void {
    this.activeUri = vscode.window.activeTextEditor?.document.uri.toString();
    context.subscriptions.push(
      this.view.onDidMessage((message) => {
        void this.onMessage(message).catch((error) => {
          log(`Result action error: ${error}`);
          vscode.window.showWarningMessage(
            "vschef: Could not complete result action.",
          );
        });
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.activeUri = editor.document.uri.toString();
        if (this.filter === "current") this.publish();
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.removeDocument(document.uri.toString());
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        const uri = event.document.uri.toString();
        const documentLength = event.document.getText().length;
        for (const item of this.results) {
          if (item.document.uri.toString() !== uri) continue;
          const tracked = transformTrackedRange(
            item.startOffset,
            item.endOffset,
            event.contentChanges,
          );
          item.startOffset = Math.min(
            Math.max(tracked.start, 0),
            documentLength,
          );
          item.endOffset = Math.min(
            Math.max(tracked.end, item.startOffset),
            documentLength,
          );
          if (tracked.changed) this.schedule(item);
        }
      }),
      this.view,
      this,
    );
    this.publish();
  }

  dispose(): void {
    for (const item of this.results) {
      item.generation++;
      if (item.timer) clearTimeout(item.timer);
      this.disposeSource(item);
    }
    this.results = [];
    this.activeUri = undefined;
  }

  show(
    editor: vscode.TextEditor,
    result: string,
    target: vscode.Range,
    source: RenderedResultSource,
  ): void {
    const item: ResultRecord = {
      id: this.seq++,
      editor,
      document: editor.document,
      startOffset: editor.document.offsetAt(target.start),
      endOffset: editor.document.offsetAt(target.end),
      output: result,
      source: { ...source, recipe: structuredClone(source.recipe) },
      referenceSubscriptions: [],
      generation: 0,
    };
    for (const binding of source.references ?? []) {
      item.referenceSubscriptions.push(
        binding.reference.onDidChange(() => this.schedule(item)),
      );
    }
    this.results.unshift(item);
    this.publish();
  }

  private publish(): void {
    const visible =
      this.filter === "current"
        ? this.results.filter(
            (item) => item.document.uri.toString() === this.activeUri,
          )
        : this.results;
    this.view.setState({
      filter: this.filter,
      items: visible.map((item) => ({
        id: item.id,
        label: item.source.label,
        source: path.basename(item.document.fileName),
        output: item.output,
        error: item.error,
      })),
      totalCount: this.results.length,
    });
  }

  private range(item: ResultRecord): vscode.Range {
    return new vscode.Range(
      item.document.positionAt(item.startOffset),
      item.document.positionAt(item.endOffset),
    );
  }

  private async reveal(
    item: ResultRecord,
  ): Promise<vscode.TextEditor | undefined> {
    if (item.document.isClosed) {
      vscode.window.showWarningMessage(
        "vschef: Cannot open result - the source document is closed.",
      );
      return undefined;
    }
    return vscode.window.showTextDocument(item.document, {
      viewColumn: item.editor.viewColumn,
      preserveFocus: false,
    });
  }

  private remove(id: number): void {
    const item = this.results.find((result) => result.id === id);
    if (!item) return;
    item.generation++;
    if (item.timer) {
      clearTimeout(item.timer);
      item.timer = undefined;
    }
    this.disposeSource(item);
    this.results = this.results.filter((result) => result.id !== id);
    this.publish();
  }

  private removeDocument(uri: string): void {
    const removed = this.results.filter(
      (item) => item.document.uri.toString() === uri,
    );
    if (!removed.length) return;
    for (const item of removed) {
      item.generation++;
      if (item.timer) {
        clearTimeout(item.timer);
        item.timer = undefined;
      }
      this.disposeSource(item);
    }
    this.results = this.results.filter(
      (item) => item.document.uri.toString() !== uri,
    );
    this.publish();
  }

  private disposeSource(item: ResultRecord): void {
    for (const subscription of item.referenceSubscriptions)
      subscription.dispose();
    item.referenceSubscriptions = [];
    item.source.dispose?.();
  }

  private schedule(item: ResultRecord): void {
    if (item.timer) clearTimeout(item.timer);
    const generation = ++item.generation;
    item.timer = setTimeout(() => {
      item.timer = undefined;
      void this.recompute(item, generation);
    }, this.dependencies.debounceMs ?? 150);
  }

  private async recompute(
    item: ResultRecord,
    generation: number,
  ): Promise<void> {
    if (!this.results.includes(item) || item.document.isClosed) return;
    const input = item.document.getText(this.range(item));
    try {
      const output = await item.source.evaluate(input);
      if (!this.results.includes(item) || item.generation !== generation)
        return;
      item.output = output;
      item.error = undefined;
    } catch (error) {
      if (!this.results.includes(item) || item.generation !== generation)
        return;
      item.output = undefined;
      item.error = error instanceof Error ? error.message : String(error);
      log(`Result recompute error: ${error}`);
    }
    this.publish();
  }

  private async open(item: ResultRecord): Promise<void> {
    const request = ++this.openRequest;
    const editor = await this.reveal(item);
    if (!editor || request !== this.openRequest || !this.results.includes(item))
      return;
    const range = this.range(item);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range);
    this.dependencies.loadRecipe(
      structuredClone(item.source.recipe),
      item.source.references ?? [],
    );
  }

  private reselect(item: ResultRecord): void {
    const editor = vscode.window.activeTextEditor;
    if (
      !editor ||
      editor.document !== item.document ||
      editor.selection.isEmpty
    ) {
      vscode.window.showWarningMessage(
        "vschef: Select non-empty text in this result's source document before reselecting.",
      );
      return;
    }
    const startOffset = item.document.offsetAt(editor.selection.start);
    const endOffset = item.document.offsetAt(editor.selection.end);
    item.startOffset = startOffset;
    item.endOffset = endOffset;
    item.output = undefined;
    this.publish();
    this.schedule(item);
  }

  private async replace(item: ResultRecord): Promise<void> {
    if (item.error || item.output === undefined) return;
    const output = item.output;
    const range = this.range(item);
    this.remove(item.id);
    const editor = await this.reveal(item);
    if (!editor) return;
    const edited = await editor.edit((builder) =>
      builder.replace(range, output),
    );
    if (!edited) throw new Error("Result replacement was not applied.");
  }

  private async onMessage(message: ResultsViewMessage): Promise<void> {
    if (message.type === "filter") {
      if (message.filter !== "all" && message.filter !== "current") return;
      this.filter = message.filter;
      this.publish();
      return;
    }

    const item = this.results.find((result) => result.id === message.id);
    if (!item) return;
    if (message.type === "open") {
      await this.open(item);
      return;
    }
    if (
      message.action !== "popup" &&
      message.action !== "copy" &&
      message.action !== "replace" &&
      message.action !== "reselect" &&
      message.action !== "delete"
    ) {
      return;
    }

    if (message.action === "delete") {
      this.remove(item.id);
      return;
    }
    if (message.action === "reselect") {
      this.reselect(item);
      return;
    }
    if (item.error || item.output === undefined) return;
    if (message.action === "popup") {
      this.dependencies.showPanel(item.editor, item.output, this.range(item));
      return;
    }
    if (message.action === "copy") {
      await vscode.env.clipboard.writeText(item.output);
      vscode.window.setStatusBarMessage(
        "vschef: Pipeline result copied",
        3000,
      );
      return;
    }
    await this.replace(item);
  }
}
