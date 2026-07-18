import { createPipelineResultSource } from "../../src/commands/resultSource";
import { runPipeline } from "../../src/commands/runner";

jest.mock("../../src/commands/runner", () => ({
  runPipeline: jest.fn(() => "UPDATED"),
}));

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
