import { Fact } from "./fact.js"
import $ from 'jquery'

export function iXBRLReport (jsonElement) {
    this.data = JSON.parse(jsonElement.innerHTML);
    this._facts = {};
}

iXBRLReport.prototype.getLabel = function(c, rolePrefix) {
    var labels = this.data.concepts[c].labels[rolePrefix]
    if (labels === undefined) {
        return undefined;
    }
    else {
        return labels["en"] || labels["en-us"]
    }
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

iXBRLReport.prototype.getChildConcepts = function(c,arcrole) {
    
    var rels = {}
    if (this.data.rels.hasOwnProperty(arcrole)) {
        $.each(this.data.rels[arcrole], function (elr, rr) {
            console.log(rr);
            if (rr.hasOwnProperty(c)) {
                rels[elr] = rr[c]
            }
        })
    }
    return rels;

}
