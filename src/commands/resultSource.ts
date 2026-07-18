import type { PipelineResultSource } from "./pipelineResult";
import { runPipeline } from "./runner";
import type { PipelineStep } from "../storage/store";

export function createPipelineResultSource(
  name: string,
  steps: PipelineStep[],
): PipelineResultSource {
  const recipe = { name, steps: structuredClone(steps) };
  return {
    recipe,
    evaluate: (input) => runPipeline(input, recipe.steps),
  };
}
