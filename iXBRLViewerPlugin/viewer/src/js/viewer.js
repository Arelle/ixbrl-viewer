// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { numberMatchSearch, fullDateMatch } from './number-matcher.js'
import { TableExport } from './tableExport.js'
import { escapeRegex } from './util.js'
import { IXNode } from './ixnode.js';
import { setDefault, runGenerator } from './util.js';
import { DocOrderIndex } from './docOrderIndex.js';
import { MessageBox } from './messagebox.js';

export class DocumentTooLargeError extends Error {}

function localName(e) {
    if (e.indexOf(':') == -1) {
        return e
    }
    else {
        return e.substring(e.indexOf(':') + 1)
    }
}


export class Viewer {
    constructor(iv, iframes, report) {
        this._iv = iv;
        this._report = report;
        this._iframes = iframes;
        this._contents = iframes.contents();
        this.onSelect = $.Callbacks();
        this.onMouseEnter = $.Callbacks();
        this.onMouseLeave = $.Callbacks();

        this._ixNodeMap = {};
        this._docOrderItemIndex = new DocOrderIndex();
        this._currentDocumentIndex = 0;
    }

    _checkContinuationCount() {
        const continuationCount = Object.keys(this.continuationOfMap).length
        if (continuationCount > this._iv.options.continuationElementLimit) {
            const contents = $('<div></div>')
                .append($('<p></p>').text(`This document contains a very large number of iXBRL elements (found ${continuationCount} ix:continuation elements).`))
                .append($('<p></p>').text('You may experience performance problems viewing this document, or the viewer may not load at all.'))
                .append($('<p></p>').text('Do you want to continue trying to load this document?'));

            const mb = new MessageBox("Large document warning", contents, "Continue", "Cancel");
            return mb.showAsync().then((result) => {
                if (!result) {
                    throw new DocumentTooLargeError("Too many continuations");
                }
            });
        }
        return Promise.resolve();
    }

    initialize() {
        return new Promise(async (resolve, reject) => {
            const viewer = this;
            viewer._buildContinuationMaps();
            viewer._checkContinuationCount()
                .catch(err => { throw err })
                .then(() => viewer._iv.setProgress("Pre-processing document"))
                .then(() => {

                    viewer._iframes.each(function (docIndex) { 
                        $(this).data("selected", docIndex == viewer._currentDocumentIndex);
                        viewer._preProcessiXBRL($(this).contents().find("body").get(0), docIndex);
                    });

                    /* Call plugin promise for each document in turn */
                    (async function () {
                        for (const [docIndex, iframe] of viewer._iframes.toArray().entries()) {
                            const body = $(iframe).contents().find("body").get(0);
                            await viewer._iv.pluginPromise('preProcessiXBRL', body, docIndex);
                            if (viewer._iv.isReviewModeEnabled()) {
                                await new Promise((resolve, _) => {
                                    viewer._iv.setProgress("Finding untagged numbers and dates").then(() => {
                                        // Temporarily hide all children of "body" to avoid constant
                                        // re-layouts when wrapping untagged numbers
                                        const children = $(body).children(':visible');
                                        children.hide();
                                        $(body).addClass("review");
                                        viewer._wrapUntaggedNumbers($(body), docIndex, false);
                                        children.show();
                                        resolve();
                                    });
                                });
                            }
                        }
                    })()
                        .then(() => viewer._iv.setProgress("Preparing document") )
                        .then(() => {
                            this._report.setIXNodeMap(this._ixNodeMap);
                            this._applyStyles();
                            this._bindHandlers();
                            this.scale = 1;
                            this._setTitle(0);
                            this._addDocumentSetTabs();
                            resolve();
                        });
                })
                .catch(err => reject(err));
        });
    }

    _addDocumentSetTabs() {
        if (this._report.isDocumentSet()) {
            $('#ixv .ixds-tabs').show();
            for (const [i, doc] of this._report.documentSetFiles().entries()) {
                $('<div class="tab">')
                    .text(doc)
                    .prop('title', doc)
                    .data('ix-doc-id', i)
                    .click(() => this.selectDocument(i))
                    .appendTo($('#ixv #viewer-pane .ixds-tabs .tab-area'));
            }
            $('#ixv #viewer-pane .ixds-tabs .tab-area .tab').eq(0).addClass("active");
        }
    }

