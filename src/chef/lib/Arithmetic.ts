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

import { Utils } from "../Utils";
import BigNumber from "bignumber.js";

export function createNumArray(input: string, delim: string): BigNumber[] {
    const sep = Utils.charRep(delim || "Space");
    const numbers: BigNumber[] = [];
    for (const token of input.split(sep)) {
        try {
            const num = new BigNumber(token.trim());
            if (!num.isNaN()) numbers.push(num);
        } catch {
            // skip invalid
        }
    }
    return numbers;
}

export function sum(data: BigNumber[]): BigNumber | undefined {
    if (data.length > 0) return data.reduce((a, c) => a.plus(c));
}

export function sub(data: BigNumber[]): BigNumber | undefined {
    if (data.length > 0) return data.reduce((a, c) => a.minus(c));
}

export function multi(data: BigNumber[]): BigNumber | undefined {
    if (data.length > 0) return data.reduce((a, c) => a.times(c));
}

export function div(data: BigNumber[]): BigNumber | undefined {
    if (data.length > 0) return data.reduce((a, c) => a.div(c));
}

export function mean(data: BigNumber[]): BigNumber | undefined {
    if (data.length > 0) return sum(data)!.div(data.length);
}

export function median(data: BigNumber[]): BigNumber | undefined {
    if (data.length === 0) return undefined;
    if (data.length % 2 === 0) {
        const sorted = [...data].sort((a, b) => a.minus(b).toNumber());
        const first = sorted[Math.floor(sorted.length / 2)];
        const second = sorted[Math.floor(sorted.length / 2) - 1];
        return mean([first, second]);
    }
    return data[Math.floor(data.length / 2)];
}

export function stdDev(data: BigNumber[]): BigNumber | undefined {
    if (data.length > 0) {
        const avg = mean(data)!;
        let devSum = new BigNumber(0);
        for (const d of data) {
            devSum = devSum.plus(d.minus(avg).pow(2));
        }
        return devSum.div(data.length).sqrt();
    }
}
