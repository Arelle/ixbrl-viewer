# XbrlModel → plugin refactor: extension-points API & design note

**Status:** proposal / design — for maintainer review and to seed a fresh implementation chat.
**Goal:** move the XbrlModel overlay out of the core viewer and into a standalone
plugin (in the style of `examples/example_plugin` and `examples/d6v`), adding a
small set of **general-purpose** extension points to the core viewer so the
plugin can supply an alternative data source and document surface.

---

## 1. Why this needs new extension points (and isn't a pure "move to a plugin")

The existing plugin hooks — `preProcessiXBRL`, `updateViewerStyleElements`,
`extendDisplayOptionsMenu`, `extendToolbarHighlightMenu`, `extendHighlightKey` —
**augment** the standard flow. The viewer still:

1. reads embedded `<script type="application/x.ixbrl-viewer+json">` data,
2. reparents the current Inline XBRL document into an iframe, and
3. discovers facts by scanning for `ix:` elements.

`example_plugin` and `d6v` (even at 2,300 lines) both call `iv.load()` and layer
features on top of that standard pipeline.

**XbrlModel replaces stages 1–3:** factset + taxonomy JSON instead of embedded
data; a plain HTML or PDF document instead of inline XBRL; fact binding by
`xbrl:htmlElementId` / `xbrl:pdfMcid` instead of `ix:` tags. There is no plugin hook
for replacing those stages today, which is why the current implementation edits
core files.

The refactor therefore has two halves:

- **Half A — Cubes panel:** already expressible as a plugin with **no core
  changes** (d6v proves the exact pattern — inject a toolbar button into
  `#inspector-head nav.controls`, add an `#inspector.<mode>` container, inject
  CSS). Just needs relocating.
- **Half B — data source + document surface:** needs the three core extension
  points below.

---

## 2. Current code inventory (what moves where)

### Core files currently modified (to be reverted once extension points exist)
| File | Current change | Destination |
|---|---|---|
| `ixbrlviewer.js` | `loadXbrlModel()` + config branch + imports | **Core:** generalized "plugin-provided report" path (EP1+EP2). **Plugin:** the XbrlModel-specific loading. |
| `viewer.js` | `_processDocuments()` extract-method seam | **Core:** becomes the EP2 fact-binding delegation point (keep). |
| `outline.js` | cycle guard in `buildDimensionMapFromSubTree` | **Core:** keep — general robustness fix (cyclic presentation data), not XbrlModel-specific. Upstream as a bugfix. |
| `inspector.{js,html,less}`, `report.js`, `reportset.js`, `i18n/en/translation.json` | Cubes panel (button, mode, panel, `cubes()`, `hasCubes()`, `conceptFactsIndex()`) | **Plugin:** re-implement d6v-style (Half A). `report.cubes()` data comes from the plugin-provided `reportData`. |

### Self-contained `xbrlModel/` modules (move as-is into the plugin package)
`adapter.js`, `htmlDocumentSurface.js`, `pdfDocumentSurface.js`,
`xbrlModelViewer.js`, `surfaceUtil.js`, `pdfjsLoader.js`.

---

## 3. Extension points API

Hooks follow the existing convention: **methods on the plugin object**, invoked
by the core through `callPluginMethod` / `pluginPromise`. One new core helper is
needed:

```js
// iXBRLViewer — returns the first non-null/undefined result from any plugin.
firstPluginResult(methodName, ...args) { … }
```

### EP1 — Report data provider  *(replaces embedded-JSON parsing)*

```js
// Plugin method. Return the internal report-data object, or undefined to
// decline (letting the core read embedded JSON as usual). May be async.
async provideReportData(iv) → reportData | undefined
```

- **Called by** `iXBRLViewer.load()` before `_getTaxonomyData()`.
- **Core behaviour:** if a plugin returns data, `new ReportSet(reportData)` and
  skip embedded-JSON reading. Otherwise the current path runs unchanged.
- **`reportData` shape** = the documented internal structure ReportSet consumes
  (`{prefixes, roles, languages, sourceReports:[{docSetFiles, targetReports:[{concepts, facts, rels, roleDefs, cubes?, localDocs}]}], …}`).
  This shape should be documented as the stable contract.
- **XbrlModel use:** `adapter.buildReportData(factset, taxonomy)`.

