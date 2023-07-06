// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import i18next from "i18next";
import { Aspect } from "./aspect.js";
import { Period } from './period.js';
import { formatNumber } from "./util.js";
import Decimal from "decimal.js";

export class Fact {
    
    constructor(report, factId) {
        this.f = report.data.facts[factId];
        this.ixNode = report.getIXNodeForItemId(factId);
        this._report = report;
        this.id = factId;
        this.linkedFacts = [];
    }

    report() {
        return this._report;
    }

    getLabel(rolePrefix, withPrefix) {
        return this._report.getLabel(this.f.a.c, rolePrefix, withPrefix);
    }

    getLabelOrName(rolePrefix, withPrefix) {
        return this._report.getLabelOrName(this.f.a.c, rolePrefix, withPrefix);
    }

    conceptName() {
        return this.f.a.c;
    }

    concept() {
        return this._report.getConcept(this.f.a.c); 
    }

    conceptQName() {
        return this._report.qname(this.f.a.c);
    }

    period(){
        return new Period(this.f.a.p);
    }

    periodString() {
        return this.period().toString();
    }


    periodTo() {
        return this.period().to();
    }

    periodFrom() {
        return this.period().from();
    }

    value() {
        return this.f.v;
    }

    readableValue() {
        let v = this.f.v;
        if (this.isInvalidIXValue()) {
            v = "Invalid value";
        }
        else if (this.isNumeric()) {
            const d = this.decimals();
            let formattedNumber;
            if (this.isNil()) {
                formattedNumber = "nil";
            }
            else {
                formattedNumber = formatNumber(v, d);
            }
            if (this.isMonetaryValue()) {
                v = this.measureLabel() + " " + formattedNumber;
            }
            else {
                v = formattedNumber + " " + this.measureLabel();
            }
        }
        else if (this.isNil()) {
            v = "nil";
        }
        else if (this.escaped()) {
            const html = $("<div>").append($($.parseHTML(v, null, false)));
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
            const labels = [];
            for (const qn of v.split(' ')) {
                labels.push(this._report.getLabelOrName(qn, 'std'));
            }
            v = labels.join(', ');
        }
        return v;
    }

    /**
     * Returns the qname of the first numerator in the fact's unit
     * @return {String} QName string of a measure
     */
    measure() {
        return this.unit()?.measure();
    }

    /**
     * Returns a readable label representing the first numerator in the fact's unit
     * @return {String} Label representing measure
     */
    measureLabel() {
        return this.unit()?.measureLabel() ?? i18next.t("factDetails.noUnit");
    }

    /**
     * Returns details about this fact's unit
     * @return {Unit} Unit instance
     */
    unit() {
        if (this._unit === undefined) {
            const unitKey = this.aspect('u')?.value();
            if (!unitKey) {
                return undefined;
            }
            this._unit = this.report().getUnit(unitKey);
        }
        return this._unit;
    }

    getConceptPrefix() {
        return this.conceptName().split(':')[0];
    }

    isCalculationContributor() {
        if (this._isCalculationContributor === undefined) {
            this._isCalculationContributor = this._report.isCalculationContributor(this.f.a.c);
        }
        return this._isCalculationContributor;
    }

    isCalculationSummation() {
        if (this._isCalculationSummation === undefined) {
            this._isCalculationSummation = this._report.isCalculationSummation(this.f.a.c);
        }
        return this._isCalculationSummation;
    }

    isNumeric() {
        return this.f.a.u !== undefined;
    }

    dimensions() {
        const dims = {};
        for (const [k, v] of Object.entries(this.f.a)) {
            if (k.indexOf(":") > -1) {
                dims[k] = v;
            }
        }
        return dims;
    }

    hasExplicitDimension() {
        return Object.keys(this.dimensions()).some(d => !this._report.getConcept(d).isTypedDimension());
    }

    hasTypedDimension() {
        return Object.keys(this.dimensions()).some(d => this._report.getConcept(d).isTypedDimension());
    }

    isMonetaryValue() {
        return this.unit()?.isMonetary() ?? false;
    }

    isTextBlock() {
        return this.concept().isTextBlock();
    }

    aspects() {
        return Object.keys(this.f.a).map(k => this.aspect(k));
    }

