# vschef Breaking Rename Design

**Date:** 2026-07-19

## Goal

Complete the extension rename from `ts-chef` and `tschef` to `vschef` before
its first publication. All active extension identifiers and branding will use
the new name without compatibility aliases, setting fallbacks, or storage
migrations.

## Scope

The canonical extension identity is:

- Package and display name: `vschef`
- Publisher: `erfur`
- Marketplace identity: `erfur.vschef`
- Repository: `https://github.com/erfur/vschef`
- VS Code namespace: `vschef`

The rename covers active source, package contributions, tests, current
documentation, scripts, and CI workflows. Historical design and implementation
records under `docs/superpowers/specs` and `docs/superpowers/plans` remain
unchanged because their old identifiers describe the repository state at the
time they were written.

## Extension Identifiers

All command IDs move from `tschef.*` to `vschef.*`, including contributed and
internal commands. All registrations, invocations, menu contributions, tests,
and generated view focus commands must use the new IDs.

The view container changes from `tschef-sidebar` to `vschef-sidebar`. View IDs,
menu conditions, and webview registrations change from `tschef.*` to
`vschef.*`. The result webview type changes from `tschef.result` to
`vschef.result`.

The configuration section changes from `tschef` to `vschef`, producing settings
such as `vschef.pipelineResultAction` and `vschef.defaultPipelineScope`.
Configuration readers and current documentation must use those keys.

No old commands, views, or settings will be registered or read as fallbacks.
The extension has not been published, so preserving those identifiers would add
unused compatibility code.

## Storage

Workspace pipeline storage changes to `<workspace>/.vscode/vschef/` when the
workspace has a `.vscode` directory, and `<workspace>/.vschef/` otherwise.
Storage tests and active documentation must reflect these paths.

Global pipeline storage continues to use `context.globalStorageUri`. Its path
will change naturally with the extension identity to `erfur.vschef`; code must
not hard-code that platform-specific location.

There will be no migration or fallback reads from the old workspace or global
storage locations. Pipeline serialization and filenames remain unchanged.

## Branding And Documentation

All active user-visible labels use `vschef`, including command titles, sidebar
and contextual titles, configuration descriptions, notifications, status
messages, Quick Pick placeholders, panel titles, output channel names, log
prefixes, release headings, API documentation titles, and script output.

Current documentation and repository links will use `vschef`, `erfur`, and
`https://github.com/erfur/vschef`. Documentation should describe only commands
and interfaces that currently exist; stale references to the removed pipeline
editor should be corrected while updating affected pages.

## Source Attribution

The standard source headers under `src/chef` change `Project: ts-chef` to
`Project: vschef`. Existing `Author: Michael Weiss`, `@author Michael Weiss`,
and license copyright notices remain unchanged to preserve authorship and
copyright provenance. The package-level author and publisher metadata identify
Furkan Er and `erfur` as the current maintainer and publisher.

## Tests And Verification

Tests that assert command IDs, view IDs, menu conditions, configuration keys,
webview types, storage paths, and user-visible messages will be updated with the
production code. Negative package-contribution assertions will use the new
namespace so they continue checking that obsolete commands and views are not
exposed.

Verification consists of:

1. Targeted tests for package contributions, command and view wiring,
   configuration, result presentation, and storage.
2. The full test suite, lint, and build.
3. A legacy-reference scan over active files. Allowed matches are limited to
   preserved author/copyright text and historical plans/specifications.
4. VSIX packaging with the output name `vschef-<version>.vsix` and inspection
   of the packaged manifest identity.

## Non-Goals

- Migrating unpublished settings, pipelines, or global storage.
- Registering aliases for old command, view, or configuration IDs.
- Renaming operation names, pipeline schemas, or serialized pipeline files.
- Rewriting historical plans and specifications.
- Replacing Michael Weiss attribution or copyright notices.
- Renaming the local checkout directory, which is outside tracked source.