### EP2 — Document surface  *(replaces document reparenting + fact discovery)*

```js
// Plugin method. Return a surface object, or undefined to use the default
// iXBRL document handling.
provideDocumentSurface(iv, reportSet) → surface | undefined
```

The `surface` implements two responsibilities:

```js
// 1. Create/populate the iframe(s) with the document(s). Replaces
//    iXBRLViewer._reparentDocument() + external-iframe creation.
//    Returns a jQuery set of iframes (with data("report-index") set).
async surface.loadDocuments(iframeContainer, iv) → $iframes

// 2. Discover/bind facts: populate viewer._ixNodeMap and add ".ixbrl-element"
//    wrapper nodes carrying "ivids". Replaces Viewer._processDocuments().
async surface.bindFacts(viewer) → void
```

- **Called by** `load()` (for `loadDocuments`) and by `Viewer._processDocuments()`
  (for `bindFacts`). The seam in `viewer.js` already exists:
  ```js
  _processDocuments() {
      if (this._surface) return this._surface.bindFacts(this);
      /* …existing ix: discovery… */
  }
  ```
- **XbrlModel use:** `HtmlDocumentSurface` / `PdfDocumentSurface` (already written;
  lazy PDF rendering, `disableRange`, font/cmap handling, etc.).

#### Surface ↔ Viewer contract (the Viewer methods a surface may call in `bindFacts`)
These become the documented, stable "surface API" of `Viewer`:
`_findOrCreateWrapperNode(el, inHidden)`, `_addIdToNodes(nodes, vuid)`,
`_getOrCreateIXNode(vuid, nodes, docIndex, isHidden)`,
`_docOrderItemIndex.addItem(vuid, docIndex)`, plus the `viewerUniqueId(reportIndex, id)`
util. Recommend documenting these (or providing thin public aliases) so surfaces
don't depend on private internals by accident.

### EP3 — Inspector extension  *(the Cubes panel)*

Two options; **(a) recommended** for the smallest core footprint since d6v proves it:

- **(a) DOM-injection hook.** New hook `extendInspector(inspector)` called once
  after `inspector.initialize()`. The plugin injects its toolbar button into
  `#inspector-head nav.controls`, adds a `#inspector.<mode>` panel container, and
  injects CSS — exactly as d6v does. Requires only that these be stable/public:
  - `inspector.reportSet` (or `iv.reportSet`) → `hasCubes()`, `cubes()`, `facts()`, `conceptFactsIndex()` (these helpers move to the plugin, computed from `reportData`).
  - `inspector.selectItem(vuid)` (already used internally; make it a supported entry point).
- **(b) Structured panel API.** Core adds
  `inspector.registerMode({ id, iconClass, title, isAvailable(), render(container) })`
  that owns the button, mode class, container and switching. Cleaner and reusable
  by other plugins, but more core work. Choose with maintainers.

### Exports from the published `ixbrl-viewer` package
Today only `iXBRLViewer` is exported. With EP1/EP2 the **core** still constructs
`ReportSet` and `Viewer`, so the plugin needs few new exports — primarily
`viewerUniqueId` (used by surfaces). Confirm whether maintainers prefer to export
`ReportSet`/`Viewer` for advanced plugins or keep the surface contract as the only
seam.

---

## 4. Generalised load path (core)

`iXBRLViewer.load()` becomes, in outline:

```
_loadRuntimeConfig(); initializeTheme();
reportData = await firstPluginResult('provideReportData', this);   // EP1
if (reportData !== undefined) {
    reportSet = new ReportSet(reportData);
    surface   = firstPluginResult('provideDocumentSurface', this, reportSet); // EP2
    iframes   = await surface.loadDocuments($('#ixv #iframe-container'), this);
    viewer    = new Viewer(this, iframes, reportSet, { surface });  // surface drives _processDocuments
    await viewer.initialize();
    await inspector.initialize(reportSet, viewer);
    callPluginMethod('extendInspector', inspector);                 // EP3
    _setupInspectorResize(); remove loader; postLoad…
    return;
}
/* …existing embedded-iXBRL path, unchanged… */
```

This is the current `loadXbrlModel()` generalised: the XbrlModel-specific logic
(fetch factset, pick surface, adapter) all moves behind EP1/EP2 in the plugin.

