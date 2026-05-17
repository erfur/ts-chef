<p align="center">
  <img src="assets/logo.jpg" alt="ts-chef logo" width="120" />
</p>

<h1 align="center">ts-chef</h1>

<p align="center">
  <strong>CyberChef-style data transformations, directly inside VS Code.</strong><br/>
  239 operations · Visual pipeline editor · Pattern scanner · Variable store
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-%5E1.85-007ACC?logo=visual-studio-code&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/operations-239-4CAF50" alt="Operations">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License">
</p>


---

> [!WARNING]
> **Early Development — Expect Rough Edges**
>
> ts-chef is in a very early stage. Things may break, behave unexpectedly, or be missing entirely.
> If you run into a bug or something doesn't work as expected, please [open an issue](../../issues/new) with a short description and, if possible, the input that caused the problem — every report helps.
>
> Contributions, ideas, and pull requests are genuinely welcome. This project is a side project built out of curiosity, not a finished product.

---

## What is ts-chef?

ts-chef brings the power of [CyberChef](https://gchq.github.io/CyberChef/) into your editor. Select any piece of text — a Base64 blob, a hex string, an AES-encrypted value, a JWT — and decode, transform, or analyse it without ever leaving VS Code.

- **No clipboard juggling** — transformations happen inline, replacing your selection.
- **No context switching** — the pipeline editor, variable store, and pattern scanner live in the sidebar.
- **No internet required** — everything runs locally in the extension host.

---

## Demo
<video controls width="100%">
  <source src="./assets/Clip1.mp4" type="video/mp4">
  Not Suported Media Format
</video>



---

## Features

### ⚡ Quick Convert
Select text, open the command palette, run **`ts-chef: Quick Convert Selection`** (or right-click → ts-chef), and pick from 239 categorised operations. The result replaces your selection instantly.

Operations that require a key or IV (AES, DES, Blowfish, …) prompt for the value inline.

---

### 🔍 Pattern Scanner & Hover Conversion

Run **`ts-chef: Scan Document for Patterns`** to highlight every recognisable encoded value in the active file.

| Highlight | Meaning |
|---|---|
| Orange border | High confidence match (≥ 90%) — Base64, SHA-256 hash, JWT, UUID, … |
| Blue dashed | Lower confidence — possible hex string, Unix timestamp, ROT13, … |

Hover over any highlighted match to see a preview of the decoded value and a one-click **Convert** link that replaces it in place.

Detected patterns include: Base64 / Base64url, hex strings, MD5/SHA-1/SHA-256/SHA-512 hashes, JWTs, UUIDs, URL-encoded text, HTML entities, Unix timestamps, PEM blocks, binary, octal, Base32, escaped Unicode, char codes, and more.

---

### 🧬 Deep Analysis

Right-click a selected value → **`ts-chef: Deep Analysis of Selection`**.

ts-chef runs every detection pattern against the selection, ranks candidates by confidence, and presents them in a quick-pick list. Pick the best match to decode it immediately.

---

### 🔗 Visual Pipeline Editor

Open with **`ts-chef: Open Pipeline Editor`**.

- **Drag operations** from the left panel into the pipeline.
- **Click ▼** on any block to expand it and edit its parameters (Key, IV, Mode, encoding, …) inline — no need to remember argument syntax.
- **Live preview** (⚡ Live toggle) — the output updates automatically as you edit the input or adjust any argument, with a 380 ms debounce.
- **Text field** at the bottom stays in sync for power users who prefer typing `From Base64 | To Hex`.
- **Save** pipelines by name; they persist in `.vscode/ts-chef/pipelines.json`.

---

### 📋 Saved Pipelines

Saved pipelines appear in the **Pipelines** sidebar view. Click any entry to run it on the current selection, or use **`ts-chef: Run Saved Pipeline`** from the command palette to pick from a searchable list.

---

### 🗝️ Variables

Store named values — AES keys, secrets, tokens — with **`ts-chef: Set Variable`** or the **+** button in the Variables sidebar view.

Reference them in any operation using `$varName` or `{{varName}}` syntax:

```
$aes-key          →  replaces with the stored value before the operation runs
{{db-password}}   →  same, with brace syntax
```

Variables persist in `.vscode/ts-chef/variables.json` (or `.ts-chef/variables.json` when no `.vscode/` folder exists).

---

### 🔢 From / To Radix

Two general-purpose encoding operations cover every base from 2 to 36:

| Operation | Example input | Example output |
|---|---|---|
| **From Radix** (base 2, Comma) | `01100001,00110000,01100100,00110011` | `a0d3` |
| **From Radix** (base 16, Colon) | `61:30:64:33` | `a0d3` |
| **From Radix** (base 10, Space) | `97 48 100 51` | `a0d3` |
| **To Radix** (base 2, Space) | bytes `a0d3` | `01100001 00110000 01100100 00110011` |

The **Auto** delimiter option detects comma, semicolon, colon, newline, or space automatically.

---

## Commands

| Command | Description |
|---|---|
| `ts-chef: Quick Convert Selection` | Apply any operation to selected text |
| `ts-chef: Deep Analysis of Selection` | Detect and decode an unknown encoded value |
| `ts-chef: Scan Document for Patterns` | Highlight all recognisable patterns in the file |
| `ts-chef: Toggle Pattern Highlighting` | Show / hide highlight decorations |
| `ts-chef: Clear Scan Results` | Remove all scan highlights |
| `ts-chef: Open Pipeline Editor` | Open the visual pipeline editor |
| `ts-chef: Run Pipeline on Selection` | Run an inline pipe expression on selected text |
| `ts-chef: Run Saved Pipeline` | Pick a saved pipeline and run it |
| `ts-chef: Set Variable` | Store a named variable |
| `ts-chef: Show Variables` | Browse, edit, copy, or delete variables |

---

## Installation

### From VSIX (local build)

```bash
git clone https://github.com/michaelweiss/vscode-ts-chef.git
cd vscode-ts-chef
npm install
npm run build
```

Then in VS Code: **Extensions** → **…** → **Install from VSIX…** → select `vscode-ts-chef-*.vsix`.

> **Requirements:** Node.js ≥ 18, VS Code ≥ 1.85.

---

## Storage Layout

```
<workspace>/
├── .vscode/
│   └── ts-chef/
│       ├── pipelines.json   ← saved pipelines (name, steps, raw text)
│       └── variables.json   ← named variables
```

If no `.vscode/` folder exists, storage falls back to `.ts-chef/` in the workspace root.

---

## Operations

239 operations across 15 categories, ported from GCHQ's CyberChef:

| Category | Examples |
|---|---|
| **Ciphers** | AES Encrypt/Decrypt, DES, Triple DES, Blowfish, ChaCha, Salsa20, ROT13, ROT47, … |
| **Encodings** | Base32 / Base45 / Base58 / Base62 / Base64 / Base85 / Base92, Binary, Hex, Octal, Radix (2–36), … |
| **Hashing** | MD5, SHA-1/256/512, BLAKE2b/2s/3, Argon2 *, Bcrypt, Scrypt, … |
| **Crypto** | JWT Decode, Analyse Hash, Analyse UUID, HMAC, … |
| **Serialise** | JSON Beautify/Minify, XML, CSV ↔ JSON, BSON, CBOR, … |
| **Networking** | URL Encode/Decode, Parse URI, Strip HTTP/TCP/IP headers, … |
| **String** | Find & Replace, Regex, Upper/Lower/Camel/Snake/Kebab Case, ROT13, … |
| **DateTime** | Unix Timestamp, Windows Filetime, Translate Date/Time Format, … |
| **Default** | XOR, AND, OR, NOT, Bit Shift, Add Line Numbers, From/To Charcode, … |

\* Some operations requiring native dependencies (Argon2, Bzip2) are excluded from the extension host.

---

## Development

```bash
npm run build          # compile chef lib + generate registry + bundle extension
npm run watch          # incremental bundle watch
npm run verify-ops     # lint registry + sample-input test for all 239 ops
```

### Project Layout

```
src/
├── extension.ts              # activation, command registration
├── logger.ts                 # [ts-chef] output channel
├── chef/
│   ├── Operation.ts          # base class
│   ├── operations/           # 239 individual operation files
│   └── lib/                  # shared utilities (Binary, Hex, Radix, …)
├── commands/runner.ts        # runOp, runPipeline, parsePipeline
├── panels/pipelinePanel.ts   # visual pipeline editor webview
├── providers/
│   ├── detector.ts           # pattern detection & analyseValue
│   ├── decorationProvider.ts # editor highlight decorations
│   ├── hoverProvider.ts      # hover conversion hints
│   └── …TreeProvider.ts      # sidebar tree views
└── storage/store.ts          # VariableStore, PipelineStore
```

---

## A word on CyberChef

ts-chef is built on top of operations ported from [**GCHQ's CyberChef**](https://gchq.github.io/CyberChef/) — a brilliant, battle-tested tool that has been indispensable to security researchers, CTF players, and developers for years.

> If you haven't tried CyberChef yet, [go check it out](https://gchq.github.io/CyberChef/). It is the original, far more complete, and runs right in your browser. ts-chef is not a replacement — it is simply a convenience wrapper that lets you use a subset of those operations without leaving VS Code.

Please consider [starring the CyberChef repository](https://github.com/gchq/CyberChef) and supporting the project.

---

## Contributing

Found a bug? Have an idea?

- **Bug report:** [Open an issue](../../issues/new?template=bug_report.md) and describe what happened, what you expected, and (if possible) the input that triggered it.
- **Feature request:** [Open an issue](../../issues/new?template=feature_request.md) with your idea — especially if there's a CyberChef operation that's missing or broken.
- **Pull request:** Fork the repo, make your change, and open a PR. Even small fixes — typos, edge cases, better error messages — are welcome.

There is no strict contribution guide yet. If in doubt, just open an issue first.

---

## License

[Apache License 2.0](LICENSE)

```
Copyright 2024 Michael Weiss

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

Operation implementations ported from [GCHQ CyberChef](https://github.com/gchq/CyberChef), also Apache 2.0.

---

<p align="center">
  Made with ☕ and TypeScript
</p>
