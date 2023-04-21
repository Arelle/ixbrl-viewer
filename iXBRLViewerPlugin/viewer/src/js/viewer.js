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
import { escapeRegex, escapeHtml, getScrollParent } from './util.js'
import { IXNode } from './ixnode.js';
import { setDefault, runGenerator } from './util.js';
import { Fact } from './fact.js';
import { DocOrderIndex } from './docOrderIndex.js';
import { MessageBox } from './messagebox.js';
import { ContextMenu } from './contextMenu.js';

export class DocumentTooLargeError extends Error {}

import 'bootstrap/js/dist/tooltip';

export function Viewer(iv, iframes, report, useFrames) {
    this._iv = iv;
    this._report = report;
    this._iframes = iframes;
    this._useFrames = useFrames;

    if (useFrames) {
        this._contents = iframes.contents();
    } else {
        this._contents = iframes;
    }        

    this.onSelect = $.Callbacks();
    this.onMouseEnter = $.Callbacks();
    this.onMouseLeave = $.Callbacks();

    this._ixNodeMap = {};
    this._docOrderItemIndex = new DocOrderIndex();
    this._currentDocumentIndex = 0;
    this._mzInit = false;   
    this._tooltipShown = null;
    this._highlighting = false;

    $(".amanablock", this.contents())
      .addClass("-ixh-highlight-region").removeClass("amanablock");
}

Viewer.prototype._checkContinuationCount = function() {
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

Viewer.prototype._checkContinuationCount = function() {
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

Viewer.prototype.initialize = function() {
    return new Promise(async (resolve, reject) => {
        var viewer = this;
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
                for (var docIndex = 0; docIndex < viewer._iframes.length; docIndex++) {
                    await viewer._iv.pluginPromise('preProcessiXBRL', viewer._iframes.eq(docIndex).contents().find("body").get(0), docIndex);
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
                })
                .then(() => {
                    viewer._iframes.each(function (docIndex) { 
                        viewer._postProcessXBRL($(this).contents().find("body").get(0), docIndex);
                    });    
                })
                .then(() => {                
                    viewer.contextMenu = new ContextMenu({
                        target: $('.ixbrl-element-nonnumeric,.ixbrl-continuation', viewer.contents()),
                        menuItems: (target) => viewer._createContextMenuItems(target),
                        mode: "light" 
                    });
                    viewer.contextMenu.init();                  
                })
            })
            .catch(err => reject(err));
    });
}

