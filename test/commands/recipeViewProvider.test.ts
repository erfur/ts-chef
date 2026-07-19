import { RecipeViewProvider } from "../../src/providers/recipeViewProvider";
import type { WebviewView } from "vscode";
import type { ArgConfig } from "../../src/chef/Operation";
import type { SelectionReference } from "../../src/commands/selectionReference";
import { JSDOM } from "jsdom";
import { EventEmitter } from "../vscode-mock";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
];

const ARG_DEFS = [
  { name: "Value", type: "string", value: "" },
  { name: "Alphabet", type: "toggleString", value: "" },
  { name: "Separator", type: "binaryShortString", value: "" },
] as ArgConfig[];

function makeView() {
  const webview = {
    options: {} as { enableScripts?: boolean },
    html: "",
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  };
  const view = { webview, show: jest.fn() };
  return { view: view as unknown as WebviewView, webview, show: view.show };
}

function fakeReference(initial: string) {
  let text = initial;
  const emitter = new EventEmitter<void>();
  const reference: SelectionReference = {
    get text() {
      return text;
    },
    onDidChange: emitter.event,
    clone: jest.fn(),
    dispose: jest.fn(() => emitter.dispose()),
  };
  return {
    reference,
    setText: (next: string) => {
      text = next;
    },
    fire: () => emitter.fire(),
  };
}

function setup(reference?: SelectionReference) {
  const onApply = jest.fn();
  const onSave = jest.fn();
  const getSelectionReference = jest.fn(() => reference);
  const argDefsFor = jest.fn((op: string): ArgConfig[] =>
    op === "FromBase64" ? ARG_DEFS : [],
  );
  const p = new RecipeViewProvider(
    ITEMS,
    { onApply, onSave, getSelectionReference },
    argDefsFor,
  );
  const v = makeView();
  p.resolveWebviewView(v.view);
  const onMessage = v.webview.onDidReceiveMessage.mock.calls[0][0] as (
    m: unknown,
  ) => Promise<void>;
  return {
    p,
    v,
    onApply,
    onSave,
    getSelectionReference,
    argDefsFor,
    onMessage,
  };
}

function setupReference(initial: string) {
  const mutable = fakeReference(initial);
  return { ...setup(mutable.reference), ...mutable };
}

function lastPostedState(v: ReturnType<typeof makeView>) {
  return v.webview.postMessage.mock.calls.at(-1)?.[0];
}

function renderRecipeDom(html: string) {
  const postMessage = jest.fn();
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    beforeParse(window) {
      Object.defineProperty(window, "acquireVsCodeApi", {
        value: () => ({ postMessage }),
      });
    },
  });

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      data: {
        type: "state",
        recipe: {
          name: "r1",
          steps: [{ opName: "FromBase64", args: ["", "", ""] }],
        },
        stepIds: ["step-1"],
        defs: { FromBase64: ARG_DEFS },
      },
    }),
  );

  return { dom, postMessage };
}

beforeEach(() => jest.clearAllMocks());

