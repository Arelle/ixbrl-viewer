// See COPYRIGHT.md for copyright information

import interact from 'interactjs'
import $ from 'jquery'
import { ReportSet } from "./reportset.js";
import { Viewer, DocumentTooLargeError } from "./viewer.js";
import { Inspector } from "./inspector.js";

export class iXBRLViewer {

    constructor(options) {
        this._features = new Set();
        this._plugins = [];
        this.inspector = new Inspector(this);
        this.viewer = null;
        options = options || {};
        const defaults = {
            continuationElementLimit: 10000,
            showValidationWarningOnStart: false,
        }
        this.options = {...defaults, ...options};
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
    registerPlugin(plugin) {
        this._plugins.push(plugin);
    }

    callPluginMethod(methodName, ...args) {
        for (const p of this._plugins) {
            if (typeof p[methodName] === 'function') {
                p[methodName](...args);
            }
        }
    }

    pluginPromise(methodName, ...args) {
        return new Promise((resolve, reject) => {
            /* Call promises in turn */
            (async () => {
                for (const p of this._plugins) {
                    if (typeof p[methodName] === 'function') {
                        await p[methodName](...args);
                    }
                }
            })().then(() => {
                resolve();
            });
        });
    }

    setFeatures(featureNames, queryString) {
        const featureMap = {}
        // Enable given features initially
        featureNames.forEach(f => {
            featureMap[f] = true;
        });

        // Enable/disable features based on query string
        const urlParams = new URLSearchParams(queryString);
        urlParams.forEach((value, key) => {
            // Do nothing if feature has already been disabled by query
            if (featureMap[key] !== false) {
                // Disable feature if value is exactly 'false', anything else enables the feature
                featureMap[key] = value !== 'false';
            }
        });

        // Gather results in _features set
        if (this._features.size > 0) {
            this._features = new Set();
        }
        for (const [feature, enabled] of Object.entries(featureMap)) {
            if (enabled) {
                this._features.add(feature);
            }
        }
    }

    isFeatureEnabled(featureName) {
        return this._features.has(featureName);
    }

    isReviewModeEnabled() {
        return this.isFeatureEnabled('review');
    }

    isViewerEnabled() {
        const urlParams = new URLSearchParams(window.location.search);
        return (urlParams.get('disable-viewer') ?? 'false') === 'false';
    }

    _loadInspectorHTML() {
        /* Insert HTML and CSS styles into body */
        $(require('../html/inspector.html')).prependTo('body');
        const inspector_css = require('../less/inspector.less').toString(); 
        $('<style id="ixv-style"></style>')
            .prop("type", "text/css")
            .text(inspector_css)
            .appendTo('head');
        $('<link id="ixv-favicon" type="image/x-icon" rel="shortcut icon" />')
            .attr('href', require('../img/favicon.ico'))
            .appendTo('head');

        try {
            $('.inspector-foot .version').text(__VERSION__);
        }
        catch (e) {
            // ReferenceError if __VERSION__ not defined
        }
    }

    _reparentDocument() {
        const iframeContainer = $('#ixv #iframe-container');

        const iframe = $('<iframe title="iXBRL document view"/>')
            .data("report-index", 0)
            .appendTo(iframeContainer)[0];

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write("<!DOCTYPE html><html><head><title></title></head><body></body></html>");
        doc.close();

        let docTitle = $('title').text();
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

    _getTaxonomyData() {
        for (let i = document.body.children.length - 1; i >= 0; i--) {
            const elt = document.body.children[i];
            if (elt.tagName.toUpperCase() == 'SCRIPT' && elt.getAttribute("type") == 'application/x.ixbrl-viewer+json') {
                return elt.innerHTML;
            }
        }
        return null;
    }

    _checkDocumentSetBrowserSupport() {
        if (document.location.protocol == 'file:') {
            alert("Displaying iXBRL document sets from local files is not supported.  Please view the viewer files using a web server.");
        }
    }

    load() {
        const iv = this;
        const inspector = this.inspector;

        setTimeout(function () {
            const stubViewer = $('body').hasClass('ixv-stub-viewer');

            // If viewer is disabled, but not in stub viewer mode, just abort
            // loading to leave the iXBRL file as-is
            if (!iv.isViewerEnabled() && !stubViewer) {
                return;
            }

            // Loading mask starts here
            iv._loadInspectorHTML();
            let iframes = $();

            // We need to parse JSON first so that we can determine feature enablement before loading begins.
            const taxonomyData = iv._getTaxonomyData();
            const parsedTaxonomyData = taxonomyData && JSON.parse(taxonomyData);
            iv.setFeatures((parsedTaxonomyData && parsedTaxonomyData["features"]) || [], window.location.search);

            const reportSet = new ReportSet(parsedTaxonomyData);

            // Viewer disabled in stub viewer mode => redirect to first iXBRL document
            if (!iv.isViewerEnabled()) {
                window.location.replace(reportSet.reportFiles()[0].file); 
                return;
            }

            if (parsedTaxonomyData === null) {
                $('#ixv .loader .text').text("Error: Could not find viewer data");
                $('#ixv .loader').removeClass("loading");
                return;
            }

            if (!stubViewer) {
                iframes = $(iv._reparentDocument());
            } 
            const ds = reportSet.reportFiles();
            let hasExternalIframe = false;
            for (let i = stubViewer ? 0 : 1; i < ds.length; i++) {
                const iframe = $("<iframe />").attr("src", ds[i].file).data("report-index", ds[i].index).appendTo("#ixv #iframe-container");
                iframes = iframes.add(iframe);
                hasExternalIframe = true;
            }
            if (hasExternalIframe) {
                iv._checkDocumentSetBrowserSupport();
            }

            const progress = stubViewer ? 'Loading iXBRL Report' : 'Loading iXBRL Viewer';
            iv.setProgress(progress).then(() => {
                /* Poll for iframe load completing - there doesn't seem to be a reliable event that we can use */
                let timer = setInterval(function () {
                    let complete = true;
                    iframes.each(function (n) {
                        const iframe = this;
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if ((iframeDoc.readyState != 'complete' && iframeDoc.readyState != 'interactive') || $(iframe).contents().find("body").children().length == 0) {
                            complete = false;
                        }
                    });
                    if (complete) {
                        clearInterval(timer);

                        const viewer = iv.viewer = new Viewer(iv, iframes, reportSet);

                        viewer.initialize()
                            .then(() => inspector.initialize(reportSet, viewer))
                            .then(() => {
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
                                .on('resizestart', () => 
                                    $('#ixv').css("pointer-events", "none")
                                )
                                .on('resizemove', (event) => {
                                    const target = event.target;
                                    const w = 100 * event.rect.width / $(target).parent().width();
                                    target.style.width = w + '%';
                                    $('#inspector').css('width', (100 - w) + '%');
                                })
                                .on('resizeend', (event) =>
                                    $('#ixv').css("pointer-events", "auto")
                                );
                                $('#ixv .loader').remove();

                                /* Focus on fact specified in URL fragment, if any */
                                inspector.handleFactDeepLink();
                                if (iv.options.showValidationWarningOnStart) {
                                    inspector.showValidationWarning();
                                }
                                viewer.postLoadAsync();
                                inspector.postLoadAsync();
                            })
                            .catch(err => {
                                if (err instanceof DocumentTooLargeError) {
                                    $('#ixv .loader').remove();
                                    $('#inspector').addClass('failed-to-load');
                                }
                                else {
                                    throw err;
                                }

                            });
                    }
                }, 250);
            });
        }, 0);
    }

    /* Update the progress message during initial load.  Returns a Promise which
     * resolves once the message is actually displayed */
    setProgress(msg) {
        return new Promise((resolve, reject) => {
            /* We need to do a double requestAnimationFrame, as we need to get the
             * message up before the ensuing thread-blocking work
             * https://bugs.chromium.org/p/chromium/issues/detail?id=675795 
             */
            window.requestAnimationFrame(function () {
                console.log(`%c [Progress] ${msg} `, 'background: #77d1c8; color: black;');
                $('#ixv .loader .text').text(msg);
                window.requestAnimationFrame(() => resolve());
            });
        });
    }
}
