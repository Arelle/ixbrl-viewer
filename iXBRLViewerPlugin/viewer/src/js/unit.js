// See COPYRIGHT.md for copyright information

import { measureLabel, NAMESPACE_ISO4217 } from "./util";

export class Unit {
    
    constructor(report, unitKey) {
        this._report = report;
        this._value = unitKey;
        const split = unitKey
                .split(/[()]/ig).join('') // TODO: replace with .replaceAll(/[()]/ig,'') when no longer supporting node 14
                .split('/');
        this._numerators = split[0].split('*');
        this._denominators = split.length > 1 ? split[1].split('*') : [];
        this._isSimple = this._numerators.length === 1 && this._denominators.length === 0;
        this._isMonetary = Boolean(this._numerators.find(n => this._report.qname(n).namespace === NAMESPACE_ISO4217));
        this._label = split
            .map(measure => {
                const part = measure
                    .split('*')
                    .map(x => measureLabel(report, x))
                    .join('*');
                return part.includes('*') ? `(${part})` : part;
            })
            .join('/');
        this._measure = this._numerators[0];
    }


    /**
     * Returns whether any of the numerators are an iso4217 monetary measure.
     * @return {Boolean}
     */
    isMonetary() {
        return this._isMonetary;
    }


    /**
     * Returns whether the unit is a simple measure (single numerator, no denominators).
     * @return {Boolean}
     */
    isSimple() {
        return this._isSimple;
    }

    /**
     * Converts an OIM format unit string into a shorthand, readable unit string
     * @return {String} Unit in readable format
     */
    label() {
        return this._label;
    }

    /**
     * Returns the qname of the first numerator in the unit
     * @return {String} QName string of a measure
     */
    measure() {
        return this._measure;
    }

    /**
     * Returns the OIM format string representing the unit
     * @return {String} OIM format unit string
     */
    value() {
        return this._value;
    }
}

