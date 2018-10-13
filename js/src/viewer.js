import $ from 'jquery'

export function Viewer(iframe, report) {
    this._report = report;
    this._iframe = iframe;
    this._contents = iframe.contents();
    this._onSelectHandlers = [];
    this._onMouseEnterHandlers = [];
    this._onMouseLeaveHandlers = [];

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
  if(n.nodeType == 1 && (localName(n.nodeName) == 'NONNUMERIC' || localName(n.nodeName) == 'NONFRACTION')) {
    var wrapper = "span";
    var nn = n.getElementsByTagName("*");
    for (var i = 0; i < nn.length; i++) {
      if($(nn[i]).css("display") === "block") {
        wrapper = 'div';
        break;
      }
    }
    var elt;
    if (localName(n.nodeName) == 'NONFRACTION') {
      $(n).wrap('<' + wrapper + ' class="ixbrl-element ixbrl-element-nonfraction"></' + wrapper + '>');
      $(n).parent().data('ivid', n.getAttribute("id"));
      if(inHidden) {
        elt = $(n).parent().clone();
      }
    }
    if (localName(n.nodeName) == 'NONNUMERIC') {
      $(n).wrap('<' + wrapper + ' class="ixbrl-element ixbrl-element-nonnumeric"></' + wrapper + '>');
      $(n).parent().data('ivid', n.getAttribute("id"));
      if(inHidden) {
        elt = $(n).parent().clone();
      }
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
        .html(require('css-loader!less-loader!./iframe.less').toString())
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

    $('table', this._contents).each(function () {
        var table = $(this);
        if (table.find(".ixbrl-element").length > 0) {
            table.css("position", "relative");
            $('<div class="ixbrl-table-handle"></div>').appendTo(table).click(function () { viewer.exportTable(table); });
        }
    });
}

Viewer.prototype.exportTable = function (table) {
    var viewer = this;
    var s = '';
    table.find("tr").each(function () {
        $(this).find("td, th").each(function () {
            var colspan = $(this).attr("colspan");
            if (colspan) {
                for (var i=0; i < colspan-1; i++) {
                    s += ",";
                }
            }
            var v;
            var facts = $(this).find('.ixbrl-element');
            if (facts.length > 0) {
                var id = facts.first().data('ivid');
                var fact = viewer._report.getFactById(id);
                v = fact.value();
            }
            else {
                v = $(this).text();
            }
            s += '"' + v + '"';
            s += ",";
        });
        s += "\n";
    });
    console.log(s);
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
    $.each(this._onSelectHandlers, function (i, handler) {
        handler(id);
    });
}

Viewer.prototype._mouseEnter = function (e) {
    var id = e.data('ivid');
    $.each(this._onMouseEnterHandlers, function (i, handler) {
        handler(id);
    });
}

Viewer.prototype._mouseLeave = function (e) {
    var id = e.data('ivid');
    $.each(this._onMouseLeaveHandlers, function (i, handler) {
        handler(id);
    });
}

Viewer.prototype.highlightRelatedFact = function (f) {
    var e = this.elementForFact(f);
    e.addClass("ixbrl-related");
}

Viewer.prototype.elementForFact = function (fact) {
    return $('.ixbrl-element', this._contents).filter(function () { return $(this).data('ivid') == fact.id }).first();
}

Viewer.prototype.showAndSelectFact = function (fact) {
    this.showAndSelectElement(this.elementForFact(fact));
}

Viewer.prototype.onSelect = function (f) {
    this._onSelectHandlers.push(f);
}

Viewer.prototype.onMouseEnter = function (f) {
    this._onMouseEnterHandlers.push(f);
}

Viewer.prototype.onMouseLeave = function (f) {
    this._onMouseLeaveHandlers.push(f);
}

Viewer.prototype.highlightAllTags = function (on) {
    if (on) {
        $(".ixbrl-element", this._contents).addClass("ixbrl-highlight");
    }
    else {
        $(".ixbrl-element", this._contents).removeClass("ixbrl-highlight");
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
