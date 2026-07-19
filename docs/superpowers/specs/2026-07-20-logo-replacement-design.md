# Logo Replacement Design

## Goal

Restore the extension's product logo and replace the temporary activity-bar SVG with the two approved supplied images.

## Assets

- Store the supplied blue image at `assets/logo.png` and use it as the top-level extension icon shown in the Marketplace and extension listings.
- Store the supplied monochrome image at `media/icon.png` and use it for the `vschef-sidebar` activity-bar container.
- Preserve both supplied images as PNG files without redrawing or changing their texture.

## Manifest And Packaging

- Set the top-level `package.json` `icon` field to `assets/logo.png`.
- Set the `vschef-sidebar` activity-bar contribution's `icon` field to `media/icon.png`.
- Update `.vscodeignore` so `assets/logo.png` is included while unrelated assets remain excluded. The existing `media` directory remains included.
- Remove the temporary `media/icon.svg` once the PNG icon is referenced.

## Verification

- Extend package contribution tests to assert both manifest icon paths and the existence of both referenced files.
- Build the VSIX and verify that `extension/assets/logo.png` and `extension/media/icon.png` are present.
- Run the full test, type-check, and lint commands.

## Scope

This change only replaces branding assets and manifest references. It does not alter sidebar views, extension behavior, or other product imagery.
