// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { viewerUniqueId } from '../util.js';
import { applyFactValue } from './surfaceUtil.js';

// Document surface that renders a PDF with PDF.js and binds XbrlModel facts to
// it using xbrl:pdfPage / xbrl:pdfMcid locators.
//
// It implements the same contract as HtmlDocumentSurface (prepareDocument +
// bind) and, crucially, produces the same DOM decorations the existing Viewer
// relies on: for each fact it creates absolutely-positioned `.ixbrl-element`
// overlay <div>s (one per marked-content rectangle) layered over the rendered
// page canvas, and registers them as the wrapper nodes of an IXNode.  Selection,
// highlighting and navigation therefore work exactly as for the HTML surface -
// no PDF-specific selection code is needed.
//
// Marked-content geometry is obtained from PDF.js `getTextContent({
// includeMarkedContent: true })`: text items are grouped by the enclosing
// marked-content id, and each item's transform/width/height gives a rectangle in
// PDF user space, which is flipped and scaled into CSS pixels over the canvas.
export class PdfDocumentSurface {

    constructor(options = {}) {
        // pageNum -> { container, refNum, vTop, mcidRects: {mcidStr: [rect]}, mcidText: {mcidStr: str} }
        this._pages = {};
        this._scale = 1.5;
        // Set of page numbers that carry facts.  Only these pages need their
        // (expensive) text/marked-content extracted up front; fact-less pages
        // just need sizing.  Null => extract every page.
        this._factPages = options.factPages ?? null;
        // When true (default), fetch the whole PDF in one request instead of via
        // HTTP range requests.  Robust everywhere (local files, servers that
        // ignore Range); set false for large PDFs on a range-capable server to
        // get progressive first-page-fast loading.
        this._disableRange = options.disableRange ?? true;
        // Base URL under which PDF.js's resource folders (standard_fonts/,
        // cmaps/) are served.  These are needed for correct glyph rendering of
        // non-embedded standard fonts and CID fonts; without them PDF.js renders
        // ".notdef" boxes for affected text.
        this._resourcesBase = options.resourcesBase ?? null;
    }

    // documentSource is { url } (PDF.js fetches it) or { data } (an ArrayBuffer
    // of already-loaded bytes, e.g. a local file picked in the GUI chooser).
    async prepareDocument(iframe, documentSource, iv) {
        const src = typeof documentSource === "string" ? { url: documentSource } : documentSource;
        // Load PDF.js lazily (and via a further dynamic import in the loader) so
        // it is only pulled in for the PDF surface and never parsed by the test
        // environment.
        const { loadPdfjs } = await import('./pdfjsLoader.js');
        const pdfjsLib = await loadPdfjs();

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(this._skeletonHtml());
        doc.close();
        const pagesEl = doc.getElementById("pdf-pages");

        // ownerDocument must be the iframe's document: PDF.js injects @font-face
        // rules there for native font rendering, and the page canvas lives in the
        // iframe.  Without this, embedded fonts are registered in the top
        // document and the iframe canvas renders ".notdef" boxes.
        const docParams = { ownerDocument: doc };
        if (src.data !== undefined) {
            docParams.data = src.data;
        }
        else {
            docParams.url = src.url;
        }
        if (this._disableRange) {
            // Fetch the whole PDF in a single request instead of via HTTP range
            // requests.  Range/streaming support varies by server (Python's
            // http.server ignores Range and returns the full file with 200) and
            // by browser, and a mismatch makes PDF.js throw on the linearization
            // dictionary ("L parameter ... does not equal the stream length") or
            // read the wrong bytes.  Local files download quickly anyway.
            docParams.disableRange = true;
            docParams.disableStream = true;
            docParams.disableAutoFetch = true;
        }
        if (this._resourcesBase) {
            docParams.standardFontDataUrl = new URL("standard_fonts/", this._resourcesBase).href;
            docParams.cMapUrl = new URL("cmaps/", this._resourcesBase).href;
            docParams.cMapPacked = true;
        }
        let pdf;
        try {
            pdf = await pdfjsLib.getDocument(docParams).promise;
        }
        catch (e) {
            // PDF.js reports a cryptic "Invalid PDF structure" when the fetched
            // resource isn't a PDF at all (a common cause: the config's
            // "document" points at the HTML file, or a 404 page, while the PDF
            // surface was selected from the factset's pdf locator type).
            throw new Error(
                `Could not open '${src.url ?? "(local file)"}' as a PDF (${e?.message ?? e}). `
                + `Check that the config's "document" points to a .pdf file.`,
            );
        }
        this._pdf = pdf; // retained for form-field lookup (getFieldObjects) in bind
        // Prepare every page (size + text/marked-content geometry) up front so
        // that all fact overlays, values and navigation work immediately, but
        // DEFER the expensive canvas rasterization: pages are rasterized lazily
        // as they scroll into view (see _setupLazyRender).  This is what lets a
        // large report (e.g. 452 pages) become visible quickly instead of
        // blocking on rendering every page.
        for (let num = 1; num <= pdf.numPages; num++) {
            // Update progress only periodically: setProgress waits on a double
            // requestAnimationFrame, so calling it every page would add ~30ms per
            // page (many seconds over a large document).
            if (num === 1 || num % 20 === 0 || num === pdf.numPages) {
                await iv.setProgress(`Processing PDF page ${num} of ${pdf.numPages}`);
            }
            await this._preparePage(pdf, num, doc, pagesEl);
        }
        this._setupLazyRender(iframe);
    }

