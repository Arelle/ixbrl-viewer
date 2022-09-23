// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import $ from 'jquery'
import { TableExport } from './tableExport.js'
import { escapeRegex } from './util.js'
import { IXNode } from './ixnode.js';

export function Viewer(iv, iframes, report) {
    this._iv = iv;
    this._report = report;
    this._iframes = iframes;
    this._contents = iframes.contents();
    this.onSelect = $.Callbacks();
    this.onMouseEnter = $.Callbacks();
    this.onMouseLeave = $.Callbacks();

    this._ixNodeMap = {};
    this._continuedAtMap = {};
    this._docOrderIDIndex = [];
}


Viewer.prototype.initialize = function() {
    return new Promise((resolve, reject) => {
        var viewer = this;
        viewer._iframes.each(function (docIndex) { 
            $(this).data("selected", docIndex == 0);
            viewer._preProcessiXBRL($(this).contents().find("body").get(0), docIndex);
        });

        /* Call plugin promise for each document in turn */
        (async function () {
            for (var docIndex = 0; docIndex < viewer._iframes.length; docIndex++) {
                await viewer._iv.pluginPromise('preProcessiXBRL', viewer._iframes.eq(docIndex).contents().find("body").get(0), docIndex);
            }
        })()
            .then(() => viewer._iv.setProgress("Preparing document") )
            .then(() => {
                this._buildContinuationMap();
                this._report.setIXNodeMap(this._ixNodeMap);
                this._applyStyles();
                this._bindHandlers();
                this.scale = 1;
                this._setTitle(0);
                this._addDocumentSetTabs();
                resolve();
            });
    });
}

function localName(e) {
    if (e.indexOf(':') == -1) {
        return e
    }
    else {
        return e.substring(e.indexOf(':') + 1)
    }
}

Viewer.prototype._buildContinuationMap = function() {
    var continuations = Object.keys(this._continuedAtMap)
    for (var i = 0; i < continuations.length; i++) {
        var id = continuations[i];
        if (this._continuedAtMap[id].isFact) {
            var parts = [];
            var nextId = id;
            while (this._continuedAtMap[nextId].continuedAt !== undefined) {
                nextId = this._continuedAtMap[nextId].continuedAt;
                if (this._ixNodeMap[nextId] !== undefined) {
                    this._continuedAtMap[nextId] = this._continuedAtMap[nextId] || {};
                    this._continuedAtMap[nextId].continuationOf = id;
                    parts.push(this._ixNodeMap[nextId]);
                }
                else {
                    console.log("Unresolvable continuedAt reference: " + nextId);
                    break;
                }
            }
            this._ixNodeMap[id].continuations = parts;
        }
    }
}

Viewer.prototype._addDocumentSetTabs = function() {
    if (this._report.isDocumentSet()) {
        $('#ixv .ixds-tabs').show();
        var ds = this._report.documentSetFiles();
        var viewer = this;
        for (var i = 0; i < ds.length; i++) {
            $('<div class="tab">')
                .text(ds[i])
                .prop('title', ds[i])
                .data('ix-doc-id', i)
                .click(function () { 
                    viewer.selectDocument($(this).data('ix-doc-id'))
                })
                .appendTo($('#ixv #viewer-pane .ixds-tabs .tab-area'));
        }
        $('#ixv #viewer-pane .ixds-tabs .tab-area .tab').eq(0).addClass("active");
    }
}

// Wrap a DOM node in a div or span.  If the node or any descendent has
// display: block, a div is used, otherwise a span.  Returns the wrapper node
// as a jQuery node
Viewer.prototype._wrapNode = function(n) {
    var wrapper = "<span>";
    const nn = n.getElementsByTagName("*");
    for (var i = 0; i < nn.length; i++) {
        if($(nn[i]).css("display") === "block") {
            wrapper = '<div>';
            break;
        }
    }
    $(n).wrap(wrapper);
    return $(n).parent();
}

/*
 * Select the document within the current document set identified docIndex, and
 * if specified, the element identified by fragment (via id or a.name
 * attribute)
 */
