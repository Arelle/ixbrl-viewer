# Cover note to maintainers: refactoring the XbrlModel overlay into a plugin

Thanks for the steer to model this on `example_plugin` / `d6v`. I've written up a
concrete proposal in `REFACTOR-TO-PLUGIN.md` (same directory). This note is the
short version and the decisions I need from you before I start.

## What it is

An "XbrlModel" overlay for the viewer that reads an **OIM factset + converted
taxonomy + a plain HTML or PDF document** (instead of embedded iXBRL JSON +
inline XBRL), binds facts by `xbrl:htmlElementId` / `xbrl:pdfMcid`, and adds a
**Cubes** navigation panel. It reuses the existing report model and inspector.
Working today against Apple's 10-K (HTML and PDF) and L'Oreal's 452-page PDF,
with lazy PDF rendering.

## The one architectural point

The existing hooks (`preProcessiXBRL`, `updateViewerStyleElements`,
`extendDisplayOptionsMenu`, …) **augment** the standard flow — which is why d6v
can do so much without touching core. XbrlModel instead **replaces** three
stages: the data source, the document, and fact discovery. There's no hook for
that yet, so the current implementation edits core files.

The Cubes panel is already fully plugin-able with no core changes (d6v proves the
pattern). The data-source + document-surface half needs a small set of
**general-purpose** extension points — useful for any alternative-data-source
plugin, not just this one.

## Proposed extension points (detail in §3 of the design doc)

1. **`provideReportData(iv)`** — a plugin supplies the report data instead of the
   core reading embedded JSON.
2. **`provideDocumentSurface(iv, reportSet)`** — a plugin supplies a "surface"
   that loads the document into the iframe(s) and binds facts. This is exactly
   the `Viewer._processDocuments()` seam I already extracted, generalised.
3. **`extendInspector(inspector)`** — a post-init hook for the Cubes panel
   (d6v-style DOM injection), or a first-class `inspector.registerMode({…})` if
   you'd prefer a structured panel API.

When no plugin provides data, the stock iXBRL viewer path is unchanged.

## Decisions I need from you

- **EP3:** DOM-injection hook, or a first-class `registerMode` API?
- **Exports:** keep the surface contract as the only seam, or export
  `ReportSet` / `Viewer` for advanced plugins?
- **Stable contract:** is the internal `reportData` shape OK to document as the
  return type of `provideReportData`, or would you rather EP1 return a
  higher-level model that core converts?
- **Surface contract:** the surface calls a few `Viewer` methods
  (`_findOrCreateWrapperNode`, `_addIdToNodes`, `_getOrCreateIXNode`,
  `viewerUniqueId`). Keep them `_`-prefixed-but-documented, or add public aliases?
- **Independent bugfix:** I added a cycle guard to
  `outline.buildDimensionMapFromSubTree` (a cyclic/self-referential presentation
  network — real in IFRS taxonomies — overflows the stack). Happy to submit that
  as a standalone PR regardless of this refactor.

## Heads-up

The plugin bundles **pdf.js** (large), kept behind a dynamic `import()` so it's
only fetched for PDF documents — same "own dist" model as d6v.

Once you've settled the extension-point shapes, I'll add them to core, revert the
XbrlModel-specific core edits, and move everything into a standalone plugin
package. Happy to hop on a call to nail down the signatures.
