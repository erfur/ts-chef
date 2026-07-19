import * as vscode from "vscode";
import { transformTrackedRange } from "./trackedRange";

export interface SelectionReference extends vscode.Disposable {
  readonly text: string;
  readonly onDidChange: vscode.Event<void>;
  clone(): SelectionReference;
  reveal(): Promise<void>;
}

class TrackedSelection implements SelectionReference {
  private emitter = new vscode.EventEmitter<void>();
  private lastText: string;
  private disposed = false;
  readonly onDidChange = this.emitter.event;

  constructor(
    private readonly owner: SelectionReferenceTracker,
    private document: vscode.TextDocument | undefined,
    private startOffset: number,
    private endOffset: number,
    text?: string,
  ) {
    this.lastText = text ?? this.read();
  }

  get text(): string {
    return this.lastText;
  }

  clone(): SelectionReference {
    return this.owner.copy(this.snapshot());
  }

  snapshot(): {
    document: vscode.TextDocument | undefined;
    startOffset: number;
    endOffset: number;
    text: string;
  } {
    return {
      document: this.document,
      startOffset: this.startOffset,
      endOffset: this.endOffset,
      text: this.lastText,
    };
  }

  update(event: vscode.TextDocumentChangeEvent): void {
    if (this.disposed || event.document !== this.document) return;
    const tracked = transformTrackedRange(
      this.startOffset,
      this.endOffset,
      event.contentChanges,
    );
    this.startOffset = tracked.start;
    this.endOffset = tracked.end;
    const next = this.read();
    const textChanged = tracked.changed && next !== this.lastText;
    this.lastText = next;
    if (textChanged) this.emitter.fire();
  }

  freeze(document: vscode.TextDocument): void {
    if (this.disposed || document !== this.document) return;
    this.lastText = this.read();
    this.document = undefined;
  }

  async reveal(): Promise<void> {
    if (this.disposed || !this.document) return;
    const document = this.document;
    try {
      const editor = await vscode.window.showTextDocument(document, {
        preserveFocus: false,
      });
      if (this.disposed || this.document !== document) return;
      const range = new vscode.Range(
        document.positionAt(this.startOffset),
        document.positionAt(this.endOffset),
      );
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range);
    } catch {
      // The document may close while VS Code is opening it.
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.owner.release(this);
    this.emitter.dispose();
  }

  private read(): string {
    if (!this.document) return this.lastText ?? "";
    return this.document.getText(
      new vscode.Range(
        this.document.positionAt(this.startOffset),
        this.document.positionAt(this.endOffset),
      ),
    );
  }
}

export class SelectionReferenceTracker implements vscode.Disposable {
  private readonly references = new Set<TrackedSelection>();
  private readonly subscriptions: vscode.Disposable[];

  constructor() {
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        for (const reference of [...this.references]) reference.update(event);
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        for (const reference of [...this.references]) reference.freeze(document);
      }),
    ];
  }

  create(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): SelectionReference {
    return this.add(
      new TrackedSelection(
        this,
        document,
        document.offsetAt(range.start),
        document.offsetAt(range.end),
      ),
    );
  }

  copy(snapshot: {
    document: vscode.TextDocument | undefined;
    startOffset: number;
    endOffset: number;
    text: string;
  }): SelectionReference {
    return this.add(
      new TrackedSelection(
        this,
        snapshot.document,
        snapshot.startOffset,
        snapshot.endOffset,
        snapshot.text,
      ),
    );
  }

  release(reference: SelectionReference): void {
    this.references.delete(reference as TrackedSelection);
  }

  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose();
    for (const reference of [...this.references]) reference.dispose();
  }

  private add(reference: TrackedSelection): SelectionReference {
    this.references.add(reference);
    return reference;
  }
}