Viewer.prototype._showDocumentAndElement = function (docIndex, fragment) {
    this.selectDocument(docIndex); 
    if (fragment !== undefined && fragment != "") {
        // As per HTML spec, try fragment, then try %-decoded fragment
        // https://html.spec.whatwg.org/multipage/browsing-the-web.html#the-indicated-part-of-the-document
        for (const fragment_option of [fragment, decodeURIComponent(fragment)]) {
            const f = $.escapeSelector(fragment_option);
            const ee = this._iframes.eq(docIndex).contents().find('#' + f + ', a[name="' + f + '"]');
            if (ee.length > 0) {
                this.showElement(ee.eq(0));
                return
            }
        }
    }
}

/*
 * Rewrite hyperlinks in the iXBRL.
 *
 * Relative links to other files in the same document set are handled by
 * JavaScript to switch tabs within the viewer
 *
 * All other links are forced to open in a new tab
 *
 */
Viewer.prototype._updateLink = function(n) {
    const url = $(n).attr("href");
    if (url !== undefined) {
        const [file, fragment] = url.split('#', 2);
        const docIndex = this._report.documentSetFiles().indexOf(file);
        if (!url.includes('/') && docIndex != -1) {
            $(n).click((e) => { 
                this._showDocumentAndElement(docIndex, fragment);
                e.preventDefault(); 
            });
        }
        else if (file) {
            // Open target in a new browser tab.  Without this, links will
            // replace the contents of the current iframe in the viewer, which
            // leaves the viewer in a confusing state.
            $(n).attr("target", "_blank");
        }
    }
}

Viewer.prototype._findOrCreateWrapperNode = function(domNode) {
    const v = this;
    /* Is the element the only significant content within a <td> or <th> ? If
     * so, use that as the wrapper element. */
    var node = $(domNode).closest("td,th").eq(0);
    const innerText = $(domNode).text();
    if (node.length == 1 && innerText.length > 0) {
        // Use indexOf rather than a single regex because innerText may
        // be too long for the regex engine 
        const outerText = $(node).text();
        const start = outerText.indexOf(innerText);
        const wrapper = outerText.substring(0, start) + outerText.substring(start + innerText.length);
        if (/[0-9A-Za-z]/.test(wrapper)) {
            node = $();
        } 
    }
    /* Otherwise, insert a <span> as wrapper */
    if (node.length == 0) {
        node = this._wrapNode(domNode);
        node = node.find("*").addBack().filter(function () {
            return (this == node[0] || $(this).css("position") == "absolute");
        });

        //if (absoluteNodes.length > 1) {
        //    console.log(absoluteNodes);
        //}
    }
    /* If we use an enclosing table cell as the wrapper, we may have
     * multiple tags in a single element. */
    node.each(function (i) {
        var ivids = $(this).data('ivid') || [];
        ivids.push(domNode.getAttribute("id"));
        $(this).addClass("ixbrl-element").data('ivid', ivids);
        if (this.getBoundingClientRect().height == 0) {
            $(this).addClass("ixbrl-no-highlight"); 
        }
        if (i > 0) {
            $(this).addClass("ixbrl-sub-element"); 
        }
    });
    return node;
}

