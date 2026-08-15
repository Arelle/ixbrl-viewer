// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { isTransparent } from './util.js';

/*
 * Object to hold information related to iXBRL nodes in the HTML document.
 * May correspond to either a nonNumeric/nonFraction element, or a continuation
 * element.
 * 
 * The wrapperNodes property is a jQuery object for the "containing" elements
 * which will be a node list containng an inserted div or span wrapper, any
 * absolutely positioned elements or the nearest enclosing td or th.
 */

var docOrderindex = 0;

export class IXNode {
    constructor(id, wrapperNodes, docIndex) {
        this.wrapperNodes = wrapperNodes;
        this.escaped = false;
        this.continuations = [];
        this.docIndex = docIndex;
        this.footnote = false;
        this.id = id;
        this.isHidden = false;
        this.docOrderindex = docOrderindex++;
    }

    continuationIds() {
        return this.continuations.map(n => n.id);
    }

    // Return IX IDs for all IX elements in the continuation chain, including the
    // head.
    chainIXIds() { 
        return [this.id].concat(this.continuationIds());
    }

    textContent() { 
        return [this].concat(this.continuations)
            // The first wrapperNode is always the wrapper for the actual IX node,
            // so will give the full text content.
            .map(n => n.wrapperNodes.first().text())
            .join(" ");
    }

    htmlHidden() {
        // Cached: the hidden state is a static property of the document, but this test reads
        // layout (getClientRects/offsetWidth) and computed style for every wrapper node, which
        // is called once per fact during search -- pathological for a document surface whose
        // facts span tens of thousands of overlay nodes (a full forced reflow each time). A
        // surface that knows its overlays are never hidden pre-seeds `_htmlHiddenCache = false`.
        if (this._htmlHiddenCache === undefined) {
            // jQuery's ":hidden" pseudo-selector is a Sizzle extension; jQuery 4 delegates to the
            // native matchesSelector, which rejects ":hidden" with a SyntaxError (and it breaks
            // for elements in another document, e.g. the PDF surface's iframe). Use the same
            // layout test jQuery's ":hidden" applies, without the pseudo-selector.
            const noLayout = (i, e) => !(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
            this._htmlHiddenCache = this.wrapperNodes.filter(':not(.ixbrl-no-highlight)').is(noLayout)
                || this.wrapperNodes.is((i, e) => isTransparent($(e).css('color')));
        }
        return this._htmlHiddenCache;
    }
}
