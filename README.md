<h1 align="center">vschef</h1>

<p align="center">
  <strong>CyberChef-style data transformations directly inside Visual Studio Code.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=erfur.vschef">
    <img src="https://img.shields.io/visual-studio-marketplace/v/erfur.vschef?style=flat-square&color=2563eb" alt="Visual Studio Marketplace version" />
  </a>
  <a href="https://github.com/erfur/vschef/actions/workflows/ci.yml">
    <img src="https://github.com/erfur/vschef/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI status" />
  </a>
  <a href="https://github.com/erfur/vschef/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/erfur/vschef?style=flat-square&color=16a34a" alt="License" />
  </a>
</p>

## Overview

`vschef` is a Visual Studio Code extension for transforming, decoding, encoding, inspecting, and analyzing data without leaving the editor. It brings a CyberChef-inspired workflow into VS Code, with a TypeScript-based operation engine and editor-focused tools for day-to-day security, development, and troubleshooting work.

Use it to inspect encoded strings, build repeatable transformation pipelines, decode suspicious payloads, format structured data, calculate hashes, test ciphers, and quickly move between raw input and usable output.

## Features

- **420+ operations** for encoding, decoding, hashing, compression, cryptography, parsing, formatting, images, and text processing.
- **Quick Convert** for applying suggested transformations directly to selected editor text.
- **Recipe sidebar** for composing multi-step recipes with configurable operation arguments.
- **Saved pipelines** for reusable workflows, stored per-workspace or system-wide (global) so they are available in every workspace.

## Installation

Install `vschef` from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=erfur.vschef), or search for `vschef` in the VS Code Extensions view.

Requirements:

- Visual Studio Code `1.85.0` or newer

## Usage

### Quick Convert

1. Select text in the editor.
2. Open the context menu.
3. Choose **vschef: Quick Convert Selection**.
4. Pick one of the suggested transformations.

### Build And Run A Recipe

1. Open the **vschef** activity-bar view.
2. Find an operation in **Operations** and add it to **Recipe**.
3. Configure the operation arguments and add further steps as needed.
4. Run the recipe against the current editor selection, then save it globally or to the workspace for reuse.

## Documentation

- [Repository](https://github.com/erfur/vschef)
- [Wiki](https://github.com/erfur/vschef/wiki)
- [Usage Guide](docs/usage.md)
- [Contributing Guide](docs/contributing.md)
- [Operations Index](https://github.com/erfur/vschef/wiki/Operations)
- [Test and Coverage Reports](https://github.com/erfur/vschef/wiki/test-report)

## Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/erfur/vschef.git
cd vschef
npm install
```

Common commands:

```bash
npm run build
npm test
npm run lint
npm run package
```

Project layout:

- `src/extension.ts` contains the VS Code extension entry point.
- `src/chef/` contains the TypeScript operation engine.
- `src/chef/operations/` contains individual transformation operations.
- `src/providers/` contains the Operations, Recipe, Results, and saved-pipeline view providers.
- `test/` contains the test suite.

## License

This project is licensed under the [Apache License 2.0](https://github.com/erfur/vschef/blob/master/LICENSE).

Many operations are ported from [GCHQ CyberChef](https://github.com/gchq/CyberChef), which is also licensed under Apache 2.0.