function localName(e) {
    if (e.indexOf(':') == -1) {
        return e.toUpperCase();
    }
    else {
        return e.substring(e.indexOf(':') + 1)
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
        if (getComputedStyle(nn[i]).getPropertyValue('display') === "block") {
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
    var nodes = $(domNode).closest("td,th").eq(0);
    const innerText = $(domNode).text();
    if (nodes.length == 1 && innerText.length > 0) {
        if (nodes.css('display') == 'none') {
            nodes = nodes.parent();
            nodes.addClass('ixbrl-cellblock');
        } else {
            // Use indexOf rather than a single regex because innerText may
            // be too long for the regex engine 
            const outerText = $(nodes).text();
            const start = outerText.indexOf(innerText);
            const wrapper = outerText.substring(0, start) + outerText.substring(start + innerText.length);
            if (/[0-9A-Za-z]/.test(wrapper)) {
                nodes = $();
            } 
        }
    }
    /* AMANA extension: */
    if (nodes.length == 0) {
        var parent = $(domNode).parent('div.-ixh-highlight-region');
        if (parent.length > 0) {                    
            nodes = parent;
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


// Adds the specified ID to the "ivid" data list on the given node
Viewer.prototype._addIdToNode = function(node, id) {
    const ivids = node.data('ivid') || [];
    ivids.push(id);
    node.data('ivid', ivids);
}

Viewer.prototype._buildContinuationMaps = function() {
    // map of element id to next element id in continuation chain
    const nextContinuationMap = {};
    // map of items in default target document to all their continuations
    const itemContinuationMap = {};
    this.contents().find("body *").each(function () {
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
// All ixbrl-elements have "ivid" data added, which is a list of the ID
// attribute(s) of corresponding IX item(s).  Continuations have the IDs of
// their head items (fact or footnotes).
// "ivid" can be a mix of different types.
//
// Viewer._ixNodeMap is a map of these IDs to IXNode objects.
//
// Viewer._docOrderItemIndex is a DocOrderIndex object that maintains a list of
// fact and footnotes in document order.
//
Viewer.prototype._preProcessiXBRL = function(n, docIndex, inHidden) {
    const self = this;
    const name = localName(n.nodeName).toUpperCase();
    const isFootnote = (name == 'FOOTNOTE');
    const isContinuation = (name == 'CONTINUATION');
    const isFact = (name == 'NONNUMERIC' || name == 'NONFRACTION');
    if (n.nodeType == 1) {
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
                ixn = new IXNode(id, nodes, docIndex, name);
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
        else if(name == 'HIDDEN') {
            inHidden = true;
        }
        else {
            // Handle SEC/ESEF links-to-hidden
            const id = this._getIXHiddenLinkStyle(n);
            if (id !== null) {
                nodes = $(n);
                nodes.addClass("ixbrl-element").data('ivid', [id]);
                this._docOrderItemIndex.addItem(id, docIndex);
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

Viewer.prototype._postProcessXBRL = function(container) {
    var viewer = this;
    $(container).find('.ixbrl-element').each(function (_, node) { 
        var id = $(node).data('ivid')[0];
        var fact = viewer._report.getItemById(id);
        if (fact && fact instanceof Fact) { 
            viewer._postProcessXBRLNode(container, node, fact);
        }
    });
}

Viewer.prototype._postProcessXBRLNode = function (container, node, fact) {
    const self = this;
    if (fact && fact.hasValidationResults())
        $(node).addClass("inline-fact-with-message");
    var htmlTooltip;    
    if (fact) {
        var title = fact.getLabel("std") || fact.conceptName();
        if (fact.concept().isTaxonomyExtension()) {
            $(node).attr('ix-title', `<i>${escapeHtml(title)}</i> (Extension)`);
            htmlTooltip = true;
        } else {
            $(node).attr('ix-title', title);
            htmlTooltip = false;
        }
    } else {
        console.log(`Fact with id '${id}' is not found in the report data`);
    }
    $(node).tooltip({     
        html: htmlTooltip,
        container: container,
        delay: { "show": 350 },
        title: function() {
            return $(this).attr('ix-title') || $(this).parents('.ixbrl-element').attr('ix-title');
        }
    }).on('show.bs.tooltip', function(evt) {        
        if (self._tooltipShown !== null && self._tooltipShown !== evt.target) {
            if ($(self._tooltipShown).parents().length > $(evt.target).parents().length) {
                evt.preventDefault();
            } else {
                $(self._tooltipShown).tooltip('hide');
                self._tooltipShown = evt.target;
            }
        } else {
            self._tooltipShown = evt.target;
        }
    }).on('hide.bs.tooltip', function(evt) {        
        if (self._tooltipShown === evt.target)
            self._tooltipShown = null;
    }); 
}

Viewer.prototype._applyStyles = function () {
    var stlyeElts = $("<style>")
        .prop("type", "text/css")
        .text(require('css-loader!less-loader!../less/viewer.less').toString())
        .appendTo(this._contents.find("head"));
    this._iv.callPluginMethod("updateViewerStyleElements", stlyeElts);
}

Viewer.prototype.contents = function() {
    return this._contents;
}

Viewer.prototype._createContextMenuItems = function (e) {
    const self = this;
    const menuItems = [];
    e = $(e);
    if (!e.hasClass(".ixbrl-element")) {
        e = e.closest(".ixbrl-element");
    }    
    const ids = this._ixIdsForElement(e);      
    if (self._iv.inspector._currentItem !== null && ids.includes(self._iv.inspector._currentItem.id)) {
        const id = self._iv.inspector._currentItem.id;
        const all = $.makeArray($(".ixbrl-element", this._contents).filter(function () {
            let ids2 = self._ixIdsForElement($(this));
            return ids2[0] === id;
        }));
        if (all.length > 1) {
            let firstElm = $(all[0]);
            let firstSubelement = firstElm.find("ixbrl-sub-element").first();
            if (firstSubelement.length > 0) {
                prevElm = firstSubelement;
            }
            if (!this.isFullyVisible(firstElm[0])) {
                menuItems.push({ 
                    content: "Show head",
                    divider: "bottom", 
                    events: {
                        click: () => {
                            firstElm[0].scrollIntoView({ block: "center"});
                            setTimeout(() => self.selectElement(ids[0]), 50);                        
                        } 
                    } 
                });
            }            
        }
        const index = all.indexOf(e[0]);
        for (let j = index - 1; j >= 0; j--) {
            let prevElm = $(all[j]);
            let firstSubelement = prevElm.find("ixbrl-sub-element").first();
            if (firstSubelement.length > 0) {
                prevElm = firstSubelement;
            }
            if (!this.isFullyVisible(prevElm[0])) {
                menuItems.push({
                    content: "Show previous",
                    events: {
                        click: () => {
                            prevElm[0].scrollIntoView({ block: "center"});
                            setTimeout(() => self.selectElement(ids[0]), 50);
                        }
                    } 
                });
                break;
            }
        }
        for (let j = index + 1; j < all.length; j++) {
            let nextElm = $(all[j]);
            let lastSubelement = nextElm.find("ixbrl-sub-element").last();
            if (lastSubelement.length > 0) {
                nextElm = lastSubelement;
            }
            if (!this.isFullyVisible(nextElm[0])) {
                menuItems.push({ 
                    content: "Show next",
                    events: {
                        click: () => {
                            nextElm[0].scrollIntoView({ block: "center"});
                            setTimeout(() => self.selectElement(ids[0]), 50);                        
                        } 
                    } 
                });
                break;
            }
        }        
        if (all.length > 1) {
            let lastElm = $(all[all.length - 1]);
            let lastSubelement = lastElm.find("ixbrl-sub-element").last();
            if (lastSubelement.length > 0) {
                lastElm = lastSubelement;
            }
            if (!this.isFullyVisible(lastElm[0])) {
                menuItems.push({ 
                    content: "Show tail",
                    divider: "top", 
                    events: {
                        click: () => {
                            lastElm[0].scrollIntoView({ block: "center"});
                            setTimeout(() => self.selectElement(ids[0]), 50);                        
                        } 
                    } 
                });
            }
        }
    }
    return menuItems;
}

// Move by offset (+1 or -1) through the tags in the document in document
// order.
//
// Each element may have one or more tags associated with it, so we need to
// move through the list of tags associated with the current element before
// moving to the next/prev element
//
Viewer.prototype._selectAdjacentTag = function (offset, currentItem) {
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
            var target = $(e.target);
            if (viewer._useFrames || target.closest("#iframe-div").length != 0)
                viewer.selectElement(null);
        });
    
    $('#iframe-container .zoom-in').click(function () { viewer.zoomIn() });
    $('#iframe-container .zoom-out').click(function () { viewer.zoomOut() });
    $('#iframe-container .print').click(function () { viewer.currentDocument().get(0).contentWindow.print() });

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
    // In quirks mode, clientHeight of body is viewport height.  In standards
    // mode, clientHeight of html is viewport height.
    const quirksMode = node.ownerDocument.compatMode != 'CSS1Compat';
    const de = quirksMode ? ancestor : ancestor.closest("html").get(0);
    return r1.left > 0 && r1.top > 0 && r1.right < de.clientWidth && r1.bottom < de.clientHeight;
}

/* If the specified element is not fully visible, scroll it into the center of
 * the viewport */
Viewer.prototype.showElement = function(e) {
    var ee = e.get(0);
    if (!this.isFullyVisible(ee)) {
        ee.scrollIntoView({ block: "center" });
    }
}

Viewer.prototype.clearHighlighting = function () {
    $("body", this.contents()).find(".ixbrl-element, .ixbrl-sub-element").removeClass("ixbrl-selected").removeClass("ixbrl-related").removeClass("ixbrl-linked-highlight");
}

Viewer.prototype._ixIdsForElement = function (e) {
    return e.data('ivid');
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
    return $(ids.map(id => this._ixNodeMap[id].wrapperNodes.get()).flat());
}

/*
 * Add or remove a class to an item (fact or footnote) and any continuation elements
 */
Viewer.prototype.changeItemClass = function(itemId, highlightClass, removeClass) {
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
Viewer.prototype.highlightItem = function(factId, itemIdList) {
    this.clearHighlighting();
    this.changeItemClass(factId, "ixbrl-selected");
    if (this._highlighting) {
        this.focusOnSelected(factId, itemIdList.map(f => f.id));
    }
}

Viewer.prototype.showItemById = function (id, force) {
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
    this._highlighting = on;
    var groups = {};
    $.each(namespaceGroups, function (i, ns) {
        groups[ns] = i;
    });
    var report = this._report;
    var viewer = this;    
    this._removeFocusOnSelected();
    if (on) {
        $(".ixbrl-element", this._contents)
            .addClass("ixbrl-highlight")
            .each(function () {
                // Find the first ixn for this element that isn't a footnote.
                // Choosing the first means that we're arbitrarily choosing a
                // highlight color for an element that is double tagged in a
                // table cell.
                const ixn = $(this).data('ivid').map(id => viewer._ixNodeMap[id]).filter(ixn => !ixn.footnote)[0];
                if (ixn != undefined) {
                    const elements = viewer.elementsForItemIds(ixn.chainIXIds());
                    const i = groups[report.getItemById(ixn.id).conceptQName().prefix];
                    if (i !== undefined) {
                        elements.addClass("ixbrl-highlight-" + i);
                    }
                } else {
                    $(this).addClass("ixbrl-highlight-missing");
                }
        });
        $(".ixbrl-sub-element", this._contents).addClass("ixbrl-highlight");
    }
    else {
        $(".ixbrl-element, .ixbrl-sub-element", this._contents).removeClass (function (i, className) {
            return (className.match (/(^|\s)ixbrl-highlight\S*/g) || []).join(' ');
        });        
    }
}

Viewer.prototype._removeFocusOnSelected = function () {
    $(".ixbrl-blur-highlight", this._contents).removeClass("ixbrl-blur-highlight");
}

Viewer.prototype.focusOnSelected = function(itemId, itemIdList) {
    const self = this;
    if (itemId === null || itemIdList === null) return;
    $(".ixbrl-blur-highlight", this._contents).addClass("ixbrl-highlight").removeClass("ixbrl-blur-highlight");
    const items = $(".ixbrl-highlight", this._contents)
        .filter(function() {
            return !$(this).hasClass("ixbrl-selected");
        });
    items.addClass("ixbrl-blur-highlight").removeClass("ixbrl-highlight");
}

// The firefox browser does not support CSS zoom style,
//      instead of is we should use -moz-transform and -moz-transform-origin styles
Viewer.prototype._zoom = function () {
    var self = this;    
    $('html', this._contents).each(function () {
        var container, scrollParent;
        if (self._iv.isPDF) {
            if (!self._mzInit) {
                let pagecontainer = $('#page-container', $(this));
                pagecontainer.contents().wrapAll('<div id="zoom-container"></div>');
                self._mzInit = true;
            }
            container = $('#zoom-container', $(this));
            scrollParent = $(getScrollParent(container[0]));
        } else {            
            container = $(this.ownerDocument.body);
            scrollParent = $(this);
        }
        var viewTop = scrollParent.scrollTop();
        var viewLeft = scrollParent.scrollLeft();
        var rc = container[0].getBoundingClientRect();
        container.css({
            '-moz-transform-origin': 'center 0',
            '-moz-transform': 'scale(' + self.scale + ')',
            'transform-origin': 'center 0',
            'transform': 'scale(' + self.scale + ')',
        }).promise().done(function() {
            var rcNew = container[0].getBoundingClientRect();
            container.css({
                'margin-top': 0,
                'margin-left': (rcNew.width - container[0].clientWidth)/2,
                'margin-bottom': rcNew.height - container[0].clientHeight, 
                'margin-right': (rcNew.width - container[0].clientWidth)/2,
            });        
            scrollParent.scrollLeft(rcNew.width * (viewLeft)/rc.width);
            scrollParent.scrollTop(rcNew.height * (viewTop)/rc.height);       
        });
    });    
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
    return this._iframes.eq(this._currentDocumentIndex);
}

Viewer.prototype.selectDocument = function (docIndex) {
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

/*
 * AMANA extension: notify external host about viewer is ready
 */
Viewer.prototype.notifyReady = function () {
    if (typeof boundEvent !== "undefined") { 
        boundEvent.ready();
    }
}

/*
 * AMANA extension: add borders to tables
 *
 */
Viewer.prototype.highlightTables = function(on) {
    if (on) 
        $(".ixbrl-element", this._contents)
            .find("table")
            .addClass('table-highlight');            
    else 
        $(".table-highlight", this._contents)
            .removeClass("table-highlight");            
}

/*
 * AMANA extension: CSS customization
 */
Viewer.prototype.customize = function(selector, styles) {
    this._contents.each(function () {   
        for (const sheet of this.styleSheets) {
            for (const rule of sheet.cssRules) {
                if ('selectorText' in rule && 'styleMap' in rule &&
                    rule.selectorText == selector) {
                    for (const property in styles) {
                        rule.styleMap.set(property, styles[property]);
                    }
                }                
            }
        }
    });
}


Viewer.prototype.postProcess = function*() {
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

Viewer.prototype.postLoadAsync = function () {
    runGenerator(this.postProcess());
}
