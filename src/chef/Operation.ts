/*
 * -----------------------------------------------------------------------------
 * Project:     ts-chef
 * Model:       Qwen 3.5 Coder Next (Local)
 * Version:     1.0.0
 * Author:      Michael Weiss
 * Source:      Ported from GCHQ's CyberChef (JavaScript)
 * License:     Apache License 2.0
 * Description: TypeScript implementation of CyberChef modules.
 * Note:        First Port done by Local Model, Cleanup and fixes by Author
 * -----------------------------------------------------------------------------
 */

export interface ArgConfig {
    name: string;
    type: string;
    value: unknown;
    toggleValues?: string[];
    hint?: string;
    rows?: number;
    disabled?: boolean;
    target?: number | number[];
    defaultIndex?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    step?: number;
}

export type HighlightPos = Array<{ start: number; end: number }>;
export type HighlightResult = HighlightPos | false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInput = any;

export abstract class Operation {
    name: string = "";
    module: string = "";
    description: string = "";
    infoURL: string | null = null;
    inputType: string = "string";
    outputType: string = "string";
    presentType: string = "string";
    flowControl: boolean = false;
    manualBake: boolean = false;
    args: ArgConfig[] = [];
    checks?: Array<{ pattern: string; flags: string; args: unknown[] }>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abstract run(input: AnyInput, args: any[]): AnyInput;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    present(data: AnyInput, _args: any[]): AnyInput {
        return data;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    highlight(_pos: HighlightPos, _args: any[]): HighlightResult {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    highlightReverse(_pos: HighlightPos, _args: any[]): HighlightResult {
        return false;
    }
}

export default Operation;
