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
}