---

## 5. Plugin package layout (mirrors d6v)

```
xbrl-model-plugin/
├── package.json          # deps: ixbrl-viewer, pdfjs-dist
├── webpack.config.js
├── src/
│   ├── index.js          # new iXBRLViewer(opts); iv.registerPlugin(new XbrlModelPlugin(iv)); iv.load()
│   ├── xbrlModelPlugin.js# provideReportData / provideDocumentSurface / extendInspector
│   ├── adapter.js
│   ├── htmlDocumentSurface.js
│   ├── pdfDocumentSurface.js
│   ├── surfaceUtil.js
│   ├── pdfjsLoader.js
│   └── cubesPanel.js     # d6v-style inspector panel (from the inspector.* edits)
└── dist/                 # built bundle + pdf.js chunks (served alongside)
```

Config continues via `ixbrlviewer.config.json` (`xbrlModel: { factset, document,
taxonomy, pdfResourcesUrl?, pdfDisableRange? }`), read through
`iv.runtimeConfig.xbrlModel` — same mechanism d6v uses for `d6.*`.

**Note:** the plugin bundles **pdf.js** (large). Fine for a standalone plugin
dist; call it out to maintainers. pdf.js stays behind the existing dynamic
`import()` in `pdfjsLoader.js` so it's only fetched for PDF documents.

---

## 6. Refactor steps (suggested order for the new chat)

1. **Agree the extension-point signatures with the maintainers** (EP1/EP2, EP3
   option a vs b, exports). This is the gating decision.
2. **Core:** add `firstPluginResult`; add the EP1 branch to `load()`; wire the
   surface into `Viewer` so `_processDocuments()` delegates to `surface.bindFacts`;
   add the `extendInspector` hook (or `registerMode`). Keep the `outline.js`
   cycle guard.
3. **Revert** the XbrlModel-specific edits to `ixbrlviewer.js`, `inspector.*`,
   `report.js`, `reportset.js`, `translation.json`.
4. **Create the plugin package**; move `xbrlModel/` modules in; implement
   `xbrlModelPlugin.js` against the new hooks; port the Cubes panel to
   `cubesPanel.js` (DOM injection).
5. **Build** with the plugin's own webpack; verify HTML + PDF + Cubes against the
   same demos (Apple 10-K HTML/PDF, L'Oreal PDF), including lazy PDF rendering.
6. Confirm the **stock iXBRL viewer is byte-for-byte behaviourally unchanged**
   when no plugin provides data (the whole point).

---

## 7. Open questions for maintainers

- EP3: DOM-injection hook (a) or first-class `registerMode` API (b)?
- Exports: keep the surface contract as the only seam, or export
  `ReportSet`/`Viewer` for advanced plugins?
- Is the internal `reportData` shape acceptable as a **documented, stable**
  contract (EP1's return type)? If it's likely to churn, EP1 could instead accept
  a higher-level model and have the core build `reportData`.
- Naming/location of the surface contract methods on `Viewer` (keep `_`-prefixed
  but documented, or add public aliases?).
- Should the `outline.js` cycle guard be upstreamed independently as a bugfix
  (it helps malformed presentation linkbases regardless of XbrlModel)?

---

## 8. Carry-over checklist for the new chat

- Branch state: XbrlModel feature committed on `hf-xbrl-model`; self-contained
  modules under `iXBRLViewerPlugin/viewer/src/js/xbrlModel/`; core edits per §2.
- Demos: `iXBRLViewerPlugin/viewer/demo-xbrl-model/` (symlinked bundle + data;
  HTML/PDF/L'Oreal configs). Build with a throwaway git tag (`version.js` runs
  `git describe --tags`). node/npm at `/usr/local/bin`.
- Working features to preserve: HTML & PDF surfaces, lazy PDF rendering + memory
  cap, numeric value reconstruction (`surfaceUtil.parseNumericValue`), Cubes
  panel, `pdfDisableRange` flag, font/cmap (`standardFontDataUrl`/`cMapUrl`),
  `ownerDocument` fix.
- Reference plugins: `examples/example_plugin` (minimal), `examples/d6v`
  (advanced — toolbar button + panel + mode injection, config via
  `iv.runtimeConfig`).
- This document is the design; §3 is the API; §6 is the plan.
