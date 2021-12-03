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
import i18next from "i18next";

export function Fact(report, factId) {
    this.f = report.data.facts[factId];
    this.ixNode = report.getIXNodeForItemId(factId);
    this._report = report;
    this.id = factId;
}

Fact.prototype.report = function() {
    return this._report;
}

Fact.prototype.getLabel = function(rolePrefix, withPrefix) {
    return this._report.getLabel(this.f.a.c, rolePrefix, withPrefix);
}

Fact.prototype.getLabelOrName = function(rolePrefix, withPrefix) {
    return this._report.getLabelOrName(this.f.a.c, rolePrefix, withPrefix);
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

Fact.prototype.readableValue = function() {
    var v = this.f.v;
    if (this.isInvalidIXValue()) {
        v = "Invalid value";
    }
    else if (this.isNumeric()) {
        var d = this.decimals();
        var formattedNumber;
        if (this.isNil()) {
            formattedNumber = "nil";
        }
        else {
            formattedNumber = formatNumber(v,d);
        }
        if (this.isMonetaryValue()) {
            v = this.unit().valueLabel() + " " + formattedNumber;
        }
        else {
            v = formattedNumber + " " + this.unit().valueLabel();
        }
    }
    else if (this.isNil()) {
        v = "nil";
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
    else if (this.isEnumeration()) {
        var labels = [];
        for (const qn of v.split(' ')) {
            labels.push(this._report.getLabelOrName(qn, 'std'));
        }
        v = labels.join(', ');
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
    return Object.keys(this.f.a).map(k => this.aspect(k));
}

Fact.prototype.aspect = function (a) {
    if (this.f.a[a] !== undefined) {
        return new Aspect(a, this.f.a[a], this._report);
    }
    return undefined;
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

Fact.prototype.isInvalidIXValue = function() {
    return this.f.err == 'INVALID_IX_VALUE';
}

Fact.prototype.readableAccuracy = function () {
    if (!this.isNumeric() || this.isNil()) {
        return i18next.t("common.notApplicable");
    }
    var d = this.decimals();
    if (d === undefined) {
        return i18next.t("common.accuracyInfinite")
    }
    else if (d === null) {
        return i18next.t("common.unspecified");
    }
    var name = i18next.t(`currencies:accuracy${d}`, {defaultValue:"noName"});
    if (this.isMonetaryValue()) {
        var currency = this.report().qname(this.unit().value()).localname;
        if (d == 2) {
            var name = i18next.t(`currencies:cents${currency}`, {defaultValue: name});
        }
    }
    if (name !== "noName") {
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
    return this.ixNode.escaped;
}

Fact.prototype.isEnumeration = function() {
    return this.concept().isEnumeration();
}

Fact.prototype.footnotes = function () {
    return $.map(this.f.fn || [], (fn, i) => this._report.getItemById(fn));
}

Fact.prototype.isHidden = function () {
    return this.ixNode.wrapperNode.length == 0;
}

Fact.prototype.isHTMLHidden = function () {
    return this.ixNode.htmlHidden;
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
