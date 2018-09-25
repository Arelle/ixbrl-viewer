import { Fact } from "./fact.js"

export function iXBRLReport (jsonElement) {
    this.data = JSON.parse(jsonElement.innerHTML);
    this.facts = {};
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
    if (!this.facts[id]) {
        this.facts[id] = new Fact(this, id);
    }
    return this.facts[id];
}
