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

import { Operation } from "../Operation";
import OperationError from "../errors/OperationError";

const BASE45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

export class FromBase45 extends Operation {
    constructor() {
        super();
        this.name = "From Base45";
        this.module = "Default";
        this.description =
            "Base45 decodes data encoded in Base45 format (used in EU Digital COVID Certificate).";
        this.infoURL = "https://datatracker.ietf.org/doc/draft-faltstrom-base45/";
        this.inputType = "string";
        this.outputType = "byteArray";
        this.args = [
            { name: "Alphabet", type: "string", value: BASE45_ALPHABET },
        ];
    }

    run(input: string, args: unknown[]): number[] {
        const alphabet = (args[0] as string) || BASE45_ALPHABET;
        const map = new Map<string, number>();
        for (let i = 0; i < alphabet.length; i++) map.set(alphabet[i], i);

        const bytes: number[] = [];

        for (let i = 0; i < input.length; ) {
            const c = map.get(input[i]);
            if (c === undefined) throw new OperationError(`Invalid Base45 character: '${input[i]}'`);

            if (i + 2 < input.length) {
                const d = map.get(input[i + 1]);
                const e = map.get(input[i + 2]);
                if (d === undefined) throw new OperationError(`Invalid Base45 character: '${input[i + 1]}'`);
                if (e === undefined) throw new OperationError(`Invalid Base45 character: '${input[i + 2]}'`);
                const n = c + d * 45 + e * 45 * 45;
                if (n > 0xffff) throw new OperationError(`Base45 value out of range at position ${i}: ${n}`);
                bytes.push((n >> 8) & 0xff, n & 0xff);
                i += 3;
            } else if (i + 1 < input.length) {
                const d = map.get(input[i + 1]);
                if (d === undefined) throw new OperationError(`Invalid Base45 character: '${input[i + 1]}'`);
                const n = c + d * 45;
                if (n > 0xff) throw new OperationError(`Base45 value out of range at position ${i}: ${n}`);
                bytes.push(n & 0xff);
                i += 2;
            } else {
                throw new OperationError("Input length is not valid for Base45 (must encode 2 or 3 chars per group).");
            }
        }

        return bytes;
    }
}

export default FromBase45;
