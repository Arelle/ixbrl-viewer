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

export function iXBRLViewer() {
    this._plugins = [];
    this.inspector = new Inspector(this);
    this.viewer = null;
    this._width = undefined;
}

/*
 * Adds a plugin to the viewer.  The plugin should be an object with one or
 * more of the methods listed below, which will be called by the viewer.
 *
 * preProcessiXBRL(bodyElement, docIndex)
 *
 * Called upon viewer intialisation, once for each iXBRL document.  bodyElement
 * is a DOM object for the body element.  docIndex is the index of the document
 * within the document set.
 *
 * updateViewerStyleElement(styleElts)
 *
 * styleElts is a JQuery object consisting of the viewer style elements for
 * each document in the document set.  Additional CSS can be appended to the
 * contents, or additional header elements inserted relative to the provided
 * style element.
 *
 * extendDisplayOptionsMenu(menu)
 *
 * Called when the display options menu is created or recreated.  menu is a
 * Menu object, and can be modified to add additional menu items.
 *
 */
iXBRLViewer.prototype.registerPlugin = function (plugin) {
    this._plugins.push(plugin);
}

iXBRLViewer.prototype.callPluginMethod = function (methodName, ...args) {
    var iv = this;
    $.each(iv._plugins, function (n, p) {
        if (typeof p[methodName] === 'function') {
            p[methodName](...args);
        }
    });
}

iXBRLViewer.prototype.pluginPromise = function (methodName, ...args) {
    var iv = this;
    return new Promise(function (resolve, reject) {
        /* Call promises in turn */
        (async function () {
            for (var n = 0; n < iv._plugins.length; n++) {
                var p = iv._plugins[n];
                if (typeof p[methodName] === 'function') {
                    await p[methodName](...args);
                }
            }
        })().then(() => {
            resolve();
        });
    });
}

iXBRLViewer.prototype._getChromeVersion = function() {
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/(\d+)\./);
    return raw ? parseInt(raw[2], 10) : null;
}

iXBRLViewer.prototype._inIframe = function() {
    try {
        return window.self !== window.top;
    } catch(e) {
        return true;
    }
}

iXBRLViewer.prototype._detectPDF = function(document) {    
    var pageContainer = $("div#page-container", document); 
    if (pageContainer.length > 0) {
        var generator = $('meta[name=generator]', this._contents).attr("content");
        if (generator === 'pdf2htmlEX') {
            if (pageContainer.css('position') == 'absolute') {
                return true;
            }
        }
        if (pageContainer.find("div.pf[style*='content-visibility']").length > 0) {
            if (pageContainer.css('position') == 'absolute') {
                return true;            
            }            
        }        
    }
    return false;
}

iXBRLViewer.prototype._fixChromeBug = function(iframe) {
    var chromeVersion = this._getChromeVersion();
    if (chromeVersion && chromeVersion >= 88) { // Giving a chance for Google to fix this        
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        var pageContainer = $(doc).find("div#page-container"); // PDF
        if (pageContainer.length > 0) {
            pageContainer.find("div.pf").css("content-visibility", "");
        } else {
            pageContainer =  $(doc).find("div.box"); // IDML
            if (pageContainer.length > 0) {
                pageContainer.find("div.page_A4").css("content-visibility", "");
            }
        }
    }
}

iXBRLViewer.prototype._reparentDocument = function (source, useFrames) {    
    var iframeContainer = $('#ixv #iframe-container');        
    
    if (useFrames) {
        
        var iframe = $('<iframe />')[0];        
        $('#iframe-div').replaceWith(iframe);

        var doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write("<!DOCTYPE html><html><head><title></title></head><body></body></html>");
        doc.close();

        $('head', source).children().not("script").not("style#ixv-style").not("link#ixv-favicon").appendTo($(iframe).contents().find('head'));
        
        /* Due to self-closing tags, our script tags may not be a direct child of
        * the body tag in an HTML DOM, so move them so that they are */
        $('body script', source).appendTo($('body', source));
        $('body', source).children().not("script").not('#ixv').not(iframeContainer).appendTo($(iframe).contents().find('body'));

        /* Avoid any inline styles on the old body interfering with the inspector */
        $('body', source).removeAttr('style');
        
        return iframe;

    } else {

        var iframediv = $('#iframe-div');                
        $('body', source).children().not("script").not('#ixv').not(iframeContainer).appendTo(iframediv);
        
        if (!source[0].isSameNode(document)) {
            $('head', source).children('style').appendTo($('head'));
            $('head title').replaceWith($('head title', source));
        }

        $('<style></style>')
            .prop('type','text/css')
            .html('.checked { background: none; }')
            .appendTo($('head'));

    
        return $.makeArray(document);
    }    
}

