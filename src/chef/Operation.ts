/**
 * @fileoverview Base class and types for all CyberChef-style operations.
 * Ported from GCHQ's CyberChef.
 * 
 * @license Apache-2.0
 * @author Michael Weiss
 */

/**
 * Configuration for an operation argument.
 */
export interface ArgConfig {
    /** The display name of the argument. */
    name: string;
    /** The type of the argument (e.g., 'string', 'number', 'option'). */
    type: string;
    /** The default or current value of the argument. */
    value: unknown;
    /** Optional values for 'option' type arguments. */
    toggleValues?: string[];
    /** A hint or tooltip for the argument. */
    hint?: string;
    /** Number of rows for textarea-like arguments. */
    rows?: number;
    /** Whether the argument is disabled. */
    disabled?: boolean;
    /** Target indices for dynamic arguments. */
    target?: number | number[];
    /** Default index for selection-based arguments. */
    defaultIndex?: number;
    /** Maximum length for string arguments. */
    maxLength?: number;
    /** Minimum value for numeric arguments. */
    min?: number;
    /** Maximum value for numeric arguments. */
    max?: number;
    /** Step value for numeric arguments. */
    step?: number;
}

/** Represents a position range for highlighting. */
export type HighlightPos = Array<{ start: number; end: number }>;
/** Result of a highlighting operation. */
export type HighlightResult = HighlightPos | false;

/** Type alias for any input data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInput = any;

/**
 * Base class for all operations in ts-chef.
 * Each operation defines its metadata and implementation for data transformation.
 */
export abstract class Operation {
    /** Internal name of the operation. */
    name: string = "";
    /** Category or module the operation belongs to. */
    module: string = "";
    /** Human-readable description of what the operation does. */
    description: string = "";
    /** Optional URL for more information about the operation or algorithm. */
    infoURL: string | null = null;
    /** Expected input data type. */
    inputType: string = "string";
    /** Expected output data type. */
    outputType: string = "string";
    /** Type for presentation purposes. */
    presentType: string = "string";
    /** Whether the operation supports flow control. */
    flowControl: boolean = false;
    /** Whether the operation requires manual triggering. */
    manualBake: boolean = false;
    /** List of arguments the operation accepts. */
    args: ArgConfig[] = [];
    /** Patterns and flags for automatic detection. */
    checks?: Array<{ pattern: string; flags: string; args: unknown[] }>;

    /**
     * Executes the operation.
     * 
     * @param input - The data to process.
     * @param args - The arguments for the operation.
     * @returns The processed data.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abstract run(input: AnyInput, args: any[]): AnyInput;

    /**
     * Formats the output data for presentation.
     * 
     * @param data - The output data from the run method.
     * @param _args - The arguments used.
     * @returns The formatted presentation data.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    present(data: AnyInput, _args: any[]): AnyInput {
        return data;
    }

    /**
     * Calculates highlight ranges based on input selection.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    highlight(_pos: HighlightPos, _args: any[]): HighlightResult {
        return false;
    }

    /**
     * Calculates highlight ranges in the input based on output selection.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    highlightReverse(_pos: HighlightPos, _args: any[]): HighlightResult {
        return false;
    }
}

export default Operation;
