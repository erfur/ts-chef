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

interface BaconAlphabetDef {
    alphabet: string;
    codes?: number[];
}

export const BACON_ALPHABETS: Record<string, BaconAlphabetDef> = {
    "Standard (I=J and U=V)": {
        alphabet: "ABCDEFGHIKLMNOPQRSTUWXYZ",
        codes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 23],
    },
    Complete: {
        alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    },
};

export const BACON_TRANSLATION_01 = "0/1";
export const BACON_TRANSLATION_AB = "A/B";
export const BACON_TRANSLATION_CASE = "Case";
export const BACON_TRANSLATION_AMNZ = "A-M/N-Z first letter";

export const BACON_TRANSLATIONS = [
    BACON_TRANSLATION_01,
    BACON_TRANSLATION_AB,
    BACON_TRANSLATION_CASE,
    BACON_TRANSLATION_AMNZ,
];

export const BACON_TRANSLATIONS_FOR_ENCODING = [BACON_TRANSLATION_01, BACON_TRANSLATION_AB];

export const BACON_CLEARER_MAP: Record<string, RegExp> = {
    [BACON_TRANSLATION_01]: /[^01]/g,
    [BACON_TRANSLATION_AB]: /[^ABab]/g,
    [BACON_TRANSLATION_CASE]: /[^A-Za-z]/g,
};

export const BACON_NORMALIZE_MAP: Record<string, Record<string, string>> = {
    [BACON_TRANSLATION_AB]: {
        A: "0",
        B: "1",
        a: "0",
        b: "1",
    },
};

export function swapZeroAndOne(string: string): string {
    return string.replace(/[01]/g, (c) => (c === "0" ? "1" : "0"));
}