    // Wrap a DOM node in a div or span.  If the node or any descendent has
    // display: block, a div is used, otherwise a span.  Returns the wrapper node
    // as a jQuery node
    _wrapNode(n) {
        var wrapper = "<span>";
        const nn = n.getElementsByTagName("*");
        for (var i = 0; i < nn.length; i++) {
            if (getComputedStyle(nn[i]).getPropertyValue('display') === "block") {
                wrapper = '<div>';
                break;
            }
        }
        $(n).wrap(wrapper);
        return $(n).parent();
    }


    _wrapUntaggedNumbers(n, docIndex, ignoreFullMatch) {
        const viewer = this;
        const ixHiddenStyleRE = /(?:^|\s|;)-(?:sec|esef)-ix-hidden:\s*([^\s;]+)/;

        n.contents().each(function () {
            if (this.nodeType === Node.ELEMENT_NODE) {
                const name = localName(this.nodeName.toUpperCase());
                /*
                 * Content in text tags should not be considered tagged, so carry
                 * on searching if it's not:
                 *
                 *  1. nonFraction (a tagged number)
                 *  2. nonNumerics with a format (mostly dates, not a text block)
                 *  3. an element with a -sec-ix-hidden style.  This shouldn't be
                 *     used on a text block, so we assume it's a more specific tag.
                 *
                 *  When we continue searching, if the element is a nonNumeric tag
                 *  and it's entire contents match the number matcher, we consider
                 *  that tagged.
                 *
                 */
                if (!(
                        name === 'NONFRACTION' ||
                        (name === 'NONNUMERIC' && this.getAttribute('format') !== null) ||
                        (this.hasAttribute('style') && this.getAttribute('style').match(ixHiddenStyleRE))
                )) {
                    viewer._wrapUntaggedNumbers($(this), docIndex, name === 'NONNUMERIC');
                }
            }
            else if (this.nodeType === Node.TEXT_NODE) {
                const input = this.nodeValue;
                const output = $("<div></div>");
                let pos = 0;
                numberMatchSearch(input, function (m, do_not_want, is_date) {
                    if (m.index > pos) {
                        output.append(document.createTextNode(input.substring(pos, m.index)));
                    }
                    // If "ignoreFullMatch" is specified, we ignore a match which
                    // covers the whole of n's text content.
                    if (do_not_want ||
                            (ignoreFullMatch && m.index === 0 && m.index + m[0].length === input.length && input === n.text())) {
                        output.append(document.createTextNode(m[0]));
                    }
                    else {
                        const c = is_date ? 'review-untagged-date' : 'review-untagged-number';
                        $('<span></span>')
                                .text(m[0])
                                .addClass(c)
                                .appendTo(output);
                    }
                    pos = m.index + m[0].length;
                });
                if (pos < input.length) {
                    output.append(document.createTextNode(input.substring(pos, input.length)));
                }
                $(this).replaceWith(output.contents());
            }
        });
    }

