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

export function Viewer(iframe, report) {
    this._report = report;
    this._iframe = iframe;
    this._contents = iframe.contents();
    this.onSelect = $.Callbacks();
    this.onMouseEnter = $.Callbacks();
    this.onMouseLeave = $.Callbacks();

    this._preProcessiXBRL($("body", iframe.contents()).get(0));
    this._applyStyles();
    this._bindHandlers();
    this.scale = 1;
}

function localName(e) {
    if (e.indexOf(':') == -1) {
        return e
    }
    else {
        return e.substring(e.indexOf(':') + 1)
    }
}


Viewer.prototype._preProcessiXBRL = function(n, inHidden) {
  var elt;
  var name = localName(n.nodeName).toUpperCase();
  if(n.nodeType == 1 && (name == 'NONNUMERIC' || name == 'NONFRACTION')) {
    var node = $(n).closest("td,th").eq(0);
    if (node.length == 1) {
        var regex = "^[^0-9A-Za-z]*" + escapeRegex($(n).text()) + "[^0-9A-Za-z]*$";
        if (node.text().match(regex) == null) {
            node = null;
        } 
    }
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
    node.addClass("ixbrl-element").data('ivid',n.getAttribute("id"));
    if (localName(n.nodeName) == 'NONFRACTION') {
      $(node).addClass("ixbrl-element-nonfraction");
    }
    if (localName(n.nodeName) == 'NONNUMERIC') {
      $(node).addClass("ixbrl-element-nonfraction");
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
    this._preProcessiXBRL(n.childNodes[i], inHidden);
  }
}

Viewer.prototype._applyStyles = function () {
    $("<style>")
        .prop("type", "text/css")
        .html(require('css-loader!less-loader!../less/viewer.less').toString())
        .appendTo($("head", this._iframe.contents()));
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
        
    this.showAndSelectElement(next);
}

Viewer.prototype._bindHandlers = function () {
    var viewer = this;
    $('.ixbrl-element', this._contents)
        .click(function (e) {
            e.stopPropagation();
            viewer.selectElement($(this));
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

Viewer.prototype.scrollIfNotVisible = function(e) {
    var viewTop = this._iframe.contents().scrollTop();
    var viewBottom = viewTop + this._iframe.height();
    var eTop = e.offset().top;
    var eBottom = eTop + e.height();
    if (eTop < viewTop || eBottom > viewBottom) {
        this._iframe.contents().scrollTop(e.offset().top - this._iframe.height()/2);
    }
}

Viewer.prototype.showAndSelectElement = function(e) {
    this.scrollIfNotVisible(e);
    this.selectElement(e);
}

Viewer.prototype.selectElement = function (e) {
    e.closest("body").find(".ixbrl-element").removeClass("ixbrl-selected").removeClass("ixbrl-related").removeClass("ixbrl-linked-highlight");
    e.addClass("ixbrl-selected");
    var id = e.data('ivid');
    this.onSelect.fire(id);
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
    return $('.ixbrl-element', this._contents).filter(function () { return $(this).data('ivid') == fact.id }).first();
}

Viewer.prototype.elementsForFacts = function (facts) {
    var ids = $.map(facts, function (f) { return f.id });
    var elements = $('.ixbrl-element', this._contents).filter(function () { return $.inArray($(this).data('ivid'), ids ) > -1 });
    return elements;
}

Viewer.prototype.showAndSelectFact = function (fact) {
    this.showAndSelectElement(this.elementForFact(fact));
}

Viewer.prototype.highlightAllTags = function (on, namespaceGroups) {
    var groups = {};
    $.each(namespaceGroups, function (i, ns) {
        groups[ns] = i;
    });
    var report = this._report;
    if (on) {
        $(".ixbrl-element", this._contents).each(function () {
            $(this).addClass("ixbrl-highlight");
            var i = groups[report.getFactById($(this).data('ivid')).conceptQName().prefix];
            if (i !== undefined) {
                $(this).addClass("ixbrl-highlight-" + i);
            }
        });
    }
    else {
        //$(".ixbrl-element", this._contents).removeClass("ixbrl-highlight");
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

Viewer.prototype.getTitle = function () {
    return $('head title', this._contents).text();
}
