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
    reveal: jest.fn(async () => {}),
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

function loadRecipe(
  p: RecipeViewProvider,
  v: ReturnType<typeof makeView>,
  name: string,
  steps: { opName: string; args: unknown[] }[],
): string[] {
  p.load({ name, steps });
  return [...lastPostedState(v).stepIds];
}

function renderRecipeDom(
  html: string,
  boundArgs: { stepId: string; arg: number }[] = [],
) {
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
        boundArgs,
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

  test("renders accessible icon-only use-selection controls", () => {
    const { v } = setup();
    const { dom } = renderRecipeDom(v.webview.html);

    const buttons = dom.window.document.querySelectorAll<HTMLElement>(
      "[data-use-selection]",
    );
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.textContent?.trim()).toBe("");
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.getAttribute("title")).toBe("Use current editor selection");
      expect(button.getAttribute("aria-label")).toBe(
        "Use current editor selection",
      );
    }

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

  test("renders a bound field read-only with an accessible clear icon", () => {
    const { v } = setup();
    const { dom } = renderRecipeDom(v.webview.html, [
      { stepId: "step-1", arg: 1 },
    ]);
    const input = dom.window.document.querySelector<HTMLInputElement>(
      'input[data-arg="1"][data-subfield="string"]',
    );
    const clear = dom.window.document.querySelector<HTMLElement>(
      "[data-clear-selection]",
    );

    expect(input?.readOnly).toBe(true);
    expect(input?.hasAttribute("data-selection-reference")).toBe(true);
    expect(input?.getAttribute("role")).toBe("button");
    expect(input?.getAttribute("aria-label")).toBe(
      "Reveal selection for Alphabet",
    );
    expect(clear?.textContent?.trim()).toBe("");
    expect(clear?.querySelector("svg")).not.toBeNull();
    expect(clear?.getAttribute("title")).toBe("Clear selection reference");
    expect(clear?.getAttribute("aria-label")).toBe("Clear selection reference");
  });

  test.each([
    ["input[data-selection-reference]", "revealSelection"],
    ["[data-clear-selection]", "clearSelection"],
  ])("clicking %s posts %s for its stable target", (selector, type) => {
    const { v } = setup();
    const { dom, postMessage } = renderRecipeDom(v.webview.html, [
      { stepId: "step-1", arg: 0 },
    ]);
    postMessage.mockClear();

    dom.window.document
      .querySelector<HTMLElement>(selector)
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type,
      stepId: "step-1",
      arg: 0,
    });
  });

  test.each(["Enter", " "])(
    "pressing %p on a bound field posts revealSelection",
    (key) => {
      const { v } = setup();
      const { dom, postMessage } = renderRecipeDom(v.webview.html, [
        { stepId: "step-1", arg: 0 },
      ]);
      postMessage.mockClear();
      const input = dom.window.document.querySelector<HTMLElement>(
        "input[data-selection-reference]",
      );
      const event = new dom.window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });

      input?.dispatchEvent(event);

      expect(postMessage).toHaveBeenCalledWith({
        type: "revealSelection",
        stepId: "step-1",
        arg: 0,
      });
      if (key === " ") expect(event.defaultPrevented).toBe(true);
    },
  );

  test("preserves the edited toggleString subfield", () => {
    const { v } = setup();
    const { dom, postMessage } = renderRecipeDom(v.webview.html);
    postMessage.mockClear();
    const option = dom.window.document.querySelector<HTMLSelectElement>(
      'select[data-arg="1"][data-subfield="option"]',
    );

    option?.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "edit",
        editedArg: { stepId: "step-1", arg: 1, subfield: "option" },
      }),
    );
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

  test("requests authoritative removal by stable step ID", () => {
    const { v } = setup();
    const { dom, postMessage } = renderRecipeDom(v.webview.html);
    postMessage.mockClear();

    dom.window.document
      .querySelector<HTMLElement>("[data-rm]")
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "removeStep",
      stepId: "step-1",
    });
  });

  test("requests authoritative reorder by stable step IDs", () => {
    const { v } = setup();
    const { dom, postMessage } = renderRecipeDom(v.webview.html);
    postMessage.mockClear();
    const step = dom.window.document.querySelector<HTMLElement>(".step");

    step?.dispatchEvent(new dom.window.Event("dragstart", { bubbles: true }));
    step?.dispatchEvent(new dom.window.Event("drop", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "reorderSteps",
      stepIds: ["step-1"],
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
      boundArgs: [],
    });
  });

  test.each([null, undefined, 0, "message", true])(
    "ignores non-object message %p",
    async (message) => {
      const { p, v, onMessage, onApply } = setup();
      const steps = [{ opName: "FromBase64", args: ["original"] }];
      const stepIds = loadRecipe(p, v, "original", steps);

      await expect(onMessage(message)).resolves.toBeUndefined();
      await onMessage({ type: "apply" });

      expect(onApply).toHaveBeenCalledWith("original", steps, []);
      expect(lastPostedState(v).stepIds).toEqual(stepIds);
    },
  );

  test("edit updates the canonical recipe; save passes it to onSave", () => {
    const { p, v, onMessage, onSave } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    const stepIds = loadRecipe(p, v, "old", steps);
    onMessage({ type: "edit", name: "r1", steps, stepIds });
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
    {
      label: "invented IDs",
      message: {
        steps: [{ opName: "FromBase64", args: ["forged"] }],
        stepIds: ["invented"],
      },
    },
  ])(
    "rejects malformed edit with $label without changing state or bindings",
    async ({ message }) => {
      const { p, onMessage, onApply, reference, v, setText, fire } =
        setupReference("bound");
      p.load({
        name: "original",
        steps: [{ opName: "FromBase64", args: ["old"] }],
      });
      const stepId = lastPostedState(v).stepIds[0] as string;
      await onMessage({ type: "useSelection", stepId, arg: 0 });

      await onMessage({
        type: "edit",
        name: "invalid",
        editedArg: { stepId, arg: 0 },
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
        stepIds: [stepId],
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

  test.each([
    ["a non-string name", 42, { opName: "FromBase64", args: ["new"] }],
    ["a null step", "invalid", null],
    ["a non-object step", "invalid", "FromBase64"],
    ["a missing operation name", "invalid", { args: [] }],
    ["a non-string operation name", "invalid", { opName: 1, args: [] }],
    ["non-array arguments", "invalid", { opName: "FromBase64", args: null }],
  ])("rejects edit with %s", async (_label, name, step) => {
    const { p, v, onMessage, onApply } = setup();
    const original = { opName: "FromBase64", args: ["old"] };
    p.load({ name: "original", steps: [original] });
    const stepId = lastPostedState(v).stepIds[0] as string;

    await onMessage({
      type: "edit",
      name,
      steps: [step],
      stepIds: [stepId],
    });
    await onMessage({ type: "apply" });

    expect(onApply).toHaveBeenCalledWith("original", [original], []);
  });

  test("strips extra top-level step metadata before save", async () => {
    const { p, v, onMessage, onSave } = setup();
    p.load({
      name: "original",
      steps: [{ opName: "FromBase64", args: ["old"] }],
    });
    const stepId = lastPostedState(v).stepIds[0] as string;

    await onMessage({
      type: "edit",
      name: "normalized",
      steps: [
        {
          opName: "FromBase64",
          args: ["new"],
          reference: { forged: true },
        },
      ],
      stepIds: [stepId],
    });
    await onMessage({ type: "save" });

    expect(onSave).toHaveBeenCalledWith("normalized", [
      { opName: "FromBase64", args: ["new"] },
    ]);
  });

  test("rejects an edit that omits a current step ID", async () => {
    const { p, v, onMessage, onApply } = setup();
    const original = [
      { opName: "FromBase64", args: ["first"] },
      { opName: "MD5", args: [] },
    ];
    const [firstId] = loadRecipe(p, v, "original", original);

    await onMessage({
      type: "edit",
      name: "truncated",
      steps: [{ opName: "FromBase64", args: ["changed"] }],
      stepIds: [firstId],
    });
    await onMessage({ type: "apply" });

    expect(onApply).toHaveBeenCalledWith("original", original, []);
  });

  test("rejects transferring an ID to another operation without detaching its binding", async () => {
    const { p, v, onMessage, onApply, reference, setText, fire } =
      setupReference("bound");
    p.load({
      name: "original",
      steps: [
        { opName: "FromBase64", args: ["first"] },
        { opName: "MD5", args: [] },
      ],
    });
    const [firstId, secondId] = lastPostedState(v).stepIds as string[];
    await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });

    await onMessage({
      type: "edit",
      name: "forged",
      steps: [
        { opName: "MD5", args: [] },
        { opName: "FromBase64", args: ["forged"] },
      ],
      stepIds: [firstId, secondId],
    });
    setText("latest");
    fire();
    await onMessage({ type: "apply" });

    expect(onApply.mock.calls[0].slice(0, 2)).toEqual([
      "original",
      [
        { opName: "FromBase64", args: ["latest"] },
        { opName: "MD5", args: [] },
      ],
    ]);
    expect(onApply.mock.calls[0][2]).toEqual([
      expect.objectContaining({
        stepIndex: 0,
        argIndex: 0,
        reference,
      }),
    ]);
    expect(reference.dispose).not.toHaveBeenCalled();
  });

  test("rejects a generic ID swap between duplicate operations without moving bindings", async () => {
    const first = fakeReference("first-bound");
    const second = fakeReference("second-bound");
    const { p, v, onMessage, onApply, getSelectionReference } = setup(
      first.reference,
    );
    const original = [
      { opName: "FromBase64", args: ["first"] },
      { opName: "FromBase64", args: ["second"] },
    ];
    const [firstId, secondId] = loadRecipe(p, v, "original", original);
    await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });
    getSelectionReference.mockReturnValue(second.reference);
    await onMessage({ type: "useSelection", stepId: secondId, arg: 0 });

    await onMessage({
      type: "edit",
      name: "forged",
      steps: [
        { opName: "FromBase64", args: ["forged-second"] },
        { opName: "FromBase64", args: ["forged-first"] },
      ],
      stepIds: [secondId, firstId],
    });
    first.setText("first-latest");
    first.fire();
    second.setText("second-latest");
    second.fire();
    await onMessage({ type: "apply" });

    expect(onApply.mock.calls[0].slice(0, 2)).toEqual([
      "original",
      [
        { opName: "FromBase64", args: ["first-latest"] },
        { opName: "FromBase64", args: ["second-latest"] },
      ],
    ]);
    expect(onApply.mock.calls[0][2]).toEqual([
      expect.objectContaining({ stepIndex: 0, reference: first.reference }),
      expect.objectContaining({ stepIndex: 1, reference: second.reference }),
    ]);
  });

  test("authoritative reorder moves duplicate operations and bindings by ID", async () => {
    const first = fakeReference("first-bound");
    const second = fakeReference("second-bound");
    const { p, v, onMessage, onApply, getSelectionReference } = setup(
      first.reference,
    );
    const [firstId, secondId] = loadRecipe(p, v, "r", [
      { opName: "FromBase64", args: ["first"] },
      { opName: "FromBase64", args: ["second"] },
    ]);
    await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });
    getSelectionReference.mockReturnValue(second.reference);
    await onMessage({ type: "useSelection", stepId: secondId, arg: 0 });

    await onMessage({
      type: "reorderSteps",
      stepIds: [secondId, firstId],
    });
    first.setText("first-latest");
    first.fire();
    second.setText("second-latest");
    second.fire();
    await onMessage({ type: "apply" });

    expect(onApply.mock.calls[0][1]).toEqual([
      { opName: "FromBase64", args: ["second-latest"] },
      { opName: "FromBase64", args: ["first-latest"] },
    ]);
    expect(onApply.mock.calls[0][2]).toEqual([
      expect.objectContaining({ stepIndex: 1, reference: first.reference }),
      expect.objectContaining({ stepIndex: 0, reference: second.reference }),
    ]);
  });

  test.each([
    ["missing IDs", ["first"]],
    ["duplicate IDs", ["first", "first"]],
    ["invented IDs", ["first", "invented"]],
    ["non-string IDs", ["first", 2]],
    ["non-array IDs", null],
  ])("rejects authoritative reorder with %s", async (_label, requestedIds) => {
    const { p, v, onMessage, onApply } = setup();
    const steps = [
      { opName: "FromBase64", args: ["first"] },
      { opName: "FromBase64", args: ["second"] },
    ];
    const [firstId] = loadRecipe(p, v, "r", steps);
    const stepIds = Array.isArray(requestedIds)
      ? requestedIds.map((id) => (id === "first" ? firstId : id))
      : requestedIds;

    await onMessage({ type: "reorderSteps", stepIds });
    await onMessage({ type: "apply" });

    expect(onApply).toHaveBeenCalledWith("r", steps, []);
  });

  test("assigns a non-empty selection to a plain string argument", async () => {
    const reference = fakeReference("selected text");
    const { p, v, onMessage, getSelectionReference } = setup(reference.reference);
    const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
    const [stepId] = loadRecipe(p, v, "decode", steps);
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", stepId, arg: 0 });

    expect(getSelectionReference).toHaveBeenCalledTimes(1);
    expect(steps[0].args[0]).toBe("selected text");
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "decode", steps },
      stepIds: [stepId],
      defs: { FromBase64: ARG_DEFS },
      boundArgs: [{ stepId, arg: 0 }],
    });
  });

  test("assigns selection to toggleString while preserving its encoding", async () => {
    const reference = fakeReference("selected key");
    const { p, v, onMessage, getSelectionReference } = setup(reference.reference);
    const steps = [
      {
        opName: "FromBase64",
        args: ["old", { string: "old key", option: "UTF8" }, ""],
      },
    ];
    const [stepId] = loadRecipe(p, v, "decode", steps);
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", stepId, arg: 1 });

    expect(getSelectionReference).toHaveBeenCalledTimes(1);
    expect(steps[0].args[1]).toEqual({
      string: "selected key",
      option: "UTF8",
    });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "decode", steps },
      stepIds: [stepId],
      defs: { FromBase64: ARG_DEFS },
      boundArgs: [{ stepId, arg: 1 }],
    });
  });

  test.each([undefined, ""])(
    "leaves the argument unchanged when selection is %p",
    async (selection) => {
      const reference = selection ? fakeReference(selection).reference : undefined;
      const { p, v, onMessage } = setup(reference);
      const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
      const [stepId] = loadRecipe(p, v, "decode", steps);
      v.webview.postMessage.mockClear();

      await onMessage({ type: "useSelection", stepId, arg: 0 });

      expect(steps[0].args[0]).toBe("old");
      expect(v.webview.postMessage).not.toHaveBeenCalled();
    },
  );

  test.each([
    { stepId: "missing", arg: 0 },
    { stepId: "step-1", arg: 2 },
  ])("ignores invalid or ineligible target $stepId:$arg", async (target) => {
    const reference = fakeReference("selected text");
    const { p, v, onMessage, getSelectionReference } = setup(reference.reference);
    const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
    const [stepId] = loadRecipe(p, v, "decode", steps);
    v.webview.postMessage.mockClear();

    await onMessage({
      type: "useSelection",
      stepId: target.stepId === "missing" ? "missing" : stepId,
      arg: target.arg,
    });

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
      boundArgs: [],
    });
  });

  test("generated IDs skip accepted client IDs and target distinct steps", async () => {
    const first = fakeReference("first-bound");
    const second = fakeReference("second-bound");
    const { p, v, onMessage, onApply, getSelectionReference } = setup(
      first.reference,
    );
    const steps = [{ opName: "FromBase64", args: ["first"] }];
    const [firstId] = loadRecipe(p, v, "r", steps);
    await onMessage({ type: "edit", name: "r", steps, stepIds: [firstId] });
    await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });

    p.addOp({ opName: "FromBase64", args: ["second"] });
    const stepIds = lastPostedState(v).stepIds as string[];
    expect(stepIds).toEqual([firstId, "step-2"]);

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
      boundArgs: [],
    });
  });

  test("apply passes the current recipe name and steps", () => {
    const { p, v, onMessage, onApply } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    loadRecipe(p, v, "decode", steps);
    onMessage({ type: "apply" });
    expect(onApply).toHaveBeenCalledWith("decode", steps, []);
  });

  test("reference changes update the bound plain value", async () => {
    const { p, onMessage, reference, v, setText, fire } =
      setupReference("first");
    const [stepId] = loadRecipe(p, v, "r", [
      { opName: "FromBase64", args: ["old", "", ""] },
    ]);
    await onMessage({ type: "useSelection", stepId, arg: 0 });
    setText("second");
    fire();
    expect(lastPostedState(v).recipe.steps[0].args[0]).toBe("second");
    expect(reference.dispose).not.toHaveBeenCalled();
  });

  test("toggleString reference changes preserve the option", async () => {
    const { p, onMessage, v, setText, fire } = setupReference("key-one");
    const [stepId] = loadRecipe(p, v, "r", [
      {
        opName: "FromBase64",
        args: ["", { string: "old", option: "UTF8" }, ""],
      },
    ]);
    await onMessage({ type: "useSelection", stepId, arg: 1 });
    setText("key-two");
    fire();
    expect(lastPostedState(v).recipe.steps[0].args[1]).toEqual({
      string: "key-two",
      option: "UTF8",
    });
  });

  test("reveals a bound target by stable ID", async () => {
    const { p, v, onMessage, reference } = setupReference("selected");
    const [stepId] = loadRecipe(p, v, "r", [
      { opName: "FromBase64", args: ["old"] },
    ]);
    await onMessage({ type: "useSelection", stepId, arg: 0 });

    await onMessage({ type: "revealSelection", stepId, arg: 0 });

    expect(reference.reveal).toHaveBeenCalledTimes(1);
  });

  test("reveals a bound toggleString by stable ID", async () => {
    const { p, v, onMessage, reference } = setupReference("selected key");
    const [stepId] = loadRecipe(p, v, "r", [
      {
        opName: "FromBase64",
        args: ["", { string: "old key", option: "UTF8" }, ""],
      },
    ]);
    await onMessage({ type: "useSelection", stepId, arg: 1 });

    await onMessage({ type: "revealSelection", stepId, arg: 1 });

    expect(reference.reveal).toHaveBeenCalledTimes(1);
  });

  test("clears one binding while retaining its latest materialized value", async () => {
    const first = fakeReference("first");
    const second = fakeReference("second");
    const { p, v, onMessage, getSelectionReference, onApply } = setup(
      first.reference,
    );
    const [firstId, secondId] = loadRecipe(p, v, "r", [
      { opName: "FromBase64", args: ["old-first"] },
      { opName: "FromBase64", args: ["old-second"] },
    ]);
    await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });
    getSelectionReference.mockReturnValue(second.reference);
    await onMessage({ type: "useSelection", stepId: secondId, arg: 0 });
    first.setText("first-latest");

    await onMessage({ type: "clearSelection", stepId: firstId, arg: 0 });
    await onMessage({ type: "apply" });

    expect(first.reference.dispose).toHaveBeenCalledTimes(1);
    expect(second.reference.dispose).not.toHaveBeenCalled();
    expect(onApply.mock.calls[0][1][0].args[0]).toBe("first-latest");
    expect(lastPostedState(v).boundArgs).toEqual([
      { stepId: secondId, arg: 0 },
    ]);
  });

  test("clears a bound toggleString while preserving its encoding", async () => {
    const { p, v, onMessage, reference, setText, onApply } =
      setupReference("selected key");
    const [stepId] = loadRecipe(p, v, "r", [
      {
        opName: "FromBase64",
        args: ["", { string: "old key", option: "UTF8" }, ""],
      },
    ]);
    await onMessage({ type: "useSelection", stepId, arg: 1 });
    setText("latest key");

    await onMessage({ type: "clearSelection", stepId, arg: 1 });
    await onMessage({ type: "apply" });

    expect(reference.dispose).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][1][0].args[1]).toEqual({
      string: "latest key",
      option: "UTF8",
    });
    expect(lastPostedState(v).boundArgs).toEqual([]);
  });

  test("changing a bound toggle encoding keeps the text reference", async () => {
    const { p, v, onMessage, reference, setText, fire } =
      setupReference("selected");
    const steps = [
      {
        opName: "FromBase64",
        args: ["", { string: "old", option: "Hex" }, ""],
      },
    ];
    const [stepId] = loadRecipe(p, v, "r", steps);
    await onMessage({ type: "useSelection", stepId, arg: 1 });

    await onMessage({
      type: "edit",
      name: "r",
      steps: [
        {
          opName: "FromBase64",
          args: ["", { string: "selected", option: "UTF8" }, ""],
        },
      ],
      stepIds: [stepId],
      editedArg: { stepId, arg: 1, subfield: "option" },
    });
    setText("latest");
    fire();

    expect(lastPostedState(v).recipe.steps[0].args[1]).toEqual({
      string: "latest",
      option: "UTF8",
    });
    expect(reference.dispose).not.toHaveBeenCalled();
  });

  test.each(["revealSelection", "clearSelection"])(
    "ignores %s for invalid or unbound targets",
    async (type) => {
      const { p, v, onMessage, reference } = setupReference("selected");
      const [stepId] = loadRecipe(p, v, "r", [
        { opName: "FromBase64", args: ["old"] },
      ]);
      await onMessage({ type, stepId, arg: 0 });
      await onMessage({ type, stepId: "missing", arg: 0 });
      await onMessage({ type, stepId, arg: 99 });

      expect(reference.reveal).not.toHaveBeenCalled();
      expect(reference.dispose).not.toHaveBeenCalled();
    },
  );

  test("reorder follows step IDs and manual target edits unlink", async () => {
    const { p, v, onMessage, reference, onApply, setText, fire } =
      setupReference("bound");
    const first = { opName: "FromBase64", args: ["first", "", ""] };
    const second = { opName: "FromBase64", args: ["second", "", ""] };
    const [firstId, secondId] = loadRecipe(p, v, "r", [first, second]);
    await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });
    await onMessage({ type: "reorderSteps", stepIds: [secondId, firstId] });
    await onMessage({
      type: "edit",
      name: "r",
      steps: [second, { ...first, args: ["manual", "", ""] }],
      stepIds: [secondId, firstId],
      editedArg: { stepId: firstId, arg: 0 },
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
    const { p, v, onMessage, getSelectionReference } = setup(first.reference);
    const [firstId, secondId] = loadRecipe(p, v, "r", [
      { opName: "FromBase64", args: ["a"] },
      { opName: "FromBase64", args: ["b"] },
    ]);
    await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });
    getSelectionReference.mockReturnValue(second.reference);
    await onMessage({ type: "useSelection", stepId: secondId, arg: 0 });

    await onMessage({ type: "removeStep", stepId: firstId });
    expect(first.reference.dispose).toHaveBeenCalledTimes(1);
    expect(second.reference.dispose).not.toHaveBeenCalled();

    p.load({ name: "loaded", steps: [] });
    expect(second.reference.dispose).toHaveBeenCalledTimes(1);
  });

  test("save receives cloned materialized steps without reference metadata", async () => {
    const { p, v, onMessage, onSave, setText } = setupReference("selected");
    const steps = [{ opName: "FromBase64", args: ["old"] }];
    const [stepId] = loadRecipe(p, v, "r", steps);
    await onMessage({ type: "useSelection", stepId, arg: 0 });
    setText("latest");
    await onMessage({ type: "save" });

    expect(onSave).toHaveBeenCalledWith("r", [
      { opName: "FromBase64", args: ["latest"] },
    ]);
    expect(onSave.mock.calls[0][1]).not.toBe(steps);
    expect(JSON.stringify(onSave.mock.calls[0][1])).not.toContain("reference");
  });

  test("dispose releases all active bindings", async () => {
    const { p, v, onMessage, reference } = setupReference("selected");
    const [stepId] = loadRecipe(p, v, "r", [
      { opName: "FromBase64", args: ["old"] },
    ]);
    await onMessage({ type: "useSelection", stepId, arg: 0 });

    p.dispose();

    expect(reference.dispose).toHaveBeenCalledTimes(1);
  });
});
