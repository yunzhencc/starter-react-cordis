# Gallery Electron initialization design

## Scope

Create a standalone `examples/gallery` Electron application shell. It demonstrates the existing Cordis web runtime in Electron and deliberately contains no gallery feature, filesystem API, IPC handler, database, thumbnail cache, or distribution configuration.

## Structure

`examples/gallery` owns these three Electron boundaries:

- `src/main.ts`: creates the application window and loads the development server or built renderer.
- `src/preload.ts`: an empty, isolated preload entry. It exposes no API.
- `src/renderer/`: React entry that boots Cordis from a generated web boot graph.

The renderer boot graph contains only the existing workspace packages, in dependency order: i18n, renderer, router, layout, and theme. No agent settings or gallery plugin is included.

The example uses `electron-vite` for its main, preload, and renderer builds. The existing agent Vite boot plugin becomes configurable by config path and virtual module id, so both examples use the same Cordis graph generation rather than carrying duplicate Vite plugins.

## Dependency and runtime boundaries

`examples/gallery` depends on Electron, electron-vite, and the five existing Cordis workspace packages plus the existing boot-graph packages. It does not add a gallery, persistence, image-processing, virtualization, or installer dependency.

The BrowserWindow keeps Node integration disabled and context isolation enabled. Filesystem capabilities and renderer-to-main IPC are intentionally absent from this initialization.

## Verification

The initialization is complete when the Electron production build succeeds, the renderer's Cordis graph contains exactly the five base entries in dependency order, and repository type checks pass. A manual development launch confirms that Electron opens the empty Cordis shell.