//
// Traverse the DOM hierarchy to find IX elements, and build maps and add
// wrapper nodes and classes.
//
// Classes:
//
//   .ixbrl-element        a wrapper for any ix: fact, footnote, or continuation
//   .ixbrl-sub-element    an absolutely positioned element within an
//                         ixbrl-element.  These require separate highlighting.
//   .ixbrl-no-highlight   a zero-height .ixbrl-element - no highlighting or 
//                         borders applied
//   .ixbrl-element-non-fraction,
//   .ixbrl-element-non-numeric,
//   .ixbrl-continuation, 
//   .ixbrl-footnote       
//                         Indicates type of element being wrapped
//
// All ixbrl-elements have "ivid" data added, which is a list of the ID
// attribute(s) of corresponding IX element(s).  i.e. facts have fact IDs,
// continuations have continuation IDs, footnotes have footnote IDs.  It's
// possible for it to be a mix of different types.
//
// Viewer._ixNodeMap is a map of these IDs to IXNode objects
//
// Viewer._docOrderIDIndex is a list of fact and footnote IDs in document
// order, used to power next/prev tag.  continuations are excluded.
//
// Viewer._continuedAtMap is a map of IDs to objects containing:
//     continuedAt - ID of next element in continuation chain
//     isFact - whether the item is the first in the chain
//     continuationOf (added later) - ID of first element in chain (fact or
//     footnote)
//
Viewer.prototype._preProcessiXBRL = function(n, docIndex, inHidden) {
    const name = localName(n.nodeName).toUpperCase();
    const isFootnote = (name == 'FOOTNOTE');
    // Ignore iXBRL elements that are not in the default target document, as
    // the viewer builder does not handle these, and does not ensure that they
    // have ID attributes.
    if (n.nodeType == 1 && (name == 'NONNUMERIC' || name == 'NONFRACTION' || name == 'CONTINUATION' || isFootnote)
        && !n.hasAttribute("target")) {
        var nodes;
        const id = n.getAttribute("id");
        if (inHidden) {
            nodes = $(n);
        } else {
            nodes = this._findOrCreateWrapperNode(n);
        }
        /* We may have already created an IXNode for this ID from a -sec-ix-hidden
         * element */
        var ixn = this._ixNodeMap[id];
        if (!ixn) {
            ixn = new IXNode(id, nodes, docIndex);
            this._ixNodeMap[id] = ixn;
        }
        if (nodes.is(':hidden')) {
            ixn.htmlHidden = true;
        }
        if (inHidden) {
            ixn.isHidden = true;
        }
        if (n.getAttribute("continuedAt")) {
            this._continuedAtMap[id] = { 
                "isFact": name != 'CONTINUATION',
                "continuedAt": n.getAttribute("continuedAt")
            }
        }
        if (name == 'CONTINUATION') {
            $(nodes).addClass("ixbrl-continuation");
        }
        else {
            this._docOrderIDIndex.push(id);
        }
        if (name == 'NONFRACTION') {
            $(nodes).addClass("ixbrl-element-nonfraction");
        }
        if (name == 'NONNUMERIC') {
            $(nodes).addClass("ixbrl-element-nonnumeric");
            if (n.hasAttribute('escape') && n.getAttribute('escape').match(/^(true|1)$/)) {
                ixn.escaped = true;
            }
        }
        if (isFootnote) {
            $(nodes).addClass("ixbrl-element-footnote");
            ixn.footnote = true;
        }
    }
    else if(n.nodeType == 1 && name == 'HIDDEN') {
        inHidden = true;
    }
    else if(n.nodeType == 1) {
        // Handle SEC/ESEF links-to-hidden
        const id = this._getIXHiddenLinkStyle(n);
        if (id !== null) {
            nodes = $(n);
            nodes.addClass("ixbrl-element").data('ivid', [id]);
            this._docOrderIDIndex.push(id);
            /* We may have already seen the corresponding ix element in the hidden
             * section */
            var ixn = this._ixNodeMap[id];
            if (ixn) {
                /* ... if so, update the node and docIndex so we can navigate to it */
                ixn.wrapperNodes = nodes;
                ixn.docIndex = docIndex;
            }
            else {
                this._ixNodeMap[id] = new IXNode(id, nodes, docIndex);
            }
        }
        if (name == 'A') {
            this._updateLink(n);
        }
    }
    this._preProcessChildNodes(n, docIndex, inHidden);
}

Viewer.prototype._getIXHiddenLinkStyle = function(domNode) {
    if (domNode.hasAttribute('style')) {
        const re = /(?:^|\s|;)-(?:sec|esef)-ix-hidden:\s*([^\s;]+)/;
        const m = domNode.getAttribute('style').match(re);
        if (m) {
            return m[1];
        }
    }
    return null;
}

Viewer.prototype._preProcessChildNodes = function (domNode, docIndex, inHidden) {
    for (const childNode of domNode.childNodes) {
        this._preProcessiXBRL(childNode, docIndex, inHidden);
    }
}

