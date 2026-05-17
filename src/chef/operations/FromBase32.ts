import { Operation } from "../Operation";
import { B32_ALPHA, B32HEX_ALPHA } from "./ToBase32";
import OperationError from "../errors/OperationError";

export class FromBase32 extends Operation {
    constructor() {
        super();
        this.name = "From Base32";
        this.module = "Default";
        this.description =
            "Base32 decodes data from a Base32-encoded string back to its raw format.";
        this.infoURL = "https://wikipedia.org/wiki/Base32";
        this.inputType = "string";
        this.outputType = "byteArray";
        this.args = [
            { name: "Alphabet", type: "editableOption", value: [
                { name: "RFC 4648: A-Z 2-7", value: B32_ALPHA },
                { name: "Extended hex: 0-9 A-V", value: B32HEX_ALPHA },
            ]},
            { name: "Padding character", type: "string", value: "=" },
            { name: "Remove non-alphabet chars", type: "boolean", value: true },
        ];
        this.checks = [
            {
                pattern: "^(?:[A-Z2-7]{8})+(?:[A-Z2-7]{2}={6}|[A-Z2-7]{4}={4}|[A-Z2-7]{5}={3}|[A-Z2-7]{7}=)?$",
                flags: "",
                args: [B32_ALPHA, "=", true],
            },
        ];
    }

    run(input: string, args: unknown[]): number[] {
        const alphabet = (args[0] as string) || B32_ALPHA;
        const padChar = (args[1] as string) || "=";
        const removeNonAlpha = args[2] as boolean ?? true;

        // Build lookup map
        const map = new Map<string, number>();
        const expanded = alphabet.length > 32
            ? alphabet
            : alphabet;
        for (let i = 0; i < expanded.length; i++) map.set(expanded[i], i);

        let cleaned = input.toUpperCase().replace(new RegExp(`[${padChar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`, "g"), "");
        if (removeNonAlpha) {
            cleaned = cleaned.split("").filter(c => map.has(c)).join("");
        }

        if (cleaned.length === 0) throw new OperationError("No valid Base32 characters found in input.");

        const bytes: number[] = [];
        let buffer = 0;
        let bitsLeft = 0;

        for (const ch of cleaned) {
            const val = map.get(ch);
            if (val === undefined) throw new OperationError(`Invalid Base32 character: '${ch}'`);
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                bitsLeft -= 8;
                bytes.push((buffer >> bitsLeft) & 0xff);
            }
        }

        return bytes;
    }
}

export default FromBase32;
