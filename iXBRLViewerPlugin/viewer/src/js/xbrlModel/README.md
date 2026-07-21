# XbrlModel document surface (proof of concept)

This directory adds an **alternative load path** for the viewer that reads an
XbrlModel OIM model — a **compiled factset-with-taxonomy**, or a separate
**factset** + **converted taxonomy** — plus a **plain document** (HTML or PDF),
instead of the embedded inline-XBRL JSON.  The existing embedded-iXBRL path is
completely unchanged; the XbrlModel path is taken when the runtime config
contains an `xbrlModel` block **or** the viewer URL has an `?xbrlModel=<url>`
argument.  The model can come from a served URL, a compiled single file, or a
local file chosen in a GUI picker (see [Model sources](#model-sources)).

> **Planned refactor:** this overlay is to be restructured as a standalone
> plugin (like `examples/example_plugin` / `examples/d6v`).  See
> [`REFACTOR-TO-PLUGIN.md`](./REFACTOR-TO-PLUGIN.md) (design + extension-points
> API) and [`MAINTAINER-COVER-NOTE.md`](./MAINTAINER-COVER-NOTE.md) (proposal for
> the maintainers) — details in [Planned refactor](#planned-refactor-move-this-overlay-into-a-standalone-plugin) below.

## Design

The whole feature reuses the existing report model and inspector.  Only two
seams were added:

1. **Adapter** (`adapter.js`) — converts an XbrlModel model into the internal
   report-data structure that `ReportSet` consumes (`concepts`, `facts`, `rels`,
   `prefixes`, `roles`, `cubes`, ...).  It takes a factset document plus a
   taxonomy document; for a **compiled model** (facts and taxonomy in one file)
   the same document is passed as both.  Facts are keyed by a document locator:
   `xbrl:htmlElementId` for the HTML surface (legacy `xbrl:htmlSpanId` is still
   accepted), or a synthesised id carrying `xbrl:pdfPage`/`xbrl:pdfMcid` locators
   for the PDF surface.  OIM networks become the viewer's ELR-keyed `pres`/`calc11`
   relationships; explicit vs typed dimensions are classified from whether a cube
   dimension has a `domainNetwork`.

2. **Document surface** — loads the document into the viewer's iframe
   (`prepareDocument`) and binds facts to it (`bind`).  `prepareDocument` accepts
   a document *source* — either `{ url }` (fetched) or already-loaded content
   (`{ text }` for HTML, `{ data }` ArrayBuffer for PDF) so a local file picked in
   the chooser can be rendered without a server.  Both surfaces produce the exact
   DOM decorations (`.ixbrl-element` + `ivids`, and an `IXNode` in the viewer's
   map) that the existing `Viewer` selection/highlight/navigation code already
   relies on, so nothing downstream is surface-specific:

   - `HtmlDocumentSurface` matches each fact's `htmlElementId` to an element id in
     a plain-HTML document and wraps the matched element.
   - `PdfDocumentSurface` renders the PDF with PDF.js, builds a marked-content-id
     → rectangle map per page from `getTextContent({ includeMarkedContent: true })`,
     and lays absolutely-positioned `.ixbrl-element` overlay `<div>`s over each
     fact's marked-content rectangles (one IXNode per fact, its overlay divs as
     wrapper nodes).  Selection, highlighting and navigation therefore work
     unchanged — there is no PDF-specific selection code.

`XbrlModelViewer` (`xbrlModelViewer.js`) is a thin `Viewer` subclass that
overrides only the fact-discovery step (`Viewer._processDocuments`) to delegate
to a document surface.  Everything after discovery — styling, event handlers,
navigation, the inspector — is shared and unmodified.

`iXBRLViewer.loadXbrlModel` resolves the model source (URL argument → config
`model`/`factset` → chooser) and hands the parsed model to `_loadXbrlModelDoc`,
which builds the report data and chooses the surface from the factset's
`factLocatorType` (or the document extension / a `documentType` config value).
The GUI file picker lives in `xbrlModelChooser.js`.

### PDF.js packaging

`PdfDocumentSurface` loads PDF.js via a runtime dynamic `import()` in
`pdfjsLoader.js`, so the (large) PDF.js and PDF worker bundles are only fetched
when a PDF is actually viewed, and never parsed by the CommonJS jest tests.
webpack emits them as separate chunks (`<id>.ixbrlviewer.js`) plus a module
worker chunk, which must be served **alongside** `ixbrlviewer.js` (the same way
the standalone `inlinePdfViewer` demo serves `pdf.mjs` / `pdf.worker.mjs`).  The
iXBRL and HTML paths never load these chunks.

## Building

Build the viewer bundle from the repository root:

```sh
npm ci          # first time only
npm run prod    # production build  -> iXBRLViewerPlugin/viewer/dist/
# or: npm run dev   (unminified, faster; emits *.dev.js)
```

No special flag is needed to include the PDF features — `PdfDocumentSurface` is
part of the normal build.  Because it pulls in PDF.js via a runtime dynamic
`import()`, webpack automatically splits PDF.js and its worker into separate
chunks that are only fetched when a PDF is actually viewed.

A production build (`npm run prod`) emits into `iXBRLViewerPlugin/viewer/dist/`:

```
ixbrlviewer.js                  868K   main bundle (all you need for iXBRL / HTML)
362.ixbrlviewer.js              285B   PDF.js loader chunk   ┐
489.ixbrlviewer.js              326K   PDF.js chunk          ├ needed only for PDF
821.ixbrlviewer.js              1.3M   PDF worker chunk      ┘
ixbrlviewer.js.LICENSE.txt             license sidecars (one per emitted chunk)
489.ixbrlviewer.js.LICENSE.txt
821.ixbrlviewer.js.LICENSE.txt
```

(The numeric chunk ids — `362`, `489`, `821` — are assigned by webpack and may
change between builds; copy whatever `*.ixbrlviewer.js` files are emitted.)  A
`dev` build additionally emits `ixbrlviewer.dev.js` and correspondingly named
`*.dev.js` PDF chunks.

- **iXBRL / HTML viewing** needs only `ixbrlviewer.js`.
- **PDF viewing** needs `ixbrlviewer.js` **plus every** `*.ixbrlviewer.js` chunk
  (and their `.LICENSE.txt` sidecars), all served in the same directory so the
  lazily-loaded PDF.js/worker chunks resolve next to the main bundle.

> Note: `iXBRLViewerPlugin/viewer/version.js` runs `git describe --tags` during
> the build, so the build fails in a clone with no tags (`fatal: No names
> found`).  If you hit this, create any tag first, e.g. `git tag v0.0.0-dev`
> (delete it afterwards with `git tag -d v0.0.0-dev`).

## Running

Provide a runtime config (`ixbrlviewer.config.json`, resolved next to the
viewer bundle) with at least a factset URL:

```json
{
  "xbrlModel": {
    "factset": "aapl-10K-20250927-factset.json",
    "document": "aapl-20250927.htm",
    "taxonomy": "aapl-10K-20250927.json"
  }
}
```

`document` and `taxonomy` are optional: when omitted they are resolved from the
factset's own `documentInfo` (`sourceMappings` and `importMapping`), relative to
the factset URL.  Serve a directory containing the bundle, a stub `index.html`
that loads it, the config, and the three data files, then open `index.html`
through a web server (not `file:`).

### Model sources

There are four ways to point the viewer at a model:

1. **Separate files** (above): `factset` + `taxonomy` + `document`.
2. **A single compiled model** — one file containing both the taxonomy structures
   and the (located) facts.  Use `model` instead of `factset`; the taxonomy is
   read from the same file:
   ```json
   { "xbrlModel": { "model": "aapl-compiled.json" } }
   ```
   The document is resolved from the model's `sourceMappings` (or an explicit
   `document`).  (A *compiled model* is auto-detected: it carries `concepts` /
   `labels` / `cubes` alongside its `facts`.)
3. **A URL argument** — `…/index.html?xbrlModel=<url>` opens a model (compiled or
   factset) with **no config file at all**, so a plain viewer bundle can be
   pointed at any served model:
   ```
   http://localhost:8000/index.html?xbrlModel=aapl-compiled.json
   ```
4. **A local-file chooser** — with an `xbrlModel` block but no `model`/`factset`
   and no URL argument (e.g. `{ "xbrlModel": {} }`), the viewer shows a chooser.
   Pick a compiled model `.json` from disk, and — when its source document (HTML
   or PDF) is also local — pick that too.  Files are read in the browser (no
   server round-trip for the document), so this works for fully local models.

Priority when several are present: `?xbrlModel=` argument → `model` → `factset`.

### Quick test with the built-in HTTP server

Build the bundle (`npm run prod`, output in `../dist/ixbrlviewer.js`) and put a
single flat directory together with everything referenced by bare filenames.
The viewer loads `ixbrlviewer.config.json` from **next to the bundle**, and the
config's `factset`/`document`/`taxonomy` are resolved relative to that config,
so keeping them in one directory is the simplest setup:

```
demo/
├── index.html                        <!-- loads ixbrlviewer.js -->
├── ixbrlviewer.js                    <!-- built bundle (from ../dist) -->
├── ixbrlviewer.config.json           <!-- the xbrlModel config shown above -->
├── aapl-10K-20250927-factset.json
├── aapl-20250927.htm
└── aapl-10K-20250927.json            <!-- converted taxonomy -->
```

where `index.html` is just:

```html
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><meta charset="UTF-8"/><title>iXBRL Viewer - XbrlModel demo</title></head>
  <body><script src="ixbrlviewer.js"></script></body>
</html>
```

Then, **from inside `demo/`**, start a server and open the stub page:

```sh
cd demo
python3 -m http.server 8000 --directory .
```

Browse to:

```
http://localhost:8000/index.html
```

The stub page loads the bundle, which reads `ixbrlviewer.config.json`, sees the
`xbrlModel` block, fetches the factset/taxonomy/document, and renders the tagged
HTML with the inspector.  (Serving over `http://` is required — the viewer does
not run from `file:` URLs.)

### PDF variant

The same setup works for a PDF: point the config at a PDF factset and a `.pdf`
document (the surface is chosen automatically from the factset's
`factLocatorType`, or you can force it with `"documentType": "pdf"`):

```json
{
  "xbrlModel": {
    "factset": "aapl-10K-20250927-factset-pdf.json",
    "document": "aapl-20250927.pdf",
    "taxonomy": "aapl-10K-20250927.json"
  }
}
```

For the PDF variant the demo directory must **also** contain the PDF.js chunk
files webpack emits next to the bundle (`<id>.ixbrlviewer.js`, e.g. the PDF.js
and PDF-worker chunks) — copy every `*.ixbrlviewer.js` from `../dist`, not just
`ixbrlviewer.js`.

PDFs whose fonts are **not embedded** (or that use CID/CJK fonts) also need
PDF.js's font/cmap resources served.  Place PDF.js's `standard_fonts/` and
`cmaps/` folders (from `node_modules/pdfjs-dist/`) next to the config, or point
elsewhere with `"pdfResourcesUrl"` in the `xbrlModel` config block:

```
demo/
├── ... (bundle, chunks, config, factset, taxonomy)
├── aapl-20250927.pdf
├── standard_fonts/      <- from node_modules/pdfjs-dist/standard_fonts
└── cmaps/               <- from node_modules/pdfjs-dist/cmaps
```

These are only fetched for fonts a PDF doesn't embed, so a PDF with fully
embedded fonts renders correctly even without them.

#### PDF range requests (`pdfDisableRange`)

By default the PDF surface fetches the whole PDF in a single request rather than
via HTTP range requests.  This is robust everywhere: local files, and servers
that don't honour `Range` (e.g. Python's `http.server`, which ignores `Range`
and returns the full file with `200` — a mismatch that makes PDF.js throw
`The "L" parameter in the linearization dictionary does not equal the stream
length`).

