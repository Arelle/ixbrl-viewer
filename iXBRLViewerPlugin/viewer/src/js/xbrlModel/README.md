# XbrlModel document surface (proof of concept)

This directory adds an **alternative load path** for the viewer that reads an
XbrlModel OIM **factset** + **converted taxonomy** and a **plain document**,
instead of the embedded inline-XBRL JSON.  The existing embedded-iXBRL path is
completely unchanged; the XbrlModel path is only taken when the runtime config
contains an `xbrlModel` block.

## Design

The whole feature reuses the existing report model and inspector.  Only two
seams were added:

1. **Adapter** (`adapter.js`) — converts an XbrlModel factset + converted
   taxonomy into the internal report-data structure that `ReportSet` consumes
   (`concepts`, `facts`, `rels`, `prefixes`, `roles`, ...).  Facts are keyed by
   their `xbrl:htmlSpanId` so they can be bound to the document, mirroring the
   way the iXBRL path keys facts by the `ix:` element id.  OIM networks become
   the viewer's ELR-keyed `pres`/`calc11` relationships; explicit vs typed
   dimensions are classified from whether a cube dimension has a `domainNetwork`.

2. **Document surface** (`htmlDocumentSurface.js`) — binds facts to the rendered
   document.  `HtmlDocumentSurface` matches each fact's span id to an element id
   in a plain-HTML document and produces the exact DOM decorations
   (`.ixbrl-element` + `ivids`, and an `IXNode` in the viewer's map) that the
   existing `Viewer` selection/highlight/navigation code already relies on.

`XbrlModelViewer` (`xbrlModelViewer.js`) is a thin `Viewer` subclass that
overrides only the fact-discovery step (`Viewer._processDocuments`) to delegate
to a document surface.  Everything after discovery — styling, event handlers,
navigation, the inspector — is shared and unmodified.

### Adding the PDF surface

The document surface is the single extension point for new renderings.  A
`PdfDocumentSurface` would implement the same `bind(viewer)` contract, rendering
pages with PDF.js and drawing overlay rectangles from `xbrl:pdfPage` /
`xbrl:pdfMcid` locators (see `oim/.../inlinePdfViewer/model-pdf-viewer.html`),
instead of wrapping DOM elements.  No changes to the adapter, report model, or
inspector should be required.

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

## Known simplifications (this PoC)

- Numeric facts are shown using their pre-formatted document text (facts are
  treated as non-numeric); unit-aware numeric rendering is a follow-up.
- Only located facts (those with an `xbrl:htmlSpanId`) are shown; hidden facts
  are not yet surfaced.
- Cube/network navigation reuses the presentation-outline machinery via mapped
  `pres` relationships; a native cube/network navigation panel is a follow-up.
