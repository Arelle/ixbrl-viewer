export function Concept(report, name) {
    this._c = report.data.concepts[name]
}

Concept.prototype.references = function() { 
    return this._c.r;
}
