import { operationNeedsInput } from "../../src/commands/runner";
import type { Operation } from "../../src/chef/Operation";

function op(args: unknown[]): Operation {
  return { args } as unknown as Operation;
}

describe("operationNeedsInput", () => {
  test("true when a toggleString arg has an empty value", () => {
    expect(operationNeedsInput(op([{ type: "toggleString", value: "" }]))).toBe(
      true,
    );
  });

  test("false when the toggleString arg has a value", () => {
    expect(
      operationNeedsInput(op([{ type: "toggleString", value: "Hex" }])),
    ).toBe(false);
  });

  test("false when there are no args", () => {
    expect(operationNeedsInput(op([]))).toBe(false);
  });
});
