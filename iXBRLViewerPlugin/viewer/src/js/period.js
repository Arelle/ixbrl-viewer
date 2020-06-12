// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { xbrlDateToMoment, momentToHuman } from "./util.js"
import moment from "moment";

export function Period(p) {
    this._p = p;
}

Period.prototype.type = function() {
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

Period.prototype.toString = function() {
    var s;
    if (!this._p) {
        s = "Undefined";
    }
    else if (this._p == 'f') {
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
Period.prototype.to = function() {
    if (this._p && this._p != 'f') {
        if (this._p.includes('/')) {
            var r = this._p.split('/');
            return xbrlDateToMoment(r[1]);
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
Period.prototype.from = function() {
    if (this._p && this._p.includes('/')) {
        var r = this._p.split('/');
        return xbrlDateToMoment(r[0]);
    }
    return null;
}

Period.prototype.isEquivalentDuration = function (op) {
    var t1 = op.type();
    var t2 = this.type();
    /* Undefined periods are never equivalent. */
    if (!t1 || !t2) {
        return false;
    }
    /* Periods must have the same type. */
    if (t1 !== t2) {
        return false;
    }
    /* Instants and forever are equivalent. */
    if (t1 != 'd') {
        return true;
    }
    var d1 = op.to().toDate() - op.from().toDate();
    var d2 = this.to().toDate() - this.from().toDate();
    if (Math.abs(d1-d2) < 0.1 * (d1+d2)) {
        return true;
    }
    return false;
}

Period.prototype.key = function () {
    return this._p;
}
