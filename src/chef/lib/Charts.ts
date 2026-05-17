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

import OperationError from "../errors/OperationError";
import Utils from "../Utils";

/**
 * @constant
 * @default
 */
export const RECORD_DELIMITER_OPTIONS: string[] = ["Line feed", "CRLF"];


/**
 * @constant
 * @default
 */
export const FIELD_DELIMITER_OPTIONS: string[] = ["Space", "Comma", "Semi-colon", "Colon", "Tab"];


/**
 * Default from colour
 *
 * @constant
 * @default
 */
export const COLOURS: { min: string, max: string } = {
    min: "white",
    max: "black"
};


/**
 * Gets values from input for a plot.
 */
export function getValues(input: string, recordDelimiter: string, fieldDelimiter: string, columnHeadingsAreIncluded: boolean, length: number): { headings?: string[], values: string[][] } {
    let headings: string[] | undefined;
    const values: string[][] = [];

    input
        .split(recordDelimiter)
        .forEach((row, rowIndex) => {
            if (row === "") return;
            const split = row.split(fieldDelimiter);
            if (split.length !== length) throw new OperationError(`Each row must have length ${length}.`);

            if (columnHeadingsAreIncluded && rowIndex === 0) {
                headings = split;
            } else {
                values.push(split);
            }
        });
    return { headings, values };
}


/**
 * Gets values from input for a scatter plot.
 */
export function getScatterValues(input: string, recordDelimiter: string, fieldDelimiter: string, columnHeadingsAreIncluded: boolean): { headings?: { x: string, y: string }, values: number[][] } {
    let { headings, values } = getValues(
        input,
        recordDelimiter,
        fieldDelimiter,
        columnHeadingsAreIncluded,
        2
    );

    let typedHeadings: { x: string, y: string } | undefined;
    if (headings) {
        typedHeadings = { x: headings[0], y: headings[1] };
    }

    const typedValues = values.map(row => {
        const x = parseFloat(row[0]),
            y = parseFloat(row[1]);

        if (Number.isNaN(x)) throw new OperationError("Values must be numbers in base 10.");
        if (Number.isNaN(y)) throw new OperationError("Values must be numbers in base 10.");

        return [x, y];
    });

    return { headings: typedHeadings, values: typedValues };
}


/**
 * Gets values from input for a scatter plot with colour from the third column.
 */
export function getScatterValuesWithColour(input: string, recordDelimiter: string, fieldDelimiter: string, columnHeadingsAreIncluded: boolean): { headings?: { x: string, y: string }, values: (number | string)[][] } {
    let { headings, values } = getValues(
        input,
        recordDelimiter, fieldDelimiter,
        columnHeadingsAreIncluded,
        3
    );

    let typedHeadings: { x: string, y: string } | undefined;
    if (headings) {
        typedHeadings = { x: headings[0], y: headings[1] };
    }

    const typedValues = values.map(row => {
        const x = parseFloat(row[0]),
            y = parseFloat(row[1]),
            colour = row[2];

        if (Number.isNaN(x)) throw new OperationError("Values must be numbers in base 10.");
        if (Number.isNaN(y)) throw new OperationError("Values must be numbers in base 10.");

        return [x, y, Utils.escapeHtml(colour)];
    });

    return { headings: typedHeadings, values: typedValues };
}

/**
 * Gets values from input for a time series plot.
 */
export function getSeriesValues(input: string, recordDelimiter: string, fieldDelimiter: string, columnHeadingsAreIncluded: boolean): { xValues: string[], series: { name: string, data: { [key: string]: number } }[] } {
    const { values } = getValues(
        input,
        recordDelimiter, fieldDelimiter,
        false,
        3
    );

    let xValuesSet = new Set<string>();
    const series: { [serie: string]: { [xVal: string]: number } } = {};

    values.forEach(row => {
        const serie = row[0],
            xVal = row[1],
            val = parseFloat(row[2]);

        if (Number.isNaN(val)) throw new OperationError("Values must be numbers in base 10.");

        xValuesSet.add(xVal);
        if (typeof series[serie] === "undefined") series[serie] = {};
        series[serie][xVal] = val;
    });

    const xValues = Array.from(xValuesSet);

    const seriesList: { name: string, data: { [key: string]: number } }[] = [];
    for (const seriesName in series) {
        const serie = series[seriesName];
        seriesList.push({ name: seriesName, data: serie });
    }

    return { xValues, series: seriesList };
}
