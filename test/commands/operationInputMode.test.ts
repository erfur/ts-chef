import { Operation } from "../../src/chef/Operation";
import { GenerateLoremIpsum } from "../../src/chef/operations/GenerateLoremIpsum";
import { GenerateUUID } from "../../src/chef/operations/GenerateUUID";

class DefaultInputOperation extends Operation {
  run(input: string): string {
    return input;
  }
}

describe("operation input modes", () => {
  test("operations require input by default", () => {
    expect(new DefaultInputOperation().inputMode).toBe("required");
  });

  test("input-independent generators declare no input", () => {
    expect(new GenerateLoremIpsum().inputMode).toBe("none");
  });

  test("generators that can consume input declare optional input", () => {
    expect(new GenerateUUID().inputMode).toBe("optional");
  });
});