Viewer.prototype._applyStyles = function () {
    var stlyeElts = $("<style>")
        .prop("type", "text/css")
        .text(require('css-loader!less-loader!../less/viewer.less').toString())
        .appendTo(this._iframes.contents().find("head"));
    this._iv.callPluginMethod("updateViewerStyleElements", stlyeElts);
}

Viewer.prototype.contents = function() {
    return this._iframes.contents();
}

// Move by offset (+1 or -1) through the tags in the document in document
// order.
//
// Each element may have one or more tags associated with it, so we need to
// move through the list of tags associated with the current element before
// moving to the next/prev element
//
Viewer.prototype._selectAdjacentTag = function (offset, currentItem) {
    // XXX needs review.  Is only used to establish first and last facts in document.
    const elements = $(".ixbrl-element:not(.ixbrl-continuation)", this.currentDocument().contents());
    var nextId;

    if (currentItem !== null) {
        const l = this._docOrderIDIndex.length;
        nextId = this._docOrderIDIndex[(this._docOrderIDIndex.indexOf(currentItem.id) + offset + l) % l];
    }
    // If no fact selected go to the first or last in the current document
    else if (offset > 0) {
        const next = elements.first();
        nextId = next.data('ivid')[0];
    } 
    else {
        const next = elements.last();
        nextId = next.data('ivid')[elements.last().data('ivid').length - 1];
    }
    
    this.showDocumentForItemId(nextId);
    const nextElement = this.elementsForItemId(nextId); 
    this.showElement(nextElement);
    // If this is a table cell with multiple nested tags pass all tags so that
    // all are shown in the inspector. 
    this.selectElement(nextId, this._ixIdsForElement(nextElement));
}

Viewer.prototype._bindHandlers = function () {
    var viewer = this;
    $('.ixbrl-element', this._contents)
        .click(function (e) {
            e.stopPropagation();
            viewer.selectElementByClick($(this));
        })
        .mouseenter(function (e) { viewer._mouseEnter($(this)) })
        .mouseleave(function (e) { viewer._mouseLeave($(this)) });
    $("body", this._contents)
        .click(function (e) {
            viewer.selectElement(null);
        });
    
    $('#iframe-container .zoom-in').click(function () { viewer.zoomIn() });
    $('#iframe-container .zoom-out').click(function () { viewer.zoomOut() });

    TableExport.addHandles(this._contents, this._report);
}

Viewer.prototype.selectNextTag = function (currentFact) {
    this._selectAdjacentTag(1, currentFact);
}

Viewer.prototype.selectPrevTag = function (currentFact) {
    this._selectAdjacentTag(-1, currentFact);
}

/*
 * Calculate the intersection of two rectangles
 */
Viewer.prototype.intersect = function(r1, r2) {
    const r3 = {
        left: Math.max(r1.left, r2.left),
        top: Math.max(r1.top, r2.top),
        right: Math.min(r1.right, r2.right),
        bottom: Math.min(r1.bottom, r2.bottom)
    };
    r3.width = r3.right - r3.left;
    r3.height = r3.bottom - r3.top;
    return r3;
}

Viewer.prototype.isScrollableElement = function (domNode) {
    const overflowy = $(domNode).css('overflow-y');
    if (domNode.clientHeight > 0 && domNode.clientHeight < domNode.scrollHeight
        && (overflowy == "auto" || overflowy == 'scroll')) {
        return true;
    }
    const overflowx = $(domNode).css('overflow-x');
    if (domNode.clientWidth > 0 && domNode.clientWidth < domNode.scrollWidth
        && (overflowx == "auto" || overflowx == 'scroll')) {
        return true;
    }
    return false;
}

/*
 * Determine if the element is fully visible within all scrollable ancestors
 */
Viewer.prototype.isFullyVisible = function (node) {
    var r1 = node.getBoundingClientRect();
    const r2 = node.getBoundingClientRect();
    var ancestor = $(node.parentElement);
    while (!ancestor.is('body')) {
        if (this.isScrollableElement(ancestor[0])) {
            r1 = this.intersect(r1, ancestor[0].getBoundingClientRect());
        }
        // If the width or height of the intersection is less than the original
        // element, then it's not fully visible.
        if (r1.width < r2.width || r1.height < r2.height) {
            return false;
        }
        ancestor = ancestor.parent();
    } 
    const de = ancestor.closest("html").get(0);
    return r1.left > 0 && r1.top > 0 && r1.right < de.clientWidth && r1.bottom < de.clientHeight;
}

