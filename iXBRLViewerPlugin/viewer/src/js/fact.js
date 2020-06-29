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

import { isodateToHuman } from "./util.js"
import { QName } from "./qname.js"
import { Aspect } from "./aspect.js";
import { Period } from './period.js';
import { formatNumber } from "./util.js";
import { Footnote } from "./footnote.js";
import $ from 'jquery'

export function Fact(report, factId) {
    this.f = report.data.facts[factId];
    this._ixNode = report.getIXNodeForItemId(factId);
    this._report = report;
    this.id = factId;
}

Fact.prototype.report = function() {
    return this._report;
}

Fact.prototype.getLabel = function(rolePrefix, withPrefix) {
    return this._report.getLabel(this.f.a.c, rolePrefix, withPrefix);
}

Fact.prototype.conceptName = function() {
    return this.f.a.c;
}

Fact.prototype.concept = function () {
    return this._report.getConcept(this.f.a.c); 
}

Fact.prototype.conceptQName = function() {
    return this._report.qname(this.f.a.c);
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

Fact.prototype.hasValidationResults = function() {
    return "zv" in this.f && this.f.zv.find( function(v) {
        return v["i"] === 2;
    });
}

Fact.prototype.getValidationResults = function() {
    return this.f.zv.map( function (v) { 
        return { ruleId: v["ri"], rule: v["r"], message: v["t"], severity: v["i"] };
    });
}

Fact.prototype.readableValue = function() {
    var v = this.f.v;
    if (this.isNumeric()) {
        var d = this.decimals();
        var formattedNumber;
        if (this.isNil()) {
            formattedNumber = "nil";
        }
        else if (d === undefined) {
            formattedNumber = v;
        }
        else {
            if (d < 0) {
                d = 0;
            }            
            formattedNumber = formatNumber(v,d);
        }
        if (this.isMonetaryValue()) {
            v = this.unit().valueLabel() + " " + formattedNumber;
        }
        else {
            v = formattedNumber + " " + this.unit().valueLabel();
        }
    }
    else if (this.escaped()) {
        var html = $("<div>").append($($.parseHTML(v, null, false)));
        /* Insert an extra space at the beginning and end of block elements to
         * preserve separation of sections of text. */
        html
            .find("p, td, th, h1, h2, h3, h4, ol, ul, pre, blockquote, dl, div")
            .append(document.createTextNode(' '))
            .prepend(document.createTextNode(' '));
        /* Replace runs of whitespace (including nbsp) with a single space */
        v = html.text().replace(/[\u00a0\s]+/g, " ").trim();
    }
    return v;
}

Fact.prototype.unit = function() {
    if (this.isNumeric()) {
        return this.aspect("u");
    }
    else {
        return undefined;
    }
}

Fact.prototype.isNumeric = function () {
    return this.f.a.u !== undefined;
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
    if (!unit || unit.value() === null) {
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
    return this.period().isEquivalentDuration(of.period());
}

Fact.prototype.decimals = function () {
    return this.f.d;
}

Fact.prototype.duplicates = function () {
    return this._report.getAlignedFacts(this);
}

Fact.prototype.isNil = function() {
    return this.f.v === null
}

Fact.prototype.readableAccuracy = function () {
    if (!this.isNumeric() || this.isNil()) {
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
    else {
        d += "";
    }
    return d;
}

Fact.prototype.identifier = function () {
    return this._report.qname(this.f.a.e);
}

Fact.prototype.escaped = function () {
    return this._ixNode.escaped;
}

Fact.prototype.footnotes = function () {
    return $.map(this.f.fn || [], (fn, i) => this._report.getItemById(fn));
}

Fact.prototype.scale = function() {
    var scale = this._ixNode.wrapperNode.find('[scale]').attr('scale');
    if (scale)
        return parseInt(scale); 
}

Fact.prototype.isHidden = function () {
    return this._ixNode.wrapperNode.length == 0;
}

Fact.prototype.widerConcepts = function () {
    var concepts = [];
    const parentsByELR = this._report.getParentRelationships(this.conceptName(), "w-n");
    for (const elr in parentsByELR) {
        concepts.push(...$.map(parentsByELR[elr], (rel) => rel.src));
    }
    return concepts;
}

Fact.prototype.narrowerConcepts = function () {
    var concepts = [];
    const childrenByELR = this._report.getChildRelationships(this.conceptName(), "w-n");
    for (const elr in childrenByELR) {
        concepts.push(...$.map(childrenByELR[elr], (rel) => rel.t));
    }
    return concepts;
}
