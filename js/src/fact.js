import { isodateToHuman } from "./util.js"
import { QName } from "./qname.js"
import { Aspect } from "./aspect.js";
import { Period } from './period.js';
import { formatNumber } from "./util.js";
import $ from 'jquery'

export function Fact(report, factId) {
    this.f = report.data.facts[factId];
    this._report = report;
    this.id = factId;
}

Fact.prototype.report = function() {
    return this._report;
}

Fact.prototype.getLabel = function(rolePrefix) {
    return this._report.getLabel(this.f.a.c, rolePrefix);
}

Fact.prototype.conceptName = function() {
    return this.f.a.c;
}

Fact.prototype.period = function (){
    return new Period(this.f.a.p);
}

Fact.prototype.periodString = function() {
    return this.period().toString();
}


Fact.prototype.periodTo = function() {
    return this.period().to();
}

Fact.prototype.periodFrom = function() {
    return this.period().from();
}

Fact.prototype.value = function() {
    return this.f.v;
}

Fact.prototype.readableValue = function() {
    var v = this.f.v;
    if (this.isNumeric()) {
        var d = this.decimals();
        if (d < 0) {
            d = 0;
        }
        if (this.isMonetaryValue()) {
            v = this.unit().valueLabel() + " " + formatNumber(v,d);
        }
        else {
            v = formatNumber(v,d) + " " + this.unit().qname;
        }
    }
    return v;
}

Fact.prototype.unit = function() {
    if (this.f.a.u) {
        return this.aspect("u");
    }
    else {
        return undefined;
    }
}

Fact.prototype.isNumeric = function () {
    return this.unit() !== undefined;
}

Fact.prototype.dimensions = function () {
    var dims = {};
    $.each(this.f.a, function (k,v) {
        if (k.indexOf(":") > -1) {
            dims[k] = v;
        }
    });
    return dims;
}

Fact.prototype.isMonetaryValue = function () {
    var unit = this.unit();
    if (!unit) {
        return false;
    }
    var q = this.report().qname(unit.value());
    return q.namespace == "http://www.xbrl.org/2003/iso4217";
}

Fact.prototype.aspects = function () {
    var aspects = {};
    var fact = this;
    $.each(this.f.a, function (k,v) {
        aspects[k] = fact.aspect(k);
    });
    return aspects;
}

Fact.prototype.aspect = function (a) {
    return new Aspect(a, this.f.a[a], this._report);
}

Fact.prototype.isAligned = function (of, coveredAspects) {
    if (Object.keys(this.f.a).length != Object.keys(of.f.a).length) {
        return false;
    }
    for (var a in this.f.a) {
        if (coveredAspects.hasOwnProperty(a)) {
            /* null => accept any value for this aspect */
            if (coveredAspects[a] !== null) {
                /* if value is an array, it's an array of allowed values */
                if (coveredAspects[a].constructor === Array) {
                    if ($.inArray(this.f.a[a], coveredAspects[a]) == -1) {
                        return false;
                    }
                }
                /* Otherwise a single allowed value */
                else if (this.f.a[a] != coveredAspects[a]) {
                    return false;
                }
            }
        }
        else if (this.f.a[a] != of.f.a[a]) {
            return false;
        }
    }
    return true;
}

Fact.prototype.isEquivalentDuration = function (of) {
    /* Two instants have equivalent duration */
    if (this.periodFrom() == null && of.periodFrom() == null) {
        return true;
    }
    /* One instant, one duration => not equivalent */
    if (this.periodFrom() == null || of.periodFrom() == null) {
        return false;
    }
    var d1 = of.periodTo() - of.periodFrom();
    var d2 = this.periodTo() - this.periodFrom();
    if (Math.abs(d1-d2) < 0.1 * (d1+d2)) {
        return true;
    }
    return false;
}

Fact.prototype.decimals = function () {
    return this.f.d;
}

Fact.prototype.duplicates = function () {
    return this._report.getAlignedFacts(this);
}

Fact.prototype.readableAccuracy = function () {
    if (!this.isNumeric()) {
        return "n/a";
    }
    var d = this.decimals();
    if (d === undefined) {
        return "Infinite precision"
    }
    else if (d === null) {
        return "Unspecified";
    }
    var names = {
        "3": "thousandths",
        "2": "hundredths",
        "0":  "ones",
        "-1":  "tens",
        "-2":  "hundreds",
        "-3":  "thousands",
        "-6":  "millions",
        "-9":  "billions",
    }    
    var name = names[d];
    if (this.isMonetaryValue()) {
        var currency = this.report().qname(this.unit().value()).localname;
        if (d == 2) {
            if (currency == 'USD' || currency == 'EUR' || currency == 'AUD' || currency == 'ZAR') {
                name = "cents";
            }
            else if (currency == 'GBP') {
                name = "pence";
            }
        }
    }
    if (name) {
        d += " ("+name+")";
    }
    return d;
}