    aspect(a) {
        if (this._aspects === undefined) {
            this._aspects = {}
        }
        if (this._aspects[a] === undefined) {
            if (this.f.a[a] !== undefined) {
                this._aspects[a] = new Aspect(a, this.f.a[a], this._report);
            }
        }
        return this._aspects[a];
    }

    isAligned(of, coveredAspects) {
        if (Object.keys(this.f.a).length != Object.keys(of.f.a).length) {
            return false;
        }
        for (const a in this.f.a) {
            if (coveredAspects.hasOwnProperty(a)) {
                /* null => accept any value for this aspect */
                if (coveredAspects[a] !== null) {
                    /* if value is an array, it's an array of allowed values */
                    if (coveredAspects[a].constructor === Array) {
                        if (!coveredAspects[a].includes(this.f.a[a])) {
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

    isEquivalentDuration(of) {
        return this.period().isEquivalentDuration(of.period());
    }

    decimals() {
        return this.f.d;
    }

    scale() {
        return this.ixNode.scale;
    }

    duplicates() {
        return this._report.getAlignedFacts(this);
    }

    isNil() {
        return this.f.v === null;
    }
    isNegative() {
        return this.isNumeric() && !this.isNil() && this.value() !== undefined && new Decimal(this.value()).isNegative() && !this.isZero();
    }
    isPositive() {
        return this.isNumeric() && !this.isNil() && this.value() !== undefined && new Decimal(this.value()).isPositive() && !this.isZero();
    }

    isZero() {
        return this.isNumeric() && !this.isNil() && this.value() !== undefined && new Decimal(this.value()).isZero();
    }
    isInvalidIXValue() {
        return this.f.err == 'INVALID_IX_VALUE';
    }

    getScaleLabel(value, isAccuracy=false) {
        let measure = this.measure() ?? '';
        if (measure) {
            measure = this.report().qname(measure).localname;
        }
        return this._report.getScaleLabel(
                // We use the same table of labels for scale and accuracy,
                // but decimals means "accurate to 10^-N" whereas scale means 10^N,
                // so invert N for accuracy.
                isAccuracy ? -value : value,
                this.isMonetaryValue(),
                measure
        );
    }

    readableAccuracy() {
        if (!this.isNumeric() || this.isNil()) {
            return i18next.t("common.notApplicable");
        }
        const d = this.decimals();
        if (d === undefined) {
            return i18next.t("common.accuracyInfinite")
        }
        else if (d === null) {
            return i18next.t("common.unspecified");
        }
        const label = this.getScaleLabel(d, true);
        if (label != null) {
            return label;
        }
        return d.toString();
    }

    readableScale() {
        if (!this.isNumeric() || this.isNil()) {
            return i18next.t("common.notApplicable");
        }
        const scale = this.scale();
        if (scale === undefined || scale === null) {
            return i18next.t("common.unscaled");
        }
        const label = this.getScaleLabel(scale);
        if (label != null) {
            return label;
        }
        return scale.toString();
    }

    identifier() {
        return this._report.qname(this.f.a.e);
    }

    escaped() {
        return this.ixNode.escaped;
    }

    isEnumeration() {
        return this.concept().isEnumeration();
    }

    footnotes() {
        return (this.f.fn || []).map((fn, i) => this._report.getItemById(fn));
    }

    isHidden() {
        return this.ixNode.isHidden;
    }

    isHTMLHidden() {
        return this.ixNode.htmlHidden();
    }

    widerConcepts() {
        const concepts = [];
        const parentsByELR = this._report.getParentRelationships(this.conceptName(), "w-n");
        for (const elr in parentsByELR) {
            concepts.push(...$.map(parentsByELR[elr], (rel) => rel.src));
        }
        return concepts;
    }

    narrowerConcepts() {
        const concepts = [];
        const childrenByELR = this._report.getChildRelationships(this.conceptName(), "w-n");
        for (const elr in childrenByELR) {
            concepts.push(...$.map(childrenByELR[elr], (rel) => rel.t));
        }
        return concepts;
    }

    // Facts that are the source of relationships to this fact.
    addLinkedFact(f) {
        this.linkedFacts.push(f);
    }
}

