import { isodateToHuman } from "./util.js"

export function Fact(report, factId) {
    this.f = report.data.facts[factId];
    this.report = report;
}

Fact.prototype.getLabel = function(rolePrefix) {
    return this.report.getLabel(this.f.c, rolePrefix);
}

Fact.prototype.conceptName = function() {
    return this.f.c;
}

Fact.prototype.periodString = function() {
    var s;
    if (!this.f.pt) {
        /* forever */
        s = "None";
    }
    else if (!this.f.pf) {
        /* instant */
        s = isodateToHuman(this.f.pt, true);
    }
    else {
        s = isodateToHuman(this.f.pf, false) + " to " + isodateToHuman(this.f.pt, true);
    }
    return s;
}