iXBRLViewer.prototype._getTaxonomyData = function() {
    for (var i = document.body.children.length - 1; i >= 0; i--) {
        var elt = document.body.children[i];
        if (elt.tagName.toUpperCase() == 'SCRIPT' && elt.getAttribute("type") == 'application/x.ixbrl-viewer+json') {
            return elt.innerHTML;
        }
    }
    return null;
}

iXBRLViewer.prototype._checkDocumentSetBrowserSupport = function() {
    if (document.location.protocol == 'file:') {
        alert("Displaying iXBRL document sets from local files is not supported.  Please view the viewer files using a web server.");
    }
}

iXBRLViewer.prototype.load = function() {
    var iv = this;
    var iframeDiv = $('#ixv #iframe-container #iframe-div');
    var src = iframeDiv[0].dataset.src;
    if (src) {
        $.get(src, function(data) {
            var doc = $(data);
            iv._load(doc);
        });
    }
    else {
        iv._load($(document));
    }
}

iXBRLViewer.prototype._load = function(ownerDocument) {
    var iv = this;
    var inspector = this.inspector;

    setTimeout(function(){
        
        /* AMANA: In the chromium, pdf files do not use frames in case of content-visibility CSS style  */  
        var isPDF = iv._detectPDF(ownerDocument);     
        var useFrames = iv._inIframe() || !isPDF;
        var iframes = $(iv._reparentDocument(ownerDocument, useFrames));

        /* AMANA extension: In a case of multifile iXBRL attach JSON into every HTML page is too expensive --> */
        var report;
        if (window.hasOwnProperty('xbrldata__')) {
            /* We do not use dynamic loading external JSON via jQuery because it does not work for file:// protocol
                 insted of this we generate script with assignment window.xbrldata__ = { <JSONdata> }; */
            report = new iXBRLReport(window.xbrldata__);
        } else {
            var taxonomyData = iv._getTaxonomyData();
            if (taxonomyData === null) {
                $('#ixv .loader .text').text("Error: Could not find viewer data");
                $('#ixv .loader').removeClass("loading");
                return;
            }
            var report = new iXBRLReport(JSON.parse(taxonomyData));
        }

        if (useFrames && report.isDocumentSet()) {
            var ds = report.documentSetFiles();
            for (var i = 1; i < ds.length; i++) {
                var iframe = $("<iframe />").attr("src", ds[i]).appendTo("#ixv #iframe-container");
                iframes = iframes.add(iframe);
            }
            iv._checkDocumentSetBrowserSupport();
        }

        /* Poll for iframe load completing - there doesn't seem to be a reliable event that we can use */
        var timer = setInterval(function () {
            var complete = true;
            if (useFrames) {
                iframes.each(function (n) {
                    var iframe = this;
                    var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if ((iframeDoc.readyState != 'complete' && iframeDoc.readyState != 'interactive') || $(iframe).contents().find("body").children().length == 0) {
                        complete = false;
                    }
                });
            }
            if (complete) {
                clearInterval(timer);
                if (useFrames) {
                    iframes.each(function (n) {
                        /* fix chrome 88 content-visibility issue */ 
                        iv._fixChromeBug(this);
                    });
                }

                var viewer = iv.viewer = new Viewer(iv, iframes, report, useFrames, isPDF);

                viewer.initialize()
                    .then(() => inspector.initialize(report))
                    .then(() => {
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
                            $('#ixv').css({"pointer-events": "none", "-moz-user-select": "none"});
                        })
                        .on('resizemove', function (event) {                                                    
                            event.target.style.width = `${event.rect.width}px`;
                            iv._width = window.innerWidth-event.rect.width;
                            $('#inspector').css('width', `${iv._width}px`);
                        })
                        .on('resizeend', function (event) {
                            $('#ixv').css({"pointer-events": "auto", "-moz-user-select": "all"});
                        });
                        $('#ixv .loader').remove();

                        $(window).on('resize', function(){
                            if (iv._width) {                 
                                $('#viewer-pane').css('width', `${window.innerWidth-iv._width}px`); 
                            }
                        });

                        /* Focus on fact specified in URL fragment, if any */
                        inspector.handleFactDeepLink();
                    })
                    .then(() => viewer.notifyReady());
            }
        });
    }, 0);
}

/* Update the progress message during initial load.  Returns a Promise which
 * resolves once the message is actually displayed */
iXBRLViewer.prototype.setProgress = function (msg) {
    return new Promise((resolve, reject) => {
        /* We need to do a double requestAnimationFrame, as we need to get the
         * message up before the ensuing thread-blocking work
         * https://bugs.chromium.org/p/chromium/issues/detail?id=675795 
         */
        window.requestAnimationFrame(function () {
            $('#ixv .loader .text').text(msg);
            window.requestAnimationFrame(function () {
                resolve();
            });
        });
    });
}
