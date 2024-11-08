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

export class iXBRLReport {
    constructor(data) {
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
    setIXNodeMap (ixData) {
        this._ixNodeMap = ixData;
        this._initialize();
    }

    _initialize () {

        // Build an array of footnotes IDs in document order so that we can assign
        // numbers to foonotes
        var fnorder = Object.keys(this._ixNodeMap).filter((id) => this._ixNodeMap[id].footnote);
        fnorder.sort((a,b) => this._ixNodeMap[a].docOrderindex - this._ixNodeMap[b].docOrderindex);

        // Create Fact objects for all facts.  
        for (const id in this.data.facts) {
            this._items[id] = new Fact(this, id);
        }

        // Now resolve footnote references, creating footnote objects for "normal"
        // footnotes, and finding Fact objects for fact->fact footnotes.  
        //
        // Associate source facts with target footnote/facts to allow two way
        // navigation.
        for (const id in this.data.facts) {
            const f = this._items[id];
            const fns = this.data.facts[id].fn || [];
            fns.forEach((fnid) => {
                var fn = this._items[fnid];
                if (fn === undefined) {
                    fn = new Footnote(this, fnid, "Footnote " + (fnorder.indexOf(fnid) + 1));
                    this._items[fnid] = fn;
                }
                // Associate fact with footnote
                fn.addLinkedFact(f);
            });
        }
    }

    getLabel (c, rolePrefix, showPrefix) {
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
            if (Object.keys(labels).length == 1) { 
                label = labels[Object.keys(labels)];
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

    getLabelOrName (c, rolePrefix, showPrefix) {
        const label = this.getLabel(c, rolePrefix, showPrefix);
        if (label === undefined) {
            return c;
        }
        return label;
    }

    availableLanguages () {
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

    languageNames () {
        return this.data.languages;
    }

    getItemById (id) {
        return this._items[id];
    }


    getIXNodeForItemId (id) {
        return this._ixNodeMap[id] || {};
    }

    facts () {
        var allItems = [];
        $.each(this.data.facts, (id, f) => allItems.push(this.getItemById(id)));
        return allItems;
    }

    prefixMap () {
        return this.data.prefixes;
    }

    roleMap () {
        return this.data.roles;
    }

    qname (v) {
        return new QName(this.prefixMap(), v);
    }

    getChildRelationships (conceptName, arcrole) {
        var rels = {}
        const elrs = this.data.rels[arcrole] || {};
        for (const elr in elrs) {
            if (conceptName in elrs[elr]) {
                rels[elr] = elrs[elr][conceptName];
            }
        }
        return rels;
    }

    getAnchors (concept) {
        var res = [];
        var report = this;
        if (this.usesAnchoring()) {
            $.each(this.data.rels["w-n"], function (elr, rr) {
                $.each(rr, function(c, r) {
                    if (concept.name == c) {
                        $.each(r, function(i, v) { 
                            res.push({concept: report.getConcept(v.t), wide: 0});
                        });
                    } else 
                        $.each(r, function(i, v) {
                            if (v.t == concept.name)
                                res.push({concept: report.getConcept(c), wide: 1});
                        });
                });
            });
        }
        return res;
    }

    /* 
    * Build and cache an inverse map of relationships for a given arcrole for
    * efficient lookup of parents concept from a child.
    *
    * Map is arcrole => elr => target => [ rel, ... ]
    *
    * "rel" is modified to have a "src" property with the source concept.
    */
    _reverseRelationships (arcrole) {
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

    getParentRelationships (conceptName, arcrole) {
        var rels = {}
        for (const [elr, relSet] of Object.entries(this._reverseRelationships(arcrole))) {
            if (conceptName in relSet) {
                rels[elr] = relSet[conceptName];
            }
        }
        return rels;
    }

    getParentRelationshipsInGroup (conceptName, arcrole, elr) {
        var rels = {}
        const relSet = this._reverseRelationships(arcrole)[elr] || {};
        return relSet[conceptName] || [];
    }

    dimensionDefault (dimensionName) {
        // ELR is irrelevant for dimension-default relationships, so check all of
        // them, and return the first (illegal for there to be more than one
        for (const rel of Object.values(this.data.rels["d-d"] || {})) {
            if (dimensionName in rel) {
                return rel[dimensionName][0].t;
            }
        }
        return undefined;
    }

    relationshipGroups (arcrole) {
        return Object.keys(this.data.rels[arcrole] || {});
    }

    relationshipGroupRoots (arcrole, elr) {
        var roots = [];
        for (const conceptName in this.data.rels[arcrole][elr]) {
            if (!(elr in this.getParentRelationships(conceptName, arcrole))) {
                roots.push(conceptName);
            }
        }
        return roots;
    }

    getAlignedFacts (f, coveredAspects) {
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

    deduplicate (facts) {
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

    setViewerOptions (vo) {
        this._viewerOptions = vo;
    }

    namespaceGroups () {
        var counts = {};
        $.each(this.facts(), function (i, f) {
            counts[f.conceptQName().prefix] = counts[f.conceptQName().prefix] || 0;
            counts[f.conceptQName().prefix]++;
        });
        var prefixes = Object.keys(counts);
        prefixes.sort(function (a, b) { return counts[b] - counts[a] });
        return prefixes;
    }

    getConcept (name) {
        return new Concept(this, name);
    }

    getRoleLabel (rolePrefix, viewerOptions) {
        /* This is currently hard-coded to "en" as the generator does not yet
        * support generic labels, and instead provides the (non-localisable) role
        * definition as a single "en" label.
        *
        * Returns the ELR URI if there is no label
        */
        const labels = this.data.roleDefs[rolePrefix];
        if (labels !== undefined) {
            const label = labels["en"];
            // Earlier versions of the generator added a "null" label if no labels
            // were available.
            if (label !== undefined && label !== null) {
                return label;
            }
        }
        return this.roleMap()[rolePrefix];
    }

    documentSetFiles () {
        if (this.data.docSetFiles === undefined) {
            return []
        }
        return this.data.docSetFiles;
    }

    isDocumentSet () {
        return this.documentSetFiles().length > 1;
    }

    usesAnchoring () {
        return this.data.rels["w-n"] !== undefined;
    }

    hasValidationErrors () {
        return this.data.validation !== undefined && this.data.validation.length > 0;
    }
}
