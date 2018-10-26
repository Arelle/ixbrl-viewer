import { isodateToHuman } from "./util.js"

export function Period(p) {
    this._p = p;
}

Period.prototype.toString = function() {
    var s;
    if (!this._p) {
        /* forever */
        s = "None";
    }
    else if (!this._p.includes('/')) {
        /* instant */
        s = isodateToHuman(this.to(), true);
    }
    else {
        s = isodateToHuman(this.from(), false) + " to " + isodateToHuman(this.to(), true);
    }
    return s;
}



Period.prototype.to = function() {
    if (this._p.includes('/')) {
        var r = this._p.split('/');
        return new Date(r[1]);
    }
    else {
        return new Date(this._p);
    }
}

Period.prototype.from = function() {
    if (this._p.includes('/')) {
        var r = this._p.split('/');
        return new Date(r[0]);
    }
    return null;
}

