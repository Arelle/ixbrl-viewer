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
   dimension has a `domainNetwork`; and the OIM `groupTree` becomes a
   reporting-structure section tree that organises the Cubes panel (see
   [Cubes panel](#cubes-panel-reporting-structure-section-tree)).

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
   - `PdfDocumentSurface` handles the PDF locator types defined by the spec
     (`factValue.source` → `factSource` → `factMap` → `factLocatorType`):
     - **content** (`xbrl:pdfContentLocatorType`: `xbrl:pdfPage` + `xbrl:pdfMcid`)
       — builds a marked-content-id → rectangle map per page from
       `getTextContent({ includeMarkedContent: true })` and lays one
       `.ixbrl-element` overlay per fact over its MCID glyph rectangles.
     - **image** (`xbrl:pdfImageLocatorType`: `xbrl:pdfPage` + `xbrl:pdfBBox`
       "x0 y0 x1 y1", origin lower-left) — a single overlay per unique
       page+bbox. Two producers share this path: a chart **image** referenced by
       many facts gives **region-level** highlighting (the SEC Tailored Shareholder
       Report pattern) — all those facts share one overlay (their vuids all land in
       its `ivids`), selecting any highlights the chart and clicking it surfaces the
       set; and a **sub-MCID text value** whose bbox is its own glyph rectangle
       (emitted by `alignFactsToSurface` when a fact is only a portion of a coarse
       row-grained MCID) gives **per-value** highlighting — its bbox is unique, so it
       gets its own overlay. The viewer treats both identically; only the granularity
       of the source bbox differs.
     - **form field** (`xbrl:pdfFormFieldLocatorType`: `xbrl:pdfFormField`, a PDF
       AcroForm field name, with **no page number**) — the field's page,
       rectangle and value are discovered via PDF.js `getFieldObjects()` (one
       call), and one overlay is placed over the field; the value defaults to the
       AcroForm field's own value.
     - **html fallback** (`xbrl:htmlElementLocatorType`) — facts not located in
       the PDF; not shown in a PDF view.

     One IXNode per fact, overlay div(s) as wrapper nodes.  Selection,
     highlighting and navigation work unchanged — there is no PDF-specific
     selection code.

`XbrlModelViewer` (`xbrlModelViewer.js`) is a thin `Viewer` subclass that
overrides the fact-discovery step (`Viewer._processDocuments`) to delegate to a
document surface.  It also overrides `Viewer.initialize()` to run only the
format-agnostic tail (styles, handlers, document-set tabs) after binding: the
base `initialize()` runs iXBRL-only post-processing (`_preProcessiXBRL`,
`_setContinuationMaps`, and review-mode untagged-number wrapping) that does not
apply to a surface-bound document and is pathologically slow on a large plain-HTML
body.  Everything else — selection, highlighting, navigation, the inspector — is
shared and unmodified.

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
3. **URL arguments** — `…/index.html?xbrlModel=<url>` opens a model (compiled or
   factset) with **no config file at all**, so a plain viewer bundle can be
   pointed at any served model.  The document and taxonomy can be given the same
   way with `document` and (for a factset) `taxonomy` arguments:
   ```
   http://localhost:8000/index.html?xbrlModel=aapl-compiled.json
   http://localhost:8000/index.html?xbrlModel=paclife-complete.json&document=paclife.pdf
   http://localhost:8000/index.html?xbrlModel=aapl-factset.json&document=aapl.pdf&taxonomy=aapl-taxonomy.json
   ```
   Each argument is a URL relative to `index.html` (an absolute `http(s)://…` URL
   works too, e.g. a PDF served elsewhere).  A URL argument overrides the same key
   in the config; the document otherwise falls back to the config's `document`,
   then the model's own `sourceMappings`.
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
- Facts not located on the document — an html-fallback fact whose id isn't in the
  PDF, or an `ix:hidden` fact (e.g. `dei:EntityCentralIndexKey`) never linked to
  display text — are registered as **hidden** IXNodes (no overlay, `isHidden=true`)
  so they flow through the core's existing hidden-fact UI: counted in the summary,
  browsable via its click-through fact list, and badged in search.
- The PDF surface prepares every page's layout + fact overlays up front (so
  navigation, values and highlighting work everywhere immediately) but rasterizes
  page canvases **lazily** as they scroll into view, releasing the pixel memory
  of pages that scroll far away.  Text is only extracted from pages that carry
  facts.  This keeps a large report (e.g. L'Oreal, 452 pages) visible in ~1-2s
  instead of blocking on rendering every page.
- A fact whose value is split across several PDF marked-content ids can show a
  repeated/garbled value (the mapped text concatenates duplicates); it is shown
  as text (never run through numeric formatting), so it doesn't error.
- OIM permits a fact to have no entity and/or no period dimension; the viewer now
  handles that (entity shows "n/a", it no longer assumes an entity is present).
  Facts whose concept isn't in a loaded taxonomy fall back to the concept QName.

## Pointer locators (`xbrlx:htmlElementPointer`)

The two HTML locator types in `core.json` both require the source document to
carry an attribute on the target — an `id` or a data attribute. Most elements in
a real report have neither: Microsoft's public annual report carries 42 `id`
attributes across 8,383 elements, all navigation anchors, so nothing in its 66
tables is addressable. Injecting ids means rewriting a document that may be
signed, checksummed, or simply not yours.

A pointer addresses any element without the document saying anything about it —
an XPointer `element()` child sequence written without the `element(...)` wrapper:
`currentAssets`, `/1/14`, `financial-review/2/1`.

| file | role |
|---|---|
| `tagging/elementPointer.js` | generate, resolve, verify. A port-mate of Arelle's `HtmlElementPointer.py`; the two must agree or they address different elements silently |
| `tagging/resolveLocator.js` | read a *stored* locator back to a DOM Range |
| `tagging/corpus/` | the shared cross-language fixture, SHA-pinned on both sides |

Generation prefers the shortest robust form: the element's own id, else a
sequence from the nearest usable ancestor id (the hybrid form), else a full
sequence from the root. An id is only usable if it addresses exactly one element
— duplicate ids occur in filings, and `getElementById` silently returns the
first.

Two rules govern resolution, both measured (see `HTML5-LOCATORS.md`):

- Walk `children[i]`; never hand a child sequence to a selector. 0.78 µs against
  43.8 s on a 1.08 M-element document, because a trailing `*:nth-child` has no
  selectivity.
- Resolve against the **pristine** tree, before decoration. Injected wrappers
  shift child indices; overlaying, as the PDF surface does, does not.
  `resolveAll()` exists so a surface can resolve everything in one pass first.

A pointer addresses an element; a value inside prose needs a character range
within it, so Arelle emits three properties per fragment and the viewer reads
them as a contract — a drift between the two mis-highlights silently:

| property | value |
|---|---|
| `xbrlx:htmlElementPointer` | pointer to the text node's **immediate parent** element |
| `xbrlx:htmlTextOffset` | 0-based character offset into that element's `textContent` |
| `xbrlx:htmlTextQuote` | the exact source text, unstripped and uncollapsed |

`textContent` means what the DOM means: all descendant text in document order,
comments contributing nothing, and the value ends at `offset + quote.length`.
Text is never stripped or whitespace-collapsed — collapsing belongs to the
transform stage. Resolution walks the element's text nodes accumulating lengths
until the offset falls inside one, then **verifies against the quote and refuses
to highlight on mismatch**: the quote exists so a regenerated document is
detected rather than silently mis-addressed (`tagging/resolveLocator.js`).

The locator type records which tree the sequence counted —
`xbrlx:xhtmlPointerLocatorType` for the XML infoset,
`xbrlx:htmlPointerLocatorType` for the HTML5 tree — because the two differ.
On Microsoft's filed 10-K, 85 tables with no `tbody` in source, only **6.8%** of
pointers survive a parse-mode swap. `htmlDocumentSurface` keys this off
`document.contentType`, which is why an XHTML source is loaded through an
XML-typed blob URL rather than `document.write`.

## Cubes panel (reporting-structure section tree)

> **Post-rebase status (2026-08).** Re-integrated into master's redesigned
> inspector as a `cubes-mode` (commit `98668cdb`); the panel is live again on
> both the HTML and PDF paths. Two things moved in the port:
>
> - the panel container is `.cubes-inspector`, following master's
>   `<mode>-inspector` convention, not the old `.cubes`;
> - the `has-cubes` gate is on **`#ixv`**, not `#inspector`. Master moved the tab
>   bar out of the `#inspector` section — `<nav id="inspector-tabs">` is now a
>   sibling of `<section id="inspector">` — so `#inspector` can no longer reach
>   the tab button. `#ixv` is the nearest common ancestor.

The inspector has a native **Cubes** navigation panel (a tab in `#inspector-tabs`,
alongside XBRL facts / Search / Overview).  The adapter reads the taxonomy's cubes,
resolving each cube's `xbrl:concept` dimension domain network into its line-item
concepts (`XBRLReport.cubes()`); the inspector lists each cube with the number of
its facts present in the document and navigates to them on click.  Which facts
those are comes from the model where it states them
(`ReportSet.cubeFactsIndex()`, reading `derivedContent.cubeContents` — see
[Derived content](#derived-content)) and otherwise from a concept match
(`ReportSet.conceptFactsIndex()`), which over-counts: it takes every fact of a
concept the cube mentions, including facts whose dimensions place them in a
different cube.  On Microsoft's FY2025 10-K that inflates 9 of 112 cubes and is
never short.

> A legacy XBRL 2.1 instance has no notion of cube membership, so a model that
> requires one has to **accommodate** it: the translation generates a cube for
> facts to belong to and translated calculations to bind in.  It corresponds to
> nothing the filer authored and is not a reporting structure, so `buildCubes`
> drops it and no panel lists it.
>
> It is recognised by its **cube type**, whose local name is
> `legacyAccommodationCubeType` — model-defined, so each translated model
> declares its own in its own namespace deriving from `xbrl:reportCube`.  Should
> a reserved type be specified later, models will derive from it and this becomes
> a QName match.  Matching the type rather than the name matters: an earlier
> build dropped the cube only because it was absent from the group tree, which
> held for every model to hand but was incidental, and would not have held for
> the flat fallback below — which sorts by fact count and would have put it
> first.
>
> Not to be confused with ESEF's *[999999] Line items not dimensionally
> qualified*, which a filer authors and which does belong in a navigator.  `createCubes()` runs from `Inspector.initialize()`
next to `createSummary()`, and sets `has-cubes` on `#ixv` from
`ReportSet.hasCubes()`; a stylesheet rule hides the tab when the class is absent,
so the panel only appears for XBRL Model reports and the iXBRL viewer is unaffected.

When the model carries a **group tree** (the OIM `groupTree` — the reporting
structure the legacy loader infers from SEC/IFRS role conventions, see
`oim-taxonomy-conversion.md`), the panel renders the cubes **hierarchically** by
reporting section rather than as a flat list:

- `adapter.buildSections` turns `groupTree` + `groups` + `groupContents` into a
  nested tree (`{ name, label, cubes, children }`), ordered by the
  `xbrl:taxonomy-group` relationships (a top-level group's source is
  `xbrl:rootSource`); `XBRLReport.sections()` / `ReportSet.sections()` expose it.
- The inspector nests each cube under its reporting section (categories such as
  *Cover* / *Notes to Financial Statements* / *Details* as expandable parents),
  rolls a fact count up each section, and **hides empty sections** (a section
  whose subtree contains no cube with facts in the document).
- A section whose only content is a **single cube** is collapsed into that cube
  (shown with the section's name), so there is no redundant "section → lone cube"
  level.
- When the model has **no** group tree, the panel falls back to the original flat
  cube list (ordered by descending fact count).

Note the reporting structure is pruned to the reported facts: the `report` save
mode drops empty abstract subgroups (see `PruneModel.py`), so the sections the
viewer shows match what a machine consumer reads from the same compiled model —
the UI's empty-section hiding is then only a safety net.

(A separate Networks panel was intentionally not added — the Document Outline,
built from the presentation/parent-child networks, already covers that.)

## Facts occurring more than once

A model fact can occur in several places in the document, and each occurrence is
a `factValue` carrying the scaling and accuracy of the text where it is
displayed.  Microsoft's total revenue is on pages 49, 84 (twice) and 85;
`us-gaap:CommercialPaper` is printed in millions in one place and billions in
another.  They are **consistent duplicates** in the specification's sense — one
fact, agreeing on value, presented differently — which is the structure the
viewer's existing duplicate handling already expects.

`buildFacts` therefore emits **one viewer fact per located occurrence**, as the
iXBRL path has always done for a repeated tag.  It previously merged a PDF
fact's occurrences into one, taking the last one's scale: that is not merely
imprecise, because barely any `factValue` carries an explicit value (27 of 1,829
in the Microsoft PDF factset) and the surface computes it from the located text
and that occurrence's scale.  One merged scale applied to text printed in
different units gives a **wrong value**, not just a wrong accuracy label — 5
facts in that filing.  Splitting also gives each viewer fact exactly one
`factValue` name, which is what lets a tagging journal say which occurrence a
binding belongs to, and what makes `derivedContent.factValues` — keyed by
`factValueName` — resolvable to a single value per fact.

## Derived content

A compiled model may carry a **`derivedContent`** object beside `documentInfo`
and `xbrlModel`, holding what processing concluded rather than what the filer
reported.  `derivedContent.js` reads two parts of it.  The producer side is
`arelle/plugin/XbrlModel`; the format is specified in `oim-taxonomy-derived.md`
(`oim` repo, branch `spec-dev-1`), still a PWD.

The two parts differ in what the viewer may do when one is absent:

- **`cubeContents`** — which facts fall in which cube — is *derivable*: the model
  implies it and a dimensional match reproduces it.  Absence is not a finding, so
  the Cubes panel falls back to its concept match.
- **`calculationResults`** — the per-binding calculation verdicts — is *not*.  It
  records what a processor did, and nothing in the model reproduces it.

That second point is why the calculation panel shows the carried verdict rather
than its own arithmetic.  Rules, standards and implementations move between the
moment a report is received and any later moment it is read, so a locally
computed answer sitting where the producer's verdict belongs answers a different
question while being indistinguishable to the reader.  The panel distinguishes:

| The model | Shown |
| --- | --- |
| carries a result for this binding | *Consistent* / *Inconsistent (as validated)*, with the `oimtc:` code |
| was validated, but has no result for this binding | *Not validated* — never a local answer |
| carries several equally specific results that disagree | *Validated, verdicts disagree* |
| carries no `derivedContent` at all | the viewer's own `calculation.js` result, as before |

The last row keeps every iXBRL report working: there is no producer verdict to
displace, and the local computation has always been its only source.  Provenance
(`derivation` — processor, date, rule sets) is shown beside every carried
verdict, including *Not validated*, where it says which run skipped the binding.

**Resolved fact values.** `derivedContent.factValues` carries what processing
resolved each occurrence to, keyed by `factValueName` — one-to-one against the
viewer's facts, since one viewer fact is one occurrence.  A `bound` value
supersedes a `resolved` one for the same occurrence: it came from an applied
tagging journal, the model's own sources having failed to locate it on that
surface.

It is used **only as a fallback**, where the surface cannot reconstruct a value
from the document text — a transformation the viewer does not implement, such as
`ixt-sec:numwordsen` and the fifteen others SEC defines, where it would otherwise
show raw text.  Not as an override, deliberately: reconstructing from the located
text is what makes a mis-bound locator visible, since a fact reading the wrong
text shows the wrong value.  Preferring the resolved value everywhere would show
the right value at the wrong place, which is the harder defect to notice.  An
explicit value in the model outranks both (`surfaceUtil.parseNumericValue`).

Numeric facts only; a textual fact still shows what the document says.

**What the viewer's own calculation cannot honour.** This applies only to the
fallback path — a report carrying no `derivedContent`, where `calculation.js`
computes locally. The specification makes the parameters of a check properties of
the model or network rather than processor settings, and two do not reach the
viewer:

| property | effect if ignored |
|---|---|
| `xbrl:roundingMode` (`roundToNearest` \| `truncation`) | a truncated report shows spurious inconsistencies; the viewer always assumes round-to-nearest |
| `xbrla:reconciliation` | display only — marks a relationship that deliberately crosses the debit/credit divide |

`xbrl:tolerance` and `xbrl:summationRelation` appeared in an earlier draft of the
proposal and have both been **withdrawn**. The "of which" case that
`summationRelation` expressed — a total followed by components known to be only
part of it — is now a relationship type of its own, `xbrl:greater-lesser`.

Carrying the producer's verdict is what makes these matter less than they did —
the processor honoured them when it validated.

**Relationship types, and a rename in flight.** A calculation network declares
`xbrl:summation-concept`, renamed from `xbrl:summation-item`. The adapter accepts
**both**, because artifacts exist on both sides of the rename: every converted
taxonomy and demo model to hand still says `summation-item`, while the plugin now
emits `summation-concept`. Keying on either name alone silently reclassifies the
other half as presentation — the failure the explicit type check existed to
prevent. A network stating no type at all still falls back to the weight
heuristic.

`xbrl:greater-lesser` is an ordering between two concepts — source ≥ target at the
same dimensional position, as in `PPEGross → PPENet` — checked like a calculation
but carrying no weights and having no total. Because an "of which" breakdown is
now written this way, it is **no longer written as a calculation at all**. The
adapter gives it its own arcrole so it cannot fall through to presentation, where
a bound between two concepts would read as a containment the model does not
state. **No renderer reads that arcrole yet**, so an ordering network is carried
and not shown; displaying it in the calculation inspector as a bound rather than
a sum is the outstanding work.

**Matching a fact to a result.** A result lists only the aspects its binding
constrains, so comparison is a subset test — and on a dimensional report several
results describe one fact at once.  Microsoft's 10-K carries verdicts on the
un-dimensioned total, the asset-class total *and* the fully dimensioned one;
treated as equal candidates, 11 of its 183 results read as disagreements when
nothing disagreed.  The most specific match wins: a result constraining fewer
aspects is a verdict on a *different* binding, not a looser opinion on this one.
That tiebreak is not yet in the specification text — see
[HANDOVER-derived-content.md](HANDOVER-derived-content.md).

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
