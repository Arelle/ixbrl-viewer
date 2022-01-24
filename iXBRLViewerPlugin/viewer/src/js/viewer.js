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
import { Fact } from './fact.js';

import 'bootstrap/js/dist/tooltip';

export function Viewer(iv, iframes, report, useFrames, isPDF) {
    this._iv = iv;
    this._report = report;
    this._iframes = iframes;
    this._useFrames = useFrames;
    this._isPDF = isPDF;

    if (useFrames) {
        this._contents = iframes.contents();
    } else {
        this._contents = iframes;
    }    

    this.onSelect = $.Callbacks();
    this.onMouseEnter = $.Callbacks();
    this.onMouseLeave = $.Callbacks();

    this._ixNodeMap = {};
    this._continuedAtMap = {};        
    this._currentShowElement = null;
    this._mzInit = false;    
}

Viewer.prototype.initialize = function() {
    return new Promise((resolve, reject) => {
        var viewer = this;
        viewer._iframes.each(function (docIndex) { 
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
            })
            .then(() => {
                viewer._iframes.each(function (docIndex) { 
                    viewer._postProcessiXBRL($(this).contents().find("body").get(0), docIndex);
                });    
            });
    });
}

function localName(e) {
    if (e.indexOf(':') == -1) {
        return e.toUpperCase();
    }
    else {
        return e.substring(e.indexOf(':') + 1).toUpperCase();
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

Viewer.prototype._preProcessiXBRL = function(n, docIndex, inHidden) {
    var elt;
    var name = localName(n.nodeName).toUpperCase();
    var isFootnote = (name == 'FOOTNOTE');
    if(n.nodeType == 1 && (name == 'NONNUMERIC' || name == 'NONFRACTION' || name == 'CONTINUATION' || isFootnote)) {
        var node = $();
        var id = n.getAttribute("id");
        if (!inHidden) {
            /* Is the element the only significant content within a <td> or <th> ? If
             * so, use that as the wrapper element. */
            node = $(n).closest("td,th").eq(0);
            if (node.length == 0 && name == 'NONFRACTION') {
                node = $(n).closest("span,div").eq(0);                
            }
            const innerText = $(n).text();
            if (node.length == 1 && innerText.length > 0) {
                if (node.css('display') == 'none') {
                    node = node.parent();
                    node.addClass('ixbrl-cellblock');
                } else {                
                    // Use indexOf rather than a single regex because innerText may
                    // be too long for the regex engine 
                    const outerText = $(node).text();
                    const start = outerText.indexOf(innerText);
                    const wrapper = outerText.substring(0, start) + outerText.substring(start + innerText.length);
                    if (/[0-9A-Za-z]/.test(wrapper)) {
                        node = $();
                    } 
                }
            }
            if (node.length == 0) {
                var parent = $(n).parent('div.amanablock');
                if (parent.length > 0) {                    
                    node = parent;
                }
            }
            /* Otherwise, insert a <span> as wrapper */
            if (node.length == 0) {
                var wrapper = "<span>";
                var nn = n.getElementsByTagName("*");
                for (var i = 0; i < nn.length; i++) {
                    if($(nn[i]).css("display") === "block") {
                        wrapper = '<div>';
                        break;
                    }
                }
                $(n).wrap(wrapper);
                node = $(n).parent();
            }
            /* If we use an enclosing table cell as the wrapper, we may have
             * multiple tags in a single element. */
            var ivids = node.data('ivid') || [];
            ivids.push(id);
            node.addClass("ixbrl-element").data('ivid', ivids)
        }
        /* We may have already created an IXNode for this ID from a -sec-ix-hidden
         * element */
        var ixn = this._ixNodeMap[id];
        if (!ixn) {
            ixn = new IXNode(id, node, docIndex);
            this._ixNodeMap[id] = ixn;
        }
        if (node.is(':hidden')) {
            ixn.htmlHidden = true;
        }
        if (n.getAttribute("continuedAt")) {
            this._continuedAtMap[id] = { 
                "isFact": name != 'CONTINUATION',
                "continuedAt": n.getAttribute("continuedAt")
            }
        }
        if (name == 'CONTINUATION') {
            $(node).addClass("ixbrl-continuation");
        }
        if (name == 'NONFRACTION') {
            $(node).addClass("ixbrl-element-nonfraction");
        }
        if (name == 'NONNUMERIC') {
            $(node).addClass("ixbrl-element-nonnumeric");
            if (n.hasAttribute('escape') && n.getAttribute('escape').match(/^(true|1)$/)) {
                ixn.escaped = true;
            }
        }
        if (isFootnote) {
            $(node).addClass("ixbrl-element-footnote");
            ixn.footnote = true;
        }
        if (elt) {
            var concept = n.getAttribute("name");
            if (elt.children().first().text() == "") {
                elt.children().first().html("<i>no content</i>");
            }
            var tr = $("<tr></tr>").append("<td><div title=\"" + concept + "\">" + concept + "</div></td>").append($(elt).wrap("<td></td>").parent());
            $("#ixbrl-inspector-hidden-facts-table-body").append(tr);
        }
    }
    else if(n.nodeType == 1 && name == 'HIDDEN') {
        inHidden = true;
    }
    else if(n.nodeType == 1) {
        if (n.hasAttribute('style')) {
            const re = /(?:^|\s|;)-(?:sec|esef)-ix-hidden:\s*([^\s;]+)/;
            var m = n.getAttribute('style').match(re);
            if (m) {
                var id = m[1];
                node = $(n);
                node.addClass("ixbrl-element").data('ivid', [id]);
                /* We may have already seen the corresponding ix element in the hidden
                 * section */
                var ixn = this._ixNodeMap[id];
                if (ixn) {
                    /* ... if so, update the node and docIndex so we can navigate to it */
                    ixn.wrapperNode = node;
                    ixn.docIndex = docIndex;
                }
                else {
                    this._ixNodeMap[id] = new IXNode(id, node, docIndex);
                }
            }
        }
    }
    for (var i=0; i < n.childNodes.length; i++) {
        this._preProcessiXBRL(n.childNodes[i], docIndex, inHidden);
    }
}

Viewer.prototype._postProcessiXBRL = function(container) {
    var viewer = this;
    $(container).find('.ixbrl-element').each(function (_, node) { 
        var id = $(node).data('ivid')[0];
        var fact = viewer._report.getItemById(id);
        if (fact && fact instanceof Fact) {
            viewer._postProcessiXBRLNode(container, node, fact);
            var ixNode = fact._ixNode;
            ixNode.continuations.forEach(c => 
                viewer._postProcessiXBRLNode(container, c.wrapperNode[0], fact));
        }
    });
}

Viewer.prototype._postProcessiXBRLNode = function (container, node, fact) {
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
        title: function() {
            return $(this).attr('ix-title') || $(this).parents('.ixbrl-element').attr('ix-title');
        }
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

Viewer.prototype._selectAdjacentTag = function (offset) {
    var elements = $(".ixbrl-element:not(.ixbrl-continuation)", this._contents);
    var current = $(".ixbrl-selected:not(.ixbrl-continuation)", this._contents);
    var next;
    if (current.length == 1) {
        next = elements.eq((elements.index(current.first()) + offset) % elements.length);
    }
    else if (offset > 0) {
        next = elements.first();
    } 
    else {
        next = elements.last();
    }
    
    this.showDocumentForItemId(next.data('ivid')[0]);
    this.showElement(next);
    this.selectElement(next);
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


    TableExport.addHandles(this._contents, this._report);
}

Viewer.prototype.selectNextTag = function () {
    this._selectAdjacentTag(1);
}

Viewer.prototype.selectPrevTag = function () {
    this._selectAdjacentTag(-1);
}

Viewer.prototype.showElement = function(e, force) {
    if (e[0] != this._currentShowElement || force) {
        this._currentShowElement = e[0];
        var span = e.find('span').first();
        if (span.length)
        {
            if (span.css('display') == 'none') {
                span = span.parent();
            }
            this.scrollIntoViewIfNeeded(span);
        }
        else
            this.scrollIntoViewIfNeeded(e);
    }
}

Viewer.prototype.scrollIntoViewIfNeeded = function(e) {
    if (Element.prototype.scrollIntoViewIfNeeded)
       e[0].scrollIntoViewIfNeeded(true);
    else {
        var viewTop = this._contents.scrollTop();
        var viewBottom = viewTop + this._iframes.height();
        var eTop = e.offset().top;
        var eBottom = eTop + e.height();
        if (eTop < viewTop || eBottom > viewBottom) {
            e[0].scrollIntoView({block: "center"});
        }
    }        
}


Viewer.prototype.showAndSelectElement = function(e) {
    this.scrollIfNotVisible(e);
}

Viewer.prototype.clearHighlighting = function () {
    $("body", this._contents).find(".ixbrl-element").removeClass("ixbrl-selected").removeClass("ixbrl-related").removeClass("ixbrl-linked-highlight");
}

/*
 * Update the currently highlighted fact, but do not trigger a change in the
 * inspector.
 * 
 * Used to switch facts when the selection corresponds to multiple facts.
 */
Viewer.prototype.highlightElements = function (ee) {
    this.clearHighlighting();
    ee.addClass("ixbrl-selected");
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
Viewer.prototype.selectElement = function (e, factIdList) {
    if (e !== null) {
        var factId = this._ixIdsForElement(e)[0];
        this.onSelect.fire(factId, factIdList);
    }
    else {
        this.onSelect.fire(null);
    }
}

Viewer.prototype.selectElementByClick = function (e) {
    var eltSet = [];
    var viewer = this;
    e.parents(".ixbrl-element").addBack().each(function () { 
        eltSet = eltSet.concat(viewer._ixIdsForElement($(this))); 
    });
    this.selectElement(e, eltSet);
}

Viewer.prototype._mouseEnter = function (e) {
    var id = e.data('ivid');
    this.onMouseEnter.fire(id);
}

Viewer.prototype._mouseLeave = function (e) {
    var id = e.data('ivid');
    this.onMouseLeave.fire(id);
}

Viewer.prototype.highlightRelatedFact = function (f) {
    var e = this.elementForFact(f);
    e.addClass("ixbrl-related");
}

Viewer.prototype.highlightRelatedFacts = function (facts) {
    this.elementsForFacts(facts).addClass("ixbrl-related");
}

Viewer.prototype.clearRelatedHighlighting = function (f) {
    $(".ixbrl-related", this._contents).removeClass("ixbrl-related");
}

Viewer.prototype.elementForFact = function (fact) {
    return this.elementForItemId(fact.id);
}

Viewer.prototype.elementForItemId = function (factId) {
    return this._ixNodeMap[factId].wrapperNode;
}

Viewer.prototype.elementsForItemIds = function (ids) {
    var viewer = this;
    return $($.map(ids, function (id, n) {
        return viewer._ixNodeMap[id].wrapperNode.get();
    }));
}

Viewer.prototype.elementsForFacts = function (facts) {
    return this.elementsForItemIds($.map(facts, function (f) { return f.id }));
}

Viewer.prototype.highlightItem = function(factId) {
    var continuations = this._ixNodeMap[factId].continuationIds();
    this.highlightElements(this.elementsForItemIds([factId].concat(continuations)));
}

Viewer.prototype.showItemById = function (id, force) {
    if (id !== null) {
        let elt = this.elementForItemId(id);
        this.showDocumentForItemId(id);
        /* Hidden elements will return an empty node list */
        if (elt.length > 0) {
            this.showElement(elt, force);
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
        $(".ixbrl-element:not(.ixbrl-continuation)", this._contents).each(function () {
            var factId = $(this).data('ivid')[0];
            var ixn = viewer._ixNodeMap[factId];
            var elements = viewer.elementsForItemIds([factId].concat(ixn.continuationIds()));
            elements.addClass("ixbrl-highlight");

            if (!ixn.footnote) {
                var fact = report.getItemById(factId);
                if (fact) {
                    var i = groups[fact.conceptQName().prefix];
                    if (i !== undefined) {
                        elements.addClass("ixbrl-highlight-" + i);
                    }
                } else {
                    $(this).addClass("ixbrl-highlight-missing");
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

// The firefox browser does not support CSS zoom style,
//      instead of is we should use -moz-transform and -moz-transform-origin styles
Viewer.prototype._zoom = function () {
    var iv = this;    
    $('html', this._contents).each(function () {
        var container, scrollParent;
        if (iv._isPDF) {
            if (!iv._mzInit) {
                let pagecontainer = $('#page-container', $(this));
                pagecontainer.contents().wrapAll('<div id="zoom-container"></div>');
                iv._mzInit = true;
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
            '-moz-transform': 'scale(' + iv.scale + ')',
            'transform-origin': 'center 0',
            'transform': 'scale(' + iv.scale + ')',
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
    var tableHashCode = fact.tableHashCode();
    if (tableHashCode)
    {
        for (const f of this._report.facts()) {
            if (f.tableHashCode() == tableHashCode) {
                facts.push(f.id);
            }
        }
    } 
    return facts;
}

Viewer.prototype.linkedHighlightFact = function (f) {
    var e = this.elementForFact(f);
    e.addClass("ixbrl-linked-highlight");
}

Viewer.prototype.clearLinkedHighlightFact = function (f) {
    var e = this.elementForFact(f);
    e.removeClass("ixbrl-linked-highlight");
}

Viewer.prototype._setTitle = function (docIndex) {
    $('#top-bar .document-title').text($('head title', this._iframes.eq(docIndex).contents()).text());
}

Viewer.prototype.showDocumentForItemId = function(factId) {
    this.selectDocument(this._ixNodeMap[factId].docIndex);
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
        .eq(docIndex)
        .height("100%");
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
