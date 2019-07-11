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

    /* Avoid any inline styles on the old body interfering with the inspector */
    $('body').removeAttr('style');
    return iframe;
}

function getTaxonomyData() {
    for (var i = document.body.children.length - 1; i >= 0; i--) {
        var elt = document.body.children[i];
        if (elt.tagName.toUpperCase() == 'SCRIPT' && elt.getAttribute("type") == 'application/x.ixbrl-viewer+json') {
            return elt.innerHTML;
        }
    }
    return null;
}

function checkDocumentSetBrowserSupport() {
    if (document.location.protocol == 'file:' && window.chrome) {
        alert("Displaying iXBRL document sets from local files is not supported on Chrome.  Please view the viewer files using a web server, or try a different browser.");
    }
}

$(function () {
    var inspector = new Inspector();
    setTimeout(function(){

        var iframes = $(reparentDocument());

        var taxonomyData = getTaxonomyData();
        if (taxonomyData === null) {
            $('#ixv .loader .text').text("Error: Could not find viewer data");
            $('#ixv .loader').removeClass("loading");
            return;
        }
        var report = new iXBRLReport(JSON.parse(taxonomyData));
        if (report.isDocumentSet()) {
            var ds = report.documentSetFiles();
            for (var i = 1; i < ds.length; i++) {
                var iframe = $("<iframe src=\"" + ds[i] + "\" />").appendTo("#ixv #iframe-container");
                iframes = iframes.add(iframe);
            }
            checkDocumentSetBrowserSupport();
        }

        /* Poll for iframe load completing - there doesn't seem to be a reliable event that we can use */
        var timer = setInterval(function () {
            var complete = true;
            iframes.each(function (n) {
                var iframe = this;
                var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if ((iframeDoc.readyState != 'complete' && iframeDoc.readyState != 'interactive') || $(iframe).contents().find("body").children().length == 0) {
                    complete = false;
                }
            });
            if (complete) {
                clearInterval(timer);
                $('#ixv .loader .text').text("Building search index");

                var viewer = new Viewer(iframes, report);

                setTimeout(function () {
                    inspector.setReport(report);
                    inspector.setViewer(viewer);

                    interact('#viewer-pane').resizable({
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
                    })
                    .on('resizemove', function (event) {
                        var target = event.target;
                        var w = 100 * event.rect.width / $(target).parent().width();
                        target.style.width = w + '%';
                        $('#inspector').css('width', (100 - w) + '%');
                    })
                    .on('resizeend', function (event) {
                        $('#ixv').css("pointer-events", "auto");
                    });
                    $('#ixv .loader').remove();

                    /* Focus on fact specified in URL fragment, if any */
                    inspector.handleFactDeepLink();
                },0);


            }
        });
        
    }, 0);
    
});
