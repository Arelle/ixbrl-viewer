import interact from 'interactjs'
import lunr from 'lunr'
import $ from 'jquery'
import dateFormat from "dateformat"

var taxonomy;
var searchIndex;

function b64DecodeUnicode(str) {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
}

function getLabel(c, rolePrefix) {
    var labels = taxonomy.concepts[c].labels[rolePrefix]
    if (labels === undefined) {
        return undefined;
    }
    else {
        return labels["en"] || labels["en-us"]
    }
}


function selectAdjacentTag(iframe, offset) {
    var elements = $(".ixbrl-element", iframe.contents());
    var current = $(".ixbrl-selected", iframe.contents());
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
        
    showAndSelectElement(iframe, next);
}

function scrollIfNotVisible(iframe, e) {
    var viewTop = iframe.contents().scrollTop();
    var viewBottom = viewTop + iframe.height();
    var eTop = e.offset().top;
    var eBottom = eTop + e.height();
    if (eTop < viewTop || eBottom > viewBottom) {
        iframe.contents().scrollTop(e.offset().top - 50);
    }
}

function showAndSelectElement(iframe, e) {
    scrollIfNotVisible(iframe, e);
    selectElement(e);
}

function selectElement(e) {
    e.closest("body").find(".ixbrl-element").removeClass("ixbrl-selected");
    e.addClass("ixbrl-selected");
    var id = e.data('ivid');
    var fact = taxonomy.facts[id];
    var concept = fact.c;
    $('#std-label').text(getLabel(concept, "std") || concept);
    $('#documentation').text(getLabel(concept, "doc") || "");
    $('#concept').text(concept);
    $('#period').text(periodString(fact));
    $('#dimensions').empty()
    for (var d in fact.d) {
        var x = $('<div class="dimension">').text(getLabel(d, "std") || d);
        x.appendTo('#dimensions');
        x = $('<div class="dimension-value">').text(getLabel(fact.d[d], "std") || fact.d[d]);
        x.appendTo('#dimensions');
        
    }
    $('#ixbrl-search-results tr').removeClass('selected');
    $('#ixbrl-search-results tr').filter(function () { return $(this).data('ivid') == id }).addClass('selected');
}

function localName(e) {
    if (e.indexOf(':') == -1) {
        return e
    }
    else {
        return e.substring(e.indexOf(':') + 1)
    }
}

function isodateToHuman(s, adjust) {
    var d = new Date(s);
    if (d.getUTCHours() + d.getUTCMinutes() + d.getUTCSeconds() == 0) { 
        if (adjust) {
            d.setDate(d.getDate() - 1);
        }
        return dateFormat(d,"d mmm yyyy");
    }
    else {
        return dateFormat(d,"d mmm yyyy HH:MM:ss");
    }
}

function periodString(f) {
    var s;
    if (!f.pt) {
        /* forever */
        s = "None";
    }
    else if (!f.pf) {
        /* instant */
        s = isodateToHuman(f.pt, true);
    }
    else {
        s = isodateToHuman(f.pf, false) + " to " + isodateToHuman(f.pt, true);
    }
    return s;
}

function preProcessiXBRL(n, inHidden) {
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
    preProcessiXBRL(n.childNodes[i], inHidden);
  }

}

function buildSearchIndex(taxonomyData) {
    var docs = [];
    var dims = {};
    $.each(taxonomyData.facts, function (id, f) {
        var doc = { "id": id };
        var l = getLabel(f.c, "std");
        doc.doc = getLabel(f.c,"doc")
        doc.date = f.pt;
        doc.startDate = f.pf;
        for (var d in f.d) {
            l += " " + getLabel(f.d[d],"std");
        }
        doc.label = l;
        docs.push(doc);
    });
    searchIndex = lunr(function () {
      this.ref('id');
      this.field('label');
      this.field('startDate');
      this.field('date');
      this.field('doc');

      docs.forEach(function (doc) {
        this.add(doc);
      }, this)
    })
}


$(function () {
    var iframeContainer = $('<div id="iframe-container"></div>').appendTo('body');
    var $frame = $('<iframe />').appendTo(iframeContainer);
    var iframe = $frame[0]

    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head><title></title></head><body></body></html>");
    doc.close();

    $('head').children().not("script").appendTo($frame.contents().find('head'));
    
    /* Due to self-closing tags, our script tags may not be a direct child of
     * the body tag in an HTML DOM, so move them so that they are */
    $('body script').appendTo($('body'));
    $('body').children().not("script").not(iframeContainer).appendTo($frame.contents().find('body'));
    
    $(require('html-loader!./inspector.html')).prependTo('body');

    var inspector_css = require('css-loader!less-loader!./inspector.less').toString(); 
    
    $("<style>")
        .prop("type", "text/css")
        .text(inspector_css)
        .appendTo('head');


    var timer = setInterval(function () {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc.readyState == 'complete' || iframeDoc.readyState == 'interactive') {
            clearInterval(timer);
            preProcessiXBRL(iframeDoc.body);
            $('.ixbrl-element', $('iframe').contents()).click(function (e) {
                e.stopPropagation();
                selectElement($(this));
            });

            
            $("<style>")
                .prop("type", "text/css")
                .html(require('css-loader!less-loader!./iframe.less').toString())
                .appendTo($('iframe').contents().find('head'));

            taxonomy = JSON.parse(document.getElementById('taxonomy-data').innerHTML);

            buildSearchIndex(taxonomy);

            $('#inspector-status').hide();
            interact('#iframe-container').resizable({
                edges: { left: false, right: true, bottom: false, top: false},
                restrictEdges: {
                    outer: 'parent',
                    endOnly: true,
                },
                restrictSize: {
                    min: { width: 100 }
                },
            })
            .on('resizemove', function (event) {
                var target = event.target;
                var w = 100 * event.rect.width / $(target).parent().width();
                target.style.width = w + '%';
                $('#inspector').css('width', (100 - w) + '%');
            });

            $('#ixbrl-show-all-tags').change(function(e){
                if(this.checked) {
                    $("iframe").contents().find(".ixbrl-element").addClass("ixbrl-highlight");
                }
                else {
                    $("iframe").contents().find(".ixbrl-element").removeClass("ixbrl-highlight");
                }
            });
            $('#ixbrl-next-tag').click(function(e) {
                selectAdjacentTag($("iframe"), 1);
            });
            $('#ixbrl-prev-tag').click(function(e) {
                selectAdjacentTag($("iframe"), -1);
            });
            $('#ixbrl-search').keyup(function () {
                var s = $(this).val();
                var rr = searchIndex.search(s);
                $('#ixbrl-search-results tr').remove();
                $.each(rr, function (i,r) {
                    var row = $('<tr><td></td></tr>');
                    row.find("td").text(getLabel(taxonomy.facts[r.ref].c, "std"));
                    row.data('ivid', r.ref);
                    row.appendTo('#ixbrl-search-results');
                    row.click(function () {
                        showAndSelectElement($('iframe'), $(".ixbrl-element", $('iframe').contents()).filter(function () { return $(this).data('ivid') == r.ref }).first());
                    });
                });
                
            });

        }
    });
    
});
