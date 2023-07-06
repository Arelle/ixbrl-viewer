// See COPYRIGHT.md for copyright information

import { xbrlDateToMoment, momentToHuman } from "./util.js"
import moment from "moment";

export class Period {
    constructor(p) {
        this._p = p;
    }

    type() {
        if (!this._p) {
            return undefined;
        }
        if (this._p == 'f') {
            return 'f';
        }
        if (this._p.includes('/')) {
            return 'd';
        }
        return 'i';
    }

    toString() {
        let s;
        if (!this._p) {
            s = "Undefined";
        }
        else if (this._p === 'f') {
            /* forever */
            s = "None";
        }
        else if (!this._p.includes('/')) {
            /* instant */
            s = momentToHuman(this.to(), true);
        }
        else {
            s = momentToHuman(this.from(), false) + " to " + momentToHuman(this.to(), true);
        }
        return s;
    }


    /*
     * Returns the date (instant) or end date (duration) of the period as a moment
     * object
     */
    to() {
        if (this._p && this._p !== 'f') {
            if (this._p.includes('/')) {
                return xbrlDateToMoment(this._p.split('/')[1]);
            }
            else {
                return xbrlDateToMoment(this._p);
            }
        }
        return null;
    }

    /*
     * Returns null (instant) or start date (duration) as a moment object.
     */
    from() {
        if (this._p && this._p.includes('/')) {
            return xbrlDateToMoment(this._p.split('/')[0]);
        }
        return null;
    }

    isEquivalentDuration(op) {
        const t1 = op.type();
        const t2 = this.type();
        /* Undefined periods are never equivalent. */
        if (!t1 || !t2) {
            return false;
        }
        /* Periods must have the same type. */
        if (t1 !== t2) {
            return false;
        }
        /* Instants and forever are equivalent. */
        if (t1 !== 'd') {
            return true;
        }
        const d1 = op.to().toDate() - op.from().toDate();
        const d2 = this.to().toDate() - this.from().toDate();
        if (Math.abs(d1-d2) < 0.1 * (d1+d2)) {
            return true;
        }
        return false;
    }

    key() {
        return this._p;
    }
}
