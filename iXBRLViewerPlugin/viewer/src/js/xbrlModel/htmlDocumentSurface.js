// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { viewerUniqueId } from '../util.js';
import { iframeReady, applyFactValue } from './surfaceUtil.js';
import { elementPointer, verifiedPointer } from './tagging/elementPointer.js';

const XHTML_MEDIA_TYPE = "application/xhtml+xml";

// A "document surface" binds XbrlModel facts to a rendered document.  It is the
// only XbrlModel-specific piece that touches the rendered document, so that
// alternative renderings can be added without changing the report model, the
// adapter, or the inspector.
//
// HtmlDocumentSurface binds facts to a plain-HTML rendering by matching each
// fact's xbrl:htmlElementId (the key of the facts map produced by the adapter) to
// an element id in the document.  For each match it produces exactly the DOM
// decorations the existing Viewer relies on:
//
//   - a wrapper node carrying the "ixbrl-element" class and an "ivids" data
//     list (via Viewer._findOrCreateWrapperNode / _addIdToNodes)
//   - an IXNode registered in Viewer._ixNodeMap (via _getOrCreateIXNode)
//
// A future PdfDocumentSurface would implement the same bind(viewer) contract,
// drawing overlay rectangles from xbrl:pdfPage / xbrl:pdfMcid locators instead
// of wrapping DOM elements.
export class HtmlDocumentSurface {

    // Fetch the plain-HTML document and load it into the iframe, resolving once
    // it is ready to be bound.  A <base> is added and scripts stripped by
    // iv._prepareDocumentHtml.
    // documentSource is { url } (fetch) or { text, baseUrl } (already-loaded
    // content, e.g. a local file picked in the GUI chooser).
    async prepareDocument(iframe, documentSource, iv) {
        const src = typeof documentSource === "string" ? { url: documentSource } : documentSource;
        let html;
        let served = null;
        if (src.text !== undefined) {
            html = src.text;
        }
        else {
            const resp = await fetch(src.url);
            if (!resp.ok) {
                throw new Error(`Could not load document (${resp.status})`);
            }
            served = resp.headers.get("content-type");
            html = await resp.text();
        }
        const prepared = iv._prepareDocumentHtml(html, src.baseUrl ?? src.url ?? "");
        const mediaType = this._mediaTypeFor(served, html, src.url ?? src.baseUrl);

        if (mediaType === XHTML_MEDIA_TYPE) {
            const ok = await this._loadAsXml(iframe, prepared);
            if (ok) {
                return;
            }
            // Not well-formed after all.  A browser renders an XML parse error
            // as a yellow error page and nothing binds, which is a far worse
            // outcome than parsing it the way a browser would have anyway.
            console.warn("XbrlModel: document declared XHTML but is not well-formed XML; "
                         + "falling back to HTML parsing");
        }
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(prepared);
        doc.close();
        // Retained so bind mode can attach its listeners to the rendered
        // document without having to be handed the iframe again.
        this._doc = doc;
        await iframeReady(iframe);
    }

