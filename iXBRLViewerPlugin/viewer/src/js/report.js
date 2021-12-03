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

import { Fact } from "./fact.js"
import { Footnote } from "./footnote.js"
import { QName } from "./qname.js"
import { Concept } from "./concept.js";
import { ViewerOptions } from "./viewerOptions.js";
import { setDefault } from "./util.js";
import $ from 'jquery'

export function iXBRLReport (data) {
    this.data = data;
    // A map of IDs to Fact and Footnote objects
    this._items = {};
    this._ixNodeMap = {};
    this._viewerOptions = new ViewerOptions();
    this._reverseRelationshipCache = {};
}

/*
 * Set additional information about facts obtained from parsing the iXBRL.
 */
iXBRLReport.prototype.setIXNodeMap = function(ixData) {
    this._ixNodeMap = ixData;
    this._initialize();
}

iXBRLReport.prototype._initialize = function () {

    // Build an array of footnotes IDs in document order so that we can assign
    // numbers to foonotes
    var fnorder = Object.keys(this._ixNodeMap).filter((id) => this._ixNodeMap[id].footnote);
    fnorder.sort((a,b) => this._ixNodeMap[a].docOrderindex - this._ixNodeMap[b].docOrderindex);

    // Create footnote objects for all footnotes, and associate facts with
    // those footnotes to allow 2 way fact <-> footnote navigation.
    for (var id in this.data.facts) {
        var f = new Fact(this, id);
        this._items[id] = f;
        var fns = this.data.facts[id].fn || [];
        fns.forEach((fnid) => {
            var fn = this._items[fnid];
            if (fn === undefined) {
                fn = new Footnote(this, fnid, "Footnote " + (fnorder.indexOf(fnid) + 1));
                this._items[fnid] = fn;
            }
            // Associate fact with footnote
            fn.addFact(f);
        });
    }
}

iXBRLReport.prototype.getLabel = function(c, rolePrefix, showPrefix) {
    rolePrefix = rolePrefix || 'std';
    var lang = this._viewerOptions.language;
    const concept = this.data.concepts[c];
    if (concept === undefined) {
        console.log("Attempt to get label for undefined concept: " + c);
        return "<no label>";
    }
    const labels = concept.labels[rolePrefix]
    if (labels === undefined || Object.keys(labels).length == 0) {
        return undefined;
    }
    else {
        var label;
        if (lang && labels[lang]) {
            label = labels[lang];
        }
        else {
            // Fall back on English, then any label deterministically.
            label = labels["en"] || labels["en-us"] || labels[Object.keys(labels).sort()[0]];
        }
        if (label === undefined) {
            return undefined;
        }
        var s = '';
        if (showPrefix && this._viewerOptions.showPrefixes) {
            s = "(" + this.qname(c).prefix + ") ";
        }
        s += label;
        return s;
    }
}

iXBRLReport.prototype.getLabelOrName = function(c, rolePrefix, showPrefix) {
    const label = this.getLabel(c, rolePrefix, showPrefix);
    if (label === undefined) {
        return c;
    }
    return label;
}

iXBRLReport.prototype.availableLanguages = function() {
    if (!this._availableLanguages) {
        var map = {};
        $.each(this.data.concepts, function (k,v) {
            $.each(v.labels, function (rolePrefx, ll) {
                $.each(ll, function (lang, v) {
                    map[lang] = 1;
                });
            });
        });
        this._availableLanguages = Object.keys(map);

    }
    return this._availableLanguages;
}

iXBRLReport.prototype.languageNames = function() {
    return this.data.languages;
}

iXBRLReport.prototype.getItemById = function(id) {
    return this._items[id];
}


iXBRLReport.prototype.getIXNodeForItemId = function(id) {
    return this._ixNodeMap[id] || {};
}

iXBRLReport.prototype.facts = function() {
    var allItems = [];
    $.each(this.data.facts, (id, f) => allItems.push(this.getItemById(id)));
    return allItems;
}

iXBRLReport.prototype.prefixMap = function() {
    return this.data.prefixes;
}

iXBRLReport.prototype.qname = function(v) {
    return new QName(this.prefixMap(), v);
}

iXBRLReport.prototype.getChildRelationships = function(conceptName, arcrole) {
    var rels = {}
    const elrs = this.data.rels[arcrole] || {};
    for (const elr in elrs) {
        if (conceptName in elrs[elr]) {
            rels[elr] = elrs[elr][conceptName];
        }
    }
    return rels;
}

