import * as path from "path";
import * as vscode from "vscode";
import type { PipelineStep } from "../storage/store";
import type { RenderedResultSource } from "./pipelineResult";
import {
  ResultsViewProvider,
  type ResultFilter,
  type ResultsViewMessage,
} from "../providers/resultsViewProvider";

type ResultRecord = {
  id: number;
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
  startOffset: number;
  endOffset: number;
  output?: string;
  error?: string;
  source: RenderedResultSource;
  generation: number;
  timer?: ReturnType<typeof setTimeout>;
};

type ResultsDependencies = {
  loadRecipe: (recipe: { name: string; steps: PipelineStep[] }) => void;
  showPanel: (
    editor: vscode.TextEditor,
    result: string,
    target: vscode.Range,
  ) => void;
  debounceMs?: number;
};

export class ResultsController {
  private results: ResultRecord[] = [];
  private filter: ResultFilter = "all";
  private seq = 0;
  private activeUri: string | undefined;

  constructor(
    private readonly view: ResultsViewProvider,
    private readonly dependencies: ResultsDependencies,
  ) {}

  register(context: vscode.ExtensionContext): void {
    this.activeUri = vscode.window.activeTextEditor?.document.uri.toString();
    context.subscriptions.push(
      this.view.onDidMessage((message) => void this.onMessage(message)),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.activeUri = editor.document.uri.toString();
        if (this.filter === "current") this.publish();
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.removeDocument(document.uri.toString());
      }),
      this.view,
    );
    this.publish();
  }

  show(
    editor: vscode.TextEditor,
    result: string,
    target: vscode.Range,
    source: RenderedResultSource,
  ): void {
    this.results.unshift({
      id: this.seq++,
      editor,
      document: editor.document,
      startOffset: editor.document.offsetAt(target.start),
      endOffset: editor.document.offsetAt(target.end),
      output: result,
      source: { ...source, recipe: structuredClone(source.recipe) },
      generation: 0,
    });
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
        "ts-chef: Cannot open result - the source document is closed.",
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
    if (item.timer) clearTimeout(item.timer);
    this.results = this.results.filter((result) => result.id !== id);
    this.publish();
  }

  private removeDocument(uri: string): void {
    const removed = this.results.filter(
      (item) => item.document.uri.toString() === uri,
    );
    if (!removed.length) return;
    for (const item of removed) {
      if (item.timer) clearTimeout(item.timer);
    }
    this.results = this.results.filter(
      (item) => item.document.uri.toString() !== uri,
    );
    this.publish();
  }

  private async open(item: ResultRecord): Promise<void> {
    const editor = await this.reveal(item);
    if (!editor) return;
    const range = this.range(item);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range);
    this.dependencies.loadRecipe(structuredClone(item.source.recipe));
  }

  private async replace(item: ResultRecord): Promise<void> {
    if (item.error || item.output === undefined) return;
    const output = item.output;
    const range = this.range(item);
    this.remove(item.id);
    const editor = await this.reveal(item);
    if (!editor) return;
    await editor.edit((builder) => builder.replace(range, output));
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
      message.action !== "delete"
    ) {
      return;
    }

    if (message.action === "delete") {
      this.remove(item.id);
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
        "ts-chef: Pipeline result copied",
        3000,
      );
      return;
    }
    await this.replace(item);
  }
}
