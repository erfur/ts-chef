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

import { Utils } from "./Utils";
import { fromHex } from "./lib/Hex";
import { OperationError } from "./errors/OperationError";
import { ArgConfig } from "./Operation";

/**
 * The arguments to operations.
 */
export class Ingredient {
    name: string = "";
    type: string = "";
    private _value: any = null;
    disabled: boolean = false;
    hint: string | boolean = "";
    rows: number | boolean = 0;
    toggleValues: string[] = [];
    target: number | number[] | null = null;
    defaultIndex: number = 0;
    maxLength: number | null = null;
    min: number | null = null;
    max: number | null = null;
    step: number = 1;
    defaultValue: any;

    /**
     * Ingredient constructor
     *
     * @param {ArgConfig} [ingredientConfig]
     */
    constructor(ingredientConfig?: ArgConfig) {
        if (ingredientConfig) {
            this._parseConfig(ingredientConfig);
        }
    }

    /**
     * Reads and parses the given config.
     *
     * @private
     * @param {ArgConfig} ingredientConfig
     */
    private _parseConfig(ingredientConfig: ArgConfig): void {
        this.name = ingredientConfig.name;
        this.type = ingredientConfig.type;
        this.defaultValue = ingredientConfig.value;
        this.disabled = !!ingredientConfig.disabled;
        this.hint = ingredientConfig.hint || false;
        this.rows = ingredientConfig.rows || false;
        this.toggleValues = ingredientConfig.toggleValues || [];
        this.target = typeof ingredientConfig.target !== "undefined" ? ingredientConfig.target : null;
        this.defaultIndex = typeof ingredientConfig.defaultIndex !== "undefined" ? ingredientConfig.defaultIndex : 0;
        this.maxLength = ingredientConfig.maxLength || null;
        this.min = typeof ingredientConfig.min !== "undefined" ? ingredientConfig.min : null;
        this.max = typeof ingredientConfig.max !== "undefined" ? ingredientConfig.max : null;
        this.step = typeof ingredientConfig.step !== "undefined" ? ingredientConfig.step : 1;
    }

    /**
     * Returns the value of the Ingredient as it should be displayed in a recipe config.
     *
     * @returns {*}
     */
    get config(): any {
        return this._value;
    }

    /**
     * Sets the value of the Ingredient.
     *
     * @param {*} value
     */
    set value(value: any) {
        this._value = Ingredient.prepare(value, this.type);
    }

    /**
     * Gets the value of the Ingredient.
     *
     * @returns {*}
     */
    get value(): any {
        return this._value;
    }

    /**
     * Most values will be strings when they are entered. This function converts them to the correct
     * type.
     *
     * @param {*} data
     * @param {string} type - The name of the data type.
    */
    static prepare(data: any, type: string): any {
        let number: number;

        switch (type) {
            case "binaryString":
            case "binaryShortString":
            case "editableOption":
            case "editableOptionShort":
                return typeof data === "string" ? Utils.parseEscapedChars(data) : data;
            case "byteArray":
                if (typeof data === "string") {
                    data = data.replace(/\s+/g, "");
                    return fromHex(data);
                } else {
                    return data;
                }
            case "number":
                if (data === null) return data;
                number = parseFloat(data);
                if (isNaN(number)) {
                    const sample = Utils.truncate(data.toString(), 10);
                    throw new OperationError(
                        "Invalid ingredient value. Not a number: " + sample,
                    );
                }
                return number;
            default:
                return data;
        }
    }
}

export default Ingredient;