/* If the specified element is not fully visible, scroll it into the center of
 * the viewport */
Viewer.prototype.showElement = function(e) {
    var ee = e.get(0);
    if (!this.isFullyVisible(ee)) {
        ee.scrollIntoView({ block: "center", inline: "center" });
    }
}

Viewer.prototype.clearHighlighting = function () {
    $("body", this._iframes.contents()).find(".ixbrl-element").removeClass("ixbrl-selected").removeClass("ixbrl-related").removeClass("ixbrl-linked-highlight");
}

Viewer.prototype._ixIdsForElement = function (e) {
    var ids = e.data('ivid');
    if (e.hasClass("ixbrl-continuation")) {
        ids = [...ids];
        /* If any of the ids are continuations, replace them with the IDs of
         * their underlying facts */
        for (var i = 0; i < ids.length; i++) {
            const cof = this._continuedAtMap[ids[i]];
            if (cof !== undefined) {
                ids[i] = cof.continuationOf;
            }
        }
    }
    return ids;
}

/*
 * Select the fact corresponding to the specified element.
 *
 * Takes an optional list of factIds corresponding to all facts that a click
 * falls within.  If omitted, it's treated as a click on a non-nested fact.
 */
Viewer.prototype.selectElement = function (itemId, itemIdList) {
    if (itemId !== null) {
        this.onSelect.fire(itemId, itemIdList);
    }
    else {
        this.onSelect.fire(null);
    }
}

// Handle a mouse click to select.  This finds all tagged elements that the
// mouse click is within, and returns a list of item IDs for the items that
// they're tagging.  This is so the inspector can show all items that were
// under the click.
// The initially selected element is the highest ancestor which is tagging
// exactly the same content as the clicked element.  This is so that when we
// have double tagged elements, we select the first of the set, but where we
// have nested elements, we select the innermost, as this gives the most
// intuitive behaviour when clicking "next".
Viewer.prototype.selectElementByClick = function (e) {
    var itemIDList = [];
    var viewer = this;
    var sameContentAncestorId;
    // If the user clicked on a sub-element, treat as if we clicked the first
    // non-sub-element ancestor in the DOM hierarchy - which would typically be
    // the corresponding ixbrl-element.
    if (e.hasClass('ixbrl-sub-element')) {
        e = e.parents('.ixbrl-element:not(.ixbrl-sub-element)').first();
    }
    e.parents(".ixbrl-element").addBack().filter(':not(.ixbrl-sub-element)').each(function () { 
        const ids = viewer._ixIdsForElement($(this));
        itemIDList = itemIDList.concat(ids); 
        if ($(this).text() == e.text() && sameContentAncestorId === undefined) {
            sameContentAncestorId = ids[0];
        }
    });
    this.selectElement(sameContentAncestorId, itemIDList);
}

Viewer.prototype._mouseEnter = function (e) {
    var id = e.data('ivid')[0];
    this.onMouseEnter.fire(id);
}

Viewer.prototype._mouseLeave = function (e) {
    var id = e.data('ivid')[0];
    this.onMouseLeave.fire(id);
}

Viewer.prototype.highlightRelatedFact = function (f) {
    this.changeItemClass(f.id, "ixbrl-related");
}

Viewer.prototype.highlightRelatedFacts = function (facts) {
    for (const f of facts) {
        this.changeItemClass(f.id, "ixbrl-related");
    }
}

Viewer.prototype.clearRelatedHighlighting = function (f) {
    $(".ixbrl-related", this._contents).removeClass("ixbrl-related");
}

// Return a jQuery node list for wrapper elements corresponding to 
// the factId.  May contain more than one node if the IX node contains
// absolutely positioned elements.
Viewer.prototype.elementsForItemId = function (factId) {
    return this._ixNodeMap[factId].wrapperNodes; 
}

Viewer.prototype.elementsForItemIds = function (ids) {
    var viewer = this;
    return $($.map(ids, function (id, n) {
        return viewer._ixNodeMap[id].wrapperNodes.get();
    }));
}

