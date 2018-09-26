import { isodateToHuman } from "./util.js"
import { QName } from "./qname.js"

export function Fact(report, factId) {
    this.f = report.data.facts[factId];
    this._report = report;
    this.id = factId;
}

Fact.prototype.getLabel = function(rolePrefix) {
    return this._report.getLabel(this.f.c, rolePrefix);
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


Fact.prototype.periodTo = function() {
    return this.f.pt;
}

Fact.prototype.periodFrom = function() {
    return this.f.pf;
}

Fact.prototype.dimensions = function() {
    return this.f.d;
}

Fact.prototype.value = function() {
    return this.f.v;
}

Fact.prototype.unit = function() {
    if (this.f.u) {
        return new QName(this._report.prefixMap(), this.f.u);
    }
    else {
        return undefined;
    }
}

Fact.prototype.isMonetaryValue = function () {
    var unit = this.unit();
    return unit && unit.namespace == "http://www.xbrl.org/2003/iso4217";
}
