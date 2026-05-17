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
import { Utils } from "../Utils";
import { fromBase64, toBase64 } from "../lib/Base64";
import { OperationError } from "../errors/OperationError";

export class ShowBase64Offsets extends Operation {
    constructor() {
        super();
        this.name = "Show Base64 offsets";
        this.module = "Default";
        this.description =
            "When a string is within a block of data and the whole block is Base64'd, the string itself could be represented in Base64 in three distinct ways depending on its offset within the block.";
        this.infoURL = "https://wikipedia.org/wiki/Base64#Output_padding";
        this.inputType = "byteArray";
        this.outputType = "html";
        this.args = [
            { name: "Alphabet", type: "binaryString", value: "A-Za-z0-9+/=" },
            { name: "Show variable chars and padding", type: "boolean", value: true },
            { name: "Input format", type: "option", value: ["Raw", "Base64"] },
        ];
    }

    run(input: number[], args: unknown[]): string {
        const [alphabet, showVariable, fmt] = args as [string, boolean, string];

        if (fmt === "Base64") {
            input = fromBase64(Utils.byteArrayToUtf8(input), undefined, "byteArray") as number[];
        }

        if (input.length < 1) {
            throw new OperationError("Please enter a string.");
        }

        const offset0 = toBase64(input, alphabet);
        const offset1 = toBase64([0].concat(input), alphabet);
        const offset2 = toBase64([0, 0].concat(input), alphabet);

        const len0 = offset0.indexOf("=");
        const len1 = offset1.indexOf("=");
        const len2 = offset2.indexOf("=");

        let out0 = "";
        let out1 = "";
        let out2 = "";

        if (!showVariable) {
            out0 = Utils.escapeHtml(len0 % 4 === 2 ? offset0.slice(0, -3) : len0 % 4 === 3 ? offset0.slice(0, -2) : offset0);
            out1 = Utils.escapeHtml(len1 % 4 === 2 ? offset1.slice(2, -3) : len1 % 4 === 3 ? offset1.slice(2, -2) : offset1.slice(2));
            out2 = Utils.escapeHtml(len2 % 4 === 2 ? offset2.slice(3, -3) : len2 % 4 === 3 ? offset2.slice(3, -2) : offset2.slice(3));
        } else {
            out0 = Utils.escapeHtml(offset0);
            out1 = Utils.escapeHtml(offset1);
            out2 = Utils.escapeHtml(offset2);
        }

        return `Offset 0: ${out0}\nOffset 1: ${out1}\nOffset 2: ${out2}`;
    }
}

export default ShowBase64Offsets;
