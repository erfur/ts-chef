import * as vscode from "vscode";
import type { PipelineStep } from "../storage/store";
import type { ArgConfig } from "../chef/Operation";
import type { PipelineArgReference } from "../commands/pipelineResult";
import type { SelectionReference } from "../commands/selectionReference";

type Recipe = { name: string; steps: PipelineStep[] };
type RecipeBinding = {
  type: "string" | "toggleString";
  reference: SelectionReference;
  subscription: vscode.Disposable;
};

export type RecipeCallbacks = {
  onApply: (
    name: string,
    steps: PipelineStep[],
    references: PipelineArgReference[],
  ) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
  getSelectionReference: () => SelectionReference | undefined;
};

/**
 * Sidebar webview holding one working "recipe" (a single pipeline). Operations
 * are appended via `addOp` (the Operations pane's ＋), reordered/removed in the
 * webview, applied to the selection, and saved into the pipelines list. Steps
 * whose operation has arguments can be expanded to edit them. The controller
 * holds the canonical recipe so it survives hide/show and loads.
 */
export class RecipeViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  private view: vscode.WebviewView | undefined;
  private recipe: Recipe = { name: "", steps: [] };
  private stepIds: string[] = [];
  private stepSeq = 0;
  private bindings = new Map<string, RecipeBinding>();

  constructor(
    private readonly items: { opName: string; displayName: string }[],
    private readonly callbacks: RecipeCallbacks,
    private readonly argDefsFor: (opName: string) => ArgConfig[] = () => [],
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage(
      async (raw: unknown) => {
        if (raw === null || typeof raw !== "object") return;
        const msg = raw as {
          type?: string;
          name?: string;
          steps?: PipelineStep[];
          stepIds?: unknown;
          stepId?: string;
          arg?: number;
          editedArg?: { stepId?: unknown; arg?: unknown; subfield?: unknown };
        };
        switch (msg.type) {
          case "ready":
            this.postState();
            break;
          case "edit": {
            const steps = msg.steps;
            const incomingIds = msg.stepIds;
            if (
              typeof msg.name !== "string" ||
              !Array.isArray(steps) ||
              !steps.every(
                (step): step is PipelineStep =>
                  step !== null &&
                  typeof step === "object" &&
                  typeof step.opName === "string" &&
                  Array.isArray(step.args),
              ) ||
              !Array.isArray(incomingIds) ||
              incomingIds.length !== steps.length ||
              incomingIds.length !== this.stepIds.length ||
              !incomingIds.every(
                (id): id is string => typeof id === "string",
              ) ||
              new Set(incomingIds).size !== incomingIds.length ||
              incomingIds.some(
                (id, index) =>
                  id !== this.stepIds[index] ||
                  this.recipe.steps[index]?.opName !== steps[index].opName,
              )
            )
              break;
            this.stepIds = [...incomingIds];
            const editedArg = msg.editedArg;
            if (
              editedArg &&
              typeof editedArg.stepId === "string" &&
              this.stepIds.includes(editedArg.stepId) &&
              Number.isInteger(editedArg.arg)
            ) {
              const key = this.bindingKey(
                editedArg.stepId,
                editedArg.arg as number,
              );
              const binding = this.bindings.get(key);
              if (
                !(
                  binding?.type === "toggleString" &&
                  editedArg.subfield === "option"
                )
              ) {
                this.disposeBinding(key);
              }
            }
            this.recipe = {
              name: msg.name,
              steps: steps.map(({ opName, args }) => ({ opName, args })),
            };
            this.removeOrphanedBindings();
            break;
          }
          case "reorderSteps": {
            const incomingIds = msg.stepIds;
            if (
              !Array.isArray(incomingIds) ||
              incomingIds.length !== this.stepIds.length ||
              !incomingIds.every(
                (id): id is string => typeof id === "string",
              ) ||
              new Set(incomingIds).size !== incomingIds.length ||
              incomingIds.some((id) => !this.stepIds.includes(id))
            )
              break;
            const stepsById = new Map(
              this.stepIds.map((id, index) => [id, this.recipe.steps[index]]),
            );
            this.recipe.steps = incomingIds.map((id) => stepsById.get(id)!);
            this.stepIds = [...incomingIds];
            this.postState();
            break;
          }
          case "useSelection": {
            if (typeof msg.stepId !== "string" || !Number.isInteger(msg.arg))
              break;
            const stepIndex = this.stepIds.indexOf(msg.stepId);
            if (stepIndex < 0) break;
            const step = this.recipe.steps[stepIndex];
            const argDef = step && this.argDefsFor(step.opName)[msg.arg!];
            if (
              !step ||
              (argDef?.type !== "string" && argDef?.type !== "toggleString")
            )
              break;
            const reference = this.callbacks.getSelectionReference();
            if (!reference) break;
            const key = this.bindingKey(msg.stepId, msg.arg!);
            this.disposeBinding(key);
            const binding: RecipeBinding = {
              type: argDef.type,
              reference,
              subscription: reference.onDidChange(() => {
                this.materializeBinding(msg.stepId!, msg.arg!, binding);
                this.postState();
              }),
            };
            this.bindings.set(key, binding);
            if (!Array.isArray(step.args)) step.args = [];
            this.materializeBinding(msg.stepId, msg.arg!, binding);
            this.postState();
            break;
          }
          case "revealSelection": {
            if (typeof msg.stepId !== "string" || !Number.isInteger(msg.arg))
              break;
            const binding = this.bindings.get(
              this.bindingKey(msg.stepId, msg.arg as number),
            );
            if (binding) await binding.reference.reveal();
            break;
          }
          case "clearSelection": {
            if (typeof msg.stepId !== "string" || !Number.isInteger(msg.arg))
              break;
            const key = this.bindingKey(msg.stepId, msg.arg as number);
            const binding = this.bindings.get(key);
            if (!binding) break;
            this.materializeBinding(msg.stepId, msg.arg as number, binding);
            this.disposeBinding(key);
            this.postState();
            break;
          }
          case "removeStep": {
            if (typeof msg.stepId !== "string") break;
            const stepIndex = this.stepIds.indexOf(msg.stepId);
            if (stepIndex < 0) break;
            this.recipe.steps.splice(stepIndex, 1);
            this.stepIds.splice(stepIndex, 1);
            this.removeOrphanedBindings();
            this.postState();
            break;
          }
          case "apply":
            this.materializeAll();
            await this.callbacks.onApply(
              this.recipe.name,
              this.recipe.steps,
              this.resultReferences(),
            );
            break;
          case "save":
            this.materializeAll();
            await this.callbacks.onSave(
              this.recipe.name,
              structuredClone(this.recipe.steps),
            );
            break;
        }
      },
    );
  }

  /** Append an operation step to the working recipe. */
  addOp(step: PipelineStep): void {
    this.recipe.steps.push(step);
    this.stepIds.push(this.nextStepId());
    this.postState();
  }

  /** Replace the working recipe with a saved pipeline and reveal the pane. */
  load(
    pipeline: { name: string; steps: PipelineStep[] },
    references: PipelineArgReference[] = [],
  ): void {
    this.disposeBindings();
    this.recipe = { name: pipeline.name, steps: [...pipeline.steps] };
    this.stepIds = pipeline.steps.map(() => this.nextStepId());

    for (const candidate of references) {
      if (
        !Number.isInteger(candidate.stepIndex) ||
        !Number.isInteger(candidate.argIndex)
      )
        continue;
      const step = this.recipe.steps[candidate.stepIndex];
      const stepId = this.stepIds[candidate.stepIndex];
      const argDef = step && this.argDefsFor(step.opName)[candidate.argIndex];
      if (!step || !stepId || argDef?.type !== candidate.type) continue;
      if (candidate.type !== "string" && candidate.type !== "toggleString")
        continue;

      const key = this.bindingKey(stepId, candidate.argIndex);
      this.disposeBinding(key);
      const reference = candidate.reference.clone();
      const binding: RecipeBinding = {
        type: candidate.type,
        reference,
        subscription: reference.onDidChange(() => {
          this.materializeBinding(stepId, candidate.argIndex, binding);
          this.postState();
        }),
      };
      this.bindings.set(key, binding);
      this.materializeBinding(stepId, candidate.argIndex, binding);
    }

    this.view?.show?.(false);
    this.postState();
  }

  private postState(): void {
    const defs: Record<string, ArgConfig[]> = {};
    for (const s of this.recipe.steps) {
      if (!(s.opName in defs)) defs[s.opName] = this.argDefsFor(s.opName);
    }
    const boundArgs = [...this.bindings.keys()].map((key) => {
      const [stepId, arg] = this.parseBindingKey(key);
      return { stepId, arg };
    });
    this.view?.webview.postMessage({
      type: "state",
      recipe: this.recipe,
      stepIds: this.stepIds,
      defs,
      boundArgs,
    });
  }

  dispose(): void {
    this.disposeBindings();
  }

  private bindingKey(stepId: string, arg: number): string {
    return JSON.stringify([stepId, arg]);
  }

  private parseBindingKey(key: string): [string, number] {
    return JSON.parse(key) as [string, number];
  }

  private nextStepId(): string {
    let id: string;
    do id = `step-${++this.stepSeq}`;
    while (this.stepIds.includes(id));
    return id;
  }

  private disposeBinding(key: string): void {
    const binding = this.bindings.get(key);
    if (!binding) return;
    binding.subscription.dispose();
    binding.reference.dispose();
    this.bindings.delete(key);
  }

  private disposeBindings(): void {
    for (const key of [...this.bindings.keys()]) this.disposeBinding(key);
  }

  private removeOrphanedBindings(): void {
    const live = new Set(this.stepIds);
    for (const key of [...this.bindings.keys()]) {
      if (!live.has(this.parseBindingKey(key)[0])) this.disposeBinding(key);
    }
  }

  private materializeBinding(
    stepId: string,
    arg: number,
    binding: RecipeBinding,
  ): void {
    const stepIndex = this.stepIds.indexOf(stepId);
    const step = this.recipe.steps[stepIndex];
    if (!step) return;
    if (!Array.isArray(step.args)) step.args = [];
    if (binding.type === "toggleString") {
      const current = step.args[arg] as { option?: unknown } | undefined;
      step.args[arg] = {
        string: binding.reference.text,
        option: current?.option,
      };
    } else {
      step.args[arg] = binding.reference.text;
    }
  }

  private materializeAll(): void {
    for (const [key, binding] of this.bindings) {
      const [stepId, arg] = this.parseBindingKey(key);
      this.materializeBinding(stepId, arg, binding);
    }
  }

  private resultReferences(): PipelineArgReference[] {
    const references: PipelineArgReference[] = [];
    for (const [key, binding] of this.bindings) {
      const [stepId, argIndex] = this.parseBindingKey(key);
      const stepIndex = this.stepIds.indexOf(stepId);
      if (stepIndex < 0) continue;
      references.push({
        stepIndex,
        argIndex,
        type: binding.type,
        reference: binding.reference,
      });
    }
    return references;
  }

  private html(): string {
    const names: Record<string, string> = {};
    for (const it of this.items) names[it.opName] = it.displayName;
    const namesData = JSON.stringify(names).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        color: var(--vscode-foreground);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        padding: 0;
        margin: 0;
      }
      input,
      select,
      button {
        font: inherit;
      }
      #name {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border: none;
        outline: none;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      #steps {
        padding: 4px 0;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        cursor: grab;
      }
      .step:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .idx {
        opacity: 0.6;
        min-width: 1.4em;
        text-align: right;
      }
      .label {
        flex: 1;
      }
      .chevron,
      .rm {
        cursor: pointer;
        opacity: 0.7;
        padding: 0 2px;
      }
      .chevron:hover,
      .rm:hover {
        opacity: 1;
      }
      .step-args {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 2px 8px 8px 28px;
      }
      .arg-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .arg-label {
        opacity: 0.8;
        min-width: 70px;
      }
      .arg-row input[type="text"],
      .arg-row input[type="number"],
      .arg-row select {
        flex: 1;
        min-width: 50px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, #555);
        padding: 2px 5px;
      }
      .arg-row input[type="checkbox"] {
        cursor: pointer;
      }
      .selection-action {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--vscode-button-secondaryForeground);
        background: var(--vscode-button-secondaryBackground);
        border: none;
        padding: 3px;
        cursor: pointer;
        border-radius: 2px;
      }
      .selection-action:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .selection-action svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
      }
      .arg-row input[data-selection-reference] {
        cursor: pointer;
        opacity: 0.85;
      }
      .empty {
        padding: 8px;
        opacity: 0.6;
      }
      .actions {
        display: flex;
        gap: 6px;
        padding: 8px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      .actions button {
        flex: 1;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        padding: 5px 8px;
        cursor: pointer;
        border-radius: 2px;
      }
      .actions button:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>
  </head>
  <body>
    <input id="name" type="text" placeholder="Recipe name…" />
    <div id="steps"></div>
    <div class="actions">
      <button id="apply">Apply to selection</button>
      <button id="save">Save as pipeline</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      const NAMES = ${namesData};
      const nameEl = document.getElementById("name");
      const stepsEl = document.getElementById("steps");
      let steps = [];
      let stepIds = [];
      let defs = {};
      let boundArgs = new Set();
      const collapsed = new Set();
      let dragIdx = -1;
      const LINK_ICON =
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M5.25 11.75l-1 .99a2.12 2.12 0 01-3-3l2.5-2.49a2.12 2.12 0 013 0M10.75 4.25l1-.99a2.12 2.12 0 013 3l-2.5 2.49a2.12 2.12 0 01-3 0"/></svg>';
      const CLEAR_ICON =
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

      function esc(s) {
        return String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
      function escAttr(s) {
        return String(s == null ? "" : s)
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;");
      }
      function label(op) {
        return NAMES[op] || op;
      }
      function argDefs(op) {
        return defs[op] || [];
      }

      function bindingKey(stepId, arg) {
        return JSON.stringify([stepId, arg]);
      }

      function selectionButton(action, ai, title, icon) {
        return (
          '<button type="button" class="selection-action" data-' +
          action +
          ' data-arg="' +
          ai +
          '" title="' +
          title +
          '" aria-label="' +
          title +
          '">' +
          icon +
          "</button>"
        );
      }

      function renderArgRow(argDef, val, ai, stepId) {
        const lbl = '<span class="arg-label">' + esc(argDef.name) + "</span>";
        const bound = boundArgs.has(bindingKey(stepId, ai));
        const referenceAttrs = bound
          ? ' readonly data-selection-reference role="button" aria-label="Reveal selection for ' +
            escAttr(argDef.name) +
            '"'
          : "";
        const action = bound
          ? selectionButton(
              "clear-selection",
              ai,
              "Clear selection reference",
              CLEAR_ICON,
            )
          : selectionButton(
              "use-selection",
              ai,
              "Use current editor selection",
              LINK_ICON,
            );
        let input = "";
        switch (argDef.type) {
          case "boolean":
            input =
              '<input type="checkbox" ' +
              (val ? "checked" : "") +
              ' data-arg="' +
              ai +
              '" data-type="boolean">';
            break;
          case "number": {
            const min = argDef.min != null ? 'min="' + argDef.min + '"' : "";
            const max = argDef.max != null ? 'max="' + argDef.max + '"' : "";
            const stp = argDef.step != null ? 'step="' + argDef.step + '"' : "";
            input =
              '<input type="number" value="' +
              escAttr(val) +
              '" ' +
              min +
              " " +
              max +
              " " +
              stp +
              ' data-arg="' +
              ai +
              '" data-type="number">';
            break;
          }
          case "option": {
            const opts = argDef.value;
            const sel = Array.isArray(opts)
              ? opts
                  .map(
                    (o) =>
                      "<option " +
                      (String(val) === String(o) ? "selected" : "") +
                      ">" +
                      esc(String(o)) +
                      "</option>",
                  )
                  .join("")
              : "";
            input =
              '<select data-arg="' + ai + '" data-type="option">' + sel + "</select>";
            break;
          }
          case "editableOption":
          case "editableOptionShort": {
            const opts = argDef.value;
            const sel = Array.isArray(opts)
              ? opts
                  .map(
                    (o) =>
                      "<option " +
                      (JSON.stringify(o.value) === JSON.stringify(val)
                        ? "selected"
                        : "") +
                      ">" +
                      esc(String(o.name)) +
                      "</option>",
                  )
                  .join("")
              : "";
            input =
              '<select data-arg="' +
              ai +
              '" data-type="editableOption">' +
              sel +
              "</select>";
            break;
          }
          case "argSelector": {
            const opts = argDef.value;
            const sel = Array.isArray(opts)
              ? opts
                  .map(
                    (o) =>
                      "<option " +
                      (String(val) === String(o.name) ? "selected" : "") +
                      ">" +
                      esc(String(o.name)) +
                      "</option>",
                  )
                  .join("")
              : "";
            input =
              '<select data-arg="' +
              ai +
              '" data-type="argSelector">' +
              sel +
              "</select>";
            break;
          }
          case "toggleString": {
            const strVal =
              val && typeof val === "object"
                ? (val.string ?? "")
                : typeof val === "string"
                  ? val
                  : "";
            const encVal =
              val && typeof val === "object" ? (val.option ?? "") : "";
            const encOpts = (argDef.toggleValues || ["Hex"])
              .map(
                (v) =>
                  "<option " +
                  (encVal === v ? "selected" : "") +
                  ">" +
                  esc(v) +
                  "</option>",
              )
              .join("");
            input =
              '<input type="text" value="' +
              escAttr(strVal) +
              '" data-arg="' +
              ai +
              '" data-type="toggleString" data-subfield="string"' +
              referenceAttrs +
              ">" +
              action +
              '<select data-arg="' +
              ai +
              '" data-type="toggleString" data-subfield="option">' +
              encOpts +
              "</select>";
            break;
          }
          default: {
            const strVal =
              typeof val === "string" ? val : val != null ? String(val) : "";
            input =
              '<input type="text" value="' +
              escAttr(strVal) +
              '" data-arg="' +
              ai +
              '" data-type="string"' +
              (argDef.type === "string" ? referenceAttrs : "") +
              ">" +
              (argDef.type === "string" ? action : "");
          }
        }
        return '<div class="arg-row">' + lbl + input + "</div>";
      }

      function renderArgs(s, i) {
        const ds = argDefs(s.opName);
        const rows = ds
          .map((a, ai) => renderArgRow(a, (s.args || [])[ai], ai, stepIds[i]))
          .join("");
        return '<div class="step-args" data-step="' + i + '">' + rows + "</div>";
      }

      function render() {
        if (!steps.length) {
          stepsEl.innerHTML =
            '<div class="empty">Empty recipe — add operations with ＋ from the Operations pane.</div>';
          return;
        }
        let html = "";
        steps.forEach((s, i) => {
          const hasArgs = argDefs(s.opName).length > 0;
          const open = hasArgs && !collapsed.has(i);
          html +=
            '<div class="step" draggable="true" data-i="' +
            i +
            '"><span class="idx">' +
            (i + 1) +
            '</span><span class="label">' +
            esc(label(s.opName)) +
            "</span>" +
            (hasArgs
              ? '<span class="chevron" data-toggle="' +
                i +
                '" title="Configure">' +
                (open ? "▲" : "▼") +
                "</span>"
              : "") +
            '<span class="rm" data-rm="' +
            i +
            '" title="Remove">✕</span></div>' +
            (open && hasArgs ? renderArgs(s, i) : "");
        });
        stepsEl.innerHTML = html;
      }

      function emitEdit(editedArg) {
        vscode.postMessage({
          type: "edit",
          name: nameEl.value,
          steps,
          stepIds,
          editedArg,
        });
      }

      function handleArgUpdate(e) {
        const argsDiv = e.target.closest(".step-args");
        if (!argsDiv) return;
        const si = Number(argsDiv.dataset.step);
        const ai = Number(e.target.dataset.arg);
        if (isNaN(si) || isNaN(ai)) return;
        const s = steps[si];
        if (!s) return;
        if (!Array.isArray(s.args)) s.args = [];
        const argDef = argDefs(s.opName)[ai] || {};
        const t = e.target;
        switch (t.dataset.type) {
          case "boolean":
            s.args[ai] = t.checked;
            break;
          case "number":
            s.args[ai] = Number(t.value);
            break;
          case "toggleString": {
            const cur = s.args[ai];
            const obj =
              cur && typeof cur === "object"
                ? { string: cur.string, option: cur.option }
                : {
                    string: "",
                    option: (argDef.toggleValues && argDef.toggleValues[0]) || "Hex",
                  };
            obj[t.dataset.subfield] = t.value;
            s.args[ai] = obj;
            break;
          }
          case "editableOption": {
            const opts = argDef.value;
            s.args[ai] = Array.isArray(opts)
              ? (opts[t.selectedIndex] && opts[t.selectedIndex].value) ?? t.value
              : t.value;
            break;
          }
          default:
            s.args[ai] = t.value;
        }
        emitEdit({
          stepId: stepIds[si],
          arg: ai,
          subfield: t.dataset.subfield,
        });
      }

      function revealSelection(input) {
        const argsDiv = input.closest(".step-args");
        if (!argsDiv) return;
        vscode.postMessage({
          type: "revealSelection",
          stepId: stepIds[Number(argsDiv.dataset.step)],
          arg: Number(input.dataset.arg),
        });
      }

      nameEl.addEventListener("input", () => emitEdit());
      document
        .getElementById("apply")
        .addEventListener("click", () => vscode.postMessage({ type: "apply" }));
      document
        .getElementById("save")
        .addEventListener("click", () => vscode.postMessage({ type: "save" }));

      stepsEl.addEventListener("click", (e) => {
        const referencedInput = e.target.closest("[data-selection-reference]");
        if (referencedInput) {
          revealSelection(referencedInput);
          return;
        }
        const clearSelection = e.target.closest("[data-clear-selection]");
        if (clearSelection) {
          const argsDiv = clearSelection.closest(".step-args");
          if (!argsDiv) return;
          vscode.postMessage({
            type: "clearSelection",
            stepId: stepIds[Number(argsDiv.dataset.step)],
            arg: Number(clearSelection.dataset.arg),
          });
          return;
        }
        const useSelection = e.target.closest("[data-use-selection]");
        if (useSelection) {
          const argsDiv = useSelection.closest(".step-args");
          if (!argsDiv) return;
          vscode.postMessage({
            type: "useSelection",
            stepId: stepIds[Number(argsDiv.dataset.step)],
            arg: Number(useSelection.dataset.arg),
          });
          return;
        }
        const tog = e.target.closest("[data-toggle]");
        if (tog) {
          const i = Number(tog.dataset.toggle);
          if (collapsed.has(i)) collapsed.delete(i);
          else collapsed.add(i);
          render();
          return;
        }
        const rm = e.target.closest("[data-rm]");
        if (rm) {
          const index = Number(rm.dataset.rm);
          vscode.postMessage({ type: "removeStep", stepId: stepIds[index] });
        }
      });
      stepsEl.addEventListener("keydown", (e) => {
        const referencedInput = e.target.closest("[data-selection-reference]");
        if (!referencedInput || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        revealSelection(referencedInput);
      });
      stepsEl.addEventListener("change", handleArgUpdate);
      stepsEl.addEventListener("input", (e) => {
        if (e.target.tagName === "INPUT" && e.target.type !== "checkbox")
          handleArgUpdate(e);
      });
      stepsEl.addEventListener("dragstart", (e) => {
        const el = e.target.closest(".step");
        if (el) dragIdx = Number(el.dataset.i);
      });
      stepsEl.addEventListener("dragover", (e) => e.preventDefault());
      stepsEl.addEventListener("drop", (e) => {
        e.preventDefault();
        const el = e.target.closest(".step");
        if (!el || dragIdx < 0) return;
        const to = Number(el.dataset.i);
        const moved = steps.splice(dragIdx, 1)[0];
        const movedId = stepIds.splice(dragIdx, 1)[0];
        steps.splice(to, 0, moved);
        stepIds.splice(to, 0, movedId);
        dragIdx = -1;
        collapsed.clear();
        render();
        vscode.postMessage({ type: "reorderSteps", stepIds });
      });

      window.addEventListener("message", (e) => {
        const msg = e.data;
        if (msg.type === "state") {
          nameEl.value = msg.recipe.name || "";
          steps = Array.isArray(msg.recipe.steps) ? msg.recipe.steps : [];
          stepIds = Array.isArray(msg.stepIds) ? msg.stepIds : [];
          defs = msg.defs || {};
          boundArgs = new Set(
            (Array.isArray(msg.boundArgs) ? msg.boundArgs : []).map((target) =>
              bindingKey(target.stepId, target.arg),
            ),
          );
          collapsed.clear();
          render();
        }
      });

      vscode.postMessage({ type: "ready" });
      render();
    </script>
  </body>
</html>`;
  }
}
