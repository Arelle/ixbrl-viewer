// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { viewerUniqueId } from '../util.js';

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
            viewer._getOrCreateIXNode(vuid, nodes, 0, false);
            viewer._docOrderItemIndex.addItem(vuid, 0);
            viewer.itemContinuationMap[vuid] = [];
            nodes.addClass("ixbrl-element-nonnumeric");

            // The displayed value comes from the document unless the OIM
            // provided one directly.
            if (factData.v === null || factData.v === undefined) {
                factData.v = $(el).text().replace(/\s+/g, " ").trim();
            }
        }

        return Promise.resolve();
    }
}
