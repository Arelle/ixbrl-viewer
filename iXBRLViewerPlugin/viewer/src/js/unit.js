// See COPYRIGHT.md for copyright information

import i18next from "i18next";
import {titleCase} from "./util";

export class Unit {
    
    constructor(report, unitKey) {
        this._report = report;
        this._value = unitKey;
        const split = unitKey
                .split(/[()]/ig).join('') // TODO: replace with .replaceAll(/[()]/ig,'') when no longer supporting node 14
                .split('/');
        this._numerators = split[0].split('*');
        this._denominators = split.length > 1 ? split[1].split('*') : [];
        this._isMonetary = Boolean(this._numerators.find(n => this._report.qname(n).namespace === "http://www.xbrl.org/2003/iso4217"));
        this._label = split.map(x => {
                const part = x.split('*').map(y => {
                    return titleCase(y.split(':')[1]);
                }).join('*');
                return part.includes('*') ? `(${part})` : part;
            }).join('/');
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
     * Returns a readable label representing the first numerator in the unit
     * @return {String} Label representing measure
     */
    measureLabel() {
        const measure = this.measure();
        const qname = this._report.qname(measure);
        if (qname.namespace === "http://www.xbrl.org/2003/iso4217") {
            return i18next.t(`currencies:unitFormat${qname.localname}`, {defaultValue: qname.localname});
        }
        return measure;
    }

    /**
     * Returns the OIM format string representing the unit
     * @return {String} OIM format unit string
     */
    value() {
        return this._value;
    }
}