For a large PDF served from a **range-capable** server (S3/CloudFront, nginx,
Apache, …), you can opt back into range requests for progressive
first-page-fast loading:

```json
{
  "xbrlModel": {
    "factset": "…-factset-pdf.json",
    "document": "…​.pdf",
    "pdfDisableRange": false
  }
}
```

## Known simplifications (this PoC)

- Numeric facts are marked numeric (from `xbrl:unit`) and their reported value is
  reconstructed from the document text plus `scale`/`sign`/`transformation`, so
  the inspector shows unit, accuracy (decimals) and scale.  The `transformation`
  (format) is captured but not shown — surfacing it needs a row in the shared
  `fact-details.html` template.
- Only located facts (with an `xbrl:htmlElementId` or `xbrl:pdfPage`/`xbrl:pdfMcid`
  locator) are shown; hidden facts are not yet surfaced.
- The PDF surface prepares every page's layout + fact overlays up front (so
  navigation, values and highlighting work everywhere immediately) but rasterizes
  page canvases **lazily** as they scroll into view, releasing the pixel memory
  of pages that scroll far away.  Text is only extracted from pages that carry
  facts.  This keeps a large report (e.g. L'Oreal, 452 pages) visible in ~1-2s
  instead of blocking on rendering every page.
- A fact whose value is split across several PDF marked-content ids can show a
  repeated/garbled value (the mapped text concatenates duplicates); it is shown
  as text (never run through numeric formatting), so it doesn't error.

## Cubes panel

The inspector has a native **Cubes** navigation panel (a mode button next to
Document Outline).  The adapter reads the taxonomy's cubes, resolving each cube's
`xbrl:concept` dimension domain network into its line-item concepts
(`XBRLReport.cubes()`); the inspector lists each cube with the number of its
facts present in the document and navigates to them on click
(`ReportSet.conceptFactsIndex()`).  The button is gated on
`ReportSet.hasCubes()`, so it only appears for XBRL Model reports and the iXBRL
viewer is unaffected.  (A separate Networks panel was intentionally not added -
the Document Outline, built from the presentation/parent-child networks, already
covers that.)

## Planned refactor: move this overlay into a standalone plugin

The maintainers have asked that this overlay be restructured as a standalone
plugin (in the style of `examples/example_plugin` and `examples/d6v`) rather than
editing core viewer files.  The design for that — a proposed set of core
extension points, an inventory of what moves where, and a step-by-step plan — is
written up in two companion documents in this directory:

- **[`REFACTOR-TO-PLUGIN.md`](./REFACTOR-TO-PLUGIN.md)** — the full design and
  extension-points API (`provideReportData`, `provideDocumentSurface`,
  `extendInspector`), the current-code inventory, and the refactor steps.  This
  is the document to work from when implementing the refactor.
- **[`MAINTAINER-COVER-NOTE.md`](./MAINTAINER-COVER-NOTE.md)** — a short cover
  note for the maintainers summarising the proposal and listing the decisions
  needed (EP3 shape, exports, whether `reportData` is a documented contract, the
  surface-contract method visibility, and the `outline.js` cycle-guard bugfix).

The extension-point shapes should be agreed with the maintainers first; the
refactor is then mostly relocating the self-contained `xbrlModel/` modules into a
plugin package and reverting the core edits.
