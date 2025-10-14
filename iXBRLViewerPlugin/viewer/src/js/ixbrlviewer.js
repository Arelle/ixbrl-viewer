// See COPYRIGHT.md for copyright information

import interact from 'interactjs'
import $ from 'jquery'
import { ReportSet } from "./reportset.js";
import { Viewer, DocumentTooLargeError } from "./viewer.js";
import { Inspector } from "./inspector.js";
import { initializeTheme } from './theme.js';
import { TaxonomyNamer } from './taxonomynamer.js';
import { FEATURE_GUIDE_LINK, FEATURE_REVIEW, FEATURE_SUPPORT_LINK, FEATURE_SURVEY_LINK, USER_GUIDE_URL, moveNonAppAttributes } from "./util";

const featureFalsyValues = new Set([undefined, null, '', 'false', false]);

export class iXBRLViewer {

    constructor(options) {
        this._staticFeatures = {};
        this._dynamicFeatures = {};
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

    setFeatures(features, queryString) {
        this._staticFeatures = {}
        for (const [key, value] of Object.entries(features)) {
            this._staticFeatures[key] = value;
        }

        const urlParams = new URLSearchParams(queryString);
        this._dynamicFeatures = {}
        urlParams.forEach((value, key) => {
            if (value === '') {
                if (this._dynamicFeatures[key] === undefined) {
                    value = 'true'
                } else {
                    return;
                }
            }
            this._dynamicFeatures[key] = value;
        });
    }

    getStaticFeatureValue(featureName) {
        return this._staticFeatures[featureName];
    }

    getFeatureValue(featureName) {
        if (this._dynamicFeatures[featureName]) {
            return this._dynamicFeatures[featureName];
        }
        return this.getStaticFeatureValue(featureName);
    }

    isFeatureEnabled(featureName) {
        return !featureFalsyValues.has(this.getFeatureValue(featureName));
    }

    isStaticFeatureEnabled(featureName) {
        return !featureFalsyValues.has(this.getStaticFeatureValue(featureName));
    }

    isReviewModeEnabled() {
        return this.isFeatureEnabled(FEATURE_REVIEW);
    }

    getGuideLinkUrl() {
        if (!this.isStaticFeatureEnabled(FEATURE_GUIDE_LINK)) {
            return USER_GUIDE_URL;
        }
        return this.resolveRelativeUrl(this.getStaticFeatureValue(FEATURE_GUIDE_LINK));
    }

    getSupportLinkUrl() {
        if (!this.isStaticFeatureEnabled(FEATURE_SUPPORT_LINK)) {
            return null;
        }
        return this.resolveRelativeUrl(this.getStaticFeatureValue(FEATURE_SUPPORT_LINK));
    }

    getSurveyLinkUrl() {
        if (!this.isStaticFeatureEnabled(FEATURE_SURVEY_LINK)) {
            return null;
        }
        return this.resolveRelativeUrl(this.getStaticFeatureValue(FEATURE_SURVEY_LINK));
    }

    isViewerEnabled() {
        const urlParams = new URLSearchParams(window.location.search);
        return (urlParams.get('disable-viewer') ?? 'false') === 'false';
    }

    // Resolves URL relative to the config file
    resolveRelativeUrl(url) {
        if (this.options.configUrl === undefined) {
            return url;
        }
        const resolvedUrl = new URL(url, this.options.configUrl.href);
        return resolvedUrl.href;
    }

    _loadInspectorHTML() {
        /* Insert HTML and CSS styles into body */
        const footerLogoHtml = this.runtimeConfig.skin?.footerLogoHtml ?? require("../html/footer-logo.html");
        $(require('../html/inspector.html'))
            .prependTo('body')
            .find("#footer-logo").html(footerLogoHtml);
        const inspector_css = require('../less/inspector.less').toString(); 
        $('<style id="ixv-style"></style>')
            .prop("type", "text/css")
            .text(inspector_css)
            .appendTo('head');
        if (this.runtimeConfig.skin?.stylesheetUrl !== undefined) {
            $('<link rel="stylesheet" id="ixv-style-skin" />')
                .attr("href", this.resolveRelativeUrl(this.runtimeConfig.skin.stylesheetUrl))
                .appendTo('head');
        }
        const favIconUrl = this.runtimeConfig.skin?.faviconUrl !== undefined ? this.resolveRelativeUrl(this.runtimeConfig.skin.faviconUrl) : require("../img/favicon.ico");
        $('<link id="ixv-favicon" type="image/x-icon" rel="shortcut icon" />')
            .attr('href', favIconUrl)
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

        const iframe = $('<iframe title="iXBRL document view" tabindex="0"/>')
            .data("report-index", 0)
            .appendTo(iframeContainer)[0];

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write("<!DOCTYPE html><html><head><title></title></head><body></body></html>");
        doc.close();

        let docTitle = $('title').text();
        if (docTitle !== "") {
            docTitle = `Inline Viewer - ${docTitle}`;
        }
        else {
            docTitle = "Inline Viewer";
        }


        $('head')
            .children().not("script, style#ixv-style, link#ixv-style-skin, link#ixv-favicon").appendTo($(iframe).contents().find('head'));

        $('<title>').text(docTitle).appendTo($('head'));

        /* Due to self-closing tags, our script tags may not be a direct child of
         * the body tag in an HTML DOM, so move them so that they are */
        $('body script').appendTo($('body'));

        const html = $('html');
        const body = $('body');
        const iframeHtml = $(iframe).contents().find('html');
        const iframeBody = $(iframe).contents().find('body');
        moveNonAppAttributes(html.get(0), iframeHtml.get(0));
        moveNonAppAttributes(body.get(0), iframeBody.get(0));
        html.attr('xmlns', 'http://www.w3.org/1999/xhtml');

        body.children().not("script").not('#ixv').not(iframeContainer).appendTo(iframeBody);

        /* Avoid any inline styles on the old body interfering with the inspector */
        body.removeAttr('style');
        return iframe;
    }

    _getTaxonomyData() {
        for (let i = document.body.children.length - 1; i >= 0; i--) {
            const elt = document.body.children[i];
            if (elt.tagName.toUpperCase() === 'SCRIPT' && elt.getAttribute("type") === 'application/x.ixbrl-viewer+json') {
                return elt.innerHTML;
            }
        }
        return null;
    }

    _checkDocumentSetBrowserSupport() {
        if (document.location.protocol === 'file:') {
            alert("Displaying iXBRL document sets from local files is not supported.  Please view the viewer files using a web server.");
        }
    }

    _loadRuntimeConfig() {
        return new Promise((resolve, reject) => {
            if (this.options.configUrl === undefined) {
                resolve({});
            }
            else {
                fetch(this.options.configUrl)
                    .then((resp) => {
                        switch (resp.status) {
                            case 200:
                                return resp.json();
                            case 404:
                                return Promise.resolve({});
                            default:
                                return Promise.reject(`Fetch of ${this.options.configUrl} failed: ${resp.status}`);
                        };
                    })
                    .then((data) => {
                        resolve(data);
                    })
                    .catch((err) => {
                        console.log(err);
                        resolve({});
                    });
            }
        });
    }

    load() {
        const iv = this;
        const inspector = this.inspector;
    
        this._loadRuntimeConfig().then((runtimeConfig) => {
            this.runtimeConfig = runtimeConfig;
            initializeTheme();

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
            let features = parsedTaxonomyData?.features;
            if (!features) {
                features = {};
            }
            // `features` was previously an array of flag values
            // Support this for backwards compatability
            else if (Array.isArray(features)) {
                features = features.reduce((obj, val) => {
                    obj[val] = true;
                    return obj;
                }, {});
            }
            if (this.runtimeConfig.features !== undefined) {
                features = {...this.runtimeConfig.features, features};
            }
            iv.setFeatures(features, window.location.search);

            const reportSet = new ReportSet(parsedTaxonomyData);
            reportSet.taxonomyNamer = new TaxonomyNamer(new Map(Object.entries(this.runtimeConfig.taxonomyNames ?? {})));

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
                const iframe = $('<iframe tabindex="0" />').attr("src", ds[i].file).data("report-index", ds[i].index).appendTo("#ixv #iframe-container");
                iframes = iframes.add(iframe);
                hasExternalIframe = true;
            }
            if (hasExternalIframe) {
                iv._checkDocumentSetBrowserSupport();
            }

            const progress = stubViewer ? 'Loading iXBRL Report' : 'Loading iXBRL Viewer';
            iv.setProgress(progress).then(() => {
                /* Poll for iframe load completing - there doesn't seem to be a reliable event that we can use */
                const timer = setInterval(() => {
                    let complete = true;
                    iframes.each((n, iframe) => {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if ((iframeDoc.readyState !== 'complete' && iframeDoc.readyState !== 'interactive') || $(iframe).contents().find("body").children().length === 0) {
                            complete = false;
                        }
                    });
                    if (complete) {
                        clearInterval(timer);

                        iframes.each((n, iframe) => {
                            const htmlNode = $(iframe).contents().find('html');
                            // A schema valid report should not have a lang attribute on the html element.
                            // However, if the report is not schema valid, we shouldn't override it.
                            if (htmlNode.attr('lang') === undefined) {
                                // If the report has an XML lang attribute, use it as the HTML lang for screen readers.
                                // If the language of the report can't be detected, set it to an empty string to avoid
                                // inheriting the lang of the application HTML node (which is set to the UI language).
                                const docLang = htmlNode.attr('xml:lang') || '';
                                htmlNode.attr('lang', docLang);
                            }
                        });

                        const viewer = new Viewer(iv, iframes, reportSet);
                        iv.viewer = viewer

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
                                    target.style.width = `${w}%`;
                                    $('#inspector').css('width', `${100 - w}%`);
                                })
                                .on('resizeend', (event) =>
                                    $('#ixv').css("pointer-events", "auto")
                                );
                                $('#ixv .loader').remove();

                                /* Focus on fact specified in URL fragment, if any */
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
            window.requestAnimationFrame(() => {
                console.log(`%c [Progress] ${msg} `, 'background: #77d1c8; color: black;');
                $('#ixv .loader .text').text(msg);
                window.requestAnimationFrame(() => resolve());
            });
        });
    }
}
