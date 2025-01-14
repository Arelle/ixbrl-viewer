// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import i18next from "i18next";
import { Aspect } from "./aspect.js";
import { Period } from './period.js';
import { formatNumber, localId } from "./util.js";
import Decimal from "decimal.js";
import { Interval } from './interval.js';

export class Fact {
    
    constructor(report, factId, factData) {
        this.f = factData;
        this.ixNode = report.reportSet.getIXNodeForItemId(factId);
        this.report = report;
        this.vuid = factId;
        this.linkedFacts = [];
        this._footnotes = [];
    }

    localId() {
        return localId(this.vuid);
    }

    isMandatory() {
        return this.f.a.m
    }

    getLabel(rolePrefix, withPrefix) {
        return this.report.getLabel(this.f.a.c, rolePrefix, withPrefix);
    }

    getLabelAndLang(rolePrefix, withPrefix) {
        return this.report.getLabelAndLang(this.f.a.c, rolePrefix, withPrefix);
    }

    getLabelOrName(rolePrefix, withPrefix) {
        return this.report.getLabelOrName(this.f.a.c, rolePrefix, withPrefix);
    }

    getLabelOrNameAndLang(rolePrefix, withPrefix) {
        return this.report.getLabelOrNameAndLang(this.f.a.c, rolePrefix, withPrefix);
    }

    conceptName() {
        return this.f.a.c;
    }

    conceptDisplayName() {
        return this.report.reportSet.taxonomyNamer.convertQName(this.conceptQName());
    }

    concept() {
        return this.report.getConcept(this.f.a.c); 
    }

    conceptQName() {
        return this.report.qname(this.f.a.c);
    }

    period() {
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

    readableValue(val) {
        return this.readableValueHTML(val).textContent;
    }

    readableValueHTML(val) {
        let v = val === undefined ? this.f.v : val;
        const span = document.createElement("span");
        span.classList.add("fact-value");
        if (this.isInvalidIXValue()) {
            span.classList.add("fact-value-invalid");
            span.append(document.createTextNode("Invalid value"));
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
                span.append(this.unitLabelHTML());
                span.append(document.createTextNode(" " + formattedNumber));
            }
            else {
                span.append(document.createTextNode(formattedNumber + " "));
                span.append(this.unitLabelHTML());
            }
        }
        else if (this.isNil()) {
            span.classList.add("fact-value-nil");
            span.append(document.createTextNode("nil"));
        }
        else if (this.isTextBlock()) {
            const html = $("<div>").append($($.parseHTML(v, null, false)));
            /* Insert an extra space at the beginning and end of block elements to
             * preserve separation of sections of text. */
            html
                .find("p, td, th, h1, h2, h3, h4, ol, ul, pre, blockquote, dl, div")
                .append(document.createTextNode(' '))
                .prepend(document.createTextNode(' '));
            /* Replace runs of whitespace (including nbsp) with a single space */
            v = html.text().replace(/[\u00a0\s]+/g, " ").trim();
            span.append(document.createTextNode(v));
        }
        else if (this.isEnumeration()) {
            const labels = [];
            for (const qn of v.split(' ')) {
                labels.push(this.report.getLabelOrName(qn, 'std'));
            }
            v = labels.join(', ');
            span.append(document.createTextNode(v));
        }
        else {
            span.append(document.createTextNode(v));
        }
        return span;
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
            this._unit = this.report.reportSet.getUnit(unitKey);
        }
        return this._unit;
    }

    /**
     * Returns a readable label representing the fact's unit
     * @return {String} Label representing unit
     */
    unitLabel() {
        return this.unit()?.label() ?? i18next.t("factDetails.noUnit");
    }

    unitLabelHTML() {
        return this.unit()?.html() ?? document.createTextNode(i18next.t("factDetails.noUnit"));
    }

    getConceptPrefix() {
        return this.conceptName().split(':')[0];
    }

    isCalculationContributor() {
        if (this._isCalculationContributor === undefined) {
            this._isCalculationContributor = this.report.isCalculationContributor(this.f.a.c);
        }
        return this._isCalculationContributor;
    }

    isCalculationSummation() {
        if (this._isCalculationSummation === undefined) {
            this._isCalculationSummation = this.report.isCalculationSummation(this.f.a.c);
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
        return Object.keys(this.dimensions()).some(d => !this.report.getConcept(d).isTypedDimension());
    }

    hasTypedDimension() {
        return Object.keys(this.dimensions()).some(d => this.report.getConcept(d).isTypedDimension());
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
                this._aspects[a] = new Aspect(a, this.f.a[a], this.report);
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
        return this.report.getAlignedFacts(this);
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
        return this.report.getScaleLabel(
                // We use the same table of labels for scale and accuracy,
                // but decimals means "accurate to 10^-N" whereas scale means 10^N,
                // so invert N for accuracy.
                isAccuracy ? -value : value,
                this.unit()
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
        return this.report.qname(this.f.a.e);
    }

    escaped() {
        return this.ixNode.escaped;
    }

    isEnumeration() {
        return this.concept().isEnumeration();
    }

    addFootnote(fn) {
        this._footnotes.push(fn);
    }

    footnotes() {
        return this._footnotes;
    }

    isHidden() {
        return this.ixNode.isHidden;
    }

    isHTMLHidden() {
        return this.ixNode.htmlHidden();
    }

    widerConcepts() {
        const concepts = [];
        const parentsByELR = this.report.getParentRelationships(this.conceptName(), "w-n");
        for (const elr in parentsByELR) {
            concepts.push(...$.map(parentsByELR[elr], (rel) => rel.src));
        }
        return concepts;
    }

    narrowerConcepts() {
        const concepts = [];
        const childrenByELR = this.report.getChildRelationships(this.conceptName(), "w-n");
        for (const elr in childrenByELR) {
            concepts.push(...$.map(childrenByELR[elr], (rel) => rel.t));
        }
        return concepts;
    }

    /*
     * Facts that are the source of relationships to this fact.
     */
    addLinkedFact(f) {
        this.linkedFacts.push(f);
    }

    /*
     * Returns the fact's value, rounded according to the value of its decimals
     * property.  This is an odd thing to do, as it implies that more figures
     * were reported than the decimals property suggest are accurate, but this
     * is required for Calc 1.0 validation.
     *
     * valueInterval() is a more meaningful.
     */
    roundedValue() {
        Decimal.rounding = Decimal.ROUND_HALF_UP;
        const v = new Decimal(this.value());
        const d = this.decimals();
        if (d === undefined) {
            return v;
        }
        return v.mul(10 ** d).round().mul(10 ** (0-d));
    }

    isCompleteDuplicate(other) {
        return this.value() === other.value() && this.decimals() === other.decimals();
    }

    /*
     * Facts that are the source of relationships to this fact.
     */
    addLinkedFact(f) {
        this.linkedFacts.push(f);
    }

    /*
     * Returns an Interval for the fact's value, as implied by its decimals
     * property.
     */
    valueInterval() {
        return Interval.fromFact(this);
    }

    isMorePrecise(of) {
        // decimals of "undefined" indicates infinite precision
        if (of.decimals() === undefined) {
            return false;
        }
        if (this.decimals() === undefined) {
            return true;
        }
        return this.decimals() > of.decimals();
    }

    targetDocument() {
        return this.report.targetDocument();
    }
}
