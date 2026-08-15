// See COPYRIGHT.md for copyright information

import { Viewer } from '../viewer.js';

// A Viewer that binds facts to the document via a pluggable document surface
// (HTML now, PDF later) instead of scanning the document for inline-XBRL tags.
//
// It reuses the entire Viewer machinery for selection, highlighting, navigation
// and styling - only the fact-discovery step (_processDocuments) is replaced.
export class XbrlModelViewer extends Viewer {

    constructor(iv, iframes, reportSet, surface) {
        super(iv, iframes, reportSet);
        this._surface = surface;
    }

    // Override the iXBRL DOM-scanning discovery with document-surface binding.
    // The continuation maps used by the iXBRL path don't apply here, but are
    // initialised empty so shared code (e.g. changeItemClass) works unchanged.
    _processDocuments() {
        this.continuationOfMap = {};
        this.itemContinuationMap = {};
        return this._iv.setProgress("Binding XbrlModel facts")
            .then(() => this._surface.bind(this));
    }

    // The base Viewer.initialize() runs iXBRL-specific post-processing after
    // _processDocuments -- per-iframe _preProcessiXBRL, _setContinuationMaps, the
    // preProcessiXBRL plugin promise, and (in review mode) _wrapUntaggedNumbers.
    // None of that applies to a document whose facts are bound by the surface, and
    // scanning a large plain-HTML/PDF body for untagged numbers is pathologically
    // slow (it appears to hang at "Binding XbrlModel facts"). Bind, then run only
    // the format-agnostic tail (styles, handlers, document-set tabs).
    initialize() {
        return new Promise((resolve, reject) => {
            this._processDocuments()
                .then(() => this._iv.setProgress("Preparing document"))
                .then(() => {
                    this._reportSet.setIXNodeMap(this._ixNodeMap);
                    this._applyStyles();
                    this._bindHandlers();
                    this.scale = 1;
                    this._addDocumentSetTabs();
                    resolve();
                })
                .catch(err => reject(err));
        });
    }
}
