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

Period.prototype.isEquivalentDuration = function (op) {
    /* Two instants have equivalent duration */
    if (this.from() == null && op.from() == null) {
        return true;
    }
    /* One instant, one duration => not equivalent */
    if (this.from() == null || op.from() == null) {
        return false;
    }
    var d1 = op.to() - op.from();
    var d2 = this.to() - this.from();
    if (Math.abs(d1-d2) < 0.1 * (d1+d2)) {
        return true;
    }
    return false;
}