/*
 * Add or remove a class to an item (fact or footnote) and any continuation elements
 */
Viewer.prototype.changeItemClass = function(itemId, highlightClass, removeClass) {
    const continuations = this._ixNodeMap[itemId].continuationIds();
    const elements = this.elementsForItemIds([itemId].concat(continuations));
    if (removeClass) {
        elements.removeClass(highlightClass);
    }
    else {
        elements.addClass(highlightClass);
    }
}

/*
 * Change the currently highlighted item
 */
Viewer.prototype.highlightItem = function(factId) {
    this.clearHighlighting();
    this.changeItemClass(factId, "ixbrl-selected");
}

Viewer.prototype.showItemById = function (id) {
    if (id !== null) {
        let elts = this.elementsForItemId(id);
        this.showDocumentForItemId(id);
        /* Hidden elements will return an empty node list */
        if (elts.length > 0) {
            this.showElement(elts);
        }
    }
}

Viewer.prototype.highlightAllTags = function (on, namespaceGroups) {
    var groups = {};
    $.each(namespaceGroups, function (i, ns) {
        groups[ns] = i;
    });
    var report = this._report;
    var viewer = this;
    if (on) {
        // XXX Needs review.
        $(".ixbrl-element:not(.ixbrl-continuation)", this._contents).each(function () {
            var factId = $(this).data('ivid')[0];
            var ixn = viewer._ixNodeMap[factId];
            var elements = viewer.elementsForItemIds([factId].concat(ixn.continuationIds()));
            elements.addClass("ixbrl-highlight");

            if (!ixn.footnote) {
                var i = groups[report.getItemById(factId).conceptQName().prefix];
                if (i !== undefined) {
                    elements.addClass("ixbrl-highlight-" + i);
                }
            }
        });
    }
    else {
        $(".ixbrl-element", this._contents).removeClass (function (i, className) {
            return (className.match (/(^|\s)ixbrl-highlight\S*/g) || []).join(' ');
        });
    }
}

Viewer.prototype._zoom = function () {
    var viewTop = this._contents.scrollTop();
    var height = $("html",this._contents).height();
    $('body', this._contents).css('zoom',this.scale);

    var newHeight = $("html", this._contents).height();
    this._contents.scrollTop(newHeight * (viewTop)/height );
}

Viewer.prototype.zoomIn = function () {
    this.scale *= 1.1;
    this._zoom();
}

Viewer.prototype.zoomOut = function () {
    this.scale /= 1.1;
    this._zoom();
}

Viewer.prototype.factsInSameTable = function (fact) {
    var facts = [];
    const e = this.elementsForItemId(fact.id);
    // XXX does this de-duplicate?
    e.closest("table").find(".ixbrl-element").each(function () {
        facts = facts.concat($(this).data('ivid'));
    });
    return facts;
}

Viewer.prototype.linkedHighlightFact = function (f) {
    this.changeItemClass(f.id, "ixbrl-linked-highlight");
}

Viewer.prototype.clearLinkedHighlightFact = function (f) {
    this.changeItemClass(f.id, "ixbrl-linked-highlight", true);
}

Viewer.prototype._setTitle = function (docIndex) {
    $('#top-bar .document-title').text($('head title', this._iframes.eq(docIndex).contents()).text());
}

Viewer.prototype.showDocumentForItemId = function(itemId) {
    this.selectDocument(this._ixNodeMap[itemId].docIndex);
}

Viewer.prototype.currentDocument = function () {
    return this._iframes.filter(function () { return $(this).data("selected") });
}

Viewer.prototype.selectDocument = function (docIndex) {
    $('#ixv #viewer-pane .ixds-tabs .tab')
        .removeClass("active")
        .eq(docIndex)
        .addClass("active");
    /* Show/hide documents using height rather than display property to avoid a
     * delay when switching tabs on large, slow-to-render documents. */
    this._iframes
        .height(0)
        .data("selected", false)
        .eq(docIndex)
        .height("100%")
        .data("selected", true);
    this._setTitle(docIndex);
}