    /*
     * Select the document within the current document set identified docIndex, and
     * if specified, the element identified by fragment (via id or a.name
     * attribute)
     */
    _showDocumentAndElement(docIndex, fragment) {
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
    _updateLink(n) {
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

    _findOrCreateWrapperNode(domNode) {
        const v = this;
        /* Is the element the only significant content within a <td> or <th> ? If
         * so, use that as the wrapper element. */
        var nodes = $(domNode).closest("td,th").eq(0);
        const innerText = $(domNode).text();
        if (nodes.length == 1 && innerText.length > 0) {
            // Use indexOf rather than a single regex because innerText may
            // be too long for the regex engine 
            const outerText = $(nodes).text();
            const start = outerText.indexOf(innerText);
            const wrapper = outerText.substring(0, start) + outerText.substring(start + innerText.length);
            if (/[0-9A-Za-z]/.test(wrapper)) {
                nodes = $();
            } 
        }
        /* Otherwise, insert a <span> as wrapper */
        if (nodes.length == 0) {
            nodes = this._wrapNode(domNode);
            // Create a node set of current node and all absolutely positioned
            // descendants.
            nodes = nodes.find("*").addBack().filter(function (n, e) {
                return (this == nodes[0] || (getComputedStyle(this).getPropertyValue('position') === "absolute"));
            });
        }
        nodes.each(function (i) {
            // getBoundingClientRect blocks on layout, so only do it if we've actually got absolute nodes
            if (nodes.length > 1) {
                this.classList.add("ixbrl-contains-absolute");
            }
            if (i == 0) {
                this.classList.add("ixbrl-element");
            }
            else {
                this.classList.add("ixbrl-sub-element");
            }
        });
        return nodes;
    }


    // Adds the specified ID to the "ivids" data list on the given node
    _addIdToNode(node, id) {
        const ivids = node.data('ivids') || [];
        ivids.push(id);
        node.data('ivids', ivids);
    }

    _buildContinuationMaps() {
        // map of element id to next element id in continuation chain
        const nextContinuationMap = {};
        // map of items in default target document to all their continuations
        const itemContinuationMap = {};
        this._iframes.contents().find("body *").each(function () {
            const name = localName(this.nodeName).toUpperCase();
            if (['NONNUMERIC', 'NONFRACTION', 'FOOTNOTE', 'CONTINUATION'].includes(name)) {
                const nodeId = this.getAttribute('id');
                const continuedAtId = this.getAttribute("continuedAt");
                if (continuedAtId !== null) {
                    nextContinuationMap[nodeId] = continuedAtId;
                }
                if (name != 'CONTINUATION' && !this.hasAttribute('target')) {
                    itemContinuationMap[nodeId] = [];
                }
            }
        });

        // Map of continuation IDs to list of (default target doc) items that
        // they're continuations of
        this.continuationOfMap = {};
        for (const [itemId, itemContinuations] of Object.entries(itemContinuationMap)) {
            var id = itemId;
            while (nextContinuationMap[id] !== undefined) {
                id = nextContinuationMap[id];
                itemContinuations.push(id);
                if (this.continuationOfMap[id] !== undefined) {
                    console.log("Continuation '" + id + "' is a continuation of multiple items.");
                }
                this.continuationOfMap[id] = itemId;
            }
        }
        this.itemContinuationMap = itemContinuationMap;
    }

    //
    // Traverse the DOM hierarchy to find IX elements, and build maps and add
    // wrapper nodes and classes.
    //
    // Primary classes, one of:
    //   .ixbrl-element        a wrapper for any ix: fact, footnote, or continuation
    //   .ixbrl-sub-element    an absolutely positioned element within an
    //                         ixbrl-element.  These require separate highlighting.
    //   .ixbrl-element-hidden an ix: element inside ix:hidden
    //
    // Additional classes:
    //   .ixbrl-no-highlight   a zero-height .ixbrl-element - no highlighting or 
    //                         borders applied
    //   .ixbrl-element-nonfraction,
    //   .ixbrl-element-nonnumeric,
    //   .ixbrl-continuation, 
    //   .ixbrl-element-footnote       
    //                         Indicates type of element being wrapped
    //
    // All ixbrl-elements have "ivids" data added, which is a list of the ID
    // attribute(s) of corresponding IX item(s).  Continuations have the IDs of
    // their head items (fact or footnotes).
    // "ivids" can be a mix of different types.
    //
    // Viewer._ixNodeMap is a map of these IDs to IXNode objects.
    //
    // Viewer._docOrderItemIndex is a DocOrderIndex object that maintains a list of
    // fact and footnotes in document order.
    //
    _preProcessiXBRL(n, docIndex, inHidden) {
        const name = localName(n.nodeName).toUpperCase();
        const isFootnote = name === 'FOOTNOTE';
        const isContinuation = name === 'CONTINUATION';
        const isNonNumeric = name === 'NONNUMERIC';
        const isNonFraction = name === 'NONFRACTION';
        const isFact = isNonNumeric || isNonFraction;
        if (n.nodeType === 1) {
            // Ignore iXBRL elements that are not in the default target document, as
            // the viewer builder does not handle these, and the builder does not
            // ensure that they have ID attributes.
            const id = n.getAttribute("id");
            if (((isFact || isFootnote) && !n.hasAttribute("target"))
                || (isContinuation && this.continuationOfMap[id] !== undefined)) {
                var nodes;
                if (inHidden) {
                    nodes = $(n);
                } else {
                    nodes = this._findOrCreateWrapperNode(n);
                }

                // For a continuation, store the IX ID(s) of the item(s), not the continuation
                const headId = isContinuation ? this.continuationOfMap[id] : id;
                this._addIdToNode(nodes.first(), headId);

                // We may have already created an IXNode for this ID from a -sec-ix-hidden
                // element 
                var ixn = this._ixNodeMap[id];
                if (!ixn) {
                    ixn = new IXNode(id, nodes, docIndex);
                    this._ixNodeMap[id] = ixn;
                }
                if (inHidden) {
                    ixn.isHidden = true;
                    nodes.addClass("ixbrl-element-hidden");
                }
                if (isContinuation) {
                    $(nodes).addClass("ixbrl-continuation");
                }
                else {
                    this._docOrderItemIndex.addItem(id, docIndex);
                }
                if (isNonFraction) {
                    $(nodes).addClass("ixbrl-element-nonfraction");
                    if (n.hasAttribute('scale')) {
                        const scale = Number(n.getAttribute('scale'));
                        // Set scale if the value is a valid number and is not a redundant 0/"ones" scale.
                        if (!Number.isNaN(scale) && scale !== 0) {
                            ixn.scale = scale;
                        }
                    }
                }
                if (isNonNumeric) {
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
            else if(name == 'HIDDEN') {
                inHidden = true;
            }
            else {
                // Handle SEC/ESEF links-to-hidden
                const id = this._getIXHiddenLinkStyle(n);
                if (id !== null) {
                    nodes = $(n);
                    nodes.addClass("ixbrl-element").data('ivids', [id]);
                    this._docOrderItemIndex.addItem(id, docIndex);
                    /* We may have already seen the corresponding ix element in the hidden
                     * section */
                    const ixn = this._ixNodeMap[id];
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
        }
        this._preProcessChildNodes(n, docIndex, inHidden);
    }

    _getIXHiddenLinkStyle(domNode) {
        if (domNode.hasAttribute('style')) {
            const re = /(?:^|\s|;)-(?:sec|esef)-ix-hidden:\s*([^\s;]+)/;
            const m = domNode.getAttribute('style').match(re);
            if (m) {
                return m[1];
            }
        }
        return null;
    }

    _preProcessChildNodes(domNode, docIndex, inHidden) {
        for (const childNode of domNode.childNodes) {
            this._preProcessiXBRL(childNode, docIndex, inHidden);
        }
    }

    _applyStyles() {
        const stlyeElts = $("<style>")
            .prop("type", "text/css")
            .text(require('css-loader!less-loader!../less/viewer.less').toString())
            .appendTo(this._iframes.contents().find("head"));
        this._iv.callPluginMethod("updateViewerStyleElements", stlyeElts);
    }

    contents() {
        return this._iframes.contents();
    }

    // Move by offset (+1 or -1) through the tags in the document in document
    // order.
    //
    // Each element may have one or more tags associated with it, so we need to
    // move through the list of tags associated with the current element before
    // moving to the next/prev element
    //
    _selectAdjacentTag(offset, currentItem) {
        var nextId;
        if (currentItem !== null) {
            nextId = this._docOrderItemIndex.getAdjacentItem(currentItem.id, offset);
            this.showDocumentForItemId(nextId);
        }
        // If no fact selected go to the first or last in the current document
        else if (offset > 0) {
            nextId = this._docOrderItemIndex.getFirstInDocument(this._currentDocumentIndex);
        } 
        else {
            nextId = this._docOrderItemIndex.getLastInDocument(this._currentDocumentIndex);
        }
        
        const nextElement = this.elementsForItemId(nextId); 
        this.showElement(nextElement);
        // If this is a table cell with multiple nested tags pass all tags so that
        // all are shown in the inspector. 
        this.selectElement(nextId, this._ixIdsForElement(nextElement));
    }

    _bindHandlers() {
        const viewer = this;
        $('.ixbrl-element', this._contents)
            .click(function (e) {
                e.stopPropagation();
                viewer.selectElementByClick($(this));
            })
            .mouseenter(function (e) { viewer._mouseEnter($(this)) })
            .mouseleave(function (e) { viewer._mouseLeave($(this)) });
        $("body", this._contents)
            .click(() => viewer.selectElement(null));
        
        $('#iframe-container .zoom-in').click(() => this.zoomIn());
        $('#iframe-container .zoom-out').click(() => this.zoomOut());
        $('#iframe-container .print').click(() => this.currentDocument().get(0).contentWindow.print());

        TableExport.addHandles(this._contents, this._report);
    }

    selectNextTag(currentFact) {
        this._selectAdjacentTag(1, currentFact);
    }

    selectPrevTag(currentFact) {
        this._selectAdjacentTag(-1, currentFact);
    }

    /*
     * Calculate the intersection of two rectangles
     */
    intersect(r1, r2) {
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

    isScrollableElement(domNode) {
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
    isFullyVisible(node) {
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
        // In quirks mode, clientHeight of body is viewport height.  In standards
        // mode, clientHeight of html is viewport height.
        const quirksMode = node.ownerDocument.compatMode != 'CSS1Compat';
        const de = quirksMode ? ancestor : ancestor.closest("html").get(0);
        return r1.left > 0 && r1.top > 0 && r1.right < de.clientWidth && r1.bottom < de.clientHeight;
    }

    /* If the specified element is not fully visible, scroll it into the center of
     * the viewport */
    showElement(e) {
        const ee = e.get(0);
        if (!this.isFullyVisible(ee)) {
            ee.scrollIntoView({ block: "center", inline: "center" });
        }
    }

    clearHighlighting() {
        $("body", this._iframes.contents()).find(".ixbrl-element, .ixbrl-sub-element").removeClass("ixbrl-selected").removeClass("ixbrl-related").removeClass("ixbrl-linked-highlight");
    }

    _ixIdsForElement(e) {
        return e.data('ivids');
    }

    /*
     * Select the fact corresponding to the specified element.
     *
     * Takes an optional list of factIds corresponding to all facts that a click
     * falls within.  If omitted, it's treated as a click on a non-nested fact.
     *
     * byClick indicates that the element was clicked directly, and in this
     * case we never scroll to make it more visible.
     */
    selectElement(itemId, itemIdList, byClick) {
        if (itemId !== null) {
            this.onSelect.fire(itemId, itemIdList, byClick);
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
    selectElementByClick(e) {
        var itemIDList = [];
        const viewer = this;
        var sameContentAncestorId;
        // If the user clicked on a sub-element (and which is not also a proper
        // ixbrl-element) treat as if we clicked the first non-sub-element
        // ancestor in the DOM hierarchy - which would typically be
        // the corresponding ixbrl-element (or one of the corresponding
        // ixbrl-elements, in the case of nested tags)
        // This is important in order to guarantee that sameContentAncestorId gets
        // assigned below.
        // We can't just ignore clicks on sub elements altogether because they are
        // likely to be rendered outside the "enclosing" ixbrl-element.
        if (!e.hasClass(".ixbrl-element")) {
            e = e.closest(".ixbrl-element");
        }
        // Now find all iXBRL IDs on all ancestors in document order, making a note
        // of the first one (sameContentAncestorId) that has exactly the same
        // content as "e"
        e.parents(".ixbrl-element").addBack().each(function () { 
            const ids = viewer._ixIdsForElement($(this));
            itemIDList = itemIDList.concat(ids); 
            if ($(this).text() == e.text() && sameContentAncestorId === undefined) {
                sameContentAncestorId = ids[0];
            }
        });
        this.selectElement(sameContentAncestorId, itemIDList, true);
    }

    _mouseEnter(e) {
        const id = e.data('ivids')[0];
        this.onMouseEnter.fire(id);
    }

    _mouseLeave(e) {
        const id = e.data('ivids')[0];
        this.onMouseLeave.fire(id);
    }

    highlightRelatedFact(f) {
        this.changeItemClass(f.id, "ixbrl-related");
    }

    highlightRelatedFacts(facts) {
        for (const f of facts) {
            this.changeItemClass(f.id, "ixbrl-related");
        }
    }

    clearRelatedHighlighting(f) {
        $(".ixbrl-related", this._contents).removeClass("ixbrl-related");
    }

    // Return a jQuery node list for wrapper elements corresponding to 
    // the factId.  May contain more than one node if the IX node contains
    // absolutely positioned elements.
    elementsForItemId(factId) {
        return this._ixNodeMap[factId].wrapperNodes; 
    }

    elementsForItemIds(ids) {
        return $(ids.map(id => this._ixNodeMap[id].wrapperNodes.get()).flat());
    }

    /*
     * Add or remove a class to an item (fact or footnote) and any continuation elements
     */
    changeItemClass(itemId, highlightClass, removeClass) {
        const elements = this.elementsForItemIds([itemId].concat(this.itemContinuationMap[itemId]))
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
    highlightItem(factId) {
        this.clearHighlighting();
        this.changeItemClass(factId, "ixbrl-selected");
    }

    showItemById(id) {
        if (id !== null) {
            let elts = this.elementsForItemId(id);
            this.showDocumentForItemId(id);
            /* Hidden elements will return an empty node list */
            if (elts.length > 0) {
                this.showElement(elts);
            }
        }
    }

    highlightAllTags(on, namespaceGroups) {
        const groups = {};
        $.each(namespaceGroups, function (i, ns) {
            groups[ns] = i;
        });
        const report = this._report;
        const viewer = this;
        if (on) {
            $(".ixbrl-element", this._contents)
                .addClass("ixbrl-highlight")
                .each(function () {
                    // Find the first ixn for this element that isn't a footnote.
                    // Choosing the first means that we're arbitrarily choosing a
                    // highlight color for an element that is double tagged in a
                    // table cell.
                    const ixn = $(this).data('ivids').map(id => viewer._ixNodeMap[id]).filter(ixn => !ixn.footnote)[0];
                    if (ixn != undefined) {
                        const elements = viewer.elementsForItemIds(ixn.chainIXIds());
                        const i = groups[report.getItemById(ixn.id).conceptQName().prefix];
                        if (i !== undefined) {
                            elements.addClass("ixbrl-highlight-" + i);
                        }
                    }
            });
            $(".ixbrl-sub-element", this._contents).addClass("ixbrl-highlight");
        }
        else {
            $(".ixbrl-element, .ixbrl-sub-element", this._contents).removeClass(
                (i, className) => (className.match (/(^|\s)ixbrl-highlight\S*/g) || []).join(' ')
            );
        }
    }

    _zoom() {
        const viewTop = this._contents.scrollTop();
        const height = $("html", this._contents).height();
        $('body', this._contents).css('zoom', this.scale);

        const newHeight = $("html", this._contents).height();
        this._contents.scrollTop(newHeight * (viewTop)/height );
    }

    zoomIn() {
        this.scale *= 1.1;
        this._zoom();
    }

    zoomOut() {
        this.scale /= 1.1;
        this._zoom();
    }

    factsInSameTable(fact) {
        var facts = [];
        const e = this.elementsForItemId(fact.id);
        e.closest("table").find(".ixbrl-element").each(function () {
            facts = facts.concat($(this).data('ivids'));
        });
        return facts;
    }

    linkedHighlightFact(f) {
        this.changeItemClass(f.id, "ixbrl-linked-highlight");
    }

    clearLinkedHighlightFact(f) {
        this.changeItemClass(f.id, "ixbrl-linked-highlight", true);
    }

    _setTitle(docIndex) {
        $('#top-bar .document-title').text($('head title', this._iframes.eq(docIndex).contents()).text());
    }

    showDocumentForItemId(itemId) {
        this.selectDocument(this._ixNodeMap[itemId].docIndex);
    }

    currentDocument() {
        return this._iframes.eq(this._currentDocumentIndex);
    }

    selectDocument(docIndex) {
        this._currentDocumentIndex = docIndex;
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

    * postProcess() {
        for (const iframe of this._iframes.get()) {
            const elts = $(iframe).contents().get(0).querySelectorAll(".ixbrl-contains-absolute");
            // In some cases, getBoundingClientRect().height returns 0, and
            // immediately repeating the call returns > 0, so do this in two passes.
            for (const [i, e] of elts.entries()) {
                if (getComputedStyle(e).getPropertyValue("display") !== 'inline') {
                    e.getBoundingClientRect().height
                }
                if (i % 100 === 0) {
                    yield;
                }
            }
            for (const [i, e] of elts.entries()) {
                if (getComputedStyle(e).getPropertyValue("display") !== 'inline' && e.getBoundingClientRect().height == 0) {
                    e.classList.add("ixbrl-no-highlight");
                }
                if (i % 100 === 0) {
                    yield;
                }
            }
        }
    }

    postLoadAsync() {
        runGenerator(this.postProcess());
    }

}
