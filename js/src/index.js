import interact from 'interactjs'
import lunr from 'lunr'
import $ from 'jquery'
import { iXBRLReport } from "./report.js";
import { Viewer } from "./viewer.js";
import { Inspector } from "./inspector.js";

var taxonomy;
var searchIndex;
var report;


function buildSearchIndex(taxonomyData) {
    var docs = [];
    var dims = {};
    var facts = report.facts();
    for (var i = 0; i < facts.length; i++) {
        var f = facts[i];
        var doc = { "id": f.id };
        var l = f.getLabel("std");
        doc.doc = f.getLabel("doc");
        doc.date = f.periodTo();
        doc.startDate = f.periodFrom();
        var dims = f.dimensions();
        for (var d in dims) {
            l += " " + report.getLabel(dims[d],"std");
        }
        doc.label = l;
        docs.push(doc);
    }
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
    $('<div id="ixv-loading-mask" style="position: fixed; top: 20px; left: 20px; width: 500px; height: 200px; background-color: #fff; border: solid #000 1px; text-align: center;">Loading iXBRL Viewer</div>').prependTo('body');
    setTimeout(function(){


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
        $('body').children().not("script").not('#ixv-loading-mask').not(iframeContainer).appendTo($frame.contents().find('body'));
        
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

                var viewer = new Viewer($('iframe'));


                $('.ixbrl-element', $('iframe').contents()).click(function (e) {
                    e.stopPropagation();
                    viewer.selectElement($(this));
                });


                taxonomy = JSON.parse(document.getElementById('taxonomy-data').innerHTML);
                report = new iXBRLReport(document.getElementById('taxonomy-data'));

                var inspector = new Inspector(report, viewer);

                $('#ixv-loading-mask').text("Building search index");
                setTimeout(function () {
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


                    $('#ixbrl-search').keyup(function () {
                        var s = $(this).val();
                        var rr = searchIndex.search(s);
                        $('#ixbrl-search-results tr').remove();
                        $.each(rr, function (i,r) {
                            var row = $('<tr><td></td></tr>');
                            row.find("td").text(report.getFactById(r.ref).getLabel("std") + " (" + r.score + ")" );
                            row.data('ivid', r.ref);
                            row.appendTo('#ixbrl-search-results');
                            row.click(function () {
                                viewer.showAndSelectElement($(".ixbrl-element", $('iframe').contents()).filter(function () { return $(this).data('ivid') == r.ref }).first());
                            });
                        });
                        
                    });
                    $('#ixv-loading-mask').remove();
                }, 0);

            }
        });
        
    }, 0);
    
});