    /*
     * Which media type the document should be parsed as.
     *
     * This decides which of two different trees the browser builds, and
     * therefore which pointer locator type the tagger can honestly record:
     * HTML5 tree construction inserts a tbody that XHTML's content model leaves
     * optional, and foster-parents stray content out of tables, so the same
     * bytes yield different child sequences under the two modes.
     *
     * The server's Content-Type wins, because that is what a browser would obey
     * for the document in its published form.  Only where nothing was served --
     * a local file chosen in the GUI -- is the content consulted, and then only
     * for an XML declaration or an XHTML namespace, which are statements by the
     * author rather than guesses about the markup.
     */
    _mediaTypeFor(servedContentType, html, url) {
        if (servedContentType) {
            return /xhtml|xml/i.test(servedContentType) ? XHTML_MEDIA_TYPE : "text/html";
        }
        if (/^\s*<\?xml[\s?]/.test(html) || /<html[^>]*xmlns\s*=\s*["']http:\/\/www\.w3\.org\/1999\/xhtml/i.test(html)) {
            return XHTML_MEDIA_TYPE;
        }
        return /\.xhtml?$/i.test(url ?? "") && /\.xhtml$/i.test(url ?? "") ? XHTML_MEDIA_TYPE : "text/html";
    }

    /*
     * Repair the one thing the shared document preparation does that is legal
     * HTML but not well-formed XML.
     *
     * _prepareDocumentHtml injects `<base href="...">` -- a void element left
     * unclosed, which an HTML parser accepts and an XML parser rejects
     * outright, taking the whole document with it.  A single tag is therefore
     * enough to turn a conformant Inline XBRL 1.1 filing into a parser error
     * page.  Repaired here rather than in the core file, which the XbrlModel
     * work is trying to stop patching, and because the HTML path wants the
     * unclosed form.
     *
     * The href is escaped as well: an unescaped & in a query string is the
     * other way an injected attribute breaks well-formedness.
     */
    _xmlWellFormed(html) {
        return html.replace(/<base\s+href="([^"]*)"\s*\/?>/i,
            (m, href) => `<base href="${href.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;")}"/>`);
    }

    /*
     * Load through a blob URL typed as XHTML, so the browser uses its XML
     * parser.  document.write cannot do this: a written document is always
     * parsed by the HTML parser, which is why an Inline XBRL 1.1 filing was
     * previously reported as text/html inside the viewer.
     *
     * The blob keeps iv._prepareDocumentHtml's work -- the injected <base> and
     * the stripped scripts -- which setting iframe.src to the original URL
     * would discard.  Relative URLs still resolve, because that <base> is what
     * they resolve against rather than the blob URL.
     *
     * Returns false if the document turns out not to be well-formed, leaving
     * the caller to fall back.
     */
    async _loadAsXml(iframe, prepared) {
        const blob = new Blob([this._xmlWellFormed(prepared)], { type: XHTML_MEDIA_TYPE });
        const url = URL.createObjectURL(blob);
        try {
            const loaded = new Promise((resolve) => {
                iframe.addEventListener("load", resolve, { once: true });
            });
            iframe.setAttribute("src", url);
            await loaded;
            await iframeReady(iframe);
            /*
             * A browser reports an XML well-formedness failure as a document
             * containing <parsererror>, not by throwing.  Checked only once the
             * document has settled: the load event can fire while
             * iframe.contentDocument still refers to the previous about:blank,
             * so an immediate check sees a clean document and lets a parser
             * error through -- which left the viewer showing an error page with
             * nothing bound and no fallback taken.
             */
            for (let i = 0; i < 40; i++) {
                const d = iframe.contentDocument;
                if (d && d.readyState === "complete" && d.documentElement) {
                    break;
                }
                await new Promise(r => setTimeout(r, 50));
            }
            const doc = iframe.contentDocument;
            if (!doc || !doc.documentElement
                || doc.getElementsByTagName("parsererror").length > 0) {
                return false;
            }
            this._doc = doc;
            return true;
        }
        finally {
            // Revoked on a later turn: revoking synchronously can race the load
            // the src assignment just started.
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
    }

    /* ---- bind mode ------------------------------------------------------
     *
     * No hit-testing is needed here, in contrast to the PDF surface: the text
     * is real DOM, so the browser has already resolved what is under the
     * cursor and event.target is the answer.  Document size is irrelevant --
     * the L'Oreal filing's 90,908 elements cost the same as a handful.
     *
     * The pointer is generated on capture rather than on hover.  Generating
     * walks up to the root and counts preceding siblings at each level, which
     * is trivial once but wasteful sixty times a second, and that document has
     * one parent with 2,036 children.
     */

    beginBind(session) {
        const doc = this._bindDoc = this._doc;
        if (!doc) {
            return;
        }
        this._onBindOver = (e) => {
            const el = e.target;
            if (!el || el.nodeType !== 1) {
                session.candidate(null);
                return;
            }
            this._highlight(el);
            session.candidate(this._candidateFor(el, doc));
        };
        this._onBindClick = (e) => {
            const el = e.target;
            if (!el || el.nodeType !== 1) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const candidate = this._candidateFor(el, doc);
            if (!candidate) {
                return;
            }
            // Shift-click joins rather than replaces, matching the PDF surface:
            // a value split across elements concatenates the same way one split
            // across marked-content runs does.
            if (e.shiftKey) {
                session.addFragment(candidate);
            }
            else {
                session.capture(candidate);
            }
        };
        /*
         * Leaving the document clears the candidate.  Without this the card goes
         * on showing the last thing hovered, and the highlight stays lit, while
         * the cursor is over the inspector -- which reads as still tracking when
         * it is in fact frozen, and invites acting on a stale candidate.
         */
        this._onBindLeave = () => {
            this._highlighted?.classList.remove("xbrl-bind-candidate");
            this._highlighted = null;
            session.candidate(null);
        };
        doc.addEventListener("mouseover", this._onBindOver, true);
        doc.addEventListener("click", this._onBindClick, true);
        doc.addEventListener("mouseleave", this._onBindLeave, true);
        doc.defaultView?.addEventListener("blur", this._onBindLeave);
        doc.body?.classList.add("xbrl-bind-mode");
    }

    /*
     * A candidate in factValueSourceObject property form.
     *
     * The pointer is verified as it is made -- generated, resolved back, and
     * checked to land on the same element.  Every way a pointer goes wrong is
     * silent: it resolves to a real but different element and yields a
     * plausible value from the wrong place.  An unverified pointer is reported
     * on the candidate rather than thrown away, so the panel can refuse to
     * accept it instead of the surface failing mutely.
     */
    /*
     * Which pointer locator type applies, from how the browser parsed the
     * document.
     *
     * The child sequence in a pointer counts element children of a *tree*, and
     * the two HTML parse modes build different trees: HTML5 tree construction
     * inserts a tbody that XHTML's content model leaves optional, and
     * foster-parents stray content out of tables.  So the locator type carries
     * the parse mode, and the surface must report the one that actually
     * applied rather than assume.  document.contentType is the browser's own
     * answer, which is the tree the pointer was generated against.
     */
    _locatorType(doc) {
        return doc?.contentType === "application/xhtml+xml"
            ? "xbrlx:xhtmlPointerLocatorType"
            : "xbrlx:htmlPointerLocatorType";
    }

    _candidateFor(el, doc) {
        const { pointer, verified, reason } = verifiedPointer(el, doc);
        if (pointer === null) {
            return null;
        }
        const candidate = {
            locatorType: this._locatorType(doc),
            properties: [{ property: "xbrlx:htmlElementPointer", value: pointer }],
            // Raw, not collapsed: whitespace collapsing belongs to the
            // transform stage (Arelle does it in rawValue only once a format is
            // present), and an element's own whitespace is what makes a joined
            // value faithful.  The card collapses for display only.
            text: el.textContent ?? "",
            unverified: verified ? undefined : (reason ?? "pointer did not verify"),
            _el: el,
        };
        // Widening goes to the parent, which is how a click on an inline span
        // inside a table cell reaches the cell.  Stops at the document element.
        const parent = el.parentElement;
        if (parent && parent !== doc.documentElement.parentElement) {
            candidate.widenTo = { _el: parent };
        }
        return candidate;
    }

    _highlight(el) {
        if (this._highlighted === el) {
            return;
        }
        this._highlighted?.classList.remove("xbrl-bind-candidate");
        el.classList.add("xbrl-bind-candidate");
        this._highlighted = el;
    }

    /* Re-derive the candidate for the parent element. */
    widen(from) {
        const el = from?.widenTo?._el;
        if (!el || !this._bindDoc) {
            return null;
        }
        this._highlight(el);
        return this._candidateFor(el, this._bindDoc);
    }

    endBind() {
        const doc = this._bindDoc;
        if (doc) {
            doc.removeEventListener("mouseover", this._onBindOver, true);
            doc.removeEventListener("click", this._onBindClick, true);
            doc.removeEventListener("mouseleave", this._onBindLeave, true);
            doc.defaultView?.removeEventListener("blur", this._onBindLeave);
            doc.body?.classList.remove("xbrl-bind-mode");
        }
        this._highlighted?.classList.remove("xbrl-bind-candidate");
        this._highlighted = null;
        this._bindDoc = null;
    }

    // Bind the report's facts to the document loaded in the viewer's (single)
    // iframe.  Facts whose span id is not present in the document are dropped
    // from the report data so that no unlocated Fact objects are created.
    bind(viewer) {
        const reportIndex = 0;
        const iframe = viewer._iframes.eq(0);
        iframe.data("selected", true);
        const body = iframe.contents().find("body").get(0);
        const facts = viewer._reportSet.reportsData()[0].facts;

        for (const [spanId, factData] of Object.entries(facts)) {
            let el = null;
            try {
                el = body.querySelector("#" + CSS.escape(spanId));
            }
            catch (e) {
                el = null;
            }
            if (el === null) {
                // No element for this locator - remove so we don't create a
                // Fact that can't be shown or navigated to.
                delete facts[spanId];
                continue;
            }

            const nodes = viewer._findOrCreateWrapperNode(el, false);
            const vuid = viewerUniqueId(reportIndex, spanId);
            viewer._addIdToNodes(nodes, vuid);
            const ixn = viewer._getOrCreateIXNode(vuid, nodes, 0, false);
            viewer.docOrderItemIndex.addItem(vuid, 0);
            viewer.itemContinuationMap[vuid] = [];
            nodes.addClass(factData.a.u !== undefined ? "ixbrl-element-nonfraction" : "ixbrl-element-nonnumeric");

            // Value comes from the OIM (numeric facts) or the document text.
            applyFactValue(factData, ixn, $(el).text());
        }

        return Promise.resolve();
    }
}
