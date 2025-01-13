// See COPYRIGHT.md for copyright information

import { NAMESPACE_ISO4217 } from "./util";
import i18next from "i18next";
import { utr } from "./utr";

/**
 * Transforms measure qname into title case label (or currency symbol, if applicable).
 * @return {String} Measure Label
 */

function measureLabel(report, measure) {
    const qname = report.qname(measure);
    if (qname.namespace === NAMESPACE_ISO4217) {
        // Prefer a name from our own i18n resources
        const keyi18n = `currencies:unitFormat${qname.localname}`;
        if (i18next.exists(keyi18n)) {
            return i18next.t(keyi18n);
        }
        // Fall back on symbol from UTR ...
        const utrEntry = utr.get(qname);
        if (utrEntry !== undefined) {
            // ... but disambiguate "$" symbol
            return utrEntry.symbol == '$' ? `${qname.localname} $` : utrEntry.symbol;
        }
    }
    if (measure.includes(':')) {
        return measure.split(':')[1];
    }
    return measure;
}

export function measureName(report, measure) {
    const qname = report.qname(measure);
    const utrEntry = utr.get(qname);
    return utrEntry?.name;
}

export class Unit {
    constructor(reportSet, unitKey) {
        this._reportSet = reportSet;
        this._value = unitKey;
        const split = unitKey
                .split(/[()]/ig).join('') // TODO: replace with .replaceAll(/[()]/ig,'') when no longer supporting node 14
                .split('/');
        this._numerators = split[0].split('*');
        this._denominators = split.length > 1 ? split[1].split('*') : [];
        this._isMonetary =
                this._denominators.length === 0 &&
                this._numerators.length === 1 &&
                this._reportSet.qname(this._numerators[0]).namespace === NAMESPACE_ISO4217;
        this._label = split
            .map(measure => {
                const part = measure
                    .split('*')
                    .map(x => measureLabel(this._reportSet, x))
                    .join('*');
                return part.includes('*') ? `(${part})` : part;
            })
            .join('/');
    }

    /**
     * Returns whether any of the numerators are an iso4217 monetary measure.
     * @return {Boolean}
     */
    isMonetary() {
        return this._isMonetary;
    }

    /**
     * Converts an OIM format unit string into a shorthand, readable unit string
     * @return {String} Unit in readable format
     */
    label() {
        return this._label;
    }

    /**
     * Returns the OIM format string representing the unit
     * @return {String} OIM format unit string
     */
    value() {
        return this._value;
    }

    measureHTML(m) {
        const span = document.createElement("span");
        const name = measureName(this._reportSet, m);
        if (name !== undefined) {
            span.setAttribute("title", name);
            span.classList.add("measure");
        }
        span.append(document.createTextNode(measureLabel(this._reportSet, m)));
        return span;
    }

    partsHTML(parts) {
        const span = document.createElement("span");
        if (parts.length > 1) {
            span.appendChild(document.createTextNode("("));
        }
        for (const [i, m] of parts.entries()) {
            span.appendChild(this.measureHTML(m));
            if (i < parts.length - 1) {
                span.appendChild(document.createTextNode(" * "))
            }
        }
        if (parts.length > 1) {
            span.appendChild(document.createTextNode(")"));
        }
        return span;
    }

    html() {
        const span = document.createElement("span");
        span.append(this.partsHTML(this._numerators));
        if (this._denominators.length > 0) {
            span.append(document.createTextNode(" / "));
            span.append(this.partsHTML(this._denominators));
        }
        return span;
    }
}

