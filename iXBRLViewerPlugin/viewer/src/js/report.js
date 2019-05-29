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
import { QName } from "./qname.js"
import { Concept } from "./concept.js";
import { ViewerOptions } from "./viewerOptions.js";
import $ from 'jquery'

export function iXBRLReport (data) {
    this.data = data;
    this._viewerFactData = {};
    this._facts = {};
    this._ixData = {};
    this._viewerOptions = new ViewerOptions();
}

iXBRLReport.prototype.getLabel = function(c, rolePrefix, showPrefix, viewerOptions) {
    rolePrefix = rolePrefix || 'std';
    var lang = this._viewerOptions.language;
    var labels = this.data.concepts[c].labels[rolePrefix]
    if (labels === undefined) {
        return undefined;
    }
    else {
        var label;
        if (lang && labels[lang]) {
            label = labels[lang];
        }
        else {
            label = labels["en"] || labels["en-us"];
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

iXBRLReport.prototype.getFactById = function(id) {
    if (!this._facts.hasOwnProperty(id)) {
        if (this.data.facts.hasOwnProperty(id)) {
            this._facts[id] = new Fact(this, id);
        }
        else {
            this._facts[id] = null;
        }
    }
    return this._facts[id];
}

/*
 * Set additional information about facts obtained from parsing the iXBRL.
 */
iXBRLReport.prototype.setIXData = function(ixData) {
    this._ixData = ixData;
}

iXBRLReport.prototype.getIXDataForFact = function(factId) {
    return this._ixData[factId] || {};
}

iXBRLReport.prototype.facts = function() {
    var allFacts = [];
    var report = this;
    $.each(this.data.facts, function (id, f) {
        allFacts.push(report.getFactById(id));
    });
    return allFacts;
}

iXBRLReport.prototype.prefixMap = function() {
    return this.data.prefixes;
}

iXBRLReport.prototype.qname = function(v) {
    return new QName(this.prefixMap(), v);
}

iXBRLReport.prototype.getChildConcepts = function(c,arcrole) {
    var rels = {}
    if (this.data.rels.hasOwnProperty(arcrole)) {
        $.each(this.data.rels[arcrole], function (elr, rr) {
            if (rr.hasOwnProperty(c)) {
                rels[elr] = rr[c]
            }
        })
    }
    return rels;
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
