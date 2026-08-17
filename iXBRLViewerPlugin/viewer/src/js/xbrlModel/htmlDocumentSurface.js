// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { viewerUniqueId } from '../util.js';
import { iframeReady, applyFactValue } from './surfaceUtil.js';
import { elementPointer, verifiedPointer } from './tagging/elementPointer.js';

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
        if (src.text !== undefined) {
            html = src.text;
        }
        else {
            const resp = await fetch(src.url);
            if (!resp.ok) {
                throw new Error(`Could not load document (${resp.status})`);
            }
            html = await resp.text();
        }
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(iv._prepareDocumentHtml(html, src.baseUrl ?? src.url ?? ""));
        doc.close();
        // Retained so bind mode can attach its listeners to the rendered
        // document without having to be handed the iframe again.
        this._doc = doc;
        await iframeReady(iframe);
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
