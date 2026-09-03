# XbrlModel → plugin refactor: extension-points API & design note

**Status:** proposal / design — for maintainer review and to seed a fresh implementation chat.
**Goal:** move the XbrlModel overlay out of the core viewer and into a standalone
plugin (in the style of `examples/example_plugin` and `examples/d6v`), adding a
small set of **general-purpose** extension points to the core viewer so the
plugin can supply an alternative data source and document surface.

> **How to read this doc.** **Part I (§1–§4) is the maintainer-facing API &
> design** — that's the part to paste into the issue. **Part II (§5–§8)** is
> implementation and continuation notes (code inventory, package layout, steps,
> carry-over checklist) for whoever does the work.

---

# Part I — API & design (for the maintainer issue)

## 1. The problem — what the PoC needs that the current plugin system doesn't support

The XbrlModel PoC displays an XBRL report where **three things differ from an
Inline XBRL document**:

1. **Data source** — the report is **OIM JSON** (a compiled taxonomy + factset),
   not the embedded `<script type="application/x.ixbrl-viewer+json">` the viewer
   normally reads.
2. **Document** — the thing being annotated is a **plain HTML file or a PDF**, not
   an Inline XBRL document.
3. **Fact binding** — facts are located by **explicit locators carried in the data**
   (`xbrl:htmlElementId`, `xbrl:pdfMcid` / `xbrl:pdfBBox`), not by scanning the
   document for `ix:`-tagged elements.

Every current plugin (`example_plugin`, `d6v`) calls `iv.load()`, which
unconditionally (1) reads the embedded viewer-JSON, (2) reparents the current
Inline XBRL document into the iframe, and (3) discovers facts by walking `ix:`
elements. The existing hooks — `preProcessiXBRL`, `updateViewerStyleElements`,
`extendDisplayOptionsMenu`, `extendToolbarHighlightMenu`, `extendHighlightKey` —
all run **inside** that fixed pipeline. They let a plugin tweak menus, styles, or
pre-process the iXBRL, but **none lets a plugin replace any of those three stages.**

So there is no seam for the three things the PoC fundamentally needs:

- **provide the report data itself** (instead of the viewer reading embedded JSON);
- **provide and load the document(s)** to annotate — a plain HTML file or a PDF —
  into the iframe(s) (instead of reparenting an Inline XBRL document);
- **own fact discovery / binding** — place the highlight overlays from the explicit
  locators (instead of the `ix:`-element scan).

That is why the PoC currently **edits core viewer files** rather than living as a
plugin: the plugin system can augment the standard load, but it cannot hand the
viewer a different data source or a different document to bind facts to.

*(There is one further, smaller need — an inspector panel for cube / reporting-
structure navigation — but that is close to what `d6v` already does with the
existing hooks and is **not** the core blocker. The rest of this doc, §2 onward, is
the proposed solution.)*

### Upstream delta / rebase outcome (rebased onto `master` @ 2026-08-13, +142 commits)

The overlay has since been **rebased onto current master**. Net effect on this
proposal, and how the rebase actually went:

