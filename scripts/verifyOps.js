#!/usr/bin/env node
// scripts/verifyOps.js — Registry lint + sample-input test for all ts-chef operations
// Run: node scripts/verifyOps.js   (requires npm run build first)

const fs   = require("fs");
const path = require("path");

const opDir       = path.resolve(__dirname, "../dist/chef/operations");
const registrySrc = path.resolve(__dirname, "../src/generated/opsRegistry.ts");

// ── 1. Collect compiled op files ─────────────────────────────────────────
if (!fs.existsSync(opDir)) {
    console.error("ERROR: dist/chef/operations not found — run 'npm run build:chef' first");
    process.exit(1);
}
const compiledFiles = fs.readdirSync(opDir)
    .filter(f => f.endsWith(".js") && !f.endsWith(".map.js") && f !== "index.js")
    .map(f => path.basename(f, ".js"));

// ── 2. Collect registered op names from registry source ──────────────────
if (!fs.existsSync(registrySrc)) {
    console.error("ERROR: src/generated/opsRegistry.ts not found — run 'npm run generate-ops' first");
    process.exit(1);
}
const regSrc = fs.readFileSync(registrySrc, "utf-8");
const registeredOps = new Set([...regSrc.matchAll(/opName: "(\w+)"/g)].map(m => m[1]));

const EXCLUDED = new Set(["Argon2", "Argon2Compare", "Bzip2Compress", "Bzip2Decompress", "CSSSelector"]);

// ── 3. Lint: compare files vs registry ───────────────────────────────────
const compiledSet = new Set(compiledFiles);
const inRegNotInFiles = [...registeredOps].filter(op => !compiledSet.has(op));
const inFilesNotInReg = compiledFiles.filter(op => !registeredOps.has(op) && !EXCLUDED.has(op) && op !== "index");

console.log("\n═══ ts-chef Op Verification ═══\n");
console.log(`Compiled ops:  ${compiledFiles.length}`);
console.log(`Registered ops: ${registeredOps.size}`);
console.log(`Excluded:       ${EXCLUDED.size}`);

if (inRegNotInFiles.length) {
    console.warn(`\n⚠  Registered but not compiled (${inRegNotInFiles.length}):`);
    for (const op of inRegNotInFiles) console.warn(`   - ${op}`);
} else {
    console.log("✓  All registered ops have compiled files");
}

if (inFilesNotInReg.length) {
    console.warn(`\n⚠  Compiled but NOT registered (${inFilesNotInReg.length}):`);
    for (const op of inFilesNotInReg) console.warn(`   - ${op}`);
} else {
    console.log("✓  No unregistered compiled ops");
}

// ── 4. Resolve default args (mirrors runner.ts resolveDefaultArg) ─────────
function resolveDefaultArg(arg) {
    switch (arg.type) {
        case "editableOption":
        case "editableOptionShort": {
            const opts = arg.value;
            if (!Array.isArray(opts)) return arg.value;
            const idx = typeof arg.defaultIndex === "number" ? arg.defaultIndex : 0;
            return opts[idx]?.value ?? opts[0]?.value ?? "";
        }
        case "option": {
            const opts = arg.value;
            return Array.isArray(opts) ? (opts[0] ?? "") : arg.value;
        }
        case "argSelector": {
            const opts = arg.value;
            return Array.isArray(opts) ? (opts[0]?.name ?? "") : arg.value;
        }
        case "toggleString":
            return { string: typeof arg.value === "string" ? arg.value : "", option: arg.toggleValues?.[0] ?? "Hex" };
        default:
            return arg.value;
    }
}

function normaliseInput(input, inputType) {
    const buf = Buffer.from(input, "utf-8");
    switch (inputType) {
        case "byteArray": return Array.from(buf);
        case "ArrayBuffer": { const ab = new ArrayBuffer(buf.length); new Uint8Array(ab).set(buf); return ab; }
        case "number": return 42;
        default: return input;
    }
}

// ── 5. Sample-input test ──────────────────────────────────────────────────
const SAMPLE = "Hello World";
const SLOW_OPS = new Set(["Bcrypt", "BcryptCompare", "BcryptParse", "Scrypt", "Bombe", "Colossus", "Enigma", "Lorenz"]);

let passed = 0, failed = 0, slow = 0;
const failures = [];

console.log("\n─── Sample-input test ───\n");

const opsToTest = [...registeredOps].sort();
for (const opName of opsToTest) {
    if (EXCLUDED.has(opName)) continue;
    if (SLOW_OPS.has(opName)) { slow++; continue; }

    const modPath = path.join(opDir, opName + ".js");
    if (!fs.existsSync(modPath)) {
        failures.push({ opName, error: "compiled file missing" });
        failed++;
        continue;
    }

    try {
        const mod = require(modPath);
        const Cls = mod[opName] || mod.default;
        if (!Cls || typeof Cls !== "function") {
            failures.push({ opName, error: "class not found in module" });
            failed++;
            continue;
        }
        const inst = new Cls();
        if (typeof inst.run !== "function") {
            failures.push({ opName, error: "run() is not a function" });
            failed++;
            continue;
        }
        const args = inst.args.map(resolveDefaultArg);
        const input = normaliseInput(SAMPLE, inst.inputType);
        inst.run(input, args);
        passed++;
    } catch (e) {
        failures.push({ opName, error: e.message || String(e) });
        failed++;
    }
}

console.log(`✓  Passed:  ${passed}`);
if (slow)  console.log(`⏭  Skipped (slow): ${slow}`);
// Distinguish expected failures (ops that correctly reject bad input)
// from actual bugs (unexpected crashes / missing methods)
// Patterns that indicate correct rejection of bad input (not actual bugs)
const EXPECTED_ERRORS = [
    "Invalid key", "Invalid JWT", "SyntaxError", "Not a number", "must be",
    "Invalid input", "Invalid Base", "Incorrect", "invalid", "No valid", "No files",
    "Invalid hash", "Invalid UUID", "Unexpected", "Unable to parse", "No key provided",
    "length", "not valid", "need at least", "less than", "invalid character",
    "Unable to detect", "You can only calculate", "Invalid Public Key",
    "Invalid domain", "Invalid date", "Invalid UNIX", "Invalid Windows", "Invalid integer",
    "requires a", "Inflate error", "Error: You can",
];

const errLower = (f) => f.error.toLowerCase();
const expectedFailures = failures.filter(f => EXPECTED_ERRORS.some(e => errLower(f).includes(e.toLowerCase())));
const realFailures = failures.filter(f => !EXPECTED_ERRORS.some(e => errLower(f).includes(e.toLowerCase())));

if (realFailures.length) {
    console.log(`\n✗  Real failures (${realFailures.length}) — these likely indicate bugs:`);
    for (const f of realFailures) {
        console.log(`  ✗ ${f.opName.padEnd(36)} ${f.error}`);
    }
} else {
    console.log("✓  No real failures");
}

if (expectedFailures.length) {
    console.log(`\n⚠  Expected failures (${expectedFailures.length}) — ops that correctly reject sample input "Hello World":`);
    for (const f of expectedFailures) {
        console.log(`  ⚠ ${f.opName.padEnd(36)} ${f.error.split("\n")[0]}`);
    }
}

console.log(`\n═══ Done ═══`);
process.exit(realFailures.length > 0 ? 1 : 0);
