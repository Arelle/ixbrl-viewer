// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { numberMatchSearch } from './number-matcher.js'
import { TableExport } from './tableExport.js'
import { IXNode } from './ixnode.js';
import { getIXHiddenLinkStyle, runGenerator, viewerUniqueId, HIGHLIGHT_COLORS } from './util.js';
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
    constructor(iv, iframes, reportSet) {
        this._iv = iv;
        this._reportSet = reportSet;
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
                        const reportIndex = $(this).data("report-index");
                        viewer._preProcessiXBRL($(this).contents().find("body").get(0), reportIndex, docIndex, false);
                    });

                    viewer._setContinuationMaps();

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
                            this._reportSet.setIXNodeMap(this._ixNodeMap);
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
        if (this._reportSet.isMultiDocumentViewer()) {
            $('#ixv .ixds-tabs').show();
            for (const [i, doc] of this._reportSet.reportFiles().entries()) {
                $('<button class="tab"></button>')
                    .text(doc.file)
                    .prop('title', doc.file)
                    .data('ix-doc-id', i)
                    .on("click", () => this.selectDocument(i))
                    .appendTo($('#ixv #viewer-pane .ixds-tabs .tab-area'));
            }
            $('#ixv #viewer-pane .ixds-tabs .tab-area .tab').eq(0).addClass("active");
        }
    }

    // Wrap a DOM node in a div or span.  If the node or any descendent has
    // display: block, a div is used, otherwise a span.  Returns the wrapper node
    // as a jQuery node
    _wrapNode(n) {
        let wrapper = "<span>";
        if (getComputedStyle(n).getPropertyValue("display") === "block") {
            wrapper = '<div>';
        }
        else {
            const nn = n.getElementsByTagName("*");
            for (var i = 0; i < nn.length; i++) {
                if (getComputedStyle(nn[i]).getPropertyValue('display') === "block") {
                    wrapper = '<div>';
                    break;
                }
            }
        }
        $(n).wrap(wrapper);
        return n.parentNode;
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
            const docIndex = this._reportSet.reportFiles().indexOf(file);
            if (!url.includes('/') && docIndex != -1) {
                $(n).on("click", (e) => { 
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

    _findOrCreateWrapperNode(domNode, inHidden) {
        const v = this;

        if (inHidden) {
            return $(domNode).addClass("ixbrl-element-hidden");
        }

        /* Is the element the only significant content within a <td> or <th> ? If
         * so, use that as the wrapper element.
         * Check for 'display: table-cell' to avoid using hidden cells */
        const tableNode = domNode.closest("td,th");
        const nodes = [];
        const innerText = $(domNode).text();
        if (tableNode !== null && getComputedStyle(tableNode).display === 'table-cell' && innerText.length > 0) {
            // Use indexOf rather than a single regex because innerText may
            // be too long for the regex engine 
            const outerText = $(tableNode).text();
            const start = outerText.indexOf(innerText);
            const wrapper = outerText.substring(0, start) + outerText.substring(start + innerText.length);
            if (!/[0-9A-Za-z]/.test(wrapper)) {
                nodes.push(tableNode)
            } 
        }
        /* Otherwise, insert a <span> or <div> as wrapper */
        if (nodes.length == 0) {
            nodes.push(this._wrapNode(domNode));
        }
        // Create a list of the wrapper node, and all absolutely positioned descendants.
        for (const e of nodes[0].querySelectorAll("*")) { 
            if (getComputedStyle(e).getPropertyValue('position') === "absolute") { 
                nodes.push(e);
            } 
        }
        for (const [i, n] of nodes.entries()) {
            // getBoundingClientRect blocks on layout, so only do it if we've actually got absolute nodes
            if (nodes.length > 1) {
                n.classList.add("ixbrl-contains-absolute");
            }
            if (i == 0) {
                n.classList.add("ixbrl-element");
            }
            else {
                n.classList.add("ixbrl-sub-element");
            }
        }
        return $(nodes);
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
        this._iframes.each((n, iframe) => {
            const reportIndex = $(iframe).data("report-index");
            $(iframe).contents().find("body *").each((m, node) => {
                const name = localName(node.nodeName).toUpperCase();
                if (['NONNUMERIC', 'NONFRACTION', 'FOOTNOTE', 'CONTINUATION'].includes(name) && node.hasAttribute('id')) {
                    const nodeId = viewerUniqueId(reportIndex, node.getAttribute('id'));
                    const continuedAtId = viewerUniqueId(reportIndex, node.getAttribute("continuedAt"));
                    if (continuedAtId !== null) {
                        nextContinuationMap[nodeId] = continuedAtId;
                    }
                    if (name != 'CONTINUATION') {
                        itemContinuationMap[nodeId] = [];
                    }
                }
            });
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

    _setContinuationMaps() {
        for (const [itemId, itemContinuations] of Object.entries(this.itemContinuationMap)) {
            this._ixNodeMap[itemId].continuations = itemContinuations.map(id => this._ixNodeMap[id]);
        }
    }

    _getOrCreateIXNode(vuid, nodes, docIndex, isHidden) {
        // We may have already created an IXNode for this ID from a -sec-ix-hidden
        // element 
        let ixn = this._ixNodeMap[vuid];
        if (!ixn) {
            ixn = new IXNode(vuid, nodes, docIndex);
            this._ixNodeMap[vuid] = ixn;
            ixn.isHidden = isHidden;
        }
        return ixn;
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
    _preProcessiXBRL(n, reportIndex, docIndex, inHidden) {
        const name = localName(n.nodeName).toUpperCase();
        const isFootnote = name === 'FOOTNOTE';
        const isContinuation = name === 'CONTINUATION';
        const isNonNumeric = name === 'NONNUMERIC';
        const isNonFraction = name === 'NONFRACTION';
        const isFact = isNonNumeric || isNonFraction;
        if (n.nodeType === 1) {
            const vuid = viewerUniqueId(reportIndex, n.getAttribute("id"));
            if (isFact || isFootnote) {
                // If @id is not present, it must be for a target document that wasn't processed.
                if (n.hasAttribute("id")) {
                    let nodes = this._findOrCreateWrapperNode(n, inHidden);

                    this._addIdToNode(nodes.first(), vuid);
                    let ixn = this._getOrCreateIXNode(vuid, nodes, docIndex, inHidden);
                    this._docOrderItemIndex.addItem(vuid, docIndex);

                    if (isNonFraction) {
                        nodes.addClass("ixbrl-element-nonfraction");
                        if (n.hasAttribute('scale')) {
                            const scale = Number(n.getAttribute('scale'));
                            // Set scale if the value is a valid number and is not a redundant 0/"ones" scale.
                            if (!Number.isNaN(scale) && scale !== 0) {
                                ixn.scale = scale;
                            }
                        }
                    }
                    if (isNonNumeric) {
                        nodes.addClass("ixbrl-element-nonnumeric");
                        if (n.hasAttribute('escape') && n.getAttribute('escape').match(/^(true|1)$/)) {
                            ixn.escaped = true;
                        }
                    }
                    if (isFootnote) {
                        nodes.addClass("ixbrl-element-footnote");
                        ixn.footnote = true;
                    }
                }
            }
            else if (isContinuation) {
                if (n.hasAttribute("id") && this.continuationOfMap[vuid] !== undefined) {
                    let nodes = this._findOrCreateWrapperNode(n, inHidden);

                    // For a continuation, store the IX ID(s) of the item(s), not the continuation
                    this._addIdToNode(nodes.first(), this.continuationOfMap[vuid]);

                    this._getOrCreateIXNode(vuid, nodes, docIndex, inHidden);

                    nodes.addClass("ixbrl-continuation");
                }
            }
            else if(name == 'HIDDEN') {
                inHidden = true;
            }
            else {
                // Handle SEC/ESEF links-to-hidden
                const vuid = viewerUniqueId(reportIndex, getIXHiddenLinkStyle(n));
                if (vuid !== null) {
                    let nodes = this._findOrCreateWrapperNode(n, inHidden);
                    nodes.addClass("ixbrl-element").data('ivids', [vuid]);
                    this._docOrderItemIndex.addItem(vuid, docIndex);
                    /* We may have already seen the corresponding ix element in the hidden
                     * section */
                    const ixn = this._ixNodeMap[vuid];
                    if (ixn) {
                        /* ... if so, update the node and docIndex so we can navigate to it */
                        ixn.wrapperNodes = nodes;
                        ixn.docIndex = docIndex;
                    }
                    else {
                        this._ixNodeMap[vuid] = new IXNode(vuid, nodes, docIndex);
                    }
                }
                if (name == 'A') {
                    this._updateLink(n);
                }
            }
        }
        this._preProcessChildNodes(n, reportIndex, docIndex, inHidden);
    }

    _preProcessChildNodes(domNode, reportIndex, docIndex, inHidden) {
        for (const childNode of domNode.childNodes) {
            this._preProcessiXBRL(childNode, reportIndex, docIndex, inHidden);
        }
    }

    _applyStyles() {
        const stlyeElts = $("<style>")
            .prop("type", "text/css")
            .text(require('../less/viewer.less').toString())
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
        var nextVuid;
        if (currentItem !== null) {
            nextVuid = this._docOrderItemIndex.getAdjacentItem(currentItem.vuid, offset);
            this.showDocumentForItemId(nextVuid);
        }
        // If no fact selected go to the first or last in the current document
        else if (offset > 0) {
            nextVuid = this._docOrderItemIndex.getFirstInDocument(this._currentDocumentIndex);
        } 
        else {
            nextVuid = this._docOrderItemIndex.getLastInDocument(this._currentDocumentIndex);
        }
        
        const nextElement = this.elementsForItemId(nextVuid);
        this.showElement(nextElement);
        // If this is a table cell with multiple nested tags pass all tags so that
        // all are shown in the inspector. 
        this.selectElement(nextVuid, this._ixIdsForElement(nextElement));
    }

    _bindHandlers() {
        const viewer = this;
        $('.ixbrl-element', this._contents)
            .on("click", function (e) {
                e.stopPropagation();
                viewer.selectElementByClick($(this));
            })
            .on("mouseenter", function (e) { viewer._mouseEnter($(this)) })
            .on("mouseleave", function (e) { viewer._mouseLeave($(this)) });
        $("body", this._contents)
            .on("click", () => viewer.selectElement(null));
        
        $('#iframe-container .zoom-in').on("click", () => this.zoomIn());
        $('#iframe-container .zoom-out').on("click", () => this.zoomOut());
        $('#iframe-container .print').on("click", () => this.currentDocument().get(0).contentWindow.print());

        TableExport.addHandles(this._contents, this._reportSet);
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
        const ee = e.filter(':not(.ixbrl-no-highlight)').get(0);
        if (!this.isFullyVisible(ee)) {
            ee.scrollIntoView({ block: "center", inline: "center" });
        }
    }

    clearHighlighting() {
        $("body", this._iframes.contents()).find(".ixbrl-element").removeClass("ixbrl-selected").removeClass("ixbrl-related").removeClass("ixbrl-linked-highlight");
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
    selectElement(vuid, itemIdList, byClick) {
        if (vuid !== null) {
            this.onSelect.fire(vuid, itemIdList, byClick);
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
        let itemIDList = [];
        const viewer = this;
        let sameContentAncestorVuid;
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
            const vuids = viewer._ixIdsForElement($(this));
            itemIDList = itemIDList.concat(vuids);
            if ($(this).text() == e.text() && sameContentAncestorVuid === undefined) {
                sameContentAncestorVuid = vuids[0];
            }
        });
        this.selectElement(sameContentAncestorVuid, itemIDList, true);
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
        this.changeItemClass(f.vuid, "ixbrl-related");
    }

    highlightRelatedFacts(facts) {
        for (const f of facts) {
            this.changeItemClass(f.vuid, "ixbrl-related");
        }
    }

    clearRelatedHighlighting(f) {
        $(".ixbrl-related", this._contents).removeClass("ixbrl-related");
    }

    // Return a jQuery node list for wrapper elements corresponding to 
    // the factId.  May contain more than one node if the IX node contains
    // absolutely positioned elements.
    elementsForItemId(vuid) {
        if (!(vuid in this._ixNodeMap)){
            throw new Error(`Attempting to retrieve IXNode with missing key: ${vuid}`);
        }
        return this._ixNodeMap[vuid].wrapperNodes;
    }

    // Returns a jQuery node list containing the primary wrapper node for each
    // vuid provided
    primaryElementsForItemIds(vuids) {
        return $(vuids.map(vuid => this.elementsForItemId(vuid).first().get(0)));
    }

    /*
     * Add or remove a class to an item (fact or footnote) and any continuation elements
     */
    changeItemClass(vuid, highlightClass, removeClass) {
        const elements = this.primaryElementsForItemIds([vuid].concat(this.itemContinuationMap[vuid]))
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
    highlightItem(vuid) {
        this.clearHighlighting();
        this.changeItemClass(vuid, "ixbrl-selected");
    }

    showItemById(vuid) {
        if (vuid !== null) {
            let elts = this.elementsForItemId(vuid);
            this.showDocumentForItemId(vuid);
            /* Hidden elements will return an empty node list */
            if (elts.length > 0) {
                this.showElement(elts);
            }
        }
    }

    highlightAllTags(on, namespaceGroups) {
        const groups = {};
        $.each(namespaceGroups, function (i, ns) {
            groups[ns] = i % HIGHLIGHT_COLORS;
        });
        const reportSet = this._reportSet;
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
                    if (ixn !== undefined ) {
                        const item = reportSet.getItemById(ixn.id);
                        if (item !== undefined) {
                            const elements = viewer.primaryElementsForItemIds(ixn.chainIXIds());
                            const i = groups[item.conceptQName().prefix];
                            if (i !== undefined) {
                                elements.addClass("ixbrl-highlight-" + i);
                            }
                        }
                    }
            });
        }
        else {
            $(".ixbrl-element", this._contents).removeClass(
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
        const e = this.elementsForItemId(fact.vuid);
        e.closest("table").find(".ixbrl-element").each(function () {
            facts = facts.concat($(this).data('ivids'));
        });
        return facts;
    }

    linkedHighlightFact(f) {
        this.changeItemClass(f.vuid, "ixbrl-linked-highlight");
    }

    clearLinkedHighlightFact(f) {
        this.changeItemClass(f.vuid, "ixbrl-linked-highlight", true);
    }

    _setTitle(docIndex) {
        const title = $('head title', this._iframes.eq(docIndex).contents()).text();
        $('#top-bar .document-title')
            .text(title)
            .attr("aria-label", "Inline Viewer: " + title);
    }

    showDocumentForItemId(vuid) {
        this.selectDocument(this._ixNodeMap[vuid].docIndex);
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
