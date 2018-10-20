import { Fact } from "./fact.js"
import { QName } from "./qname.js"
import $ from 'jquery'

export function iXBRLReport (jsonElement) {
    this.data = JSON.parse(jsonElement.innerHTML);
    this._facts = {};
}

iXBRLReport.prototype.getLabel = function(c, rolePrefix) {
    rolePrefix = rolePrefix || 'std';
    var labels = this.data.concepts[c].labels[rolePrefix]
    if (labels === undefined) {
        return undefined;
    }
    else {
        if (this._language && labels[this._language]) {
            return labels[this._language];
        }
        else {
            return labels["en"] || labels["en-us"];
        }
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

iXBRLReport.prototype.getFactById = function(id) {
    if (!this._facts[id]) {
        this._facts[id] = new Fact(this, id);
    }
    return this._facts[id];
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

iXBRLReport.prototype.setLanguage = function (lang) {
    this._language = lang;
}

