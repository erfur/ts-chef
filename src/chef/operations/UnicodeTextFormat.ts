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

const FORMAT_MAP: Record<string, [number, number]> = {
    "Bold": [0x1D400, 0x1D41A],
    "Italic": [0x1D434, 0x1D44E],
    "Bold Italic": [0x1D468, 0x1D482],
    "Script": [0x1D49C, 0x1D4B6],
    "Fraktur": [0x1D504, 0x1D51E],
    "Double-struck": [0x1D538, 0x1D552],
    "Sans-serif": [0x1D5A0, 0x1D5BA],
    "Sans-serif Bold": [0x1D5D4, 0x1D5EE],
    "Sans-serif Italic": [0x1D608, 0x1D622],
    "Sans-serif Bold Italic": [0x1D63C, 0x1D656],
    "Monospace": [0x1D670, 0x1D68A],
};

export class UnicodeTextFormat extends Operation {
    constructor() {
        super();
        this.name = "Unicode Text Format";
        this.module = "Default";
        this.description =
            "Formats text using Unicode lookalike characters (bold, italic, etc).";
        this.inputType = "string";
        this.outputType = "string";
        this.args = [
            { name: "Format", type: "option", value: Object.keys(FORMAT_MAP) },
        ];
    }

    run(input: string, args: unknown[]): string {
        const format = args[0] as string;
        const [upperStart, lowerStart] = FORMAT_MAP[format] ?? FORMAT_MAP["Bold"];
        return Array.from(input).map(ch => {
            const cp = ch.codePointAt(0)!;
            if (cp >= 65 && cp <= 90) return String.fromCodePoint(upperStart + (cp - 65));
            if (cp >= 97 && cp <= 122) return String.fromCodePoint(lowerStart + (cp - 97));
            return ch;
        }).join("");
    }
}

export default UnicodeTextFormat;
