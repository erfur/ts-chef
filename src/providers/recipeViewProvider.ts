import * as vscode from "vscode";
import type { PipelineStep } from "../storage/store";
import type { ArgConfig } from "../chef/Operation";

type Recipe = { name: string; steps: PipelineStep[] };

export type RecipeCallbacks = {
  onApply: (name: string, steps: PipelineStep[]) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
  getSelection: () => string | undefined;
};

/**
 * Sidebar webview holding one working "recipe" (a single pipeline). Operations
 * are appended via `addOp` (the Operations pane's ＋), reordered/removed in the
 * webview, applied to the selection, and saved into the pipelines list. Steps
 * whose operation has arguments can be expanded to edit them. The controller
 * holds the canonical recipe so it survives hide/show and loads.
 */
export class RecipeViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private recipe: Recipe = { name: "", steps: [] };

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
      async (msg: {
        type?: string;
        name?: string;
        steps?: PipelineStep[];
        step?: number;
        arg?: number;
      }) => {
        switch (msg.type) {
          case "ready":
            this.postState();
            break;
          case "edit":
            this.recipe = {
              name: msg.name ?? "",
              steps: Array.isArray(msg.steps) ? msg.steps : [],
            };
            break;
          case "useSelection": {
            if (!Number.isInteger(msg.step) || !Number.isInteger(msg.arg)) break;
            const step = this.recipe.steps[msg.step!];
            const argDef = step && this.argDefsFor(step.opName)[msg.arg!];
            if (!step || argDef?.type !== "string") break;
            const selection = this.callbacks.getSelection();
            if (!selection) break;
            if (!Array.isArray(step.args)) step.args = [];
            step.args[msg.arg!] = selection;
            this.postState();
            break;
          }
          case "apply":
            await this.callbacks.onApply(this.recipe.name, this.recipe.steps);
            break;
          case "save":
            await this.callbacks.onSave(this.recipe.name, this.recipe.steps);
            break;
        }
      },
    );
  }

  /** Append an operation step to the working recipe. */
  addOp(step: PipelineStep): void {
    this.recipe.steps.push(step);
    this.postState();
  }

  /** Replace the working recipe with a saved pipeline and reveal the pane. */
  load(pipeline: { name: string; steps: PipelineStep[] }): void {
    this.recipe = { name: pipeline.name, steps: [...pipeline.steps] };
    this.view?.show?.(false);
    this.postState();
  }

  private postState(): void {
    const defs: Record<string, ArgConfig[]> = {};
    for (const s of this.recipe.steps) {
      if (!(s.opName in defs)) defs[s.opName] = this.argDefsFor(s.opName);
    }
    this.view?.webview.postMessage({
      type: "state",
      recipe: this.recipe,
      defs,
    });
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
      .use-selection {
        flex: none;
        color: var(--vscode-button-secondaryForeground);
        background: var(--vscode-button-secondaryBackground);
        border: none;
        padding: 3px 6px;
        cursor: pointer;
        border-radius: 2px;
      }
      .use-selection:hover {
        background: var(--vscode-button-secondaryHoverBackground);
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
      let defs = {};
      const collapsed = new Set();
      let dragIdx = -1;

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

      function renderArgRow(argDef, val, ai) {
        const lbl = '<span class="arg-label">' + esc(argDef.name) + "</span>";
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
              '" data-type="toggleString" data-subfield="string">' +
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
              '" data-type="string">' +
              '<button type="button" class="use-selection" data-use-selection data-arg="' +
              ai +
              '" title="Use current editor selection">Use selection</button>';
          }
        }
        return '<div class="arg-row">' + lbl + input + "</div>";
      }

      function renderArgs(s, i) {
        const ds = argDefs(s.opName);
        const rows = ds
          .map((a, ai) => renderArgRow(a, (s.args || [])[ai], ai))
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

      function emitEdit() {
        vscode.postMessage({ type: "edit", name: nameEl.value, steps });
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
        emitEdit();
      }

      nameEl.addEventListener("input", emitEdit);
      document
        .getElementById("apply")
        .addEventListener("click", () => vscode.postMessage({ type: "apply" }));
      document
        .getElementById("save")
        .addEventListener("click", () => vscode.postMessage({ type: "save" }));

      stepsEl.addEventListener("click", (e) => {
        const useSelection = e.target.closest("[data-use-selection]");
        if (useSelection) {
          const argsDiv = useSelection.closest(".step-args");
          if (!argsDiv) return;
          vscode.postMessage({
            type: "useSelection",
            step: Number(argsDiv.dataset.step),
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
          steps.splice(Number(rm.dataset.rm), 1);
          collapsed.clear();
          render();
          emitEdit();
        }
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
        steps.splice(to, 0, moved);
        dragIdx = -1;
        collapsed.clear();
        render();
        emitEdit();
      });

      window.addEventListener("message", (e) => {
        const msg = e.data;
        if (msg.type === "state") {
          nameEl.value = msg.recipe.name || "";
          steps = Array.isArray(msg.recipe.steps) ? msg.recipe.steps : [];
          defs = msg.defs || {};
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
