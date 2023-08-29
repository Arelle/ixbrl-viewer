// See COPYRIGHT.md for copyright information


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
        return this.wrapperNodes.is(':hidden');
    }
}
