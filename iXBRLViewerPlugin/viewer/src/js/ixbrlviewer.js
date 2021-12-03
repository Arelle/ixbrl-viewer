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

export function iXBRLViewer(options) {
    this.options = options || {};
    this._plugins = [];
    this.inspector = new Inspector(this);
    this.viewer = null;
    this.options = options || {};
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
 * extendHighlightKey(key)
 *
 * Called when the highlight color key is created.  key is an array of labels,
 * which can be modified or extended.
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

iXBRLViewer.prototype._loadInspectorHTML = function () {
    /* Insert HTML and CSS styles into body */
    $(require('../html/inspector.html')).prependTo('body');
    var inspector_css = require('css-loader!less-loader!../less/inspector.less').toString(); 
    $('<style id="ixv-style"></style>')
        .prop("type", "text/css")
        .text(inspector_css)
        .appendTo('head');
    $('<link id="ixv-favicon" type="image/x-icon" rel="shortcut icon" />')
        .attr('href', require('../img/favicon.ico'))
        .appendTo('head');
}

iXBRLViewer.prototype._reparentDocument = function () {
    var iframeContainer = $('#ixv #iframe-container');

    var iframe = $('<iframe title="iXBRL document view"/>').appendTo(iframeContainer)[0];

    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head><title></title></head><body></body></html>");
    doc.close();

    var docTitle = $('title').text();
    if (docTitle != "") {
        docTitle = "Inline Viewer - " + docTitle;
    }
    else {
        docTitle = "Inline Viewer";
    }
    if ($('html').attr("lang") === undefined) {
        $('html').attr("lang", "en-US");
    }

    $('head').children().not("script").not("style#ixv-style").not("link#ixv-favicon").appendTo($(iframe).contents().find('head'));

    $('<title>').text(docTitle).appendTo($('head'));

    /* Due to self-closing tags, our script tags may not be a direct child of
     * the body tag in an HTML DOM, so move them so that they are */
    $('body script').appendTo($('body'));
    const iframeBody = $(iframe).contents().find('body');
    $('body').children().not("script").not('#ixv').not(iframeContainer).appendTo(iframeBody);

    /* Move all attributes on the body tag to the new body */
    for (const bodyAttr of [...$('body').prop("attributes")]) {
        iframeBody.attr(bodyAttr.name, bodyAttr.value); 
        $('body').removeAttr(bodyAttr.name);
    }

    /* Avoid any inline styles on the old body interfering with the inspector */
    $('body').removeAttr('style');
    return iframe;
}

iXBRLViewer.prototype._getTaxonomyData = function () {
    for (var i = document.body.children.length - 1; i >= 0; i--) {
        var elt = document.body.children[i];
        if (elt.tagName.toUpperCase() == 'SCRIPT' && elt.getAttribute("type") == 'application/x.ixbrl-viewer+json') {
            return elt.innerHTML;
        }
    }
    return null;
}

iXBRLViewer.prototype._checkDocumentSetBrowserSupport = function () {
    if (document.location.protocol == 'file:') {
        alert("Displaying iXBRL document sets from local files is not supported.  Please view the viewer files using a web server.");
    }
}

iXBRLViewer.prototype.load = function () {
    var iv = this;
    var inspector = this.inspector;
    setTimeout(function () {

        iv._loadInspectorHTML();
        var iframes = $(iv._reparentDocument());

        var taxonomyData = iv._getTaxonomyData();
        if (taxonomyData === null) {
            $('#ixv .loader .text').text("Error: Could not find viewer data");
            $('#ixv .loader').removeClass("loading");
            return;
        }
        var report = new iXBRLReport(JSON.parse(taxonomyData));
        if (report.isDocumentSet()) {
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
            iframes.each(function (n) {
                var iframe = this;
                var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if ((iframeDoc.readyState != 'complete' && iframeDoc.readyState != 'interactive') || $(iframe).contents().find("body").children().length == 0) {
                    complete = false;
                }
            });
            if (complete) {
                clearInterval(timer);

                var viewer = iv.viewer = new Viewer(iv, iframes, report);

                viewer.initialize()
                    .then(() => inspector.initialize(report, viewer))
                    .then(() => {
                        interact('#viewer-pane').resizable({
                            edges: { left: false, right: ".resize", bottom: false, top: false },
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
                        if (iv.options.showValidationWarningOnStart) {
                            inspector.showValidationWarning();
                        }
                    });
            }
        }, 250);
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
