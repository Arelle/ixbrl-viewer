import interact from 'interactjs'
import $ from 'jquery'
import { iXBRLReport } from "./report.js";
import { Viewer } from "./viewer.js";
import { Inspector } from "./inspector.js";

var taxonomy;
var searchIndex;
var report;



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

                report = new iXBRLReport(document.getElementById('taxonomy-data'));

                var inspector = new Inspector(report, viewer);

                $('#ixv-loading-mask').text("Building search index");
                setTimeout(function () {

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


                    $('#ixv-loading-mask').remove();
                }, 0);

            }
        });
        
    }, 0);
    
});
