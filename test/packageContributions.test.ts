import pkg from "../package.json";

describe("package contributions", () => {
  test("does not contribute the standalone pipeline editor command", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);

    expect(commands).not.toContain("tschef.openPipelineEditor");
    expect(commands).toContain("tschef.runPipeline");
    expect(commands).toContain("tschef.runSavedPipelinePicker");
  });
});