- **No extension points were added upstream** — still no report-data,
  document-surface, or inspector-mode hook (`firstPluginResult` doesn't exist).
  EP1/EP2/EP3 remain net-new and needed.
- **The plugin-hook system was hardened:** upstream *restored*
  `extendDisplayOptionsMenu` / `extendToolbarHighlightMenu` / `extendHighlightKey`
  and added jest tests for them (`registerPlugin` unchanged). Any new hooks we
  propose should ship with equivalent tests.
- **The inspector was redesigned (~1,500 lines).** Consequences:
  - The **`#inspector-head nav.controls` anchor that Half A / EP3-(a) relied on is
    gone** — the new `inspector.html` uses `top-bar-controls` / `.controls` / per-
    section `*-controls`. DOM injection is now a moving target, so **EP3 option (b)
    `registerMode` is preferred** (a first-class panel API rather than DOM injection).
  - The data-side APIs the plugin uses **survive**: `selectItem`, `factListRow`,
    `summary.hiddenFacts`, `fact.isHidden` (→ `ixNode.isHidden`), `visibilityFilter`.
    The Cubes data path and hidden-fact surfacing still work; only the injection
    point moved. (Re-verify against upstream's "Fix inspector summary visibility bugs".)
  - **Rebase outcome (done):** conflicts landed exactly where predicted —
    `inspector.js`/`.html`/`.less`, `outline.js`, `viewer.js`. Resolved by taking
    master's redesigned inspector **wholesale** (dropping the Cubes panel), re-applying
    the `outline.js` cycle guard, and taking master's `initialize()`. Two runtime
    API drifts surfaced and were fixed: master renamed
    `Viewer._docOrderItemIndex` → `Viewer.docOrderItemIndex` (surface call sites
    updated), and master's `initialize()` now runs heavy iXBRL-only post-processing,
    so `XbrlModelViewer` overrides `initialize()` to skip it. This churn is itself
    the argument for the refactor — stop carrying core-inspector patches.
  - **Cubes re-integrated (done, `98668cdb`):** re-added in master's idiom — a
    `cubes-mode` tab button, a `.cubes-inspector` container mirroring the overview
    one, `"cubes-mode"` in `allModes`, an `&.cubes-mode` display rule, and
    `createCubes()` called from `initialize()`. `createCubes` and its section-tree
    `renderNode` ported from `hf-xbrl-model-prerebase` essentially verbatim; only
    the container selectors changed (`.cubes` → `.cubes-inspector`).
    A **third API drift** surfaced here: the `has-cubes` gate had to move from
    `#inspector` to `#ixv`, because master moved `<nav id="inspector-tabs">` out of
    `<section id="inspector">`, leaving the two without a shared ancestor below
    `#ixv`. That one fails *silently* — the selector simply stops matching and the
    tab is always visible, including in the plain iXBRL viewer. A `registerMode`
    API owning its own visibility would remove the whole class of breakage.
- **General fixes remain relevant upstream:** the `outline.js` change did *not* add a
  cycle guard; jQuery `:hidden`/`:visible` are still used (`ixnode.js`, `tableExport.js`,
  `viewer.js`). The compat/perf fixes (see *Open questions*, §4) are still valid
  standalone contributions.
- **Layout DOM renamed** (`#viewer-pane` → `#pane-left`, favicon/skin) — surfaces and
  the plugin should re-check DOM assumptions.

---

## 2. Extension points API

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
`docOrderItemIndex.addItem(vuid, docIndex)` (renamed from `_docOrderItemIndex` in
the 2026-08 redesign), plus the `viewerUniqueId(reportIndex, id)`
util. Recommend documenting these (or providing thin public aliases) so surfaces
don't depend on private internals by accident.

This contract is already sufficient for **hidden / unlocated facts**: a surface can
register a fact that has no location on its document (an html-fallback fact whose id
isn't in a PDF, or an `ix:hidden` fact such as `dei:EntityCentralIndexKey`) as an
IXNode with no wrapper nodes and `isHidden=true`. It then flows through the core's
existing hidden-fact UI unchanged — counted in the summary, browsable via its
click-through fact list, and badged in search — with **no new core changes**. Good
evidence the surface seam is at the right level.

### EP3 — Inspector extension  *(the Cubes panel)*

Two options. **(b) is now recommended** — see *Upstream delta* (§1): the 2026-08
inspector redesign removed the `#inspector-head nav.controls` anchor that (a) relied
on and shows the inspector DOM is unstable, so a first-class API is safer than
DOM injection.

The hand re-integration in `98668cdb` is a worked example of what (a) costs. A mode
had to touch five separate places in core (`#inspector-tabs`, a container in
`inspector.html`, `allModes` in `inspectorMode()`, a display rule and panel styles
in `inspector.less`, a call in `initialize()`), and its availability gate had to be
re-anchored from `#inspector` to `#ixv` because the redesign moved the tab bar out
of the inspector section. `registerMode` would own all five, and — more importantly
— own the gate, which is the piece that fails silently rather than loudly:

- **(b) Structured panel API (recommended).** Core adds
  `inspector.registerMode({ id, iconClass, title, isAvailable(), render(container) })`
  that owns the button, mode class, container and mode switching. Insulates the
  plugin from inspector-DOM churn (which just happened), and is reusable by other
  plugins. Still needs these stable/public: `inspector.reportSet` (or `iv.reportSet`)
  → `hasCubes()`, `cubes()`, `facts()`, `conceptFactsIndex()` (helpers move to the
  plugin, computed from `reportData`), and `inspector.selectItem(vuid)` as a
  supported entry point.
- **(a) DOM-injection hook.** New hook `extendInspector(inspector)` called once
  after `inspector.initialize()`; the plugin injects its button, a `#inspector.<mode>`
  container and CSS — the d6v pattern. Smallest core footprint, but the injection
  anchor is no longer stable upstream (the button target moved from
  `#inspector-head nav.controls` to the redesigned `top-bar-controls`/`.controls`),
  so this now needs re-validation against each inspector revision.

### Exports from the published `ixbrl-viewer` package
Today only `iXBRLViewer` is exported. With EP1/EP2 the **core** still constructs
`ReportSet` and `Viewer`, so the plugin needs few new exports — primarily
`viewerUniqueId` (used by surfaces). Confirm whether maintainers prefer to export
`ReportSet`/`Viewer` for advanced plugins or keep the surface contract as the only
seam.

---

## 3. Generalised load path (core)

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

## 4. Open questions for maintainers

- EP3: first-class `registerMode` API (b, now recommended — the inspector redesign
  removed the DOM anchor that (a) used) or the lighter DOM-injection hook (a)?
- Exports: keep the surface contract as the only seam, or export
  `ReportSet`/`Viewer` for advanced plugins?
- Is the internal `reportData` shape acceptable as a **documented, stable**
  contract (EP1's return type)? If it's likely to churn, EP1 could instead accept
  a higher-level model and have the core build `reportData`.
- Naming/location of the surface contract methods on `Viewer` (keep `_`-prefixed
  but documented, or add public aliases?).
- Several changes are **general fixes independent of XbrlModel** and could be
  upstreamed as standalone bugfixes now, regardless of the refactor: the
  `outline.js` cycle guard (malformed/cyclic presentation data); jQuery-4
  pseudo-selector compat (`:hidden`/`:visible` throw under jQuery 4 — `ixnode.js`,
  `tableExport.js`, `viewer.js`); `htmlHidden` result caching (search perf on
  large documents); and the OIM-permitted absent-entity guard (`fact.js`). Take
  these separately?

---

# Part II — Implementation & continuation notes (not for the issue)

## 5. Current code inventory (what moves where)

> **Post-rebase note (2026-08).** The table below describes the edits as authored
> before the master rebase. After the rebase: `inspector.{js,html,less}` are now
> **master's redesigned files plus the re-integrated Cubes panel** (`98668cdb`) —
> a `cubes-mode` tab, a `.cubes-inspector` container, `createCubes()` called from
> `initialize()`, and the `has-cubes` gate on `#ixv`. `viewer.js` kept only the
> `highlightAllTags` perf cache (master's `initialize()`/`:visible` were taken as-is);
> the surface-binding/init overrides moved into `XbrlModelViewer` (which now
> overrides `_processDocuments` **and** `initialize()`). The `outline.js` cycle
> guard was re-applied cleanly. The general fixes in `ixnode.js`/`tableExport.js`/
> `fact.js` carried through the rebase.

### Core files currently modified (to be reverted once extension points exist)
| File | Current change | Destination |
|---|---|---|
| `ixbrlviewer.js` | `loadXbrlModel()` + config branch + imports | **Core:** generalized "plugin-provided report" path (EP1+EP2). **Plugin:** the XbrlModel-specific loading. |
| `viewer.js` | `_processDocuments()` extract-method seam; **also** `highlightAllTags` perf (cache colour per fact id — 14 s → 25 ms on a 26 k-overlay PDF) and a jQuery-4 `:visible` fix | **Core:** the seam becomes the EP2 fact-binding delegation point (keep); the perf/compat fixes are general (keep/upstream). |
| `outline.js` | cycle guard in `buildDimensionMapFromSubTree` | **Core:** keep — general robustness fix (cyclic presentation data), not XbrlModel-specific. Upstream as a bugfix. |
| `ixnode.js`, `tableExport.js`, `fact.js` | jQuery-4 pseudo-selector compat (`:hidden`/`:visible` are Sizzle-only and throw under jQuery 4 → native layout test), `htmlHidden` result caching (avoids a forced reflow per fact during search), and an OIM-permitted absent-entity guard | **Core:** keep/upstream — general fixes independent of XbrlModel, same category as the `outline.js` guard. |
| `inspector.{js,html,less}`, `report.js`, `reportset.js`, `i18n/en/translation.json` | Cubes panel (`cubes-mode` tab, `.cubes-inspector` container, `allModes` entry, display rule + panel styles, `createCubes()` in `initialize()`, `has-cubes` gate on `#ixv`, `inspector.tabs.cubes` label; `cubes()`, `hasCubes()`, `conceptFactsIndex()`), a **groupTree-driven section tree** with numeric-code section sort | **Plugin:** re-implement via EP3 (b) `registerMode` — the five core touch-points above are exactly what that API would own. `report.cubes()` / section-tree data comes from the plugin-provided `reportData` (`buildSections`/`buildCubes` in `adapter.js`, self-contained). |

### Self-contained `xbrlModel/` modules (move as-is into the plugin package)
`adapter.js`, `htmlDocumentSurface.js`, `pdfDocumentSurface.js`,
`xbrlModelViewer.js`, `surfaceUtil.js`, `pdfjsLoader.js`, `xbrlModelChooser.js`.

The model-source resolution and document-content handling added to
`ixbrlviewer.js` (`_loadXbrlModelDoc`, the `?xbrlModel=` argument, compiled-model
detection, and passing `{text}`/`{data}` document sources to the surfaces) move
behind EP1/EP2 as well.

---

## 6. Plugin package layout (mirrors d6v)

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

## 7. Refactor steps (suggested order for the new chat)

1. **Agree the extension-point signatures with the maintainers** (EP1/EP2, EP3
   option a vs b, exports). This is the gating decision.
2. **Core:** add `firstPluginResult`; add the EP1 branch to `load()`; wire the
   surface into `Viewer` so `_processDocuments()` delegates to `surface.bindFacts`;
   add the inspector mode API (`registerMode`, or the `extendInspector` hook). Keep
   the `outline.js` cycle guard.
3. **Revert** the XbrlModel-specific edits to `ixbrlviewer.js`, `inspector.*`,
   `report.js`, `reportset.js`, `translation.json`.
4. **Create the plugin package**; move `xbrlModel/` modules in; implement
   `xbrlModelPlugin.js` against the new hooks; port the Cubes panel to
   `cubesPanel.js`.
5. **Build** with the plugin's own webpack; verify HTML + PDF + Cubes against the
   demos (Apple 10-K HTML/PDF, L'Oreal PDF, and the large SEC N-CSRs — principal /
   paclife — which stress scale), including lazy PDF rendering.
6. Confirm the **stock iXBRL viewer is byte-for-byte behaviourally unchanged**
   when no plugin provides data (the whole point).

**Rebase note:** upstream has moved +142 commits (inspector redesign, layout DOM
rename, restored+tested plugin hooks). Rebasing `hf-xbrl-model` will conflict most
in `inspector.js` and `outline.js`; do the rebase before step 2 so the core work
targets the current inspector.

---

## 8. Carry-over checklist for the new chat

- Branch state: XbrlModel feature committed on `hf-xbrl-model`; self-contained
  modules under `iXBRLViewerPlugin/viewer/src/js/xbrlModel/`; core edits per the
  code inventory (§5). Upstream (`origin/master`) is +142 commits ahead — rebase
  first (see the rebase note in §7).
- Demos: `iXBRLViewerPlugin/viewer/demo-xbrl-model/` (symlinked bundle + data;
  HTML/PDF/L'Oreal + SEC N-CSR configs). Build with a throwaway git tag
  (`version.js` runs `git describe --tags`). node/npm at `/usr/local/bin`.
- Working features to preserve: HTML & PDF surfaces, lazy PDF rendering + memory
  cap, numeric value reconstruction (`surfaceUtil.parseNumericValue`), the Cubes
  panel as a **groupTree-driven section tree** with numeric-code (`[NNNNNN]`)
  section sort and single-cube-section collapse, **hidden/unlocated-fact
  surfacing** (isHidden IXNodes → existing summary count + click-through list +
  search badge), URL args (`?xbrlModel=` / `?document=` / `?taxonomy=` overriding
  config), `highlightAllTags` perf caching, jQuery-4 pseudo-selector compat,
  `pdfDisableRange` flag, font/cmap (`standardFontDataUrl`/`cMapUrl`),
  `ownerDocument` fix.
- Reference plugins: `examples/example_plugin` (minimal), `examples/d6v`
  (advanced — toolbar button + panel + mode injection, config via
  `iv.runtimeConfig`).
- This document is the design; Part I §2 is the API; §7 is the plan.
