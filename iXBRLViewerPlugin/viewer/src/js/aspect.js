// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import i18next from 'i18next';
import { QName } from './qname.js';
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

    value() {
        return this._value;
    }

    equalTo(a) {
        return a !== undefined && this._aspect === a._aspect && this._value === a._value;
    }


    isTaxonomyDefined() {
        return this._aspect.includes(":");
    }

    isNil() {
        return this._value === null;
    }

    valueLabel(rolePrefix) {
        if (this._aspect === 'c') {
            return this._report.getLabel(this._value, rolePrefix) || this._value;
        }
        if (this.isTaxonomyDefined()) {
            if (this._report.getConcept(this._aspect).isTypedDimension()) {
                return this._value === null ? "nil" : this._value;
            }
            return this._report.getLabel(this._value, rolePrefix) || this._value;
        }
        else if (this._aspect === 'u') {
            return this._report.getUnit(this._value).measureLabel();
        }
        else if (this._aspect === 'p') {
            const p = new Period(this._value);
            return p.toString();
        }
        else if (this._aspect === 'e') {
            return Identifiers.readableName(this._report.qname(this._value));
        }
        else {
            return this._value;
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