/* 
 * Build and cache an inverse map of relationships for a given arcrole for
 * efficient lookup of parents concept from a child.
 *
 * Map is arcrole => elr => target => [ rel, ... ]
 *
 * "rel" is modified to have a "src" property with the source concept.
 */
iXBRLReport.prototype._reverseRelationships = function(arcrole) {
    if (!(arcrole in this._reverseRelationshipCache)) {
        const rrc = {};
        const elrs = this.data.rels[arcrole] || {};
        for (const [elr, relSet] of Object.entries(elrs)) {
            for (const [src, rels] of Object.entries(relSet)) {
                for (const r of rels) {
                    r.src = src;
                    setDefault(setDefault(rrc, elr, {}), r.t, []).push(r);
                }
            }
        }
        this._reverseRelationshipCache[arcrole] = rrc;
    }
    return this._reverseRelationshipCache[arcrole];
}

iXBRLReport.prototype.getParentRelationships = function(conceptName, arcrole) {
    var rels = {}
    for (const [elr, relSet] of Object.entries(this._reverseRelationships(arcrole))) {
        if (conceptName in relSet) {
            rels[elr] = relSet[conceptName];
        }
    }
    return rels;
}

iXBRLReport.prototype.getParentRelationshipsInGroup = function(conceptName, arcrole, elr) {
    var rels = {}
    const relSet = this._reverseRelationships(arcrole)[elr] || {};
    return relSet[conceptName] || [];
}

iXBRLReport.prototype.dimensionDefault = function(dimensionName) {
    // ELR is irrelevant for dimension-default relationships, so check all of
    // them, and return the first (illegal for there to be more than one
    for (const rel of Object.values(this.data.rels["d-d"] || {})) {
        if (dimensionName in rel) {
            return rel[dimensionName][0].t;
        }
    }
    return undefined;
}

iXBRLReport.prototype.relationshipGroups = function(arcrole) {
    return Object.keys(this.data.rels[arcrole] || {});
}

iXBRLReport.prototype.relationshipGroupRoots = function(arcrole, elr) {
    var roots = [];
    for (const conceptName in this.data.rels[arcrole][elr]) {
        if (!(elr in this.getParentRelationships(conceptName, arcrole))) {
            roots.push(conceptName);
        }
    }
    return roots;
}

iXBRLReport.prototype.getAlignedFacts = function(f, coveredAspects) {
    var all = this.facts();
    var aligned = [];
    if (!coveredAspects) {
        coveredAspects = {};
    }
    $.each(all, function (i, ff) {
        if (ff.isAligned(f, coveredAspects)) {
            aligned.push(ff);
        }
    });
    return aligned; 
}

iXBRLReport.prototype.deduplicate = function (facts) {
    var ff = [];
    $.each(facts, function (i, f) {
        var dupe = false;
        $.each(ff, function (j, of) {
            if (of.isAligned(f,{})) {
                dupe = true;
            }
        });
        if (!dupe){
            ff.push(f);
        }
    });
    return ff;
}

iXBRLReport.prototype.setViewerOptions = function (vo) {
    this._viewerOptions = vo;
}

iXBRLReport.prototype.namespaceGroups = function () {
    var counts = {};
    $.each(this.facts(), function (i, f) {
        counts[f.conceptQName().prefix] = counts[f.conceptQName().prefix] || 0;
        counts[f.conceptQName().prefix]++;
    });
    var prefixes = Object.keys(counts);
    prefixes.sort(function (a, b) { return counts[b] - counts[a] });
    return prefixes;
}

iXBRLReport.prototype.getConcept = function(name) {
    return new Concept(this, name);
}

iXBRLReport.prototype.getRoleLabel = function(rolePrefix, viewerOptions) {
    /* This is currently hard-coded to "en" as the generator does not yet
     * support generic labels, and instead provides the (non-localisable) role
     * definition as a single "en" label.
     */
    return this.data.roleDefs[rolePrefix]["en"];
}

iXBRLReport.prototype.documentSetFiles = function() {
    return this.data.docSetFiles;
}

iXBRLReport.prototype.isDocumentSet = function() {
    return this.data.docSetFiles !== undefined;
}

iXBRLReport.prototype.usesAnchoring = function() {
    return this.data.rels["w-n"] !== undefined;
}

iXBRLReport.prototype.hasValidationErrors = function() {
    return this.data.validation !== undefined && this.data.validation.length > 0;
}
