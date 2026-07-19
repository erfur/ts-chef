import { createPipelineResultSource } from "../../src/commands/resultSource";
import { runPipeline } from "../../src/commands/runner";
import type { SelectionReference } from "../../src/commands/selectionReference";
import { EventEmitter } from "../vscode-mock";

jest.mock("../../src/commands/runner", () => ({
  runPipeline: jest.fn(() => "UPDATED"),
}));

function fakeReference(initial: string) {
  const state = { text: initial };
  const clones: SelectionReference[] = [];
  const make = (): SelectionReference => {
    const emitter = new EventEmitter<void>();
    const reference: SelectionReference = {
      get text() {
        return state.text;
      },
      onDidChange: emitter.event,
      clone: () => {
        const clone = make();
        clones.push(clone);
        return clone;
      },
      dispose: jest.fn(() => emitter.dispose()),
    };
    return reference;
  };
  return {
    reference: make(),
    clones,
    setText: (text: string) => {
      state.text = text;
    },
  };
}

test("captures immutable pipeline steps and evaluates with the snapshot", () => {
  const steps = [{ opName: "ROT13", args: [] }];
  const source = createPipelineResultSource("decode", steps);
  steps[0].opName = "MD5";

  expect(source.recipe).toEqual({
    name: "decode",
    steps: [{ opName: "ROT13", args: [] }],
  });
  expect(source.evaluate("input")).toBe("UPDATED");
  expect(runPipeline).toHaveBeenCalledWith("input", source.recipe.steps);
});

test("materializes current string and toggleString references for every evaluation", () => {
  const stringRef = fakeReference("first");
  const toggleRef = fakeReference("key-one");
  const source = createPipelineResultSource(
    "decode",
    [
      {
        opName: "Test",
        args: ["old", { string: "old-key", option: "UTF8" }],
      },
    ],
    [
      {
        stepIndex: 0,
        argIndex: 0,
        type: "string",
        reference: stringRef.reference,
      },
      {
        stepIndex: 0,
        argIndex: 1,
        type: "toggleString",
        reference: toggleRef.reference,
      },
    ],
  );

  source.evaluate("input");
  stringRef.setText("second");
  toggleRef.setText("key-two");
  source.evaluate("input");

  expect(runPipeline).toHaveBeenLastCalledWith("input", [
    {
      opName: "Test",
      args: ["second", { string: "key-two", option: "UTF8" }],
    },
  ]);
});

test("keeps reference metadata outside the serializable recipe and disposes clones", () => {
  const reference = fakeReference("selected");
  const source = createPipelineResultSource(
    "decode",
    [{ opName: "Test", args: ["selected"] }],
    [
      {
        stepIndex: 0,
        argIndex: 0,
        type: "string",
        reference: reference.reference,
      },
    ],
  );
  expect(source.recipe).toEqual({
    name: "decode",
    steps: [{ opName: "Test", args: ["selected"] }],
  });
  expect(JSON.stringify(source.recipe)).not.toContain("stepIndex");
  source.dispose?.();
  expect(source.references![0].reference.dispose).toHaveBeenCalledTimes(1);
});
