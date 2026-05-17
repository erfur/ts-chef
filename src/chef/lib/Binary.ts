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
import { OperationError } from "../errors/OperationError";

export function toBinary(
    data: number[] | Uint8Array | number,
    delim: string = "Space",
    padding: number = 8
): string {
    if (data === undefined || data === null)
        throw new OperationError(
            "Unable to convert to binary: Empty input data encountered"
        );

    const delimStr = Utils.charRep(delim);

    if (typeof data === "number") {
        return data.toString(2).padStart(padding, "0");
    }

    const arr = data instanceof Uint8Array ? Array.from(data) : (data as number[]);
    if (!arr.length) return "";

    return arr
        .map((b) => b.toString(2).padStart(padding, "0"))
        .join(delimStr);
}

export function fromBinary(data: string, delim?: string, byteLen: number = 8): number[] {
    if (!data) return [];

    let parts: string[];
    if (delim && delim !== "None") {
        parts = data.split(Utils.charRep(delim));
    } else {
        // Auto split by any non-binary chars or chunk by byteLen
        parts = data.replace(/\s+/g, " ").trim().split(/\s+|,|;|:/);
        if (parts.length === 1 && parts[0].length > byteLen) {
            const raw = parts[0];
            parts = [];
            for (let i = 0; i < raw.length; i += byteLen) {
                parts.push(raw.slice(i, i + byteLen));
            }
        }
    }

    return parts.filter((p) => p.length > 0).map((p) => parseInt(p, 2));
}
