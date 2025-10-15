// See COPYRIGHT.md for copyright information

import { Period } from './period.js';
import { Identifiers } from './identifiers.js';

const aspectLabelMap = {
    'c': 'Concept',
    'e': 'Entity',
    'p': 'Period',
    'u': 'Unit',
}

export class Aspect {
    constructor(a, v, report) {
        this._aspect = a;
        this._value = v;
        this._report = report;
    }

    name() {
        return this._aspect;
    }

    label() {
        return aspectLabelMap[this._aspect] ?? this._report.getLabel(this._aspect);
    }

    labelOrNameAndLang() {
        if (this._aspect in aspectLabelMap) {
            return {label: aspectLabelMap};
        }
        return this._report.getLabelOrNameAndLang(this._aspect);
    }

    value() {
        return this._value;
    }

    equalTo(a) {
        return a !== undefined && this._aspect === a._aspect && this._value === a._value;
    }

    /**
     * Compares this Aspect to another
     *
     *
     * @param {Aspect} b - The Aspect instance to compare against.
     * @returns {number} - Negative if this < b, positive if this > b, zero if
     * equal.
     */
    compareTo(b) {
        return this._aspect.localeCompare(b._aspect);
    }

    isTaxonomyDefined() {
        return this._aspect.includes(":");
    }

    isNil() {
        return this._value === null;
    }

    valueLabel(rolePrefix) {
        return this.valueLabelAndLang(rolePrefix).label;
    }

    valueLabelAndLang(rolePrefix) {
        if (this._aspect === 'c') {
            return this._report.getLabelOrNameAndLang(this._value, rolePrefix);
        }
        if (this.isTaxonomyDefined()) {
            if (this._report.getConcept(this._aspect).isTypedDimension()) {
                return {label: (this._value === null ? "nil" : this._value)};
            }
            return this._report.getLabelOrNameAndLang(this._value, rolePrefix);
        }
        else if (this._aspect === 'u') {
            return {label: this._report.reportSet.getUnit(this._value).label()};
        }
        else if (this._aspect === 'p') {
            const p = new Period(this._value);
            return {label: p.toString()};
        }
        else if (this._aspect === 'e') {
            return {label: Identifiers.readableName(this._report.qname(this._value))};
        }
        else {
            return {label: this._value};
        }
    }
}


/* AspectSet is used to obtain a list of unique aspect values */

export class AspectSet {
    constructor(as) {
        this._aspectSet = as || [];
    }

    add(a) {
        this._aspectSet.push(a);
    }

    uniqueValues() {
        let x = {};
        for (const v of Object.values(this._aspectSet)) {
            x[v.value()] = v;
        }
        return Object.values(x); 
    }
}