    _skeletonHtml() {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
            html, body { margin: 0; padding: 0; background: #525659; }
            #pdf-pages { padding: 8px 0; }
            .pdf-page { position: relative; margin: 8px auto; background: #fff;
                        box-shadow: 0 1px 5px rgba(0,0,0,0.5); }
            .pdf-page canvas { display: block; }
            /* Overlay boxes sit above the rendered page canvas.  "multiply"
               makes any highlight background behave like a translucent
               highlighter so the page text below stays readable (matching the
               HTML surface, where the highlight is behind the text). */
            .ixbrl-element { position: absolute; mix-blend-mode: multiply; }
        </style></head><body><div id="pdf-pages"></div></body></html>`;
    }

    // Prepare a page's layout and marked-content geometry WITHOUT rasterizing
    // it.  Creates a correctly-sized container with an (initially empty) canvas
    // that _renderCanvas fills in on demand.
    async _preparePage(pdf, num, doc, pagesEl) {
        const page = await pdf.getPage(num);
        const refNum = page.ref?.num ?? page._pageInfo?.ref?.num;
        const viewport = page.getViewport({ scale: this._scale });

        const container = doc.createElement("div");
        container.className = "pdf-page";
        container.dataset.page = String(num);
        container.style.width = Math.floor(viewport.width) + "px";
        container.style.height = Math.floor(viewport.height) + "px";
        pagesEl.appendChild(container);

        const canvas = doc.createElement("canvas");
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        container.appendChild(canvas);

        // Build marked-content id -> rectangles / text for this page, but only
        // for pages that actually carry facts - text extraction is the expensive
        // part of the up-front pass, and most pages of a large report have no
        // tagged facts.
        const vTop = viewport.viewBox[3];
        const mcidRects = {};
        const mcidText = {};
        if (this._factPages !== null && !this._factPages.has(num)) {
            this._pages[num] = { container, canvas, page, viewport, refNum, vTop, mcidRects, mcidText, canvasRendered: false };
            return;
        }
        let textContent;
        try {
            textContent = await page.getTextContent({ includeMarkedContent: true });
        }
        catch (e) {
            // A malformed page shouldn't abort the whole document.
            this._pages[num] = { container, canvas, page, viewport, refNum, vTop, mcidRects, mcidText, canvasRendered: false };
            return;
        }
        let mcid = null;
        for (const t of textContent.items) {
            if (t.type === "beginMarkedContentProps" || t.type === "beginMarkedContent") {
                if (t.id != null) {
                    mcid = t.id;
                }
            }
            else if (t.type === "endMarkedContent") {
                mcid = null;
            }
            else if (mcid != null) {
                if (typeof t.str === "string" && t.str.length) {
                    mcidText[mcid] = (mcidText[mcid] ?? "") + t.str;
                }
                if (t.width > 0 && t.height > 0) {
                    const x = t.transform[4];
                    const y = t.transform[5];
                    (mcidRects[mcid] ??= []).push({
                        left: x * this._scale,
                        top: (vTop - y - t.height) * this._scale,
                        width: t.width * this._scale,
                        height: t.height * this._scale,
                    });
                }
            }
        }

        this._pages[num] = { container, canvas, page, viewport, refNum, vTop, mcidRects, mcidText, canvasRendered: false };
    }

    // Rasterize pages lazily: render pages within (or near) the visible scroll
    // region and release the pixel memory of pages that scroll far away, so a
    // large PDF doesn't render (or hold in memory) hundreds of pages at once.
    // The iframe's document is the scroll container (matching the rest of the
    // viewer, e.g. Viewer._zoom uses iframe.contents().scrollTop()).
    _setupLazyRender(iframe) {
        const win = iframe.contentWindow;
        let scheduled = false;
        const onScroll = () => {
            if (scheduled) {
                return;
            }
            scheduled = true;
            win.requestAnimationFrame(() => {
                scheduled = false;
                this._renderVisible(win);
            });
        };
        win.addEventListener("scroll", onScroll, { passive: true });
        win.addEventListener("resize", onScroll);
        // The iframe is only sized once the loader is removed (after this runs),
        // and getBoundingClientRect is only meaningful then.  Poll until the
        // iframe has a height, then stop and rely on scroll/resize.
        this._lazyTimer = win.setInterval(() => {
            this._renderVisible(win);
            if (win.innerHeight > 0) {
                win.clearInterval(this._lazyTimer);
                this._lazyTimer = null;
            }
        }, 250);
        this._renderVisible(win);
    }

    _renderVisible(win) {
        const viewportHeight = win.innerHeight || 900;
        const margin = 1000; // render a little beyond the viewport (prefetch)
        for (const num of Object.keys(this._pages)) {
            const rect = this._pages[num].container.getBoundingClientRect();
            const near = rect.bottom > -margin && rect.top < viewportHeight + margin;
            if (near) {
                this._renderCanvas(Number(num));
            }
            else {
                this._clearCanvas(Number(num));
            }
        }
    }

    async _renderCanvas(num) {
        const pg = this._pages[num];
        if (!pg || pg.canvasRendered) {
            return;
        }
        pg.canvasRendered = true;
        const { canvas, page, viewport } = pg;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        try {
            await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        }
        catch (e) {
            pg.canvasRendered = false; // allow a later retry
        }
    }

    _clearCanvas(num) {
        const pg = this._pages[num];
        if (!pg || !pg.canvasRendered) {
            return;
        }
        // Release the backing store; the container keeps its size, so layout and
        // fact overlays are unaffected.  Re-rendered if scrolled back into view.
        pg.canvasRendered = false;
        pg.canvas.width = 0;
        pg.canvas.height = 0;
    }

    // Resolve a locator's marked-content ids to page rectangles + text.
    _resolveLocator(locator) {
        const pageInfo = this._pages[locator.page];
        if (!pageInfo) {
            return { container: null, rects: [], text: "" };
        }
        const rects = [];
        const textParts = [];
        for (const mcidNum of locator.mcids) {
            const mcidStr = `p${pageInfo.refNum}R_mc${mcidNum}`;
            for (const rect of pageInfo.mcidRects[mcidStr] ?? []) {
                rects.push(rect);
            }
            const txt = pageInfo.mcidText[mcidStr];
            if (txt) {
                textParts.push(txt.trim());
            }
        }
        return { container: pageInfo.container, rects, text: textParts.join(" ") };
    }

    // Resolve an image locator's bbox (PDF user-space points, origin lower-left)
    // to a CSS rectangle over the page canvas.
    _resolveImageLocator(loc) {
        const pageInfo = this._pages[loc.page];
        if (!pageInfo) {
            return null;
        }
        const s = this._scale;
        const b = loc.bbox;
        return {
            container: pageInfo.container,
            rect: {
                left: b.x0 * s,
                top: (pageInfo.vTop - b.y1) * s,
                width: (b.x1 - b.x0) * s,
                height: (b.y1 - b.y0) * s,
            },
        };
    }

    async bind(viewer) {
        const reportIndex = 0;
        viewer._iframes.eq(0).data("selected", true);
        const facts = viewer._reportSet.reportsData()[0].facts;
        const doc = viewer._iframes.eq(0).contents().get(0);

        // Resolve AcroForm fields once (only if any fact is form-field located).
        const hasFormFields = Object.values(facts).some(fd => fd.pdfFormField);
        const fieldMap = hasFormFields ? await this._buildFormFieldMap() : {};

        // Group image facts by their shared region (page+bbox) so that one
        // embedded chart image becomes a single highlight carrying all its facts.
        // Content and form-field facts become per-fact overlays.  Facts that
        // resolve to nothing (e.g. html-fallback facts, in a PDF view) are dropped.
        const imageRegions = {}; // regionKey -> { rect, container, page, factKeys: [] }
        const tasks = [];        // ordered render tasks
        for (const [key, factData] of Object.entries(facts)) {
            let located = false;

            if (factData.pdf) {
                const rectSets = factData.pdf.map(loc => this._resolveLocator(loc)).filter(r => r.rects.length > 0);
                if (rectSets.length > 0) {
                    located = true;
                    const page = factData.pdf[0]?.page ?? 0;
                    const top = Math.min(...rectSets.flatMap(r => r.rects.map(x => x.top)));
                    tasks.push({ type: "content", sortKey: page * 1e6 + top, key, factData, rectSets });
                }
            }

            if (factData.pdfImage) {
                for (const loc of factData.pdfImage) {
                    const r = this._resolveImageLocator(loc);
                    if (!r) {
                        continue;
                    }
                    located = true;
                    const region = imageRegions[loc.key] ?? (imageRegions[loc.key] = {
                        rect: r.rect, container: r.container, page: loc.page, factKeys: [],
                    });
                    region.factKeys.push(key);
                }
            }

            if (factData.pdfFormField) {
                for (const name of factData.pdfFormField) {
                    const r = this._resolveFormField(name, fieldMap);
                    if (!r) {
                        continue;
                    }
                    located = true;
                    tasks.push({ type: "formfield", sortKey: r.page * 1e6 + r.rect.top, key, factData, rect: r.rect, container: r.container, fieldValue: r.value });
                }
            }

            if (!located) {
                delete facts[key];
            }
        }
        for (const region of Object.values(imageRegions)) {
            tasks.push({ type: "image", sortKey: region.page * 1e6 + region.rect.top, region });
        }
        tasks.sort((a, b) => a.sortKey - b.sortKey);

        for (const task of tasks) {
            if (task.type === "content") {
                this._bindContentFact(viewer, doc, reportIndex, task, facts);
            }
            else if (task.type === "image") {
                this._bindImageRegion(viewer, doc, reportIndex, task.region, facts);
            }
            else {
                this._bindFormFieldFact(viewer, doc, reportIndex, task, facts);
            }
        }
    }

    // Map AcroForm field name -> { page (1-based), rect (user-space), value } via
    // PDF.js getFieldObjects (one call for the whole document).  Form-field
    // locators carry no page number, so the field's location is discovered here.
    async _buildFormFieldMap() {
        const map = {};
        try {
            const fieldObjects = await this._pdf.getFieldObjects();
            for (const [name, objs] of Object.entries(fieldObjects ?? {})) {
                for (const o of objs ?? []) {
                    if (o && Array.isArray(o.rect) && o.page != null && map[name] === undefined) {
                        map[name] = { page: o.page + 1, rect: o.rect, value: o.value };
                    }
                }
            }
        }
        catch (e) {
            // No AcroForm, or getFieldObjects unsupported.
        }
        return map;
    }

    // Resolve an AcroForm field name to a CSS rectangle over its page + its value.
    _resolveFormField(name, fieldMap) {
        const fld = fieldMap[name];
        if (!fld) {
            return null;
        }
        const pageInfo = this._pages[fld.page];
        if (!pageInfo) {
            return null;
        }
        const s = this._scale;
        const [x0, y0, x1, y1] = fld.rect;
        return {
            container: pageInfo.container,
            page: fld.page,
            value: fld.value,
            rect: {
                left: x0 * s,
                top: (pageInfo.vTop - y1) * s,
                width: (x1 - x0) * s,
                height: (y1 - y0) * s,
            },
        };
    }

    _bindFormFieldFact(viewer, doc, reportIndex, { key, factData, rect, container, fieldValue }, facts) {
        const numericClass = factData.a.u !== undefined ? "ixbrl-element-nonfraction" : "ixbrl-element-nonnumeric";
        const div = doc.createElement("div");
        div.className = "ixbrl-element " + numericClass + " xbrl-formfield";
        div.style.left = rect.left + "px";
        div.style.top = rect.top + "px";
        div.style.width = rect.width + "px";
        div.style.height = rect.height + "px";
        container.appendChild(div);
        const vuid = viewerUniqueId(reportIndex, key);
        const nodes = $([div]);
        viewer._addIdToNodes(nodes, vuid);
        const ixn = viewer._getOrCreateIXNode(vuid, nodes, 0, false);
        viewer._docOrderItemIndex.addItem(vuid, 0);
        viewer.itemContinuationMap[vuid] = [];
        // Value: the OIM fact value if present, else the form field's own value.
        applyFactValue(facts[key], ixn, fieldValue != null ? String(fieldValue) : "");
    }

    _bindContentFact(viewer, doc, reportIndex, { key, factData, rectSets }, facts) {
        const overlayNodes = [];
        const textParts = [];
        const numericClass = factData.a.u !== undefined ? "ixbrl-element-nonfraction" : "ixbrl-element-nonnumeric";
        for (const rs of rectSets) {
            if (rs.text) {
                textParts.push(rs.text);
            }
            for (const rect of rs.rects) {
                const div = doc.createElement("div");
                div.className = "ixbrl-element " + numericClass;
                div.style.left = rect.left + "px";
                div.style.top = rect.top + "px";
                div.style.width = rect.width + "px";
                div.style.height = rect.height + "px";
                rs.container.appendChild(div);
                overlayNodes.push(div);
            }
        }
        const vuid = viewerUniqueId(reportIndex, key);
        const nodes = $(overlayNodes);
        viewer._addIdToNodes(nodes, vuid);
        const ixn = viewer._getOrCreateIXNode(vuid, nodes, 0, false);
        viewer._docOrderItemIndex.addItem(vuid, 0);
        viewer.itemContinuationMap[vuid] = [];
        // Value comes from the OIM (numeric facts) or the mapped MCID text.
        applyFactValue(factData, ixn, textParts.join(" "));
    }

    // One overlay div for the whole chart region, shared by all its facts:
    // selecting any fact highlights the region, and clicking the region surfaces
    // all of them (they all appear in the div's "ivids" list).
    _bindImageRegion(viewer, doc, reportIndex, region, facts) {
        const div = doc.createElement("div");
        div.className = "ixbrl-element ixbrl-element-nonnumeric xbrl-image-region";
        div.style.left = region.rect.left + "px";
        div.style.top = region.rect.top + "px";
        div.style.width = region.rect.width + "px";
        div.style.height = region.rect.height + "px";
        region.container.appendChild(div);
        const nodes = $([div]);
        for (const key of region.factKeys) {
            const vuid = viewerUniqueId(reportIndex, key);
            viewer._addIdToNodes(nodes, vuid);
            const ixn = viewer._getOrCreateIXNode(vuid, nodes, 0, false);
            viewer._docOrderItemIndex.addItem(vuid, 0);
            viewer.itemContinuationMap[vuid] = [];
            // Image facts carry an explicit OIM value (the chart has no text).
            applyFactValue(facts[key], ixn, "");
        }
    }
}
