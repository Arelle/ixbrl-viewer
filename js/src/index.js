import interact from 'interactjs'
import $ from 'jquery'
import { iXBRLReport } from "./report.js";
import { Viewer } from "./viewer.js";
import { Inspector } from "./inspector.js";

function reparentDocument() {
    var iframeContainer = $('#ixv #iframe-container');
    
    var iframe = $('<iframe />').appendTo(iframeContainer)[0];

    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head><title></title></head><body></body></html>");
    doc.close();

    $('head').children().not("script").not("style#ixv-style").appendTo($(iframe).contents().find('head'));
    
    /* Due to self-closing tags, our script tags may not be a direct child of
     * the body tag in an HTML DOM, so move them so that they are */
    $('body script').appendTo($('body'));
    $('body').children().not("script").not('#ixv').not(iframeContainer).appendTo($(iframe).contents().find('body'));
    return iframe;

}

$(function () {
    var inspector = new Inspector();
    setTimeout(function(){

        var iframe = reparentDocument();

        /* Poll for iframe load completing - there doesn't seem to be a reliable event that we can use */
        var timer = setInterval(function () {
            var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc.readyState == 'complete' || iframeDoc.readyState == 'interactive') {
                clearInterval(timer);

                var viewer = new Viewer($('iframe'));
                var report = new iXBRLReport(document.getElementById('taxonomy-data'));

                $('#ixv .loader .text').text("Building search index");
                setTimeout(function () {
                    inspector.setReport(report);
                    inspector.setViewer(viewer);

                    interact('#iframe-container').resizable({
                        edges: { left: false, right: ".resize", bottom: false, top: false},
                        restrictEdges: {
                            outer: 'parent',
                            endOnly: true,
                        },
                        restrictSize: {
                            min: { width: 100 }
                        },
                    })
                    .on('resizestart', function (event) {
                        $('#ixv').css("pointer-events", "none");
                        console.log("resize start");
                    })
                    .on('resizemove', function (event) {
                        console.log("resize move");
                        var target = event.target;
                        var w = 100 * event.rect.width / $(target).parent().width();
                        target.style.width = w + '%';
                        $('#inspector').css('width', (100 - w) + '%');
                    })
                    .on('resizeend', function (event) {
                        console.log("resize end");
                        $('#ixv').css("pointer-events", "auto");
                    });
                    $('#ixv .loader').remove();
                },0);


            }
        });
        
    }, 0);
    
});
