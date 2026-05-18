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
  <img src="https://img.shields.io/badge/operations-400+-4CAF50" alt="Operations">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License">
</p>


---

## What is ts-chef?

ts-chef brings the power of [CyberChef](https://gchq.github.io/CyberChef/) into your editor. Select any piece of text — a Base64 blob, a hex string, an AES-encrypted value, a JWT — and decode, transform, or analyse it without ever leaving VS Code.

- **No clipboard juggling** — transformations happen inline, replacing your selection.
- **No context switching** — the pipeline editor, variable store, and pattern scanner live in the sidebar.
- **No internet required** — everything runs locally in the extension host.

---

## Demo

![Demo-Video](assets/Clip1.gif)



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

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Operations ported from [GCHQ CyberChef](https://github.com/gchq/CyberChef) (Apache 2.0).

---

<p align="center">
  Made with ☕ and TypeScript
</p>
