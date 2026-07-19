import type {
  PipelineArgReference,
  PipelineResultSource,
} from "./pipelineResult";
import { runPipeline } from "./runner";
import type { PipelineStep } from "../storage/store";

export function createPipelineResultSource(
  name: string,
  steps: PipelineStep[],
  references: PipelineArgReference[] = [],
): PipelineResultSource {
  const recipe = { name, steps: structuredClone(steps) };
  const runtimeReferences = references.map((binding) => ({
    ...binding,
    reference: binding.reference.clone(),
  }));
  const materialize = (): PipelineStep[] => {
    const next = structuredClone(recipe.steps);
    for (const binding of runtimeReferences) {
      const step = next[binding.stepIndex];
      if (!step || !Array.isArray(step.args)) continue;
      if (binding.type === "toggleString") {
        const current = step.args[binding.argIndex] as
          | { option?: unknown }
          | undefined;
        step.args[binding.argIndex] = {
          string: binding.reference.text,
          option: current?.option,
        };
      } else {
        step.args[binding.argIndex] = binding.reference.text;
      }
    }
    return next;
  };
  return {
    recipe,
    references: runtimeReferences,
    evaluate: (input) => runPipeline(input, materialize()),
    dispose: () => {
      for (const binding of runtimeReferences) binding.reference.dispose();
    },
  };
}
