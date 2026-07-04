// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { viewerUniqueId } from '../util.js';
import { iframeReady, applyFactValue } from './surfaceUtil.js';

// A "document surface" binds XbrlModel facts to a rendered document.  It is the
// only XbrlModel-specific piece that touches the rendered document, so that
// alternative renderings can be added without changing the report model, the
// adapter, or the inspector.
//
// HtmlDocumentSurface binds facts to a plain-HTML rendering by matching each
// fact's xbrl:htmlSpanId (the key of the facts map produced by the adapter) to
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
    async prepareDocument(iframe, documentUrl, iv) {
        const resp = await fetch(documentUrl);
        if (!resp.ok) {
            throw new Error(`Could not load document (${resp.status})`);
        }
        const html = await resp.text();
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(iv._prepareDocumentHtml(html, documentUrl));
        doc.close();
        await iframeReady(iframe);
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
            viewer._docOrderItemIndex.addItem(vuid, 0);
            viewer.itemContinuationMap[vuid] = [];
            nodes.addClass(factData.a.u !== undefined ? "ixbrl-element-nonfraction" : "ixbrl-element-nonnumeric");

            // Value comes from the OIM (numeric facts) or the document text.
            applyFactValue(factData, ixn, $(el).text());
        }

        return Promise.resolve();
    }
}
