// See COPYRIGHT.md for copyright information

import { measureLabel, NAMESPACE_ISO4217 } from "./util";

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
}

