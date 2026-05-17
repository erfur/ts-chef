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

export const BITWISE_OP_DELIMS = ["Hex", "Decimal", "Binary", "Base64", "UTF8", "Latin1"];

export function bitOp(
    input: number[],
    key: number[] | null,
    func: (operand: number, key: number) => number,
    nullPreserving: boolean = false,
    scheme: string = "Standard"
): number[] {
    if (!key || !key.length) key = [0];
    const result: number[] = [];
    const keyCopy = [...key];

    for (let i = 0; i < input.length; i++) {
        const k = scheme === "Cascade" ? input[i + 1] || 0 : keyCopy[i % keyCopy.length];
        const o = input[i];
        const x =
            nullPreserving && (o === 0 || o === k) ? o : func(o, k);
        result.push(x);
        if (scheme && scheme !== "Standard" && !(nullPreserving && (o === 0 || o === k))) {
            switch (scheme) {
                case "Input differential":
                    keyCopy[i % keyCopy.length] = o;
                    break;
                case "Output differential":
                    keyCopy[i % keyCopy.length] = x;
                    break;
            }
        }
    }

    return result;
}

export function xor(operand: number, key: number): number {
    return operand ^ key;
}

export function not(operand: number, _key: number): number {
    return ~operand & 0xff;
}

export function and(operand: number, key: number): number {
    return operand & key;
}

export function or(operand: number, key: number): number {
    return operand | key;
}

export function add(operand: number, key: number): number {
    return (operand + key) % 256;
}

export function sub(operand: number, key: number): number {
    const result = operand - key;
    return result < 0 ? 256 + result : result;
}