describe("RecipeViewProvider", () => {
  test("resolveWebviewView enables scripts and renders name input + buttons", () => {
    const { v } = setup();
    expect(v.webview.options.enableScripts).toBe(true);
    expect(v.webview.html).toContain('id="name"');
    expect(v.webview.html).toContain("Apply to selection");
    expect(v.webview.html).toContain("Save as pipeline");
  });

  test("uses VS Code default typography for all recipe fields", () => {
    const { v } = setup();

    expect(v.webview.html).toContain("font-size: var(--vscode-font-size);");
    expect(v.webview.html).toMatch(
      /input,\s*select,\s*button\s*{\s*font: inherit;/,
    );
    expect(v.webview.html).not.toContain("font-size: 11px;");
  });

  test("renders argument-bearing steps open by default while honoring collapse state", () => {
    const { v } = setup();
    const { dom } = renderRecipeDom(v.webview.html);

    expect(dom.window.document.querySelector(".step-args")).not.toBeNull();
    expect(
      dom.window.document.querySelector("[data-toggle]")?.textContent,
    ).toBe("▲");

    dom.window.document
      .querySelector<HTMLElement>("[data-toggle]")
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    expect(dom.window.document.querySelector(".step-args")).toBeNull();
    expect(
      dom.window.document.querySelector("[data-toggle]")?.textContent,
    ).toBe("▼");

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        data: {
          type: "state",
          recipe: { name: "r1", steps: [{ opName: "FromBase64", args: [""] }] },
          stepIds: ["step-1"],
          defs: { FromBase64: ARG_DEFS },
        },
      }),
    );

    expect(dom.window.document.querySelector(".step-args")).not.toBeNull();
  });

  test("renders use-selection beside string and toggleString arguments", () => {
    const { v } = setup();
    const { dom } = renderRecipeDom(v.webview.html);

    const buttons = dom.window.document.querySelectorAll("[data-use-selection]");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].closest(".arg-row")?.textContent).toContain("Value");
    expect(buttons[1].closest(".arg-row")?.textContent).toContain("Alphabet");

    const alphabetRow = buttons[1].closest(".arg-row");
    expect(
      alphabetRow?.querySelector('input[type="text"] + button + select'),
    ).not.toBeNull();

    const separatorRow = Array.from(
      dom.window.document.querySelectorAll(".arg-row"),
    ).find((row) => row.textContent?.includes("Separator"));
    expect(separatorRow?.querySelector('input[type="text"]')).not.toBeNull();
    expect(separatorRow?.querySelector("[data-use-selection]")).toBeNull();
  });

  test("requests the current selection for the clicked argument", () => {
    const { v } = setup();
    const { dom, postMessage } = renderRecipeDom(v.webview.html);
    postMessage.mockClear();

    dom.window.document
      .querySelector<HTMLElement>("[data-use-selection]")
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "useSelection",
      stepId: "step-1",
      arg: 0,
    });
  });

  test("ready posts the empty recipe state with an empty defs map", () => {
    const { v, onMessage } = setup();
    onMessage({ type: "ready" });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [] },
      stepIds: [],
      defs: {},
    });
  });

  test("edit updates the canonical recipe; save passes it to onSave", () => {
    const { onMessage, onSave } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "r1", steps, stepIds: ["step-1"] });
    onMessage({ type: "save" });
    expect(onSave).toHaveBeenCalledWith("r1", steps);
  });

  test.each([
    { label: "missing steps and IDs", message: {} },
    { label: "non-array steps", message: { steps: null, stepIds: [] } },
    {
      label: "missing IDs",
      message: { steps: [{ opName: "MD5", args: [] }] },
    },
    {
      label: "mismatched IDs",
      message: { steps: [{ opName: "MD5", args: [] }], stepIds: [] },
    },
    {
      label: "duplicate IDs",
      message: {
        steps: [
          { opName: "MD5", args: [] },
          { opName: "MD5", args: [] },
        ],
        stepIds: ["duplicate", "duplicate"],
      },
    },
    {
      label: "non-string IDs",
      message: { steps: [{ opName: "MD5", args: [] }], stepIds: [1] },
    },
  ])(
    "rejects malformed edit with $label without changing state or bindings",
    async ({ message }) => {
      const { onMessage, onApply, reference, v, setText, fire } =
        setupReference("bound");
      await onMessage({
        type: "edit",
        name: "original",
        steps: [{ opName: "FromBase64", args: ["old"] }],
        stepIds: ["a"],
      });
      await onMessage({ type: "useSelection", stepId: "a", arg: 0 });

      await onMessage({
        type: "edit",
        name: "invalid",
        editedArg: { stepId: "a", arg: 0 },
        ...message,
      });
      setText("latest");
      fire();
      await onMessage({ type: "ready" });
      await onMessage({ type: "apply" });

      expect(lastPostedState(v)).toMatchObject({
        recipe: {
          name: "original",
          steps: [{ opName: "FromBase64", args: ["latest"] }],
        },
        stepIds: ["a"],
      });
      expect(onApply.mock.calls[0].slice(0, 2)).toEqual([
        "original",
        [{ opName: "FromBase64", args: ["latest"] }],
      ]);
      expect(onApply.mock.calls[0][2]).toEqual([
        expect.objectContaining({ stepIndex: 0, argIndex: 0, reference }),
      ]);
      expect(reference.dispose).not.toHaveBeenCalled();
    },
  );

  test("assigns a non-empty selection to a plain string argument", async () => {
    const reference = fakeReference("selected text");
    const { v, onMessage, getSelectionReference } = setup(reference.reference);
    const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
    await onMessage({ type: "edit", name: "decode", steps, stepIds: ["step-1"] });
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", stepId: "step-1", arg: 0 });

    expect(getSelectionReference).toHaveBeenCalledTimes(1);
    expect(steps[0].args[0]).toBe("selected text");
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "decode", steps },
      stepIds: ["step-1"],
      defs: { FromBase64: ARG_DEFS },
    });
  });

  test("assigns selection to toggleString while preserving its encoding", async () => {
    const reference = fakeReference("selected key");
    const { v, onMessage, getSelectionReference } = setup(reference.reference);
    const steps = [
      {
        opName: "FromBase64",
        args: ["old", { string: "old key", option: "UTF8" }, ""],
      },
    ];
    await onMessage({ type: "edit", name: "decode", steps, stepIds: ["step-1"] });
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", stepId: "step-1", arg: 1 });

    expect(getSelectionReference).toHaveBeenCalledTimes(1);
    expect(steps[0].args[1]).toEqual({
      string: "selected key",
      option: "UTF8",
    });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "decode", steps },
      stepIds: ["step-1"],
      defs: { FromBase64: ARG_DEFS },
    });
  });

  test.each([undefined, ""])(
    "leaves the argument unchanged when selection is %p",
    async (selection) => {
      const reference = selection ? fakeReference(selection).reference : undefined;
      const { v, onMessage } = setup(reference);
      const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
      await onMessage({ type: "edit", name: "decode", steps, stepIds: ["step-1"] });
      v.webview.postMessage.mockClear();

      await onMessage({ type: "useSelection", stepId: "step-1", arg: 0 });

      expect(steps[0].args[0]).toBe("old");
      expect(v.webview.postMessage).not.toHaveBeenCalled();
    },
  );

  test.each([
    { stepId: "missing", arg: 0 },
    { stepId: "step-1", arg: 2 },
  ])("ignores invalid or ineligible target $stepId:$arg", async (target) => {
    const reference = fakeReference("selected text");
    const { v, onMessage, getSelectionReference } = setup(reference.reference);
    const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
    await onMessage({ type: "edit", name: "decode", steps, stepIds: ["step-1"] });
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", ...target });

    expect(getSelectionReference).not.toHaveBeenCalled();
    expect(steps[0].args).toEqual(["old", "Hex"]);
    expect(v.webview.postMessage).not.toHaveBeenCalled();
  });

  test("addOp appends a step and posts state including the op's arg defs", () => {
    const { p, v, argDefsFor } = setup();
    v.webview.postMessage.mockClear();
    p.addOp({ opName: "FromBase64", args: [] });
    expect(argDefsFor).toHaveBeenCalledWith("FromBase64");
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [{ opName: "FromBase64", args: [] }] },
      stepIds: [expect.any(String)],
      defs: { FromBase64: ARG_DEFS },
    });
  });

  test("generated IDs skip accepted client IDs and target distinct steps", async () => {
    const first = fakeReference("first-bound");
    const second = fakeReference("second-bound");
    const { p, v, onMessage, onApply, getSelectionReference } = setup(
      first.reference,
    );
    await onMessage({
      type: "edit",
      name: "r",
      steps: [{ opName: "FromBase64", args: ["first"] }],
      stepIds: ["step-1"],
    });
    await onMessage({ type: "useSelection", stepId: "step-1", arg: 0 });

    p.addOp({ opName: "FromBase64", args: ["second"] });
    const stepIds = lastPostedState(v).stepIds as string[];
    expect(stepIds).toEqual(["step-1", "step-2"]);

    getSelectionReference.mockReturnValue(second.reference);
    await onMessage({ type: "useSelection", stepId: stepIds[1], arg: 0 });
    first.setText("first-latest");
    first.fire();
    second.setText("second-latest");
    second.fire();
    await onMessage({ type: "apply" });

    expect(onApply.mock.calls[0][1]).toEqual([
      { opName: "FromBase64", args: ["first-latest"] },
      { opName: "FromBase64", args: ["second-latest"] },
    ]);
    expect(onApply.mock.calls[0][2]).toEqual([
      expect.objectContaining({ stepIndex: 0, reference: first.reference }),
      expect.objectContaining({ stepIndex: 1, reference: second.reference }),
    ]);
  });

  test("load replaces the recipe, reveals the view, and posts state with defs", () => {
    const { p, v } = setup();
    v.webview.postMessage.mockClear();
    p.load({ name: "p", steps: [{ opName: "MD5", args: [] }] });
    expect(v.show).toHaveBeenCalled();
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "p", steps: [{ opName: "MD5", args: [] }] },
      stepIds: [expect.any(String)],
      defs: { MD5: [] },
    });
  });

  test("apply passes the current recipe name and steps", () => {
    const { onMessage, onApply } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "decode", steps, stepIds: ["step-1"] });
    onMessage({ type: "apply" });
    expect(onApply).toHaveBeenCalledWith("decode", steps, []);
  });

  test("reference changes update the bound plain value", async () => {
    const { onMessage, reference, v, setText, fire } = setupReference("first");
    await onMessage({
      type: "edit",
      name: "r",
      steps: [{ opName: "FromBase64", args: ["old", "", ""] }],
      stepIds: ["step-1"],
    });
    await onMessage({ type: "useSelection", stepId: "step-1", arg: 0 });
    setText("second");
    fire();
    expect(lastPostedState(v).recipe.steps[0].args[0]).toBe("second");
    expect(reference.dispose).not.toHaveBeenCalled();
  });

  test("toggleString reference changes preserve the option", async () => {
    const { onMessage, v, setText, fire } = setupReference("key-one");
    await onMessage({
      type: "edit",
      name: "r",
      steps: [
        {
          opName: "FromBase64",
          args: ["", { string: "old", option: "UTF8" }, ""],
        },
      ],
      stepIds: ["step-1"],
    });
    await onMessage({ type: "useSelection", stepId: "step-1", arg: 1 });
    setText("key-two");
    fire();
    expect(lastPostedState(v).recipe.steps[0].args[1]).toEqual({
      string: "key-two",
      option: "UTF8",
    });
  });

  test("reorder follows step IDs and manual target edits unlink", async () => {
    const { onMessage, reference, onApply, setText, fire } =
      setupReference("bound");
    const first = { opName: "FromBase64", args: ["first", "", ""] };
    const second = { opName: "FromBase64", args: ["second", "", ""] };
    await onMessage({
      type: "edit",
      name: "r",
      steps: [first, second],
      stepIds: ["a", "b"],
    });
    await onMessage({ type: "useSelection", stepId: "a", arg: 0 });
    await onMessage({
      type: "edit",
      name: "r",
      steps: [second, first],
      stepIds: ["b", "a"],
    });
    await onMessage({
      type: "edit",
      name: "r",
      steps: [second, { ...first, args: ["manual", "", ""] }],
      stepIds: ["b", "a"],
      editedArg: { stepId: "a", arg: 0 },
    });
    setText("ignored");
    fire();
    await onMessage({ type: "apply" });
    expect(onApply.mock.calls[0][1][1].args[0]).toBe("manual");
    expect(onApply.mock.calls[0][2]).toEqual([]);
    expect(reference.dispose).toHaveBeenCalled();
  });

  test("removing a step and loading a recipe dispose bindings", async () => {
    const first = fakeReference("first");
    const second = fakeReference("second");
    const { p, onMessage, getSelectionReference } = setup(first.reference);
    await onMessage({
      type: "edit",
      name: "r",
      steps: [
        { opName: "FromBase64", args: ["a"] },
        { opName: "FromBase64", args: ["b"] },
      ],
      stepIds: ["a", "b"],
    });
    await onMessage({ type: "useSelection", stepId: "a", arg: 0 });
    getSelectionReference.mockReturnValue(second.reference);
    await onMessage({ type: "useSelection", stepId: "b", arg: 0 });

    await onMessage({
      type: "edit",
      name: "r",
      steps: [{ opName: "FromBase64", args: ["b"] }],
      stepIds: ["b"],
    });
    expect(first.reference.dispose).toHaveBeenCalledTimes(1);
    expect(second.reference.dispose).not.toHaveBeenCalled();

    p.load({ name: "loaded", steps: [] });
    expect(second.reference.dispose).toHaveBeenCalledTimes(1);
  });

  test("save receives cloned materialized steps without reference metadata", async () => {
    const { onMessage, onSave, setText } = setupReference("selected");
    const steps = [{ opName: "FromBase64", args: ["old"] }];
    await onMessage({ type: "edit", name: "r", steps, stepIds: ["a"] });
    await onMessage({ type: "useSelection", stepId: "a", arg: 0 });
    setText("latest");
    await onMessage({ type: "save" });

    expect(onSave).toHaveBeenCalledWith("r", [
      { opName: "FromBase64", args: ["latest"] },
    ]);
    expect(onSave.mock.calls[0][1]).not.toBe(steps);
    expect(JSON.stringify(onSave.mock.calls[0][1])).not.toContain("reference");
  });

  test("dispose releases all active bindings", async () => {
    const { p, onMessage, reference } = setupReference("selected");
    await onMessage({
      type: "edit",
      name: "r",
      steps: [{ opName: "FromBase64", args: ["old"] }],
      stepIds: ["a"],
    });
    await onMessage({ type: "useSelection", stepId: "a", arg: 0 });

    p.dispose();

    expect(reference.dispose).toHaveBeenCalledTimes(1);
  });
});
