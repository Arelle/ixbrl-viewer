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
                    parts.push(nextId);
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
                .data('ix-doc-id', i)
                .click(function () { 
                    viewer.selectDocument($(this).data('ix-doc-id'))
                })
                .appendTo($('#ixv #viewer-pane .ixds-tabs'));
        }
        $('#ixv #viewer-pane .ixds-tabs .tab').eq(0).addClass("active");
    }
}

Viewer.prototype._preProcessiXBRL = function(n, docIndex, inHidden) {
  var elt;
  var name = localName(n.nodeName).toUpperCase();
  var isFootnote = (name == 'FOOTNOTE');
  if(n.nodeType == 1 && (name == 'NONNUMERIC' || name == 'NONFRACTION' || name == 'CONTINUATION' || isFootnote)) {
    /* Is the element the only significant content within a <td> or <th> ? If
     * so, use that as the wrapper element. */
    var node = $(n).closest("td,th").eq(0);
    if (node.length == 1) {
        var regex = "^[^0-9A-Za-z]*" + escapeRegex($(n).text()) + "[^0-9A-Za-z]*$";
        if (node.text().match(regex) == null) {
            node = null;
        } 
    }
    /* Otherwise, insert a <span> as wrapper */
    if (node == null || node.length == 0) {
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
    var id = n.getAttribute("id");
    node.addClass("ixbrl-element").data('ivid',id);
    var ixn = new IXNode(node, docIndex);
    this._ixNodeMap[id] = ixn;
    if (n.getAttribute("continuedAt")) {
        this._continuedAtMap[id] = { 
            "isFact": name != 'CONTINUATION',
            "continuedAt": n.getAttribute("continuedAt")
        }
    }
    if (localName(n.nodeName) == 'CONTINUATION') {
        node.addClass("ixbrl-continuation");
    }
    if (localName(n.nodeName) == 'NONFRACTION') {
      $(node).addClass("ixbrl-element-nonfraction");
    }
    if (localName(n.nodeName) == 'NONNUMERIC') {
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
      if(elt.children().first().text() == "") {
        elt.children().first().html("<i>no content</i>");
      }
      var tr = $("<tr></tr>").append("<td><div title=\"" + concept + "\">" + concept + "</div></td>").append($(elt).wrap("<td></td>").parent());
      $("#ixbrl-inspector-hidden-facts-table-body").append(tr);
    }
  }
  else if(n.nodeType == 1 && localName(n.nodeName) == 'HIDDEN') {
    inHidden = true;
  }
  for (var i=0; i < n.childNodes.length; i++) {
    this._preProcessiXBRL(n.childNodes[i], docIndex, inHidden);
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


Viewer.prototype._selectAdjacentTag = function (offset) {
    var elements = $(".ixbrl-element", this._contents);
    var current = $(".ixbrl-selected", this._contents);
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
    
    this.showDocumentForFactId(next.data('ivid'));
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

Viewer.prototype.showElement = function(e) {
    var viewTop = this._iframes.contents().scrollTop();
    var viewBottom = viewTop + this._iframes.height();
    var eTop = e.offset().top;
    var eBottom = eTop + e.height();
    if (eTop < viewTop || eBottom > viewBottom) {
        this._iframes.contents().scrollTop(e.offset().top - this._iframes.height()/2);
    }
}

Viewer.prototype.showAndSelectElement = function(e) {
    this.scrollIfNotVisible(e);
}

/*
 * Update the currently highlighted fact, but do not trigger a change in the
 * inspector.
 * 
 * Used to switch facts when the selection corresponds to multiple facts.
 */
Viewer.prototype.highlightElements = function (ee) {
    $("body", this._iframes.contents()).find(".ixbrl-element").removeClass("ixbrl-selected").removeClass("ixbrl-related").removeClass("ixbrl-linked-highlight");
    ee.addClass("ixbrl-selected");
}

Viewer.prototype._factIdForElement = function (e) {
    var id = e.data('ivid');
    if (e.hasClass("ixbrl-continuation")) {
        id = this._continuedAtMap[id].continuationOf;
    }
    return id;
}

/*
 * Select the fact corresponding to the specified element.
 *
 * Takes an optional list of factIds corresponding to all facts that a click
 * falls within.  If omitted, it's treated as a click on a non-nested fact.
 */
Viewer.prototype.selectElement = function (e, factIdList) {
    var factId = this._factIdForElement(e);
    this.onSelect.fire(factId, factIdList);
}

Viewer.prototype.selectElementByClick = function (e) {
    var eltSet = [];
    var viewer = this;
    e.parents(".ixbrl-element").addBack().each(function () { 
        eltSet.unshift(viewer._factIdForElement($(this))); 
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
    return this.elementForFactId(fact.id);
}

Viewer.prototype.elementForFactId = function (factId) {
    return this._ixNodeMap[factId].wrapperNode;
}

Viewer.prototype.elementsForFactIds = function (ids) {
    var viewer = this;
    return $($.map(ids, function (id, n) {
        return viewer._ixNodeMap[id].wrapperNode.get();
    }));
}

Viewer.prototype.elementsForFacts = function (facts) {
    return this.elementsForFactIds($.map(facts, function (f) { return f.id }));
}

Viewer.prototype.highlightFact = function(factId) {
    var continuations = this._ixNodeMap[factId].continuations;
    this.highlightElements(this.elementsForFactIds([factId].concat(continuations)));
}

Viewer.prototype.showFactById = function (factId) {
    let elt = this.elementForFactId(factId);
    this.showDocumentForFactId(factId);
    if (elt) {
        this.showElement(elt);
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
        $(".ixbrl-element:not(.ixbrl-continuation):not(.ixbrl-element-footnote)", this._contents).each(function () {
            var factId = $(this).data('ivid');
            var continuations = viewer._ixNodeMap[factId].continuations;
            var elements = viewer.elementsForFactIds([factId].concat(continuations));
            elements.addClass("ixbrl-highlight");
            var i = groups[report.getFactById(factId).conceptQName().prefix];
            if (i !== undefined) {
                elements.addClass("ixbrl-highlight-" + i);
            }
        });
        $(".ixbrl-element-footnote", this._contents).addClass("ixbrl-highlight");
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
    var e = this.elementForFact(fact);
    var facts = [];
    e.closest("table").find(".ixbrl-element").each(function (i,e) {
        facts.push($(this).data('ivid'));
    });
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

Viewer.prototype.showDocumentForFactId = function(factId) {
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
