const fs = require("fs");
const path = require("path");

const HEADER = `/*
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
 */\n\n`;

function portOperation(opName) {
    const srcPath = path.resolve(__dirname, `../../CyberChef/src/core/operations/${opName}.mjs`);
    const destPath = path.resolve(__dirname, `../src/chef/operations/${opName}.ts`);

    if (!fs.existsSync(srcPath)) {
        console.error(`Source not found: ${srcPath}`);
        return;
    }

    let content = fs.readFileSync(srcPath, "utf-8");

    // Remove original header
    content = content.replace(/\/\*\*[\s\S]*?\*\/\n/, "");

    // Add new header
    content = HEADER + content.trim();

    // Replace imports
    content = content.replace(/import Operation from "\.\.\/Operation\.mjs";/g, 'import { Operation } from "../Operation";');
    content = content.replace(/import (.*?) from "(.*?)\.mjs";/g, 'import $1 from "$2";');
    content = content.replace(/import Utils from "\.\.\/Utils";/g, 'import Utils from "../Utils";');
    content = content.replace(/import OperationError from "\.\.\/errors\/OperationError";/g, 'import OperationError from "../errors/OperationError";');

    // Fix constructor signature
    content = content.replace(/constructor\(\)\s*\{/, "constructor() {\n        super();");

    // Fix super() duplication if it happens
    content = content.replace(/super\(\);\s*super\(\);/, "super();");

    // Fix run method signature
    content = content.replace(/run\(input, args\)/, "run(input: any, args: any[]): any");

    // Fix highlight methods
    content = content.replace(/highlight\(pos, args\)/, "highlight(pos: any, args: any[]): any");
    content = content.replace(/highlightReverse\(pos, args\)/, "highlightReverse(pos: any, args: any[]): any");

    // Ensure it exports default and named class
    const exportMatch = content.match(/export default (\w+);/);
    if (exportMatch) {
        const className = exportMatch[1];
        content = content.replace(`class ${className} extends Operation`, `export class ${className} extends Operation`);
    }

    fs.writeFileSync(destPath, content, "utf-8");
    console.log(`Ported ${opName} to ${destPath}`);
}

const ops = process.argv.slice(2);
ops.forEach(portOperation);
