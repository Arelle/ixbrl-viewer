var taxonomy;

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
function selectNextTag(root) {
    var current = root.find(".ixbrl-selected").first();
    var elements = root.find(".ixbrl-element");
    var next = elements.eq(elements.index(current) + 1);
    root.scrollTop(next.offset().top - 50);
    selectElement(next);
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
    $('#dimensions').empty()
    for (var d in fact.d) {
        var x = $('<div class="dimension">').text(getLabel(d, "std") || d);
        x.appendTo('#dimensions');
        x = $('<div class="dimension-value">').text(getLabel(fact.d[d], "std") || fact.d[d]);
        x.appendTo('#dimensions');
        
    }
}

function localName(e) {
    if (e.indexOf(':') == -1) {
        return e
    }
    else {
        return e.substring(e.indexOf(':') + 1)
    }
}

function preProcessiXBRL(n, inHidden) {
  // XXX ignore prefixes

  if(n.nodeType == 1 && (localName(n.nodeName) == 'NONNUMERIC' || localName(n.nodeName) == 'NONFRACTION')) {
    var wrapper = "span";
    nn = n.getElementsByTagName("*");
    for (i = 0; i < nn.length; i++) {
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
        console.log("cloning non fraction");
        elt = $(n).parent().clone();
      }
    }
    if (localName(n.nodeName) == 'NONNUMERIC') {
      $(n).wrap('<' + wrapper + ' class="ixbrl-element ixbrl-element-nonnumeric"></' + wrapper + '>');
      console.log(n.getAttribute("id"));
      $(n).parent().data('ivid', n.getAttribute("id"));
      if(inHidden) {
        console.log("cloning non numeric");
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


$(function () {
    console.log("Preparing iframe...")
    var iframeContainer = $('<div id="iframe-container"></div>').appendTo('body');
    var $frame = $('<iframe />').appendTo(iframeContainer);
    var iframe = $frame[0]

    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head><title></title></head><body></body></html>");
    doc.close();

    $('head').children().not("script").appendTo($frame.contents().find('head'));
    {# Self-closing tags may mean that the script tags are not considered direct children of body, so move them so that they are #}
    $('body script').appendTo($('body'));
    $('body').children().not("script").not(iframeContainer).appendTo($frame.contents().find('body'));
    {% import 'inspector-html.tmpl' as inspectorhtml %}
    $("{{ inspectorhtml.html | htmlminify }}").prependTo('body');

    {% import 'inspector-css.css' as inspectorcss %}
    $("<style>")
        .prop("type", "text/css")
        .html("{{ inspectorcss.css | cssminify }}")
        .appendTo('head');

    taxonomy = JSON.parse(document.getElementById('taxonomy-data').innerHTML);

    var timer = setInterval(function () {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc.readyState == 'complete' || iframeDoc.readyState == 'interactive') {
            clearInterval(timer);
            preProcessiXBRL(iframeDoc.body);
            $('iframe').contents().find('.ixbrl-element').click(function (e) {
                e.stopPropagation();
                selectElement($(this));
            });

            {% import 'iframe-css.css' as css %}
            $("<style>")
                .prop("type", "text/css")
                .html("{{ css.css | cssminify }}")
                .appendTo($('iframe').contents().find('head'));

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
                selectNextTag($("iframe").contents());
            });

        }
    });
    
});

