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

function selectElement(e) {
    console.log(e.target.id);
    var id = e.target.id;
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
    $('body').children().not(iframeContainer).appendTo($frame.contents().find('body'));
    $('<div id="inspector"><span id="inspector-status">Loading...</span><div id="std-label"></div><div id="documentation"></div><div id="dimensions"></div><div id="concept"></div>').prependTo('body');

            {% import 'inspector-css.css' as inspectorcss %}
            $("<style>")
                .prop("type", "text/css")
                .html("{{ inspectorcss.css | replace ("\n", "\\\n") | replace("\"", "\\\"") }}")
                .appendTo('head');

    taxonomy = JSON.parse(document.getElementById('taxonomy-data').innerHTML);
/*
    var b64 = document.getElementById("ixbrl-data").innerHTML;
    var html = b64DecodeUnicode(b64);
    var iframe = document.createElement('iframe');
    document.getElementById('iframe-container').appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
*/
    var timer = setInterval(function () {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc.readyState == 'complete' || iframeDoc.readyState == 'interactive') {
            clearInterval(timer);
            nn = $('iframe').contents().find(":root").get(0).getElementsByTagName("*");
            for (i=0; i < nn.length; i++) {
                n = nn[i]
                if (n.nodeName == 'IX:NONFRACTION' || n.nodeName == 'IX:NONNUMERIC') {
                    $(n).addClass("iv-ixbrl-fact");
                    $(n).click(selectElement);
                }

            }
            {% import 'iframe-css.css' as css %}
            $("<style>")
                .prop("type", "text/css")
                .html("{{ css.css | replace ("\n", "\\\n") | replace("\"", "\\\"") }}")
                .appendTo($('iframe').contents().find('head'));

            $('#inspector-status').hide();
            //$('#iframe-container > .loading-mask').hide();
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
        }
    });
    
});

