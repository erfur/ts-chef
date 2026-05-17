import Dish from "./Dish";
import { Operation } from "./Operation";

interface OpListItem {
    name: string;
    module?: string;
    ingValues: unknown[];
    breakpoint?: boolean;
    disabled?: boolean;
    inputType?: string;
    outputType?: string;
    flowControl?: boolean;
    op?: Operation;
}

interface RecipeState {
    progress: number;
    dish: Dish;
    opList: OpListItem[];
    forkOffset?: number;
}

class Recipe {
    opList: OpListItem[] = [];

    constructor(recipeConfig?: Array<{ op: string; args: unknown[]; breakpoint?: boolean; disabled?: boolean }>) {
        if (recipeConfig) {
            recipeConfig.forEach(c => {
                this.opList.push({
                    name: c.op,
                    ingValues: c.args,
                    breakpoint: c.breakpoint,
                    disabled: c.disabled || c.op === "Comment",
                });
            });
        }
    }

    addOperations(ops: OpListItem[]): void {
        this.opList = this.opList.concat(ops);
    }

    async execute(dish: Dish, startProgress = 0, state?: Partial<RecipeState>): Promise<number> {
        let progress = startProgress;
        const opList = this.opList;

        for (let i = progress; i < opList.length; i++) {
            const item = opList[i];
            if (item.disabled) continue;
            if (!item.op) continue;

            try {
                if (item.flowControl) {
                    const currentState: RecipeState = {
                        progress: i,
                        dish,
                        opList,
                        forkOffset: state?.forkOffset ?? 0,
                        ...state,
                    };
                    const result = await item.op.run(currentState, item.ingValues as string[]);
                    if (result && typeof result === "object" && "progress" in result) {
                        i = (result as RecipeState).progress;
                    }
                } else {
                    const input = await dish.get(item.inputType ?? "string");
                    const output = await item.op.run(input, item.ingValues as string[]);
                    dish.set(output, dish.type);
                }
                progress = i;
            } catch (err) {
                throw Object.assign(err instanceof Error ? err : new Error(String(err)), { progress: i });
            }
        }
        return progress;
    }
}

export default Recipe;
