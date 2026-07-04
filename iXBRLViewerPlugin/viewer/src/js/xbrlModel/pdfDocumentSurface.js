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
        // Base URL under which PDF.js's resource folders (standard_fonts/,
        // cmaps/) are served.  These are needed for correct glyph rendering of
        // non-embedded standard fonts and CID fonts; without them PDF.js renders
        // ".notdef" boxes for affected text.
        this._resourcesBase = options.resourcesBase ?? null;
    }

    async prepareDocument(iframe, documentUrl, iv) {
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
        const docParams = { url: documentUrl, ownerDocument: doc };
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
                `Could not open '${documentUrl}' as a PDF (${e?.message ?? e}). `
                + `Check that the config's "document" points to a .pdf file.`,
            );
        }
        for (let num = 1; num <= pdf.numPages; num++) {
            await iv.setProgress(`Rendering PDF page ${num} of ${pdf.numPages}`);
            await this._renderPage(pdf, num, doc, pagesEl);
        }
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

    async _renderPage(pdf, num, doc, pagesEl) {
        const page = await pdf.getPage(num);
        const refNum = page.ref?.num ?? page._pageInfo?.ref?.num;
        const viewport = page.getViewport({ scale: this._scale });
        const outputScale = 1;

        const container = doc.createElement("div");
        container.className = "pdf-page";
        container.style.width = Math.floor(viewport.width) + "px";
        container.style.height = Math.floor(viewport.height) + "px";
        pagesEl.appendChild(container);

        const canvas = doc.createElement("canvas");
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        container.appendChild(canvas);

        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

        // Build marked-content id -> rectangles / text for this page.
        const vTop = viewport.viewBox[3];
        const mcidRects = {};
        const mcidText = {};
        const textContent = await page.getTextContent({ includeMarkedContent: true });
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

        this._pages[num] = { container, refNum, vTop, mcidRects, mcidText };
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

    bind(viewer) {
        const reportIndex = 0;
        viewer._iframes.eq(0).data("selected", true);
        const facts = viewer._reportSet.reportsData()[0].facts;

        // Order facts in reading order (page, then vertical position) so that
        // document-order navigation and the outline behave sensibly.
        const entries = [];
        for (const [key, factData] of Object.entries(facts)) {
            const resolved = (factData.pdf ?? []).map(loc => this._resolveLocator(loc));
            const rectSets = resolved.filter(r => r.rects.length > 0);
            if (rectSets.length === 0) {
                // Fact not locatable in the rendered PDF - drop it so no
                // unbindable Fact object is created.
                delete facts[key];
                continue;
            }
            const firstPage = factData.pdf[0]?.page ?? 0;
            const minTop = Math.min(...rectSets.flatMap(r => r.rects.map(x => x.top)));
            entries.push({ key, factData, rectSets, sortKey: firstPage * 1e6 + minTop });
        }
        entries.sort((a, b) => a.sortKey - b.sortKey);

        const doc = viewer._iframes.eq(0).contents().get(0);
        for (const { key, factData, rectSets } of entries) {
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

        return Promise.resolve();
    }
}
